import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

type AuthenticatedUser = NonNullable<AuthRequest['user']>;

export function requireAuth(req: AuthRequest): AuthenticatedUser {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  return req.user;
}

export function requireAdmin(req: AuthRequest): AuthenticatedUser {
  const user = requireAuth(req);

  if (user.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  return user;
}

export function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(`${fieldName} is required`, 400);
  }

  return value.trim();
}

export function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new AppError(`${fieldName} must be a boolean`, 400);
  }

  return value;
}

export function parsePositiveInt(
  value: unknown,
  fieldName: string,
  fallback: number,
  options: { min?: number; max?: number } = {}
): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);

  if (Number.isNaN(parsed)) {
    throw new AppError(`${fieldName} must be a valid integer`, 400);
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new AppError(`${fieldName} must be greater than or equal to ${options.min}`, 400);
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new AppError(`${fieldName} must be less than or equal to ${options.max}`, 400);
  }

  return parsed;
}

export function requireArray<T>(value: unknown, fieldName: string): T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(`${fieldName} must be a non-empty array`, 400);
  }

  return value as T[];
}
