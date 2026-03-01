import { Response } from 'express';
import { customersService } from './customers.service.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  loyaltyTransactionSchema,
} from './customers.validation.js';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { logger } from '../../utils/logger.js';
import { loyaltyService } from '../../services/loyalty.service.js';
import { wishlistService } from '../../services/wishlist.service.js';
import { buyingHabitsService } from '../../services/buying-habits.service.js';
import { referralService } from '../../services/referral.service.js';
import { whatsappService } from '../../services/whatsapp.service.js';

export class CustomersController {
  async createCustomer(req: AuthRequest, res: Response) {
    try {
      const validatedData = createCustomerSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const customer = await customersService.createCustomer(
        validatedData,
        req.user.storeId
      );

      res.status(201).json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      logger.error('Create customer error:', error);

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
          code: 'CREATE_CUSTOMER_FAILED',
          message: error.message || 'Failed to create customer',
        },
      });
    }
  }

  async getCustomer(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;

      const customer = await customersService.getCustomer(customerId);

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      logger.error('Get customer error:', error);

      res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: error.message || 'Customer not found',
        },
      });
    }
  }

  async updateCustomer(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const validatedData = updateCustomerSchema.parse(req.body);

      const customer = await customersService.updateCustomer(customerId, validatedData);

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      logger.error('Update customer error:', error);

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
          code: 'UPDATE_CUSTOMER_FAILED',
          message: error.message || 'Failed to update customer',
        },
      });
    }
  }

  async listCustomers(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { search } = req.query;

      const customers = await customersService.listCustomers(
        req.user.storeId,
        search as string | undefined
      );

      res.json({
        success: true,
        data: customers,
      });
    } catch (error: any) {
      logger.error('List customers error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_CUSTOMERS_FAILED',
          message: 'Failed to list customers',
        },
      });
    }
  }

  async getPurchaseHistory(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;

      const history = await customersService.getCustomerPurchaseHistory(customerId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      logger.error('Get purchase history error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_HISTORY_FAILED',
          message: 'Failed to get purchase history',
        },
      });
    }
  }

  async addLoyaltyPoints(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const validatedData = loyaltyTransactionSchema.parse(req.body);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const transaction = await customersService.addLoyaltyPoints(
        customerId,
        validatedData,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: transaction,
      });
    } catch (error: any) {
      logger.error('Add loyalty points error:', error);

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
          code: 'ADD_LOYALTY_FAILED',
          message: error.message || 'Failed to add loyalty points',
        },
      });
    }
  }

  async getLoyaltyTransactions(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;

      const transactions = await customersService.getLoyaltyTransactions(customerId);

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error: any) {
      logger.error('Get loyalty transactions error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_LOYALTY_FAILED',
          message: 'Failed to get loyalty transactions',
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

      const stats = await customersService.getCustomerStats(req.user.storeId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get customer stats error:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATS_FAILED',
          message: 'Failed to get customer statistics',
        },
      });
    }
  }

  // ============================================================================
  // LOYALTY & REWARDS METHODS
  // ============================================================================

  async getLoyaltyInfo(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const loyaltyInfo = await loyaltyService.getCustomerLoyaltyInfo(customerId);

      res.json({
        success: true,
        data: loyaltyInfo,
      });
    } catch (error: any) {
      logger.error('Get loyalty info error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_LOYALTY_INFO_FAILED', message: error.message },
      });
    }
  }

  async getAvailableRewards(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const rewards = await loyaltyService.getAvailableRewards(customerId, req.user.storeId);

      res.json({
        success: true,
        data: rewards,
      });
    } catch (error: any) {
      logger.error('Get available rewards error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_REWARDS_FAILED', message: error.message },
      });
    }
  }

  async redeemReward(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const { rewardId } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const redemption = await loyaltyService.redeemReward(
        customerId,
        rewardId,
        req.user.storeId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        data: redemption,
      });
    } catch (error: any) {
      logger.error('Redeem reward error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'REDEEM_REWARD_FAILED', message: error.message },
      });
    }
  }

  async getRedemptions(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const loyaltyInfo = await loyaltyService.getCustomerLoyaltyInfo(customerId);

      res.json({
        success: true,
        data: loyaltyInfo.activeRedemptions,
      });
    } catch (error: any) {
      logger.error('Get redemptions error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_REDEMPTIONS_FAILED', message: error.message },
      });
    }
  }

  // ============================================================================
  // WISHLIST METHODS
  // ============================================================================

  async getWishlist(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const { includeInactive } = req.query;

      const wishlist = await wishlistService.getCustomerWishlist(
        customerId,
        includeInactive === 'true'
      );

      res.json({
        success: true,
        data: wishlist,
      });
    } catch (error: any) {
      logger.error('Get wishlist error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_WISHLIST_FAILED', message: error.message },
      });
    }
  }

  async addToWishlist(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const wishlistItem = await wishlistService.createWishlistItem({
        customerId,
        storeId: req.user.storeId,
        createdBy: req.user.userId,
        ...req.body,
      });

      res.status(201).json({
        success: true,
        data: wishlistItem,
      });
    } catch (error: any) {
      logger.error('Add to wishlist error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'ADD_WISHLIST_FAILED', message: error.message },
      });
    }
  }

  async updateWishlistItem(req: AuthRequest, res: Response) {
    try {
      const { wishlistId } = req.params;
      const updated = await wishlistService.updateWishlistItem(wishlistId, req.body);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      logger.error('Update wishlist item error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'UPDATE_WISHLIST_FAILED', message: error.message },
      });
    }
  }

  async removeFromWishlist(req: AuthRequest, res: Response) {
    try {
      const { wishlistId } = req.params;
      await wishlistService.deleteWishlistItem(wishlistId);

      res.json({
        success: true,
        message: 'Wishlist item removed',
      });
    } catch (error: any) {
      logger.error('Remove wishlist item error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'REMOVE_WISHLIST_FAILED', message: error.message },
      });
    }
  }

  // ============================================================================
  // BUYING HABITS METHODS
  // ============================================================================

  async getBuyingHabits(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const habits = await buyingHabitsService.getCustomerHabits(customerId);

      res.json({
        success: true,
        data: habits,
      });
    } catch (error: any) {
      logger.error('Get buying habits error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_HABITS_FAILED', message: error.message },
      });
    }
  }

  async recalculateHabits(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      await buyingHabitsService.calculateCustomerHabits(customerId, req.user.storeId);

      res.json({
        success: true,
        message: 'Buying habits recalculated',
      });
    } catch (error: any) {
      logger.error('Recalculate habits error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'RECALCULATE_HABITS_FAILED', message: error.message },
      });
    }
  }

  // ============================================================================
  // REFERRAL METHODS
  // ============================================================================

  async getReferrals(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const referrals = await referralService.getReferralsByReferrer(customerId);

      res.json({
        success: true,
        data: referrals,
      });
    } catch (error: any) {
      logger.error('Get referrals error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_REFERRALS_FAILED', message: error.message },
      });
    }
  }

  async createReferral(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const { referredId, referralCode, notes } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const referral = await referralService.createReferral({
        storeId: req.user.storeId,
        referrerId: customerId,
        referredId,
        referralCode,
        notes,
        recordedBy: req.user.userId,
      });

      res.status(201).json({
        success: true,
        data: referral,
      });
    } catch (error: any) {
      logger.error('Create referral error:', error);
      res.status(400).json({
        success: false,
        error: { code: 'CREATE_REFERRAL_FAILED', message: error.message },
      });
    }
  }

  // ============================================================================
  // WHATSAPP COMMUNICATION METHODS
  // ============================================================================

  async getMessageHistory(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const { limit } = req.query;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const messages = await whatsappService.getMessageHistory(
        req.user.storeId,
        undefined,
        customerId,
        undefined,
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      logger.error('Get message history error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_MESSAGES_FAILED', message: error.message },
      });
    }
  }

  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const { message, phoneNumber } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      if (!whatsappService.isConfigured()) {
        return res.status(400).json({
          success: false,
          error: { code: 'WHATSAPP_NOT_CONFIGURED', message: 'WhatsApp is not configured' },
        });
      }

      const result = await whatsappService.sendMessage({
        phoneNumber,
        message,
        storeId: req.user.storeId,
        customerId,
        sentBy: req.user.userId,
      });

      res.json({
        success: result.success,
        data: { messageId: result.messageId },
        error: result.error ? { message: result.error } : undefined,
      });
    } catch (error: any) {
      logger.error('Send message error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'SEND_MESSAGE_FAILED', message: error.message },
      });
    }
  }
}

export const customersController = new CustomersController();
