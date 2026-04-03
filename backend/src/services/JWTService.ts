import jwt from 'jsonwebtoken';
import { AUTH_ENV } from '../config/env';

const JWT_SECRET = AUTH_ENV.jwtSecret;
const JWT_EXPIRES_IN = AUTH_ENV.jwtExpiresIn;
const REFRESH_TOKEN_EXPIRES_IN = AUTH_ENV.refreshTokenExpiresIn;
const PASSWORD_RESET_SECRET = AUTH_ENV.passwordResetSecret;
const PASSWORD_RESET_EXPIRES_IN = AUTH_ENV.passwordResetExpiresIn;

export interface JWTPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
}

export interface PasswordResetTokenPayload {
  userId: string;
  email: string;
  passwordHashDigest: string;
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function generatePasswordResetToken(payload: PasswordResetTokenPayload): string {
  return jwt.sign(payload, PASSWORD_RESET_SECRET, { expiresIn: PASSWORD_RESET_EXPIRES_IN });
}

export function verifyPasswordResetToken(token: string): PasswordResetTokenPayload {
  return jwt.verify(token, PASSWORD_RESET_SECRET) as PasswordResetTokenPayload;
}

export function decodeToken(token: string): JWTPayload | null {
  return jwt.decode(token) as JWTPayload | null;
}

export function getTokenExpiration(token: string): Date | null {
  const decoded = jwt.decode(token, { complete: true });
  if (decoded && typeof decoded.payload === 'object' && decoded.payload.exp) {
    return new Date(decoded.payload.exp * 1000);
  }
  return null;
}
