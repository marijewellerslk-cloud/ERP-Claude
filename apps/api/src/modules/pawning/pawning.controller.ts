import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logger } from '../../utils/logger.js';
import { goldPawningService } from '../../services/gold-pawning.service.js';
import { kycService } from '../../services/kyc.service.js';
import { loanNotificationService } from '../../services/loan-notification.service.js';

export class PawningController {
  // ─── Interest Rate Config ───────────────────────────────────────────

  async getInterestRates(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const rates = await goldPawningService.getInterestRates(req.user.storeId);

      res.json({
        success: true,
        data: rates,
      });
    } catch (error: any) {
      logger.error('Get interest rates error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_INTEREST_RATES_FAILED',
          message: 'Failed to get interest rates',
        },
      });
    }
  }

  async createInterestRate(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      // Validate dates
      const effectiveFrom = new Date(req.body.effectiveFrom);
      if (isNaN(effectiveFrom.getTime())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATE',
            message: 'Invalid effectiveFrom date',
          },
        });
      }

      // Validate required fields
      if (!req.body.rateName || !req.body.minAmount || !req.body.annualRate) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Rate name, min amount, and annual rate are required',
          },
        });
      }

      // Convert numeric fields
      const minAmount = parseFloat(req.body.minAmount);
      if (isNaN(minAmount)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NUMBER',
            message: 'Invalid min amount',
          },
        });
      }

      const maxAmount = req.body.maxAmount ? parseFloat(req.body.maxAmount) : undefined;
      if (maxAmount !== undefined && isNaN(maxAmount)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NUMBER',
            message: 'Invalid max amount',
          },
        });
      }

      const annualRate = parseFloat(req.body.annualRate);
      if (isNaN(annualRate)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NUMBER',
            message: 'Invalid annual rate',
          },
        });
      }
      if (annualRate > 999.99) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RATE',
            message: 'Annual rate cannot exceed 999.99%',
          },
        });
      }

      const penaltyRate = req.body.penaltyRate ? parseFloat(req.body.penaltyRate) : undefined;
      if (penaltyRate !== undefined && isNaN(penaltyRate)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NUMBER',
            message: 'Invalid penalty rate',
          },
        });
      }
      if (penaltyRate !== undefined && penaltyRate > 999.99) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RATE',
            message: 'Penalty rate cannot exceed 999.99%',
          },
        });
      }

      const maxLtv = parseFloat(req.body.maxLtv);
      if (isNaN(maxLtv)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NUMBER',
            message: 'Invalid max LTV',
          },
        });
      }
      if (maxLtv > 999.99) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_LTV',
            message: 'Max LTV cannot exceed 999.99%',
          },
        });
      }

      const maxTenureMonths = req.body.maxTenureMonths ? parseInt(req.body.maxTenureMonths) : undefined;
      if (maxTenureMonths !== undefined && isNaN(maxTenureMonths)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NUMBER',
            message: 'Invalid max tenure months',
          },
        });
      }

      const rate = await goldPawningService.createInterestRate(
        req.user.storeId,
        {
          rateName: req.body.rateName,
          minAmount,
          maxAmount,
          annualRate,
          penaltyRate,
          maxLtv,
          maxTenureMonths,
          effectiveFrom,
        },
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: rate,
      });
    } catch (error: any) {
      logger.error('Create interest rate error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'CREATE_INTEREST_RATE_FAILED',
          message: error.message || 'Failed to create interest rate',
        },
      });
    }
  }

  async updateInterestRate(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { rateId } = req.params;

      let updateData: any = {};
      
      // Handle field conversions with validation
      if (req.body.rateName !== undefined) updateData.rateName = req.body.rateName;
      
      if (req.body.annualRate !== undefined) {
        const annualRate = parseFloat(req.body.annualRate);
        if (isNaN(annualRate)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_NUMBER',
              message: 'Invalid annual rate',
            },
          });
        }
        if (annualRate > 999.99) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_RATE',
              message: 'Annual rate cannot exceed 999.99%',
            },
          });
        }
        updateData.annualRate = annualRate;
      }
      
      if (req.body.penaltyRate !== undefined) {
        const penaltyRate = parseFloat(req.body.penaltyRate);
        if (isNaN(penaltyRate)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_NUMBER',
              message: 'Invalid penalty rate',
            },
          });
        }
        if (penaltyRate > 999.99) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_RATE',
              message: 'Penalty rate cannot exceed 999.99%',
            },
          });
        }
        updateData.penaltyRate = penaltyRate;
      }
      
      if (req.body.maxLtv !== undefined) {
        const maxLtv = parseFloat(req.body.maxLtv);
        if (isNaN(maxLtv)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_NUMBER',
              message: 'Invalid max LTV',
            },
          });
        }
        if (maxLtv > 999.99) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_LTV',
              message: 'Max LTV cannot exceed 999.99%',
            },
          });
        }
        updateData.maxLtv = maxLtv;
      }
      
      if (req.body.maxTenureMonths !== undefined) {
        const maxTenureMonths = parseInt(req.body.maxTenureMonths);
        if (isNaN(maxTenureMonths)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_NUMBER',
              message: 'Invalid max tenure months',
            },
          });
        }
        updateData.maxTenureMonths = maxTenureMonths;
      }
      
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

      const rate = await goldPawningService.updateInterestRate(rateId, updateData);

      res.json({
        success: true,
        data: rate,
      });
    } catch (error: any) {
      logger.error('Update interest rate error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'UPDATE_INTEREST_RATE_FAILED',
          message: error.message || 'Failed to update interest rate',
        },
      });
    }
  }

  async getApplicableRate(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { amount } = req.query;

      const rate = await goldPawningService.getApplicableRate(
        req.user.storeId,
        parseFloat(amount as string)
      );

      res.json({
        success: true,
        data: rate,
      });
    } catch (error: any) {
      logger.error('Get applicable rate error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'GET_APPLICABLE_RATE_FAILED',
          message: error.message || 'Failed to get applicable rate',
        },
      });
    }
  }

  // ─── LTV Management ────────────────────────────────────────────────

  async calculateLTV(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanId } = req.params;

      const ltv = await goldPawningService.calculateLTV(loanId);

      res.json({
        success: true,
        data: ltv,
      });
    } catch (error: any) {
      logger.error('Calculate LTV error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'CALCULATE_LTV_FAILED',
          message: error.message || 'Failed to calculate LTV',
        },
      });
    }
  }

  async validateLTV(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanAmount, totalGoldValue, maxLtv } = req.body;

      const validation = await goldPawningService.validateLTV(
        loanAmount,
        totalGoldValue,
        maxLtv
      );

      res.json({
        success: true,
        data: validation,
      });
    } catch (error: any) {
      logger.error('Validate LTV error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATE_LTV_FAILED',
          message: error.message || 'Failed to validate LTV',
        },
      });
    }
  }

  async recalculateLTV(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanId } = req.params;

      const ltv = await goldPawningService.recalculateLoanLTV(loanId);

      res.json({
        success: true,
        data: ltv,
      });
    } catch (error: any) {
      logger.error('Recalculate LTV error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'RECALCULATE_LTV_FAILED',
          message: error.message || 'Failed to recalculate LTV',
        },
      });
    }
  }

  async getLtvHistory(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanId } = req.params;

      const history = await goldPawningService.getLtvHistory(loanId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      logger.error('Get LTV history error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_LTV_HISTORY_FAILED',
          message: 'Failed to get LTV history',
        },
      });
    }
  }

  async getLtvAlerts(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const alerts = await goldPawningService.getLtvAlerts(req.user.storeId);

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error: any) {
      logger.error('Get LTV alerts error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_LTV_ALERTS_FAILED',
          message: 'Failed to get LTV alerts',
        },
      });
    }
  }

  // ─── Interest ───────────────��────────────────────────��──────────────

  async calculateInterest(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { principal, annualRate, fromDate, toDate, penaltyRate, isOverdue } = req.body;

      const interest = await goldPawningService.calculateInterestAccrual(
        principal,
        annualRate,
        fromDate,
        toDate,
        penaltyRate,
        isOverdue
      );

      res.json({
        success: true,
        data: interest,
      });
    } catch (error: any) {
      logger.error('Calculate interest error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'CALCULATE_INTEREST_FAILED',
          message: error.message || 'Failed to calculate interest',
        },
      });
    }
  }

  async accrueAllInterest(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await goldPawningService.accrueInterestForAllLoans(req.user.storeId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Accrue all interest error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'ACCRUE_INTEREST_FAILED',
          message: 'Failed to accrue interest for all loans',
        },
      });
    }
  }

  // ─── KYC ───────────────────���──────────────────���─────────────────────

  async getCustomerKyc(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { customerId } = req.params;

      const kyc = await kycService.getCustomerKyc(customerId);

      res.json({
        success: true,
        data: kyc,
      });
    } catch (error: any) {
      logger.error('Get customer KYC error:', error);

      res.status(404).json({
        success: false,
        error: {
          code: 'KYC_NOT_FOUND',
          message: error.message || 'KYC record not found',
        },
      });
    }
  }

  async createOrUpdateKyc(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { customerId } = req.params;

      const kyc = await kycService.createOrUpdateKyc(
        customerId,
        req.user.storeId,
        req.body
      );

      res.json({
        success: true,
        data: kyc,
      });
    } catch (error: any) {
      logger.error('Create/update KYC error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'KYC_UPDATE_FAILED',
          message: error.message || 'Failed to create or update KYC',
        },
      });
    }
  }

  async verifyKycDocument(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { kycId } = req.params;
      const { field } = req.body;

      const result = await kycService.verifyDocument(kycId, field, req.user.userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Verify KYC document error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'KYC_VERIFY_FAILED',
          message: error.message || 'Failed to verify KYC document',
        },
      });
    }
  }

  async updateKycStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { kycId } = req.params;
      const { status } = req.body;

      const result = await kycService.updateKycStatus(kycId, status, req.user.userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Update KYC status error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'KYC_STATUS_UPDATE_FAILED',
          message: error.message || 'Failed to update KYC status',
        },
      });
    }
  }

  async getKycPendingLoans(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const loans = await kycService.getKycPendingLoans(req.user.storeId);

      res.json({
        success: true,
        data: loans,
      });
    } catch (error: any) {
      logger.error('Get KYC pending loans error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_KYC_PENDING_FAILED',
          message: 'Failed to get KYC pending loans',
        },
      });
    }
  }

  // ─── Margin Calls ──────────────────────────────────────────────────

  async getPendingMarginCalls(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const marginCalls = await goldPawningService.getPendingMarginCalls(req.user.storeId);

      res.json({
        success: true,
        data: marginCalls,
      });
    } catch (error: any) {
      logger.error('Get pending margin calls error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_MARGIN_CALLS_FAILED',
          message: 'Failed to get pending margin calls',
        },
      });
    }
  }

  async createMarginCall(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanId } = req.params;

      const ltv = await goldPawningService.calculateLTV(loanId);
      const marginCall = await goldPawningService.createMarginCall(
        loanId,
        ltv,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: marginCall,
      });
    } catch (error: any) {
      logger.error('Create margin call error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'CREATE_MARGIN_CALL_FAILED',
          message: error.message || 'Failed to create margin call',
        },
      });
    }
  }

  async recordMarginCallCompliance(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { callId } = req.params;
      const { paymentAmount } = req.body;

      const result = await goldPawningService.recordMarginCallCompliance(
        callId,
        paymentAmount
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Record margin call compliance error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'MARGIN_CALL_COMPLIANCE_FAILED',
          message: error.message || 'Failed to record margin call compliance',
        },
      });
    }
  }

  async checkAllMarginCalls(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await goldPawningService.checkMarginCalls(req.user.storeId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Check all margin calls error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'CHECK_MARGIN_CALLS_FAILED',
          message: 'Failed to check margin calls',
        },
      });
    }
  }

  // ─── Renewals ───────────────────────────────────────────────────────

  async renewLoan(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanId } = req.params;

      const renewal = await goldPawningService.renewLoan(
        loanId,
        req.body,
        req.user.storeId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: renewal,
      });
    } catch (error: any) {
      logger.error('Renew loan error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'RENEW_LOAN_FAILED',
          message: error.message || 'Failed to renew loan',
        },
      });
    }
  }

  async getRenewalHistory(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanId } = req.params;

      const history = await goldPawningService.getRenewalHistory(loanId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      logger.error('Get renewal history error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_RENEWAL_HISTORY_FAILED',
          message: 'Failed to get renewal history',
        },
      });
    }
  }

  // ─── Auctions ───────────────────────────────────────────────────────

  async getAuctions(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { status } = req.query;

      const auctions = await goldPawningService.getAuctions(
        req.user.storeId,
        status as string
      );

      res.json({
        success: true,
        data: auctions,
      });
    } catch (error: any) {
      logger.error('Get auctions error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_AUCTIONS_FAILED',
          message: 'Failed to get auctions',
        },
      });
    }
  }

  async initiateAuction(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanId } = req.params;

      const auction = await goldPawningService.initiateAuction(
        loanId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: auction,
      });
    } catch (error: any) {
      logger.error('Initiate auction error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'INITIATE_AUCTION_FAILED',
          message: error.message || 'Failed to initiate auction',
        },
      });
    }
  }

  async completeAuction(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { auctionId } = req.params;

      const auction = await goldPawningService.completeAuction(
        auctionId,
        req.body,
        req.user.userId
      );

      res.json({
        success: true,
        data: auction,
      });
    } catch (error: any) {
      logger.error('Complete auction error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'COMPLETE_AUCTION_FAILED',
          message: error.message || 'Failed to complete auction',
        },
      });
    }
  }

  // ─── Dashboard ──────────────────────────────────────────────────────

  async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const stats = await goldPawningService.getLoanStats(req.user.storeId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get dashboard stats error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_DASHBOARD_STATS_FAILED',
          message: 'Failed to get dashboard statistics',
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

      const loans = await goldPawningService.getOverdueLoans(req.user.storeId);

      res.json({
        success: true,
        data: loans,
      });
    } catch (error: any) {
      logger.error('Get overdue loans error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_OVERDUE_LOANS_FAILED',
          message: 'Failed to get overdue loans',
        },
      });
    }
  }

  async getMaturingLoans(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { days } = req.query;
      const daysAhead = days ? parseInt(days as string) : 7;

      const loans = await goldPawningService.getMaturingLoans(
        req.user.storeId,
        daysAhead
      );

      res.json({
        success: true,
        data: loans,
      });
    } catch (error: any) {
      logger.error('Get maturing loans error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_MATURING_LOANS_FAILED',
          message: 'Failed to get maturing loans',
        },
      });
    }
  }

  // ─── Notifications ─────────────────────────────────────────────────

  async sendNotification(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanId } = req.params;
      const { type, channel } = req.body;

      const result = await loanNotificationService.sendLoanNotification(
        loanId,
        type,
        channel
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Send notification error:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'SEND_NOTIFICATION_FAILED',
          message: error.message || 'Failed to send notification',
        },
      });
    }
  }

  async getNotificationHistory(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { loanId } = req.params;

      const history = await loanNotificationService.getNotificationHistory(loanId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      logger.error('Get notification history error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_NOTIFICATION_HISTORY_FAILED',
          message: 'Failed to get notification history',
        },
      });
    }
  }

  async sendBulkReminders(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { type } = req.body;

      const result = await loanNotificationService.sendBulkReminders(
        req.user.storeId,
        type
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Send bulk reminders error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_BULK_REMINDERS_FAILED',
          message: 'Failed to send bulk reminders',
        },
      });
    }
  }

  async getNotificationTemplates(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { channel } = req.query;

      const templates = await loanNotificationService.getTemplates(channel as string);

      res.json({
        success: true,
        data: templates,
      });
    } catch (error: any) {
      logger.error('Get notification templates error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_TEMPLATES_FAILED',
          message: 'Failed to get notification templates',
        },
      });
    }
  }
}

export const pawningController = new PawningController();
