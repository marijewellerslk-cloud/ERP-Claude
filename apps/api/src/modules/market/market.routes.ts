import { Router } from 'express';
import { marketController } from './market.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = {
    REPORTS: 'reports',
} as const;

const ACTIONS = {
    READ: 'read',
    CREATE: 'create',
    DELETE: 'delete',
} as const;

const router = Router();

// All market routes require authentication
router.use(authenticate);

// Get market rate history
router.get(
    '/rates',
    (req, res) => marketController.getRates(req, res)
);

// Get latest market rate
router.get(
    '/rates/latest',
    (req, res) => marketController.getLatestRate(req, res)
);

// Create or update daily rate
router.post(
    '/rates',
    requirePermission(RESOURCES.REPORTS, ACTIONS.CREATE),
    (req, res) => marketController.upsertRate(req, res)
);

// Delete a rate entry
router.delete(
    '/rates/:id',
    requirePermission(RESOURCES.REPORTS, ACTIONS.DELETE),
    (req, res) => marketController.deleteRate(req, res)
);

export default router;
