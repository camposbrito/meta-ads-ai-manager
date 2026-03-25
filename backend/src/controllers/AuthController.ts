import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import authService from '../services/AuthService';
import { requireAuth, requireString } from '../utils/request';

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
    const user = requireAuth(req);

    res.json({
      user: {
        id: user.userId,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    });
  }
}

export default new AuthController();
