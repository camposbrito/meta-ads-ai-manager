import { Router } from 'express';
import optimizationController from '../controllers/OptimizationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Rules
router.get('/rules', optimizationController.getRules);
router.post('/rules', optimizationController.createRule);
router.put('/rules/:id', optimizationController.updateRule);
router.delete('/rules/:id', optimizationController.deleteRule);
router.patch('/rules/:id/toggle', optimizationController.toggleRule);

// Suggestions
router.get('/suggestions', optimizationController.getSuggestions);
router.get('/suggestions/:id', optimizationController.getSuggestion);
router.post('/suggestions/:id/accept', optimizationController.acceptSuggestion);
router.post('/suggestions/:id/reject', optimizationController.rejectSuggestion);

// Run optimization
router.post('/run', optimizationController.runOptimization);

export default router;
