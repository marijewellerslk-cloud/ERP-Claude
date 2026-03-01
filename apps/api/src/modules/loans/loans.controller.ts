import { Response } from 'express';
import { loansService } from './loans.service.js';
import {
  createLoanSchema,
  approveLoanSchema,
  addLoanPaymentSchema,
  releaseLoanSchema,
} from './loans.validation.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logger } from '../../utils/logger.js';

export class LoansController {
  async createLoan(req: AuthRequest, res: Response) {
    try {
      const validatedData = createLoanSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const loan = await loansService.createLoan(
        validatedData,
        req.user.storeId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: loan,
      });
    } catch (error: any) {
      logger.error('Create loan error:', error);

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
          code: 'CREATE_LOAN_FAILED',
          message: error.message || 'Failed to create loan',
        },
      });
    }
  }

  async getLoan(req: AuthRequest, res: Response) {
    try {
      const { loanId } = req.params;

      const loan = await loansService.getLoan(loanId);

      res.json({
        success: true,
        data: loan,
      });
    } catch (error: any) {
      logger.error('Get loan error:', error);

      res.status(404).json({
        success: false,
        error: {
          code: 'LOAN_NOT_FOUND',
          message: error.message || 'Loan not found',
        },
      });
    }
  }

  async listLoans(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { status, customerId, startDate, endDate } = req.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (customerId) filters.customerId = customerId;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const loans = await loansService.listLoans(req.user.storeId, filters);

      res.json({
        success: true,
        data: loans,
      });
    } catch (error: any) {
      logger.error('List loans error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_LOANS_FAILED',
          message: 'Failed to list loans',
        },
      });
    }
  }

  async approveLoan(req: AuthRequest, res: Response) {
    try {
      const { loanId } = req.params;
      const validatedData = approveLoanSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const loan = await loansService.approveLoan(
        loanId,
        validatedData,
        req.user.userId
      );

      res.json({
        success: true,
        data: loan,
      });
    } catch (error: any) {
      logger.error('Approve loan error:', error);

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
          code: 'APPROVE_LOAN_FAILED',
          message: error.message || 'Failed to approve loan',
        },
      });
    }
  }

  async addPayment(req: AuthRequest, res: Response) {
    try {
      const { loanId } = req.params;
      const validatedData = addLoanPaymentSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const payment = await loansService.addPayment(
        loanId,
        validatedData,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      logger.error('Add loan payment error:', error);

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

  async releaseLoan(req: AuthRequest, res: Response) {
    try {
      const { loanId } = req.params;
      const validatedData = releaseLoanSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const release = await loansService.releaseLoan(
        loanId,
        validatedData,
        req.user.userId
      );

      res.json({
        success: true,
        data: release,
      });
    } catch (error: any) {
      logger.error('Release loan error:', error);

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
          code: 'RELEASE_LOAN_FAILED',
          message: error.message || 'Failed to release loan',
        },
      });
    }
  }

  async getOverdueLoans(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const loans = await loansService.getOverdueLoans(req.user.storeId);

      res.json({
        success: true,
        data: loans,
      });
    } catch (error: any) {
      logger.error('Get overdue loans error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_OVERDUE_FAILED',
          message: 'Failed to get overdue loans',
        },
      });
    }
  }

  async getStats(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const stats = await loansService.getLoanStats(req.user.storeId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get loan stats error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATS_FAILED',
          message: 'Failed to get loan statistics',
        },
      });
    }
  }
}

export const loansController = new LoansController();
