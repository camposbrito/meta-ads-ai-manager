import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import authService from '../services/AuthService';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, organizationName } = req.body;

      if (!email || !password || !name || !organizationName) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

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
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

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
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token required' });
        return;
      }

      const tokens = await authService.refreshTokens(refreshToken);

      res.json({ tokens });
    } catch (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }

  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async logoutAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await authService.logoutAll(req.user.userId);

      res.json({ message: 'Logged out from all devices' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      res.json({
        user: {
          id: req.user.userId,
          email: req.user.email,
          role: req.user.role,
          organizationId: req.user.organizationId,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new AuthController();
