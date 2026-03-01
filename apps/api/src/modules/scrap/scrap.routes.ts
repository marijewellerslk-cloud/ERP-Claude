import { Router } from 'express';
import { scrapController } from './scrap.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = {
  SCRAP: 'scrap',
  MELTING: 'melting',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
} as const;

const router = Router();

// All scrap routes require authentication
router.use(authenticate);

// Scrap Inventory Routes
router.post(
  '/',
  requirePermission(RESOURCES.SCRAP, ACTIONS.CREATE),
  (req, res) => scrapController.addScrap(req, res)
);

router.get(
  '/',
  requirePermission(RESOURCES.SCRAP, ACTIONS.READ),
  (req, res) => scrapController.listScrap(req, res)
);

router.get(
  '/statistics',
  requirePermission(RESOURCES.SCRAP, ACTIONS.READ),
  (req, res) => scrapController.getStatistics(req, res)
);

// Melting Routes
router.post(
  '/melting',
  requirePermission(RESOURCES.MELTING, ACTIONS.CREATE),
  (req, res) => scrapController.createMeltingRecord(req, res)
);

router.get(
  '/melting',
  requirePermission(RESOURCES.MELTING, ACTIONS.READ),
  (req, res) => scrapController.listMeltingRecords(req, res)
);

router.get(
  '/melting/statistics',
  requirePermission(RESOURCES.MELTING, ACTIONS.READ),
  (req, res) => scrapController.getMeltingStatistics(req, res)
);

router.get(
  '/melting/:meltingId',
  requirePermission(RESOURCES.MELTING, ACTIONS.READ),
  (req, res) => scrapController.getMeltingRecord(req, res)
);

router.put(
  '/melting/:meltingId/complete',
  requirePermission(RESOURCES.MELTING, ACTIONS.UPDATE),
  (req, res) => scrapController.completeMeltingRecord(req, res)
);

export default router;
