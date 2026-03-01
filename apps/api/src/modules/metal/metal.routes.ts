import { Router } from 'express';
import { metalController } from './metal.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

// Constants defined locally to avoid import issues
const RESOURCES = {
  INVENTORY: 'inventory',
  REPORTS: 'reports',
} as const;

const ACTIONS = {
  READ: 'read',
  UPDATE: 'update',
} as const;

const router = Router();

// All metal routes require authentication
router.use(authenticate);

// Metal Position Reports
router.get(
  '/position',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => metalController.getMetalPosition(req, res)
);

router.get(
  '/position/:storeId',
  requirePermission(RESOURCES.REPORTS, ACTIONS.READ),
  (req, res) => metalController.getStoreMetalPosition(req, res)
);

// Conversion Calculator
router.post(
  '/convert',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  (req, res) => metalController.convertToFineGold(req, res)
);

// Purity Reference
router.get(
  '/purity-reference',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  (req, res) => metalController.getPurityReference(req, res)
);

// Gold Rate
router.get(
  '/gold-rate',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  (req, res) => metalController.getCurrentGoldRate(req, res)
);

// Admin: Backfill fine gold values
router.post(
  '/backfill-fine-gold',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE),
  (req, res) => metalController.backfillFineGold(req, res)
);

export default router;
