import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import * as suppliersController from './suppliers.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/suppliers
 * @desc    Create a new supplier
 * @access  Private (requires suppliers:create permission)
 */
router.post(
  '/',
  requirePermission('suppliers', 'create'),
  suppliersController.createSupplier
);

/**
 * @route   GET /api/v1/suppliers
 * @desc    List suppliers with optional filters
 * @access  Private (requires suppliers:read permission)
 */
router.get(
  '/',
  requirePermission('suppliers', 'read'),
  suppliersController.listSuppliers
);

/**
 * @route   GET /api/v1/suppliers/overview
 * @desc    Get suppliers overview for dashboard
 * @access  Private (requires suppliers:read permission)
 */
router.get(
  '/overview',
  requirePermission('suppliers', 'read'),
  suppliersController.getSuppliersOverview
);

/**
 * @route   GET /api/v1/suppliers/:id
 * @desc    Get supplier details by ID
 * @access  Private (requires suppliers:read permission)
 */
router.get(
  '/:id',
  requirePermission('suppliers', 'read'),
  suppliersController.getSupplier
);

/**
 * @route   PUT /api/v1/suppliers/:id
 * @desc    Update supplier
 * @access  Private (requires suppliers:update permission)
 */
router.patch(
  '/:id',
  requirePermission('suppliers', 'update'),
  suppliersController.updateSupplier
);

/**
 * @route   DELETE /api/v1/suppliers/:id
 * @desc    Delete supplier (soft delete)
 * @access  Private (requires suppliers:delete permission)
 */
router.delete(
  '/:id',
  requirePermission('suppliers', 'delete'),
  suppliersController.deleteSupplier
);

/**
 * @route   GET /api/v1/suppliers/:id/stats
 * @desc    Get supplier statistics
 * @access  Private (requires suppliers:read permission)
 */
router.get(
  '/:id/stats',
  requirePermission('suppliers', 'read'),
  suppliersController.getSupplierStats
);

/**
 * @route   GET /api/v1/suppliers/:id/purchases
 * @desc    Get supplier purchase history
 * @access  Private (requires suppliers:read permission)
 */
router.get(
  '/:id/purchases',
  requirePermission('suppliers', 'read'),
  suppliersController.getSupplierPurchaseHistory
);

/**
 * @route   GET /api/v1/suppliers/:id/ledger
 * @desc    Get supplier transaction ledger
 * @access  Private (requires suppliers:read permission)
 */
router.get(
  '/:id/ledger',
  requirePermission('suppliers', 'read'),
  suppliersController.getSupplierLedger
);

/**
 * @route   GET /api/v1/suppliers/:id/account-transactions
 * @desc    Get supplier account transactions (new ledger from transactions table)
 * @access  Private (requires suppliers:read permission)
 */
router.get(
  '/:id/account-transactions',
  requirePermission('suppliers', 'read'),
  suppliersController.getAccountTransactions
);

/**
 * @route   GET /api/v1/suppliers/:id/unified-ledger
 * @desc    Get unified ledger with dual-ledger support (monetary + gold)
 * @query   ledgerType: 'monetary' | 'gold' | 'both' (default: 'both')
 * @query   dateFrom: ISO date string (optional)
 * @query   dateTo: ISO date string (optional)
 * @query   limit: number (optional)
 * @query   offset: number (optional)
 * @access  Private (requires suppliers:read permission)
 */
router.get(
  '/:id/unified-ledger',
  requirePermission('suppliers', 'read'),
  suppliersController.getUnifiedLedger
);

/**
 * @route   POST /api/v1/suppliers/:id/settle-balance
 * @desc    Settle pending balance (monetary or gold)
 * @access  Private (requires suppliers:update permission)
 */
router.post(
  '/:id/settle-balance',
  requirePermission('suppliers', 'update'),
  suppliersController.settleBalance
);

export default router;

