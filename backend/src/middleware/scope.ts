import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function scopeToOrganization(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Add organization ID to query for scoping
  req.organizationId = req.user.organizationId;
  next();
}

declare module 'express' {
  interface Request {
    organizationId?: string;
  }
}
