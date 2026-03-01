import { Router } from 'express';
import { karigarsController } from './karigars.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

// Define permissions for karigars module
const RESOURCES = {
  KARIGARS: 'karigars',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

const router = Router();

// All karigar routes require authentication
router.use(authenticate);

// Summary route (must be before :karigarId routes)
router.get(
  '/summary',
  requirePermission(RESOURCES.KARIGARS, ACTIONS.READ),
  (req, res) => karigarsController.getStoreSummary(req, res)
);

// List karigars
router.get(
  '/',
  requirePermission(RESOURCES.KARIGARS, ACTIONS.READ),
  (req, res) => karigarsController.listKarigars(req, res)
);

// Create karigar
router.post(
  '/',
  requirePermission(RESOURCES.KARIGARS, ACTIONS.CREATE),
  (req, res) => karigarsController.createKarigar(req, res)
);

// Get karigar by ID
router.get(
  '/:karigarId',
  requirePermission(RESOURCES.KARIGARS, ACTIONS.READ),
  (req, res) => karigarsController.getKarigar(req, res)
);

// Update karigar
router.put(
  '/:karigarId',
  requirePermission(RESOURCES.KARIGARS, ACTIONS.UPDATE),
  (req, res) => karigarsController.updateKarigar(req, res)
);

// Get karigar ledger
router.get(
  '/:karigarId/ledger',
  requirePermission(RESOURCES.KARIGARS, ACTIONS.READ),
  (req, res) => karigarsController.getKarigarLedger(req, res)
);

// Make payment to karigar
router.post(
  '/:karigarId/payments',
  requirePermission(RESOURCES.KARIGARS, ACTIONS.UPDATE),
  (req, res) => karigarsController.makePayment(req, res)
);

// Record advance to karigar
router.post(
  '/:karigarId/advances',
  requirePermission(RESOURCES.KARIGARS, ACTIONS.UPDATE),
  (req, res) => karigarsController.recordAdvance(req, res)
);

export default router;
