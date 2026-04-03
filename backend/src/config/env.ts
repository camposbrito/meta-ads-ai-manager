import type { SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

interface RequiredEnvOptions {
  minLength?: number;
  forbiddenValues?: string[];
}

function requireEnv(name: string, options: RequiredEnvOptions = {}): string {
  const rawValue = process.env[name];

  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    throw new Error(`[ENV] ${name} is required.`);
  }

  const value = rawValue.trim();

  if (options.minLength && value.length < options.minLength) {
    throw new Error(`[ENV] ${name} must be at least ${options.minLength} characters long.`);
  }

  const forbiddenValues = new Set((options.forbiddenValues || []).map((item) => item.toLowerCase()));
  if (forbiddenValues.has(value.toLowerCase())) {
    throw new Error(`[ENV] ${name} is using an insecure placeholder value.`);
  }

  return value;
}

const jwtSecret = requireEnv('JWT_SECRET', {
  minLength: 32,
  forbiddenValues: [
    'default-jwt-secret-change-in-production',
    'your-jwt-secret-change-in-production',
  ],
});

const encryptionKey = requireEnv('ENCRYPTION_KEY', {
  minLength: 16,
  forbiddenValues: ['default-key-change-in-production', 'your-encryption-key-change-in-production'],
});

const passwordResetSecret = (process.env.PASSWORD_RESET_SECRET || jwtSecret).trim();

if (passwordResetSecret.length < 32) {
  throw new Error('[ENV] PASSWORD_RESET_SECRET must be at least 32 characters long.');
}

if (passwordResetSecret.toLowerCase() === 'your-password-reset-secret-change-in-production') {
  throw new Error('[ENV] PASSWORD_RESET_SECRET is using an insecure placeholder value.');
}

const passwordResetExpiresIn = (process.env.PASSWORD_RESET_EXPIRES_IN || '1h').trim();
const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || '15m').trim();
const refreshTokenExpiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d').trim();

export const AUTH_ENV = {
  jwtSecret,
  encryptionKey,
  passwordResetSecret,
  jwtExpiresIn: jwtExpiresIn as SignOptions['expiresIn'],
  refreshTokenExpiresIn: refreshTokenExpiresIn as SignOptions['expiresIn'],
  passwordResetExpiresIn: passwordResetExpiresIn as SignOptions['expiresIn'],
};
