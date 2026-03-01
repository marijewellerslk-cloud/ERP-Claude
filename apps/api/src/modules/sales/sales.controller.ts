import { Response } from 'express';
import { salesService } from './sales.service.js';
import {
  updateGoldRateSchema,
  createInvoiceSchema,
  addPaymentSchema,
  createQuotationSchema,
} from './sales.validation.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logger } from '../../utils/logger.js';

export class SalesController {
  // ============================================================================
  // GOLD RATES
  // ============================================================================

  async updateGoldRate(req: AuthRequest, res: Response) {
    try {
      const validatedData = updateGoldRateSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const rate = await salesService.updateGoldRate(validatedData, req.user.userId);

      res.json({
        success: true,
        data: rate,
      });
    } catch (error: any) {
      logger.error('Update gold rate error:', error);

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
          code: 'UPDATE_RATE_FAILED',
          message: error.message || 'Failed to update gold rate',
        },
      });
    }
  }

  async getCurrentGoldRate(req: AuthRequest, res: Response) {
    try {
      const { goldType, purity } = req.query;

      if (!goldType || !purity) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'goldType and purity are required',
          },
        });
      }

      const rate = await salesService.getCurrentGoldRate(
        goldType as string,
        purity as string
      );

      res.json({
        success: true,
        data: rate,
      });
    } catch (error: any) {
      logger.error('Get current gold rate error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_RATE_FAILED',
          message: 'Failed to get current gold rate',
        },
      });
    }
  }

  async listGoldRates(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      const rates = await salesService.listGoldRates(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json({
        success: true,
        data: rates,
      });
    } catch (error: any) {
      logger.error('List gold rates error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_RATES_FAILED',
          message: 'Failed to list gold rates',
        },
      });
    }
  }

  // ============================================================================
  // INVOICES
  // ============================================================================

  async createInvoice(req: AuthRequest, res: Response) {
    try {
      const validatedData = createInvoiceSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const invoice = await salesService.createInvoice(
        validatedData,
        req.user.storeId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: invoice,
      });
    } catch (error: any) {
      logger.error('Create invoice error:', error);

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
          code: 'CREATE_INVOICE_FAILED',
          message: error.message || 'Failed to create invoice',
        },
      });
    }
  }

  async getInvoice(req: AuthRequest, res: Response) {
    try {
      const { invoiceId } = req.params;

      const invoice = await salesService.getInvoice(invoiceId);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error: any) {
      logger.error('Get invoice error:', error);

      res.status(404).json({
        success: false,
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: error.message || 'Invoice not found',
        },
      });
    }
  }

  async listInvoices(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { paymentStatus, startDate, endDate, customerId } = req.query;

      const filters: any = {};
      if (paymentStatus) filters.paymentStatus = paymentStatus;
      if (customerId) filters.customerId = customerId;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const invoices = await salesService.listInvoices(req.user.storeId, filters);

      res.json({
        success: true,
        data: invoices,
      });
    } catch (error: any) {
      logger.error('List invoices error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_INVOICES_FAILED',
          message: 'Failed to list invoices',
        },
      });
    }
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  async addPayment(req: AuthRequest, res: Response) {
    try {
      const { invoiceId } = req.params;
      const validatedData = addPaymentSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const payment = await salesService.addPayment(
        invoiceId,
        validatedData,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      logger.error('Add payment error:', error);

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
          code: 'ADD_PAYMENT_FAILED',
          message: error.message || 'Failed to add payment',
        },
      });
    }
  }

  // ============================================================================
  // QUOTATIONS
  // ============================================================================

  async createQuotation(req: AuthRequest, res: Response) {
    try {
      const validatedData = createQuotationSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const quotation = await salesService.createQuotation(
        validatedData,
        req.user.storeId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: quotation,
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

      res.status(400).json({
        success: false,
        error: {
          code: 'CREATE_QUOTATION_FAILED',
          message: error.message || 'Failed to create quotation',
        },
      });
    }
  }

  async listQuotations(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { status } = req.query;

      const quotations = await salesService.listQuotations(
        req.user.storeId,
        status as string | undefined
      );

      res.json({
        success: true,
        data: quotations,
      });
    } catch (error: any) {
      logger.error('List quotations error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_QUOTATIONS_FAILED',
          message: 'Failed to list quotations',
        },
      });
    }
  }

  // ============================================================================
  // ANALYTICS
  // ============================================================================

  async getSalesStats(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'startDate and endDate are required',
          },
        });
      }

      const stats = await salesService.getSalesStats(
        req.user.storeId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get sales stats error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATS_FAILED',
          message: 'Failed to get sales statistics',
        },
      });
    }
  }
}

export const salesController = new SalesController();
