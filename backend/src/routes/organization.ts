import { Router } from 'express';
import organizationController from '../controllers/OrganizationController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', organizationController.getOrganization);
router.put('/', organizationController.updateOrganization);
router.get('/members', organizationController.getMembers);
router.post('/members', requireRole('admin'), organizationController.addMember);
router.delete('/members/:id', requireRole('admin'), organizationController.removeMember);
router.patch('/members/:id/role', requireRole('admin'), organizationController.updateMemberRole);

export default router;
