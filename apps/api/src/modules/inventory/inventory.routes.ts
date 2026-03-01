import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import {
  checkInventoryManipulationPermission,
  checkStoreAccess,
} from '../../middleware/inventory-permission.middleware.js';

// Constants defined locally to avoid import issues
const RESOURCES = {
  INVENTORY: 'inventory',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

// Batch management routes
router.post(
  '/batches',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.CREATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.createBatch(req, res)
);

router.get(
  '/batches',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.listBatches(req, res)
);

router.get(
  '/batches/:batchId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.getBatch(req, res)
);

router.put(
  '/batches/:batchId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.updateBatch(req, res)
);

router.get(
  '/batches/:batchId/summary',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.getBatchSummary(req, res)
);

router.post(
  '/batches/:batchId/items',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.CREATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.addItemToBatch(req, res)
);

router.put(
  '/batches/:batchId/items/:itemId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.updateBatchItem(req, res)
);

router.delete(
  '/batches/:batchId/items/:itemId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.DELETE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.deleteItemFromBatch(req, res)
);

router.post(
  '/batches/:batchId/complete',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.completeBatch(req, res)
);

router.delete(
  '/batches/:batchId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.DELETE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.deleteBatch(req, res)
);

// Payment routes
router.post(
  '/batches/:batchId/payments',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.CREATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.recordBatchPayment(req, res)
);

router.get(
  '/batches/:batchId/payments',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.getBatchPayments(req, res)
);

// Category routes
router.post(
  '/categories',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.CREATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.createCategory(req, res)
);

router.get(
  '/categories',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.listCategories(req, res)
);

router.get(
  '/categories/statistics',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.getCategoryStatistics(req, res)
);

router.put(
  '/categories/:categoryId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.updateCategory(req, res)
);

router.delete(
  '/categories/:categoryId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.DELETE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.deleteCategory(req, res)
);

// Stock Valuation & Aging routes
router.get(
  '/valuation',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.getValuationSummary(req, res)
);

router.post(
  '/revalue',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.revalueInventory(req, res)
);

router.get(
  '/aging',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.getStockAgingReport(req, res)
);

router.get(
  '/dead-stock',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.getDeadStock(req, res)
);

router.get(
  '/turnover',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.getInventoryTurnover(req, res)
);

// Item routes
router.get(
  '/items',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.searchItems(req, res)
);

router.get(
  '/items/sold',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.listSoldItems(req, res)
);

router.get(
  '/items/:itemId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  (req, res) => inventoryController.getInventoryItem(req, res)
);

router.put(
  '/items/:itemId',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.updateInventoryItem(req, res)
);

// Get valuation details for an inventory item
router.get(
  '/items/:itemId/valuation',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  (req, res) => inventoryController.getItemValuationDetails(req, res)
);

// Transfer routes
router.get(
  '/transfers',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  checkStoreAccess,
  (req, res) => inventoryController.getTransfers(req, res)
);

router.get(
  '/transfers/:id',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  (req, res) => inventoryController.getTransferById(req, res)
);

router.post(
  '/transfers',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.CREATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.createTransfer(req, res)
);

router.post(
  '/transfers/receive',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.UPDATE),
  checkInventoryManipulationPermission,
  (req, res) => inventoryController.receiveTransfer(req, res)
);

// Global search
router.get(
  '/global-search',
  requirePermission(RESOURCES.INVENTORY, ACTIONS.READ),
  (req, res) => inventoryController.searchGlobal(req, res)
);

export default router;
