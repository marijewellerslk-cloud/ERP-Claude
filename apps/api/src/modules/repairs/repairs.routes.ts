import { Router } from 'express';
import { repairsController } from './repairs.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = {
  REPAIRS: 'repairs',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

const router = Router();

// All routes require authentication
router.use(authenticate);

// Statistics (must be before :repairId routes)
router.get(
  '/statistics',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.READ),
  (req, res) => repairsController.getStatistics(req as any, res)
);

// Create repair
router.post(
  '/',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.CREATE),
  (req, res) => repairsController.createRepair(req as any, res)
);

// List repairs
router.get(
  '/',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.READ),
  (req, res) => repairsController.listRepairs(req as any, res)
);

// Get single repair
router.get(
  '/:repairId',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.READ),
  (req, res) => repairsController.getRepair(req as any, res)
);

// Update repair
router.put(
  '/:repairId',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.UPDATE),
  (req, res) => repairsController.updateRepair(req as any, res)
);

// Assess repair (provide quotation)
router.post(
  '/:repairId/assess',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.UPDATE),
  (req, res) => repairsController.assessRepair(req as any, res)
);

// Approve quotation
router.post(
  '/:repairId/approve',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.UPDATE),
  (req, res) => repairsController.approveQuotation(req as any, res)
);

// Start repair work
router.post(
  '/:repairId/start',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.UPDATE),
  (req, res) => repairsController.startRepair(req as any, res)
);

// Complete repair
router.post(
  '/:repairId/complete',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.UPDATE),
  (req, res) => repairsController.completeRepair(req as any, res)
);

// Mark repair as ready
router.post(
  '/:repairId/ready',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.UPDATE),
  (req, res) => repairsController.markReady(req as any, res)
);

// Deliver repair
router.post(
  '/:repairId/deliver',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.UPDATE),
  (req, res) => repairsController.deliverRepair(req as any, res)
);

// Cancel repair
router.post(
  '/:repairId/cancel',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.DELETE),
  (req, res) => repairsController.cancelRepair(req as any, res)
);

// Add item to repair
router.post(
  '/:repairId/items',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.UPDATE),
  (req, res) => repairsController.addRepairItem(req as any, res)
);

// Notify customer
router.post(
  '/:repairId/notify',
  requirePermission(RESOURCES.REPAIRS, ACTIONS.UPDATE),
  (req, res) => repairsController.notifyCustomer(req as any, res)
);

export default router;
