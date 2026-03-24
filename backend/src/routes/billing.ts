import { Router } from 'express';
import billingController from '../controllers/BillingController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/plans', billingController.getPlans);
router.get('/subscription', billingController.getCurrentPlan);
router.post('/upgrade', billingController.upgradePlan);
router.post('/cancel', billingController.cancelSubscription);

export default router;
