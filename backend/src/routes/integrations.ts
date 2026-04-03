import { Router } from 'express';
import integrationController from '../controllers/IntegrationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/ga4', integrationController.getGa4Integration);
router.post('/ga4', integrationController.upsertGa4Integration);
router.post('/ga4/test', integrationController.testGa4Integration);
router.delete('/ga4', integrationController.disconnectGa4Integration);

export default router;
