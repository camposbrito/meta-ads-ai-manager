import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import ga4Service from '../services/Ga4Service';
import { requireAdmin, requireAuth, requireString } from '../utils/request';

class IntegrationController {
  async getGa4Integration(req: AuthRequest, res: Response): Promise<void> {
    const user = requireAuth(req);
    const integration = await ga4Service.getIntegration(user.organizationId);
    res.json({ integration });
  }

  async upsertGa4Integration(req: AuthRequest, res: Response): Promise<void> {
    const adminUser = requireAdmin(req);
    const propertyId = requireString(req.body.propertyId, 'propertyId');
    const serviceAccountEmail = requireString(req.body.serviceAccountEmail, 'serviceAccountEmail');
    const privateKey = typeof req.body.privateKey === 'string' ? req.body.privateKey : undefined;
    const measurementId =
      typeof req.body.measurementId === 'string' ? req.body.measurementId : undefined;

    const integration = await ga4Service.upsertIntegration(adminUser.organizationId, {
      propertyId,
      measurementId,
      serviceAccountEmail,
      privateKey,
    });

    res.json({
      message: 'GA4 integration saved successfully',
      integration,
    });
  }

  async testGa4Integration(req: AuthRequest, res: Response): Promise<void> {
    const adminUser = requireAdmin(req);
    const integration = await ga4Service.testIntegration(adminUser.organizationId);

    res.json({
      message: 'GA4 integration tested successfully',
      integration,
    });
  }

  async disconnectGa4Integration(req: AuthRequest, res: Response): Promise<void> {
    const adminUser = requireAdmin(req);
    await ga4Service.disconnectIntegration(adminUser.organizationId);
    res.json({ message: 'GA4 integration disconnected' });
  }
}

export default new IntegrationController();
