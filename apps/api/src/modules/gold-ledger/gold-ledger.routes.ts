import { Router } from 'express';
import { goldLedgerController } from './gold-ledger.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = {
    INVENTORY: 'inventory',
} as const;

const ACTIONS = {
    READ: 'read',
} as const;

const router = Router();

// All gold ledger routes require authentication and inventory read permission
router.use(authenticate);

router.get(
    '/position',
    requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
    (req, res) => goldLedgerController.getGoldPosition(req as any, res)
);

router.get(
    '/inventory',
    requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
    (req, res) => goldLedgerController.getGoldInventory(req as any, res)
);

router.get(
    '/karigar-movements',
    requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
    (req, res) => goldLedgerController.getKarigarGoldMovements(req as any, res)
);

export default router;
