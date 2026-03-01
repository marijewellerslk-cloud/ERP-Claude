import { Router } from 'express';
import { aiReportController } from './ai-report.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = {
    REPORTS: 'reports',
} as const;

const ACTIONS = {
    READ: 'read',
} as const;

const router = Router();

router.use(authenticate);

// Check Ollama status
router.get(
    '/status',
    requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
    (req, res) => aiReportController.checkStatus(req as any, res)
);

// Get available report types
router.get(
    '/report-types',
    requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
    (req, res) => aiReportController.getReportTypes(req as any, res)
);

// Generate AI analysis
router.post(
    '/generate',
    requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
    (req, res) => aiReportController.generateReport(req as any, res)
);

export default router;
