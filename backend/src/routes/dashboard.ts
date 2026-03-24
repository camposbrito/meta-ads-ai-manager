import { Router } from 'express';
import dashboardController from '../controllers/DashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/overview', dashboardController.getOverview);
router.get('/performance', dashboardController.getPerformanceChart);
router.get('/campaigns', dashboardController.getCampaigns);
router.get('/top-ads', dashboardController.getTopAds);

export default router;
