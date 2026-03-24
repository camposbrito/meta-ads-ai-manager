import { Router } from 'express';
import adAccountController from '../controllers/AdAccountController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', adAccountController.list);
router.post('/connect', adAccountController.connect);
router.post('/:id/sync', adAccountController.sync);
router.get('/:id/sync-status', adAccountController.getSyncStatus);
router.delete('/:id', adAccountController.disconnect);

export default router;
