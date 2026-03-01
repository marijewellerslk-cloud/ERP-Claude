import { Router } from 'express';
import { customersController } from './customers.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

// Constants defined locally to avoid import issues
const RESOURCES = {
  CUSTOMERS: 'customers',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

const router = Router();

// All customer routes require authentication
router.use(authenticate);

// Customer CRUD routes
router.post(
  '/',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.CREATE),
  (req, res) => customersController.createCustomer(req, res)
);

router.get(
  '/',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.listCustomers(req, res)
);

router.get(
  '/stats',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getStats(req, res)
);

router.get(
  '/:customerId',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getCustomer(req, res)
);

router.put(
  '/:customerId',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.UPDATE),
  (req, res) => customersController.updateCustomer(req, res)
);

// Purchase history
router.get(
  '/:customerId/purchases',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getPurchaseHistory(req, res)
);

// ============================================================================
// LOYALTY & REWARDS ROUTES
// ============================================================================

// Loyalty points
router.post(
  '/:customerId/loyalty',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.UPDATE),
  (req, res) => customersController.addLoyaltyPoints(req, res)
);

router.get(
  '/:customerId/loyalty',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getLoyaltyTransactions(req, res)
);

// Get full loyalty info (points, tier, available rewards)
router.get(
  '/:customerId/loyalty/info',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getLoyaltyInfo(req, res)
);

// Get available rewards for customer
router.get(
  '/:customerId/rewards/available',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getAvailableRewards(req, res)
);

// Redeem a reward
router.post(
  '/:customerId/rewards/redeem',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.UPDATE),
  (req, res) => customersController.redeemReward(req, res)
);

// Get customer's active redemptions
router.get(
  '/:customerId/rewards/redemptions',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getRedemptions(req, res)
);

// ============================================================================
// WISHLIST ROUTES
// ============================================================================

// Get customer wishlist
router.get(
  '/:customerId/wishlist',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getWishlist(req, res)
);

// Add to wishlist
router.post(
  '/:customerId/wishlist',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.CREATE),
  (req, res) => customersController.addToWishlist(req, res)
);

// Update wishlist item
router.put(
  '/:customerId/wishlist/:wishlistId',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.UPDATE),
  (req, res) => customersController.updateWishlistItem(req, res)
);

// Remove from wishlist
router.delete(
  '/:customerId/wishlist/:wishlistId',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.DELETE),
  (req, res) => customersController.removeFromWishlist(req, res)
);

// ============================================================================
// BUYING HABITS ROUTES
// ============================================================================

// Get customer buying habits
router.get(
  '/:customerId/habits',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getBuyingHabits(req, res)
);

// Recalculate customer habits
router.post(
  '/:customerId/habits/recalculate',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.UPDATE),
  (req, res) => customersController.recalculateHabits(req, res)
);

// ============================================================================
// REFERRAL ROUTES
// ============================================================================

// Get customer's referrals (those they referred)
router.get(
  '/:customerId/referrals',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getReferrals(req, res)
);

// Create a referral (staff manually records)
router.post(
  '/:customerId/referrals',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.CREATE),
  (req, res) => customersController.createReferral(req, res)
);

// ============================================================================
// WHATSAPP COMMUNICATION ROUTES
// ============================================================================

// Get WhatsApp message history
router.get(
  '/:customerId/messages',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.READ),
  (req, res) => customersController.getMessageHistory(req, res)
);

// Send WhatsApp message
router.post(
  '/:customerId/messages',
  requirePermission(RESOURCES.CUSTOMERS, ACTIONS.CREATE),
  (req, res) => customersController.sendMessage(req, res)
);

export default router;
