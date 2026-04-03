import { Router } from 'express';
import authRoutes from './auth';
import organizationRoutes from './organization';
import adAccountRoutes from './ad-accounts';
import dashboardRoutes from './dashboard';
import optimizationRoutes from './optimization';
import billingRoutes from './billing';
import integrationsRoutes from './integrations';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organization', organizationRoutes);
router.use('/ad-accounts', adAccountRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/optimization', optimizationRoutes);
router.use('/billing', billingRoutes);
router.use('/integrations', integrationsRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
