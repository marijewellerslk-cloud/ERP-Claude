import { Response } from 'express';
import { db } from '../../config/database.js';
import { inventoryItems } from '../../db/schema.js';
import { inventoryService } from './inventory.service.js';
import {
  createBatchSchema,
  updateBatchSchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  completeBatchSchema,
  createCategorySchema,
  recordBatchPaymentSchema,
  updateBatchItemSchema,
  deleteBatchItemSchema,
  createTransferSchema,
  receiveTransferSchema,
} from './inventory.validation.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { stockValuationService } from '../../services/stock-valuation.service.js';
import { logger } from '../../utils/logger.js';
import { eq, and } from 'drizzle-orm';

export class InventoryController {
  // Create new batch
  async createBatch(req: AuthRequest, res: Response) {
    try {
      const validatedData = createBatchSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const batch = await inventoryService.createBatch(
        validatedData,
        (() => {
          // Admin/owner can specify a target store for the batch
          if (validatedData.targetStoreId) {
            const isAdmin = req.user!.permissions.includes('*:*') ||
              ['super_admin', 'superadmin', 'owner'].includes(req.user!.role);
            if (isAdmin) {
              return validatedData.targetStoreId;
            }
          }
          // Branch managers and other users: use their assigned store
          return req.user!.storeId;
        })(),
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: batch,
      });
    } catch (error: any) {
      logger.error('Create batch error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'CREATE_BATCH_FAILED',
          message: error.message || 'Failed to create batch',
        },
      });
    }
  }

  // Update batch
  async updateBatch(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.params;
      const validatedData = updateBatchSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const updatedBatch = await inventoryService.updateBatch(
        batchId,
        validatedData,
        req.user.userId
      );

      res.json({
        success: true,
        data: updatedBatch,
      });
    } catch (error: any) {
      logger.error('Update batch error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_BATCH_FAILED',
          message: error.message || 'Failed to update batch',
        },
      });
    }
  }

  // Get batch details
  async getBatch(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.params;

      const batch = await inventoryService.getBatch(batchId);

      res.json({
        success: true,
        data: batch,
      });
    } catch (error: any) {
      logger.error('Get batch error:', error);

      res.status(404).json({
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: error.message || 'Batch not found',
        },
      });
    }
  }

  // Get batch summary
  async getBatchSummary(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.params;

      const summary = await inventoryService.getBatchSummary(batchId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Get batch summary error:', error);

      res.status(404).json({
        success: false,
        error: {
          code: 'BATCH_NOT_FOUND',
          message: error.message || 'Batch not found',
        },
      });
    }
  }

  // Add item to batch
  async addItemToBatch(req: AuthRequest, res: Response) {
    try {
      const validatedData = createInventoryItemSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const item = await inventoryService.addItemToBatch(validatedData, req.user.userId);

      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error: any) {
      logger.error('Add item to batch error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'ADD_ITEM_FAILED',
          message: error.message || 'Failed to add item to batch',
        },
      });
    }
  }

  // Complete batch
  async completeBatch(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await inventoryService.completeBatch(
        batchId,
        req.user.userId,
        req.user.storeId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Complete batch error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'COMPLETE_BATCH_FAILED',
          message: error.message || 'Failed to complete batch',
        },
      });
    }
  }

  // Delete batch (only incomplete batches)
  async deleteBatch(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.params;
      const { reason } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Deletion reason is required',
          },
        });
      }

      const result = await inventoryService.deleteBatch(
        batchId,
        req.user.userId,
        req.user.storeId,
        reason
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Delete batch error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'DELETE_BATCH_FAILED',
          message: error.message || 'Failed to delete batch',
        },
      });
    }
  }

  // Update batch item weights (for review page inline editing)
  async updateBatchItem(req: AuthRequest, res: Response) {
    try {
      const { batchId, itemId } = req.params;
      const validatedData = updateBatchItemSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const updatedItem = await inventoryService.updateBatchItem(
        itemId,
        batchId,
        validatedData,
        req.user.userId,
        req.user.storeId
      );

      res.json({
        success: true,
        data: updatedItem,
      });
    } catch (error: any) {
      logger.error('Update batch item error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_BATCH_ITEM_FAILED',
          message: error.message || 'Failed to update batch item',
        },
      });
    }
  }

  // Delete item from batch
  async deleteItemFromBatch(req: AuthRequest, res: Response) {
    try {
      const { batchId, itemId } = req.params;
      const validatedData = deleteBatchItemSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await inventoryService.deleteItemFromBatch(
        itemId,
        batchId,
        validatedData.reason,
        req.user.userId,
        req.user.storeId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Delete batch item error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'DELETE_BATCH_ITEM_FAILED',
          message: error.message || 'Failed to delete batch item',
        },
      });
    }
  }

  // List batches
  async listBatches(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { status, includeChildStores, filterStoreId } = req.query;

      // Determine which storeId(s) to query
      let targetStoreId = req.user.storeId;

      // If admin is filtering by a specific store
      if (filterStoreId && typeof filterStoreId === 'string') {
        const isAdmin = req.user.permissions.includes('*:*') ||
          ['super_admin', 'superadmin', 'owner'].includes(req.user.role);
        if (isAdmin) {
          targetStoreId = filterStoreId;
        }
      }

      const batches = await inventoryService.listBatches(
        targetStoreId,
        status as string | undefined,
        includeChildStores === 'true'
      );

      res.json({
        success: true,
        data: batches,
      });
    } catch (error: any) {
      logger.error('List batches error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_BATCHES_FAILED',
          message: 'Failed to list batches',
        },
      });
    }
  }

  // Create category
  async createCategory(req: AuthRequest, res: Response) {
    try {
      const validatedData = createCategorySchema.parse(req.body);

      const category = await inventoryService.createCategory(validatedData);

      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error: any) {
      logger.error('Create category error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'CREATE_CATEGORY_FAILED',
          message: error.message || 'Failed to create category',
        },
      });
    }
  }

  // List categories
  async listCategories(req: AuthRequest, res: Response) {
    try {
      const categories = await inventoryService.listCategories();

      res.json({
        success: true,
        data: categories,
      });
    } catch (error: any) {
      logger.error('List categories error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_CATEGORIES_FAILED',
          message: 'Failed to list categories',
        },
      });
    }
  }

  // Get category statistics
  async getCategoryStatistics(req: AuthRequest, res: Response) {
    try {
      const statistics = await inventoryService.getCategoryStatistics();

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error: any) {
      logger.error('Get category statistics error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_CATEGORY_STATISTICS_FAILED',
          message: 'Failed to get category statistics',
        },
      });
    }
  }

  // Update category
  async updateCategory(req: AuthRequest, res: Response) {
    try {
      const { categoryId } = req.params;
      const validatedData = createCategorySchema.parse(req.body);

      // Check if user has superadmin permissions (wildcard permission or superadmin role)
      const isSuperAdmin = req.user.permissions.includes('*:*') ||
        ['super_admin', 'superadmin', 'owner'].includes(req.user.role);

      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only superadmins can update categories',
          },
        });
      }

      const category = await inventoryService.updateCategory(categoryId, validatedData);

      res.json({
        success: true,
        data: category,
      });
    } catch (error: any) {
      logger.error('Update category error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_CATEGORY_FAILED',
          message: error.message || 'Failed to update category',
        },
      });
    }
  }

  // Delete category
  async deleteCategory(req: AuthRequest, res: Response) {
    try {
      const { categoryId } = req.params;

      // Check if user has superadmin permissions (wildcard permission or superadmin role)
      const isSuperAdmin = req.user.permissions.includes('*:*') ||
        ['super_admin', 'superadmin', 'owner'].includes(req.user.role);

      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only superadmins can delete categories',
          },
        });
      }

      await inventoryService.deleteCategory(categoryId);

      return res.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete category error:', error);

      return res.status(400).json({
        success: false,
        error: {
          code: 'DELETE_CATEGORY_FAILED',
          message: error.message || 'Failed to delete category',
        },
      });
    }
  }

  // Search inventory items
  async searchItems(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const {
        q,
        categoryId,
        metalType,
        purity,
        weightMin,
        weightMax,
        dateFrom,
        dateTo,
        priceMin,
        priceMax,
        slowMovers,
        limit,
        offset
      } = req.query;

      const filters: any = {};
      if (categoryId) filters.categoryId = categoryId as string;
      if (metalType) filters.metalType = metalType as string;
      if (purity) filters.purity = purity as string;
      if (weightMin) filters.weightMin = parseFloat(weightMin as string);
      if (weightMax) filters.weightMax = parseFloat(weightMax as string);
      if (dateFrom) filters.dateFrom = dateFrom as string;
      if (dateTo) filters.dateTo = dateTo as string;
      if (priceMin) filters.priceMin = parseFloat(priceMin as string);
      if (priceMax) filters.priceMax = parseFloat(priceMax as string);
      if (slowMovers === 'true') filters.slowMovers = true;

      const items = await inventoryService.searchInventoryItems(
        req.user.storeId,
        q as string | undefined,
        filters,
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined
      );

      res.json({
        success: true,
        data: items,
        total: items.length,
      });
    } catch (error: any) {
      logger.error('Search items error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ITEMS_FAILED',
          message: 'Failed to search items',
        },
      });
    }
  }

  // Record payment for a batch
  async recordBatchPayment(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.params;
      const validatedData = recordBatchPaymentSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await inventoryService.recordBatchPayment(
        batchId,
        validatedData,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Payment recorded successfully',
      });
    } catch (error: any) {
      logger.error('Record batch payment error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'RECORD_PAYMENT_FAILED',
          message: error.message || 'Failed to record payment',
        },
      });
    }
  }

  // Get all payments for a batch
  async getBatchPayments(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const payments = await inventoryService.getBatchPayments(batchId);

      res.json({
        success: true,
        data: payments,
      });
    } catch (error: any) {
      logger.error('Get batch payments error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PAYMENTS_FAILED',
          message: 'Failed to fetch batch payments',
        },
      });
    }
  }

  // Get single inventory item
  async getInventoryItem(req: AuthRequest, res: Response) {
    try {
      const { itemId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const item = await inventoryService.getInventoryItem(itemId, req.user.storeId);

      res.json({
        success: true,
        data: item,
      });
    } catch (error: any) {
      logger.error('Get inventory item error:', error);

      res.status(404).json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: error.message || 'Inventory item not found',
        },
      });
    }
  }

  // Update inventory item
  async updateInventoryItem(req: AuthRequest, res: Response) {
    try {
      const { itemId } = req.params;
      const validatedData = updateInventoryItemSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      // Check if user has super admin permissions (wildcard permission or superadmin role)
      // Only super admins can update inventory items
      const isSuperAdmin = req.user.permissions.includes('*:*') ||
        ['super_admin', 'superadmin', 'owner'].includes(req.user.role);

      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only super admins can update inventory items. This action requires special authorization for audit and compliance purposes.',
          },
        });
      }

      const updatedItem = await inventoryService.updateInventoryItem(
        itemId,
        req.user.storeId,
        validatedData,
        req.user.userId
      );

      res.json({
        success: true,
        data: updatedItem,
        message: 'Inventory item updated successfully. Changes have been logged in the audit trail.',
      });
    } catch (error: any) {
      logger.error('Update inventory item error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_ITEM_FAILED',
          message: error.message || 'Failed to update inventory item',
        },
      });
    }
  }

  // List sold items with profit tracking
  async listSoldItems(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate, metalType, categoryId, limit, offset } = req.query;

      const filters: any = {};
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;
      if (metalType) filters.metalType = metalType as string;
      if (categoryId) filters.categoryId = categoryId as string;

      const result = await inventoryService.listSoldItems(
        req.user.storeId,
        filters,
        limit ? parseInt(limit as string) : 100,
        offset ? parseInt(offset as string) : 0
      );

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination,
        summary: result.summary,
      });
    } catch (error: any) {
      logger.error('List sold items error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_SOLD_ITEMS_FAILED',
          message: 'Failed to list sold items',
        },
      });
    }
  }
  // ============================================================================
  // STOCK VALUATION ENDPOINTS
  // ============================================================================

  // Get valuation summary
  async getValuationSummary(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const summary = await stockValuationService.getValuationSummary(req.user.storeId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Get valuation summary error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'VALUATION_SUMMARY_FAILED',
          message: 'Failed to get valuation summary',
        },
      });
    }
  }

  // Trigger manual revaluation
  async revalueInventory(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const report = await stockValuationService.revalueInventory(req.user.storeId);

      res.json({
        success: true,
        data: report,
        message: `Revalued ${report.itemsRevalued} items`,
      });
    } catch (error: any) {
      logger.error('Revalue inventory error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'REVALUATION_FAILED',
          message: error.message || 'Failed to revalue inventory',
        },
      });
    }
  }

  // Get stock aging report
  async getStockAgingReport(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : undefined;

      const report = await stockValuationService.getStockAgingReport(req.user.storeId, threshold);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get stock aging report error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'AGING_REPORT_FAILED',
          message: 'Failed to get stock aging report',
        },
      });
    }
  }

  // Get dead stock items
  async getDeadStock(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : undefined;

      const deadStock = await stockValuationService.getDeadStock(req.user.storeId, threshold);

      res.json({
        success: true,
        data: deadStock,
        meta: {
          count: deadStock.length,
          threshold: threshold || 180,
        },
      });
    } catch (error: any) {
      logger.error('Get dead stock error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'DEAD_STOCK_FAILED',
          message: 'Failed to get dead stock items',
        },
      });
    }
  }

  // Get inventory turnover metrics
  async getInventoryTurnover(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate } = req.query;

      // Default to last 30 days
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate
        ? new Date(startDate as string)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const turnover = await stockValuationService.getInventoryTurnover(
        req.user.storeId,
        start,
        end
      );

      res.json({
        success: true,
        data: turnover,
        meta: {
          startDate: start,
          endDate: end,
        },
      });
    } catch (error: any) {
      logger.error('Get inventory turnover error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'TURNOVER_FAILED',
          message: 'Failed to get inventory turnover',
        },
      });
    }
  }

  // Get valuation details for an inventory item
  async getItemValuationDetails(req: AuthRequest, res: Response) {
    try {
      const { itemId } = req.params;
      const storeId = req.user?.storeId;

      if (!itemId) {
        return res.status(400).json({ error: 'Item ID is required' });
      }

      // Verify item belongs to user's store
      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.storeId, storeId!)
        )
      });

      if (!item) {
        return res.status(404).json({ error: 'Item not found in your store' });
      }

      const valuationDetails = await inventoryService.getItemValuationDetails(itemId);

      res.status(200).json({ success: true, data: valuationDetails });
    } catch (error) {
      logger.error('Error getting item valuation details:', error);
      res.status(500).json({ error: 'Failed to get item valuation details' });
    }
  }

  // Transfer management
  async createTransfer(req: AuthRequest, res: Response) {
    try {
      const validatedData = createTransferSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const transfer = await inventoryService.createTransfer(
        validatedData,
        req.user.storeId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: transfer,
      });
    } catch (error: any) {
      logger.error('Create transfer error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'CREATE_TRANSFER_FAILED',
          message: error.message || 'Failed to create transfer',
        },
      });
    }
  }

  async receiveTransfer(req: AuthRequest, res: Response) {
    try {
      const validatedData = receiveTransferSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const transfer = await inventoryService.receiveTransfer(
        validatedData,
        req.user.storeId,
        req.user.userId
      );

      res.json({
        success: true,
        data: transfer,
      });
    } catch (error: any) {
      logger.error('Receive transfer error:', error);

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

      res.status(400).json({
        success: false,
        error: {
          code: 'RECEIVE_TRANSFER_FAILED',
          message: error.message || 'Failed to receive transfer',
        },
      });
    }
  }

  async getTransfers(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { type } = req.query;
      const options = type ? { type: type as 'inbound' | 'outbound' } : undefined;

      const transfers = await inventoryService.getTransfers(
        req.user.storeId,
        options
      );

      res.json({
        success: true,
        data: transfers,
      });
    } catch (error: any) {
      logger.error('Get transfers error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_TRANSFERS_FAILED',
          message: 'Failed to retrieve transfers',
        },
      });
    }
  }

  async getTransferById(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { id } = req.params;
      const transfer = await inventoryService.getTransferById(
        id,
        req.user.storeId
      );

      if (!transfer) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Transfer not found',
          },
        });
      }

      res.json({
        success: true,
        data: transfer,
      });
    } catch (error: any) {
      logger.error('Get transfer by ID error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_TRANSFER_FAILED',
          message: 'Failed to retrieve transfer details',
        },
      });
    }
  }

  // Global Inventory Search
  async searchGlobal(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      // Check if user has permission to search globally
      // (This could be a specific permission or role check)
      // For now, allowing all authorized users but the service limits data returned

      const { q, category, metalType, limit, storeId } = req.query;

      const items = await inventoryService.searchGlobalInventory(
        q as string,
        {
          category: category as string,
          metalType: metalType as string,
          storeId: storeId as string,
        },
        limit ? parseInt(limit as string) : 20
      );

      res.json({
        success: true,
        data: items,
      });
    } catch (error: any) {
      logger.error('Global search error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GLOBAL_SEARCH_FAILED',
          message: 'Failed to search global inventory',
        },
      });
    }
  }
}

export const inventoryController = new InventoryController();
