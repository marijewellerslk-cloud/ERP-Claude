import { Router } from 'express';
import { loansController } from './loans.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

// Constants defined locally to avoid import issues
const RESOURCES = {
  GOLD_LOANS: 'gold_loans',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  APPROVE: 'approve',
} as const;

const router = Router();

// All loan routes require authentication
router.use(authenticate);

// Loan CRUD routes
router.post(
  '/',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.CREATE),
  (req, res) => loansController.createLoan(req, res)
);

router.get(
  '/',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => loansController.listLoans(req, res)
);

router.get(
  '/overdue',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => loansController.getOverdueLoans(req, res)
);

router.get(
  '/stats',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => loansController.getStats(req, res)
);

router.get(
  '/:loanId',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => loansController.getLoan(req, res)
);

// Loan approval
router.post(
  '/:loanId/approve',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.APPROVE),
  (req, res) => loansController.approveLoan(req, res)
);

// Loan payments
router.post(
  '/:loanId/payments',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.CREATE),
  (req, res) => loansController.addPayment(req, res)
);

// Loan release
router.post(
  '/:loanId/release',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.UPDATE),
  (req, res) => loansController.releaseLoan(req, res)
);

export default router;
