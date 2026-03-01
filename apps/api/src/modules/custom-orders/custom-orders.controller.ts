import { Response } from 'express';
import { customOrdersService } from './custom-orders.service.js';
import {
  createCustomOrderSchema,
  updateCustomOrderSchema,
  addDesignVersionSchema,
  presentDesignSchema,
  designFeedbackSchema,
  quoteCustomOrderSchema,
  approveOrderSchema,
  startProductionSchema,
  completeProductionSchema,
  qualityCheckSchema,
  deliverOrderSchema,
  cancelOrderSchema,
  addOrderItemSchema,
  notifyCustomerSchema,
} from './custom-orders.validation.js';
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

class CustomOrdersController {
  // Create a new custom order
  async createOrder(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const validatedData = createCustomOrderSchema.parse(req.body);
      const order = await customOrdersService.createCustomOrder(
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.status(201).json({
        success: true,
        data: order,
        message: 'Custom order created successfully',
      });
    } catch (error: any) {
      logger.error('Create custom order error:', error);

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
          code: 'CREATE_ORDER_FAILED',
          message: error.message || 'Failed to create custom order',
        },
      });
    }
  }

  // Get order by ID
  async getOrder(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const order = await customOrdersService.getOrderById(orderId, req.user.storeId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Custom order not found' },
        });
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error: any) {
      logger.error('Get custom order error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ORDER_FAILED',
          message: 'Failed to fetch custom order',
        },
      });
    }
  }

  // List orders with filters
  async listOrders(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const {
        status,
        orderType,
        priority,
        customerId,
        assignedTo,
        dateFrom,
        dateTo,
        search,
        limit,
        offset,
      } = req.query;

      const result = await customOrdersService.listOrders(
        req.user.storeId,
        {
          status: status as string,
          orderType: orderType as string,
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
        data: result.orders,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error: any) {
      logger.error('List custom orders error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_ORDERS_FAILED',
          message: 'Failed to fetch custom orders',
        },
      });
    }
  }

  // Update order
  async updateOrder(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const validatedData = updateCustomOrderSchema.parse(req.body);

      const order = await customOrdersService.updateOrder(
        orderId,
        req.user.storeId,
        validatedData
      );

      res.json({
        success: true,
        data: order,
        message: 'Custom order updated successfully',
      });
    } catch (error: any) {
      logger.error('Update custom order error:', error);

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
          code: 'UPDATE_ORDER_FAILED',
          message: error.message || 'Failed to update custom order',
        },
      });
    }
  }

  // Add design version
  async addDesignVersion(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const validatedData = addDesignVersionSchema.parse(req.body);

      const version = await customOrdersService.addDesignVersion(
        orderId,
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.status(201).json({
        success: true,
        data: version,
        message: 'Design version added successfully',
      });
    } catch (error: any) {
      logger.error('Add design version error:', error);

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
          code: 'ADD_DESIGN_VERSION_FAILED',
          message: error.message || 'Failed to add design version',
        },
      });
    }
  }

  // Present design to customer
  async presentDesign(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const { versionId } = presentDesignSchema.parse(req.body);

      const order = await customOrdersService.presentDesign(
        orderId,
        req.user.storeId,
        versionId
      );

      res.json({
        success: true,
        data: order,
        message: 'Design presented to customer',
      });
    } catch (error: any) {
      logger.error('Present design error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PRESENT_DESIGN_FAILED',
          message: error.message || 'Failed to present design',
        },
      });
    }
  }

  // Add design feedback
  async addDesignFeedback(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const { versionId, feedback } = designFeedbackSchema.parse(req.body);

      const order = await customOrdersService.addDesignFeedback(
        orderId,
        req.user.storeId,
        versionId,
        feedback
      );

      res.json({
        success: true,
        data: order,
        message: 'Feedback recorded',
      });
    } catch (error: any) {
      logger.error('Add design feedback error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ADD_FEEDBACK_FAILED',
          message: error.message || 'Failed to add feedback',
        },
      });
    }
  }

  // Create quotation
  async createQuotation(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const validatedData = quoteCustomOrderSchema.parse(req.body);

      const order = await customOrdersService.createQuotation(
        orderId,
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.json({
        success: true,
        data: order,
        message: 'Quotation created successfully',
      });
    } catch (error: any) {
      logger.error('Create quotation error:', error);

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
          code: 'CREATE_QUOTATION_FAILED',
          message: error.message || 'Failed to create quotation',
        },
      });
    }
  }

  // Approve order
  async approveOrder(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const validatedData = approveOrderSchema.parse(req.body);

      const order = await customOrdersService.approveOrder(
        orderId,
        req.user.storeId,
        req.user.userId,
        validatedData
      );

      res.json({
        success: true,
        data: order,
        message: 'Order approved successfully',
      });
    } catch (error: any) {
      logger.error('Approve order error:', error);

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
          code: 'APPROVE_ORDER_FAILED',
          message: error.message || 'Failed to approve order',
        },
      });
    }
  }

  // Start production
  async startProduction(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const { craftsman, workshopNotes } = startProductionSchema.parse(req.body);

      const order = await customOrdersService.startProduction(
        orderId,
        req.user.storeId,
        req.user.userId,
        craftsman,
        workshopNotes
      );

      res.json({
        success: true,
        data: order,
        message: 'Production started',
      });
    } catch (error: any) {
      logger.error('Start production error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'START_PRODUCTION_FAILED',
          message: error.message || 'Failed to start production',
        },
      });
    }
  }

  // Complete production
  async completeProduction(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const { actualWeight, completionPhotos } = completeProductionSchema.parse(req.body);

      const order = await customOrdersService.completeProduction(
        orderId,
        req.user.storeId,
        req.user.userId,
        actualWeight,
        completionPhotos
      );

      res.json({
        success: true,
        data: order,
        message: 'Production completed, moved to quality check',
      });
    } catch (error: any) {
      logger.error('Complete production error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'COMPLETE_PRODUCTION_FAILED',
          message: error.message || 'Failed to complete production',
        },
      });
    }
  }

  // Quality check
  async qualityCheck(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const { passed, notes } = qualityCheckSchema.parse(req.body);

      const order = await customOrdersService.qualityCheck(
        orderId,
        req.user.storeId,
        req.user.userId,
        passed,
        notes
      );

      res.json({
        success: true,
        data: order,
        message: passed ? 'Quality check passed, ready for delivery' : 'Quality check failed, returned to production',
      });
    } catch (error: any) {
      logger.error('Quality check error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'QUALITY_CHECK_FAILED',
          message: error.message || 'Failed to process quality check',
        },
      });
    }
  }

  // Deliver order
  async deliverOrder(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const { paymentReceived, packagingPhotos } = deliverOrderSchema.parse(req.body);

      const order = await customOrdersService.deliverOrder(
        orderId,
        req.user.storeId,
        req.user.userId,
        paymentReceived,
        packagingPhotos
      );

      res.json({
        success: true,
        data: order,
        message: 'Order delivered to customer',
      });
    } catch (error: any) {
      logger.error('Deliver order error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DELIVER_ORDER_FAILED',
          message: error.message || 'Failed to deliver order',
        },
      });
    }
  }

  // Cancel order
  async cancelOrder(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const { reason } = cancelOrderSchema.parse(req.body);

      const order = await customOrdersService.cancelOrder(
        orderId,
        req.user.storeId,
        req.user.userId,
        reason
      );

      res.json({
        success: true,
        data: order,
        message: 'Order cancelled',
      });
    } catch (error: any) {
      logger.error('Cancel order error:', error);

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
          code: 'CANCEL_ORDER_FAILED',
          message: error.message || 'Failed to cancel order',
        },
      });
    }
  }

  // Get statistics
  async getStatistics(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const stats = await customOrdersService.getStatistics(req.user.storeId);

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

  // Add item to order
  async addOrderItem(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const validatedData = addOrderItemSchema.parse(req.body);

      const item = await customOrdersService.addOrderItem(orderId, validatedData);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Item added to order',
      });
    } catch (error: any) {
      logger.error('Add order item error:', error);

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

  // Notify customer
  async notifyCustomer(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { orderId } = req.params;
      const { stageName, method } = notifyCustomerSchema.parse(req.body);

      await customOrdersService.notifyCustomer(orderId, stageName, method);

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

export const customOrdersController = new CustomOrdersController();
