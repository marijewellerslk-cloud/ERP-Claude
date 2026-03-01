import { Response } from 'express';
import { repairsService } from './repairs.service.js';
import {
  createRepairSchema,
  updateRepairSchema,
  assessRepairSchema,
  approveQuotationSchema,
  startRepairSchema,
  completeRepairSchema,
  deliverRepairSchema,
  cancelRepairSchema,
  addRepairItemSchema,
  notifyCustomerSchema,
} from './repairs.validation.js';
import { logger } from '../../utils/logger.js';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    storeId: string;
    email: string;
    permissions: string[];
  };
  params: any;
  query: any;
  body: any;
}

class RepairsController {
  // Create a new repair
  async createRepair(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const validatedData = createRepairSchema.parse(req.body);
      const repair = await repairsService.createRepair(
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.status(201).json({
        success: true,
        data: repair,
        message: 'Repair order created successfully',
      });
    } catch (error: any) {
      logger.error('Create repair error:', error);

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
          code: 'CREATE_REPAIR_FAILED',
          message: error.message || 'Failed to create repair order',
        },
      });
    }
  }

  // Get repair by ID
  async getRepair(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const repair = await repairsService.getRepairById(repairId, req.user.storeId);

      if (!repair) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Repair not found' },
        });
      }

      res.json({
        success: true,
        data: repair,
      });
    } catch (error: any) {
      logger.error('Get repair error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_REPAIR_FAILED',
          message: 'Failed to fetch repair',
        },
      });
    }
  }

  // List repairs with filters
  async listRepairs(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const {
        status,
        repairType,
        priority,
        customerId,
        assignedTo,
        dateFrom,
        dateTo,
        search,
        limit,
        offset,
      } = req.query;

      const result = await repairsService.listRepairs(
        req.user.storeId,
        {
          status: status as string,
          repairType: repairType as string,
          priority: priority as string,
          customerId: customerId as string,
          assignedTo: assignedTo as string,
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
          search: search as string,
        },
        limit ? parseInt(limit as string) : 50,
        offset ? parseInt(offset as string) : 0
      );

      res.json({
        success: true,
        data: result.repairs,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error: any) {
      logger.error('List repairs error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_REPAIRS_FAILED',
          message: 'Failed to fetch repairs',
        },
      });
    }
  }

  // Update repair
  async updateRepair(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const validatedData = updateRepairSchema.parse(req.body);

      const repair = await repairsService.updateRepair(
        repairId,
        req.user.storeId,
        validatedData
      );

      res.json({
        success: true,
        data: repair,
        message: 'Repair updated successfully',
      });
    } catch (error: any) {
      logger.error('Update repair error:', error);

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
          code: 'UPDATE_REPAIR_FAILED',
          message: error.message || 'Failed to update repair',
        },
      });
    }
  }

  // Assess repair and provide quotation
  async assessRepair(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const validatedData = assessRepairSchema.parse(req.body);

      const repair = await repairsService.assessRepair(
        repairId,
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.json({
        success: true,
        data: repair,
        message: 'Repair assessed and quotation created',
      });
    } catch (error: any) {
      logger.error('Assess repair error:', error);

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
          code: 'ASSESS_REPAIR_FAILED',
          message: error.message || 'Failed to assess repair',
        },
      });
    }
  }

  // Approve quotation
  async approveQuotation(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const validatedData = approveQuotationSchema.parse(req.body);

      const repair = await repairsService.approveQuotation(
        repairId,
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.json({
        success: true,
        data: repair,
        message: 'Quotation approved',
      });
    } catch (error: any) {
      logger.error('Approve quotation error:', error);

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
          code: 'APPROVE_QUOTATION_FAILED',
          message: error.message || 'Failed to approve quotation',
        },
      });
    }
  }

  // Start repair work
  async startRepair(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const { assignedTo } = startRepairSchema.parse(req.body);

      const repair = await repairsService.startRepair(
        repairId,
        req.user.storeId,
        req.user.userId,
        assignedTo
      );

      res.json({
        success: true,
        data: repair,
        message: 'Repair work started',
      });
    } catch (error: any) {
      logger.error('Start repair error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'START_REPAIR_FAILED',
          message: error.message || 'Failed to start repair',
        },
      });
    }
  }

  // Complete repair
  async completeRepair(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const { completionPhotos } = completeRepairSchema.parse(req.body);

      const repair = await repairsService.completeRepair(
        repairId,
        req.user.storeId,
        req.user.userId,
        completionPhotos
      );

      res.json({
        success: true,
        data: repair,
        message: 'Repair completed, moved to quality check',
      });
    } catch (error: any) {
      logger.error('Complete repair error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'COMPLETE_REPAIR_FAILED',
          message: error.message || 'Failed to complete repair',
        },
      });
    }
  }

  // Mark repair as ready
  async markReady(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;

      const repair = await repairsService.markReady(
        repairId,
        req.user.storeId,
        req.user.userId
      );

      res.json({
        success: true,
        data: repair,
        message: 'Repair marked as ready for pickup',
      });
    } catch (error: any) {
      logger.error('Mark ready error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'MARK_READY_FAILED',
          message: error.message || 'Failed to mark repair as ready',
        },
      });
    }
  }

  // Deliver repair
  async deliverRepair(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const { paymentReceived } = deliverRepairSchema.parse(req.body);

      const repair = await repairsService.deliverRepair(
        repairId,
        req.user.storeId,
        req.user.userId,
        paymentReceived
      );

      res.json({
        success: true,
        data: repair,
        message: 'Repair delivered to customer',
      });
    } catch (error: any) {
      logger.error('Deliver repair error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DELIVER_REPAIR_FAILED',
          message: error.message || 'Failed to deliver repair',
        },
      });
    }
  }

  // Cancel repair
  async cancelRepair(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const { reason } = cancelRepairSchema.parse(req.body);

      const repair = await repairsService.cancelRepair(
        repairId,
        req.user.storeId,
        reason
      );

      res.json({
        success: true,
        data: repair,
        message: 'Repair cancelled',
      });
    } catch (error: any) {
      logger.error('Cancel repair error:', error);

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
          code: 'CANCEL_REPAIR_FAILED',
          message: error.message || 'Failed to cancel repair',
        },
      });
    }
  }

  // Get repair statistics
  async getStatistics(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const stats = await repairsService.getStatistics(req.user.storeId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get statistics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATISTICS_FAILED',
          message: 'Failed to fetch statistics',
        },
      });
    }
  }

  // Add item to repair
  async addRepairItem(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const validatedData = addRepairItemSchema.parse(req.body);

      const item = await repairsService.addRepairItem(repairId, validatedData);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Item added to repair',
      });
    } catch (error: any) {
      logger.error('Add repair item error:', error);

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
          code: 'ADD_ITEM_FAILED',
          message: error.message || 'Failed to add item',
        },
      });
    }
  }

  // Notify customer about stage
  async notifyCustomer(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { repairId } = req.params;
      const { stageName, method } = notifyCustomerSchema.parse(req.body);

      await repairsService.notifyCustomer(repairId, stageName, method);

      res.json({
        success: true,
        message: 'Customer notified',
      });
    } catch (error: any) {
      logger.error('Notify customer error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'NOTIFY_FAILED',
          message: error.message || 'Failed to notify customer',
        },
      });
    }
  }
}

export const repairsController = new RepairsController();
