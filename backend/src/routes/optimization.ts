import { Router } from 'express';
import optimizationController from '../controllers/OptimizationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Rules
router.get('/rules', optimizationController.getRules.bind(optimizationController));
router.post('/rules', optimizationController.createRule.bind(optimizationController));
router.put('/rules/:id', optimizationController.updateRule.bind(optimizationController));
router.delete('/rules/:id', optimizationController.deleteRule.bind(optimizationController));
router.patch('/rules/:id/toggle', optimizationController.toggleRule.bind(optimizationController));

// Suggestions
router.get('/suggestions', optimizationController.getSuggestions.bind(optimizationController));
router.get('/suggestions/:id', optimizationController.getSuggestion.bind(optimizationController));
router.post('/suggestions/:id/accept', optimizationController.acceptSuggestion.bind(optimizationController));
router.post('/suggestions/:id/reject', optimizationController.rejectSuggestion.bind(optimizationController));

// Run optimization
router.post('/run', optimizationController.runOptimization.bind(optimizationController));

export default router;
