import { Router } from 'express';
import { getNotificationStatus } from './notifications.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// Get notification service status
router.get('/status', authenticate, getNotificationStatus);

export default router;
