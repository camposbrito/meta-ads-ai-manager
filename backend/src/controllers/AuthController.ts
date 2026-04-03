import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import authService from '../services/AuthService';
import { requireAuth, requireString } from '../utils/request';
import { User, Organization } from '../models';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const email = requireString(req.body.email, 'email');
    const password = requireString(req.body.password, 'password');
    const name = requireString(req.body.name, 'name');
    const organizationName = requireString(req.body.organizationName, 'organizationName');

    const result = await authService.register({ email, password, name, organizationName });

    res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        organization: {
          id: result.user.organization!.id,
          name: result.user.organization!.name,
          plan: result.user.organization!.plan,
        },
      },
      tokens: result.tokens,
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const email = requireString(req.body.email, 'email');
    const password = requireString(req.body.password, 'password');

    const result = await authService.login({ email, password });

    res.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        organization: {
          id: result.user.organization!.id,
          name: result.user.organization!.name,
          plan: result.user.organization!.plan,
        },
      },
      tokens: result.tokens,
    });
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const refreshToken = requireString(req.body.refreshToken, 'refreshToken');
    const tokens = await authService.refreshTokens(refreshToken);
    res.json({ tokens });
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const email = requireString(req.body.email, 'email');
    const result = await authService.requestPasswordReset(email);
    res.json({
      message: 'If an account with this email exists, a password reset link has been sent.',
      ...result,
    });
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    const token = requireString(req.body.token, 'token');
    const password = requireString(req.body.password, 'password');

    await authService.resetPassword({ token, password });

    res.json({ message: 'Password reset successfully' });
  }

  async logout(req: AuthRequest, res: Response): Promise<void> {
    const refreshToken = req.body.refreshToken;

    if (typeof refreshToken === 'string' && refreshToken.trim() !== '') {
      await authService.logout(refreshToken);
    }

    res.json({ message: 'Logged out successfully' });
  }

  async logoutAll(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    await authService.logoutAll(user.userId);
    res.json({ message: 'Logged out from all devices' });
  }

  async me(req: AuthRequest, res: Response): Promise<void> {
    const authUser = requireAuth(req);
    const user = await User.findByPk(authUser.userId, {
      include: [
        {
          model: Organization,
          as: 'organization',
          attributes: ['id', 'name', 'plan', 'max_ad_accounts', 'max_daily_syncs', 'subscription_status', 'subscription_ends_at'],
        },
      ],
      attributes: ['id', 'email', 'name', 'role', 'organization_id'],
    });

    if (!user || !user.organization) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          plan: user.organization.plan,
          max_ad_accounts: user.organization.max_ad_accounts,
          max_daily_syncs: user.organization.max_daily_syncs,
          subscription_status: user.organization.subscription_status,
          subscription_ends_at: user.organization.subscription_ends_at,
        },
      },
    });
  }
}

export default new AuthController();
