import { Router } from 'express';
import { customOrdersController } from './custom-orders.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const RESOURCES = {
  CUSTOM_ORDERS: 'custom_orders',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

const router = Router();

// All routes require authentication
router.use(authenticate);

// Statistics (must be before :orderId routes)
router.get(
  '/statistics',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.READ),
  (req, res) => customOrdersController.getStatistics(req as any, res)
);

// Create order
router.post(
  '/',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.CREATE),
  (req, res) => customOrdersController.createOrder(req as any, res)
);

// List orders
router.get(
  '/',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.READ),
  (req, res) => customOrdersController.listOrders(req as any, res)
);

// Get single order
router.get(
  '/:orderId',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.READ),
  (req, res) => customOrdersController.getOrder(req as any, res)
);

// Update order
router.put(
  '/:orderId',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.updateOrder(req as any, res)
);

// Add design version
router.post(
  '/:orderId/design-versions',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.addDesignVersion(req as any, res)
);

// Present design to customer
router.post(
  '/:orderId/present-design',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.presentDesign(req as any, res)
);

// Add design feedback
router.post(
  '/:orderId/design-feedback',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.addDesignFeedback(req as any, res)
);

// Create quotation
router.post(
  '/:orderId/quote',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.createQuotation(req as any, res)
);

// Approve order
router.post(
  '/:orderId/approve',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.approveOrder(req as any, res)
);

// Start production
router.post(
  '/:orderId/start-production',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.startProduction(req as any, res)
);

// Complete production
router.post(
  '/:orderId/complete-production',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.completeProduction(req as any, res)
);

// Quality check
router.post(
  '/:orderId/quality-check',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.qualityCheck(req as any, res)
);

// Deliver order
router.post(
  '/:orderId/deliver',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.deliverOrder(req as any, res)
);

// Cancel order
router.post(
  '/:orderId/cancel',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.DELETE),
  (req, res) => customOrdersController.cancelOrder(req as any, res)
);

// Add item to order
router.post(
  '/:orderId/items',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.addOrderItem(req as any, res)
);

// Notify customer
router.post(
  '/:orderId/notify',
  requirePermission(RESOURCES.CUSTOM_ORDERS, ACTIONS.UPDATE),
  (req, res) => customOrdersController.notifyCustomer(req as any, res)
);

export default router;
