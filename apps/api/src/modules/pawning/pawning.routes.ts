import { Router } from 'express';
import { pawningController } from './pawning.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = {
  GOLD_LOANS: 'gold_loans',
  LOAN_CONFIG: 'loan_config',
  LOAN_KYC: 'loan_kyc',
  LOAN_AUCTIONS: 'loan_auctions',
  MARGIN_CALLS: 'margin_calls',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  APPROVE: 'approve',
  VERIFY: 'verify',
  INITIATE_AUCTION: 'initiate_auction',
  RENEW: 'renew',
  DISBURSE: 'disburse',
} as const;

const router = Router();

// All pawning routes require authentication
router.use(authenticate);

// ── Dashboard / Stats ──────────────────────────────────────────────────────────

router.get(
  '/dashboard/stats',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.getDashboardStats(req, res)
);

router.get(
  '/dashboard/overdue',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.getOverdueLoans(req, res)
);

router.get(
  '/dashboard/maturing',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.getMaturingLoans(req, res)
);

router.get(
  '/dashboard/ltv-alerts',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.getLtvAlerts(req, res)
);

// ── Interest Rate Config ───────────────────────────────────────────────────────

router.get(
  '/interest-rates',
  requirePermission(RESOURCES.LOAN_CONFIG, ACTIONS.READ),
  (req, res) => pawningController.getInterestRates(req, res)
);

router.post(
  '/interest-rates',
  requirePermission(RESOURCES.LOAN_CONFIG, ACTIONS.CREATE),
  (req, res) => pawningController.createInterestRate(req, res)
);

// Specific route before parameterized route
router.get(
  '/interest-rates/applicable',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.getApplicableRate(req, res)
);

router.put(
  '/interest-rates/:rateId',
  requirePermission(RESOURCES.LOAN_CONFIG, ACTIONS.UPDATE),
  (req, res) => pawningController.updateInterestRate(req, res)
);

// ── LTV ────────────────────────────────────────────────────────────────────────

router.post(
  '/ltv/validate',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.validateLTV(req, res)
);

router.get(
  '/ltv/:loanId',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.calculateLTV(req, res)
);

router.post(
  '/ltv/:loanId/recalculate',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.UPDATE),
  (req, res) => pawningController.recalculateLTV(req, res)
);

router.get(
  '/ltv/:loanId/history',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.getLtvHistory(req, res)
);

// ── Interest ───────────────────────────────────────────────────────────────────

router.post(
  '/interest/calculate',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.calculateInterest(req, res)
);

router.post(
  '/interest/accrue-all',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.UPDATE),
  (req, res) => pawningController.accrueAllInterest(req, res)
);

// ── KYC ────────────────────────────────────────────────────────────────────────

router.get(
  '/kyc-pending',
  requirePermission(RESOURCES.LOAN_KYC, ACTIONS.READ),
  (req, res) => pawningController.getKycPendingLoans(req, res)
);

router.get(
  '/kyc/:customerId',
  requirePermission(RESOURCES.LOAN_KYC, ACTIONS.READ),
  (req, res) => pawningController.getCustomerKyc(req, res)
);

router.post(
  '/kyc/:customerId',
  requirePermission(RESOURCES.LOAN_KYC, ACTIONS.CREATE),
  (req, res) => pawningController.createOrUpdateKyc(req, res)
);

router.post(
  '/kyc/:kycId/verify',
  requirePermission(RESOURCES.LOAN_KYC, ACTIONS.VERIFY),
  (req, res) => pawningController.verifyKycDocument(req, res)
);

router.put(
  '/kyc/:kycId/status',
  requirePermission(RESOURCES.LOAN_KYC, ACTIONS.UPDATE),
  (req, res) => pawningController.updateKycStatus(req, res)
);

// ── Margin Calls ───────────────────────────────────────────────────────────────

router.get(
  '/margin-calls',
  requirePermission(RESOURCES.MARGIN_CALLS, ACTIONS.READ),
  (req, res) => pawningController.getPendingMarginCalls(req, res)
);

router.post(
  '/margin-calls/check-all',
  requirePermission(RESOURCES.MARGIN_CALLS, ACTIONS.CREATE),
  (req, res) => pawningController.checkAllMarginCalls(req, res)
);

router.post(
  '/margin-calls/:loanId',
  requirePermission(RESOURCES.MARGIN_CALLS, ACTIONS.CREATE),
  (req, res) => pawningController.createMarginCall(req, res)
);

router.post(
  '/margin-calls/:callId/comply',
  requirePermission(RESOURCES.MARGIN_CALLS, ACTIONS.UPDATE),
  (req, res) => pawningController.recordMarginCallCompliance(req, res)
);

// ── Renewals ───────────────────────────────────────────────────────────────────

router.post(
  '/renewals/:loanId',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.RENEW),
  (req, res) => pawningController.renewLoan(req, res)
);

router.get(
  '/renewals/:loanId/history',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.getRenewalHistory(req, res)
);

// ── Auctions ───────────────────────────────────────────────────────────────────

router.get(
  '/auctions',
  requirePermission(RESOURCES.LOAN_AUCTIONS, ACTIONS.READ),
  (req, res) => pawningController.getAuctions(req, res)
);

router.post(
  '/auctions/:loanId/initiate',
  requirePermission(RESOURCES.LOAN_AUCTIONS, ACTIONS.INITIATE_AUCTION),
  (req, res) => pawningController.initiateAuction(req, res)
);

router.post(
  '/auctions/:auctionId/complete',
  requirePermission(RESOURCES.LOAN_AUCTIONS, ACTIONS.UPDATE),
  (req, res) => pawningController.completeAuction(req, res)
);

// ── Notifications ──────────────────────────────────────────────────────────────

router.post(
  '/notifications/bulk-reminders',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.UPDATE),
  (req, res) => pawningController.sendBulkReminders(req, res)
);

router.get(
  '/notifications/templates',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.getNotificationTemplates(req, res)
);

router.post(
  '/notifications/:loanId/send',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.UPDATE),
  (req, res) => pawningController.sendNotification(req, res)
);

router.get(
  '/notifications/:loanId/history',
  requirePermission(RESOURCES.GOLD_LOANS, ACTIONS.READ),
  (req, res) => pawningController.getNotificationHistory(req, res)
);

export default router;
