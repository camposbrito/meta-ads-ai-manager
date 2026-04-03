import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import sequelize from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { User, Organization, RefreshToken } from '../models';
import {
  generateAccessToken,
  generatePasswordResetToken,
  generateRefreshToken,
  getTokenExpiration,
  JWTPayload,
  verifyPasswordResetToken,
  verifyToken,
} from './JWTService';
import { hashPassword, comparePassword } from './PasswordService';
import emailService from './EmailService';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  organizationName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface PasswordResetRequestResult {
  resetToken?: string;
  resetUrl?: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const transaction = await sequelize.transaction();

    try {
      // Check if user already exists
      const existingUser = await User.findOne({ where: { email: input.email } });
      if (existingUser) {
        throw new AppError('Email already registered', 409);
      }

      // Create organization
      const organization = await Organization.create(
        {
          id: uuidv4(),
          name: input.organizationName,
          slug: this.generateSlug(input.organizationName),
          plan: 'free',
          max_ad_accounts: 1,
          max_daily_syncs: 1,
          is_active: true,
        },
        { transaction }
      );

      // Create user
      const passwordHash = await hashPassword(input.password);
      const user = await User.create(
        {
          id: uuidv4(),
          organization_id: organization.id,
          email: input.email,
          password_hash: passwordHash,
          name: input.name,
          role: 'admin',
          is_active: true,
        },
        { transaction }
      );

      await transaction.commit();

      // Generate tokens
      const tokens = await this.generateTokens(user, organization);

      return { user, tokens };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await User.findOne({
      where: { email: input.email, is_active: true },
      include: [{ model: Organization, as: 'organization', where: { is_active: true } }],
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValidPassword = await comparePassword(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Update last login
    await user.update({ last_login_at: new Date() });

    // Generate tokens
    const tokens = await this.generateTokens(user, user.organization!);

    return { user, tokens };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      verifyToken(refreshToken);

      // Check if token exists and is not revoked
      const tokenHash = this.hashToken(refreshToken);
      const storedToken = await RefreshToken.findOne({
        where: { token_hash: tokenHash, revoked_at: null },
        include: [
          {
            model: User,
            as: 'user',
            include: [{ model: Organization, as: 'organization', where: { is_active: true } }],
          },
        ],
      });

      if (!storedToken || storedToken.expires_at < new Date()) {
        throw new AppError('Invalid or expired refresh token', 401);
      }

      const user = storedToken.user;
      if (!user) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken({
        userId: user.id,
        organizationId: user.organization_id,
        email: user.email,
        role: user.role,
      });

      const newRefreshToken = generateRefreshToken({
        userId: user.id,
        organizationId: user.organization_id,
        email: user.email,
        role: user.role,
      });

      // Revoke old token
      await storedToken.update({ revoked_at: new Date() });

      // Store new refresh token
      await RefreshToken.create({
        id: uuidv4(),
        user_id: user.id,
        token_hash: this.hashToken(newRefreshToken),
        expires_at: this.getRefreshTokenExpiration(newRefreshToken),
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('Invalid refresh token', 401);
    }
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await RefreshToken.update({ revoked_at: new Date() }, { where: { token_hash: tokenHash } });
  }

  async logoutAll(userId: string): Promise<void> {
    await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: userId } });
  }

  async requestPasswordReset(email: string): Promise<PasswordResetRequestResult> {
    const user = await User.findOne({ where: { email, is_active: true } });

    if (!user) {
      return {};
    }

    const resetToken = generatePasswordResetToken({
      userId: user.id,
      email: user.email,
      passwordHashDigest: this.hashToken(user.password_hash),
    });

    const resetUrl = this.buildPasswordResetUrl(resetToken);
    const emailSent = await emailService.sendPasswordResetEmail(user.email, resetUrl);

    if (process.env.NODE_ENV !== 'production') {
      console.info(`[AuthService] Password reset URL for ${user.email}: ${resetUrl}`);
      return { resetToken, resetUrl };
    }

    if (!emailSent) {
      console.warn(
        '[AuthService] SMTP is not configured. Password reset email was not sent in production mode.'
      );
    }

    return {};
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    if (input.password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400);
    }

    let payload;
    try {
      payload = verifyPasswordResetToken(input.token);
    } catch (error) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const user = await User.findOne({
      where: { id: payload.userId, email: payload.email, is_active: true },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const currentPasswordDigest = this.hashToken(user.password_hash);
    if (currentPasswordDigest !== payload.passwordHashDigest) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const samePassword = await comparePassword(input.password, user.password_hash);
    if (samePassword) {
      throw new AppError('New password must be different from the current password', 400);
    }

    const passwordHash = await hashPassword(input.password);
    const transaction = await sequelize.transaction();

    try {
      await user.update({ password_hash: passwordHash }, { transaction });

      await RefreshToken.update(
        { revoked_at: new Date() },
        { where: { user_id: user.id, revoked_at: null }, transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async generateTokens(user: User, organization: Organization): Promise<AuthTokens> {
    const payload: JWTPayload = {
      userId: user.id,
      organizationId: organization.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token
    await RefreshToken.create({
      id: uuidv4(),
      user_id: user.id,
      token_hash: this.hashToken(refreshToken),
      expires_at: this.getRefreshTokenExpiration(refreshToken),
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiration(token: string): Date {
    const expiration = getTokenExpiration(token);

    if (!expiration) {
      throw new AppError('Invalid refresh token expiration', 500);
    }

    return expiration;
  }

  private buildPasswordResetUrl(token: string): string {
    const frontendUrl = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(
      /\/+$/,
      ''
    );
    return `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substring(2, 7);
  }
}

export default new AuthService();
