import { Router } from 'express';
import { accountingController } from './accounting.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = {
  ACCOUNTING: 'accounting',
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

// Initialize chart of accounts
router.post(
  '/initialize',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.CREATE),
  (req, res) => accountingController.initializeAccounts(req as any, res)
);

// Financial Summary (Dashboard)
router.get(
  '/summary',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getFinancialSummary(req as any, res)
);

// Chart of Accounts
router.get(
  '/chart-of-accounts',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getChartOfAccounts(req as any, res)
);

router.get(
  '/accounts',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getAccountsList(req as any, res)
);

router.post(
  '/accounts',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.CREATE),
  (req, res) => accountingController.createAccount(req as any, res)
);

router.get(
  '/accounts/:accountId/ledger',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getAccountLedger(req as any, res)
);

// Bank Accounts
router.get(
  '/bank-accounts',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getBankAccounts(req as any, res)
);

router.post(
  '/bank-accounts',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.CREATE),
  (req, res) => accountingController.createBankAccount(req as any, res)
);

// Journal Entries
router.get(
  '/journal-entries',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.listJournalEntries(req as any, res)
);

router.post(
  '/journal-entries',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.CREATE),
  (req, res) => accountingController.createJournalEntry(req as any, res)
);

router.get(
  '/journal-entries/:entryId',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getJournalEntry(req as any, res)
);

// Expenses
router.get(
  '/expenses',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.listExpenses(req as any, res)
);

router.post(
  '/expenses',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.CREATE),
  (req, res) => accountingController.createExpense(req as any, res)
);

// Financial Reports
router.get(
  '/reports/income-statement',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getIncomeStatement(req as any, res)
);

router.get(
  '/reports/balance-sheet',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getBalanceSheet(req as any, res)
);

router.get(
  '/reports/trial-balance',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getTrialBalance(req as any, res)
);

router.get(
  '/reports/cash-flow',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getCashFlowStatement(req as any, res)
);

// Cash Register
router.get(
  '/cash-register',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getCashRegister(req as any, res)
);

router.post(
  '/cash-register/open',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.CREATE),
  (req, res) => accountingController.openCashRegister(req as any, res)
);

router.post(
  '/cash-register/close',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.UPDATE),
  (req, res) => accountingController.closeCashRegister(req as any, res)
);

// Petty Cash
router.get(
  '/petty-cash',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.READ),
  (req, res) => accountingController.getPettyCashBook(req as any, res)
);

router.post(
  '/petty-cash',
  requirePermission(RESOURCES.ACCOUNTING, ACTIONS.CREATE),
  (req, res) => accountingController.recordPettyCashEntry(req as any, res)
);

export default router;
