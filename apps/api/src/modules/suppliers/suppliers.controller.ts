import type { Request, Response } from 'express';
import { SuppliersService } from './suppliers.service.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
  settleBalanceSchema,
} from './suppliers.validation.js';

import { logger } from '../../utils/logger.js';

const suppliersService = new SuppliersService();

/**
 * Create a new supplier
 */
export const createSupplier = async (req: Request, res: Response) => {
  try {
    const validatedData = createSupplierSchema.parse(req.body);
    const storeId = req.user!.storeId;

    const supplier = await suppliersService.createSupplier(validatedData, storeId);

    logger.info(`Supplier created: ${supplier.id} by user ${req.user!.userId}`);

    res.status(201).json({
      success: true,
      data: supplier,
      message: 'Supplier created successfully',
    });
  } catch (error: any) {
    logger.error('Error creating supplier:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create supplier',
    });
  }
};

/**
 * Get supplier by ID
 */
export const getSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = req.user!.storeId;

    const supplier = await suppliersService.getSupplier(id, storeId);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    res.status(200).json({
      success: true,
      data: supplier,
    });
  } catch (error: any) {
    logger.error('Error fetching supplier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch supplier',
    });
  }
};

/**
 * Update supplier
 */
export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateSupplierSchema.parse(req.body);
    const storeId = req.user!.storeId;

    const supplier = await suppliersService.updateSupplier(id, storeId, validatedData);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    logger.info(`Supplier updated: ${id} by user ${req.user!.userId}`);

    res.status(200).json({
      success: true,
      data: supplier,
      message: 'Supplier updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating supplier:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update supplier',
    });
  }
};

/**
 * Delete supplier (soft delete)
 */
export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = req.user!.storeId;

    const supplier = await suppliersService.deleteSupplier(id, storeId);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    logger.info(`Supplier deleted: ${id} by user ${req.user!.userId}`);

    res.status(200).json({
      success: true,
      data: supplier,
      message: 'Supplier deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting supplier:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete supplier',
    });
  }
};

/**
 * List suppliers with optional filters
 */
export const listSuppliers = async (req: Request, res: Response) => {
  try {
    const query = listSuppliersQuerySchema.parse(req.query);
    const storeId = req.user!.storeId;

    const result = await suppliersService.listSuppliers(storeId, query);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    logger.error('Error listing suppliers:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to list suppliers',
    });
  }
};

/**
 * Get supplier statistics
 */
export const getSupplierStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = req.user!.storeId;

    const stats = await suppliersService.getSupplierStats(id, storeId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error fetching supplier stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch supplier statistics',
    });
  }
};

/**
 * Get supplier purchase history
 */
export const getSupplierPurchaseHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = req.user!.storeId;

    const purchases = await suppliersService.getSupplierPurchaseHistory(id, storeId);

    res.status(200).json({
      success: true,
      data: purchases,
    });
  } catch (error: any) {
    logger.error('Error fetching supplier purchase history:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch purchase history',
    });
  }
};

/**
 * Get supplier ledger
 */
export const getSupplierLedger = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = req.user!.storeId;

    const ledger = await suppliersService.getSupplierLedger(id, storeId);

    res.status(200).json({
      success: true,
      data: ledger,
    });
  } catch (error: any) {
    logger.error('Error fetching supplier ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch supplier ledger',
    });
  }
};

/**
 * Get suppliers overview for dashboard
 */
export const getSuppliersOverview = async (req: Request, res: Response) => {
  try {
    const storeId = req.user!.storeId;

    const overview = await suppliersService.getSuppliersOverview(storeId);

    res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error: any) {
    logger.error('Error fetching suppliers overview:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch suppliers overview',
    });
  }
};

/**
 * Get supplier account transactions (new ledger from transactions table)
 */
export const getAccountTransactions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = req.user!.storeId;

    const options: any = {};
    if (req.query.dateFrom) options.dateFrom = req.query.dateFrom as string;
    if (req.query.dateTo) options.dateTo = req.query.dateTo as string;
    if (req.query.transactionType) options.transactionType = req.query.transactionType as string;
    if (req.query.limit) options.limit = parseInt(req.query.limit as string);
    if (req.query.offset) options.offset = parseInt(req.query.offset as string);

    const transactions = await suppliersService.getAccountTransactions(id, storeId, options);

    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error: any) {
    logger.error('Error fetching account transactions:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch account transactions',
    });
  }
};

/**
 * Get unified ledger with dual-ledger support (monetary + gold)
 */
export const getUnifiedLedger = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = req.user!.storeId;

    const options: any = {};
    if (req.query.ledgerType) {
      const ledgerType = req.query.ledgerType as string;
      if (['monetary', 'gold', 'gold_exchange', 'both'].includes(ledgerType)) {
        options.ledgerType = ledgerType;
      }
    }
    if (req.query.dateFrom) options.dateFrom = req.query.dateFrom as string;
    if (req.query.dateTo) options.dateTo = req.query.dateTo as string;
    if (req.query.limit) options.limit = parseInt(req.query.limit as string);
    if (req.query.offset) options.offset = parseInt(req.query.offset as string);

    const ledger = await suppliersService.getUnifiedLedger(id, storeId, options);

    res.status(200).json({
      success: true,
      data: ledger,
    });
  } catch (error: any) {
    logger.error('Error fetching unified ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch unified ledger',
    });
  }
};

/**
 * Settle pending balance
 */
export const settleBalance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = settleBalanceSchema.parse(req.body);

    const result = await suppliersService.settleBalance(
      id,
      req.user!.storeId,
      validatedData,
      req.user!.userId
    );

    res.status(200).json({
      success: true,
      message: 'Balance settled successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Error settling balance:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Failed to settle balance',
      },
    });
  }
};
