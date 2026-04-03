import { Router } from 'express';
import dashboardController from '../controllers/DashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/overview', dashboardController.getOverview.bind(dashboardController));
router.get('/performance', dashboardController.getPerformanceChart.bind(dashboardController));
router.get('/campaigns', dashboardController.getCampaigns.bind(dashboardController));
router.get('/campaigns/:campaignId/ads', dashboardController.getCampaignAds.bind(dashboardController));
router.get('/top-ads', dashboardController.getTopAds.bind(dashboardController));

export default router;
