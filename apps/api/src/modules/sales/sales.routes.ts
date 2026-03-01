import { Router } from 'express';
import { salesController } from './sales.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

// Constants defined locally to avoid import issues
const RESOURCES = {
  SALES: 'sales',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
} as const;

const router = Router();

// All sales routes require authentication
router.use(authenticate);

// Gold rates routes
router.post(
  '/gold-rates',
  requirePermission(RESOURCES.SALES, ACTIONS.UPDATE),
  (req, res) => salesController.updateGoldRate(req, res)
);

router.get(
  '/gold-rates/current',
  requirePermission(RESOURCES.SALES, ACTIONS.READ),
  (req, res) => salesController.getCurrentGoldRate(req, res)
);

router.get(
  '/gold-rates',
  requirePermission(RESOURCES.SALES, ACTIONS.READ),
  (req, res) => salesController.listGoldRates(req, res)
);

// Invoice routes
router.post(
  '/invoices',
  requirePermission(RESOURCES.SALES, ACTIONS.CREATE),
  (req, res) => salesController.createInvoice(req, res)
);

router.get(
  '/invoices',
  requirePermission(RESOURCES.SALES, ACTIONS.READ),
  (req, res) => salesController.listInvoices(req, res)
);

router.get(
  '/invoices/:invoiceId',
  requirePermission(RESOURCES.SALES, ACTIONS.READ),
  (req, res) => salesController.getInvoice(req, res)
);

// Payment routes
router.post(
  '/invoices/:invoiceId/payments',
  requirePermission(RESOURCES.SALES, ACTIONS.CREATE),
  (req, res) => salesController.addPayment(req, res)
);

// Quotation routes
router.post(
  '/quotations',
  requirePermission(RESOURCES.SALES, ACTIONS.CREATE),
  (req, res) => salesController.createQuotation(req, res)
);

router.get(
  '/quotations',
  requirePermission(RESOURCES.SALES, ACTIONS.READ),
  (req, res) => salesController.listQuotations(req, res)
);

// Analytics routes
router.get(
  '/stats',
  requirePermission(RESOURCES.SALES, ACTIONS.READ),
  (req, res) => salesController.getSalesStats(req, res)
);

export default router;
