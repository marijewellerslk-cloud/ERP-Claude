import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import * as storesController from './stores.controller.js';
import * as storesAccessController from './stores-access.controller.js';

const router = Router();

const RESOURCES = {
  STORES: 'stores',
} as const;

const ACTIONS = {
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

// All routes require authentication
router.use(authenticate);

/**
 * Store CRUD routes (store management)
 */

// Get all stores
router.get('/', requirePermission(RESOURCES.STORES, ACTIONS.READ), storesController.getAll);

// Get store hierarchy (for dropdowns and tree views)
router.get('/hierarchy', requirePermission(RESOURCES.STORES, ACTIONS.READ), storesController.getHierarchy);

// Get stores accessible to current user (multi-store access control)
router.get('/accessible', storesAccessController.getAccessibleStores);

// Get single store
router.get('/:id', requirePermission(RESOURCES.STORES, ACTIONS.READ), storesController.getById);

// Create store
router.post('/', requirePermission(RESOURCES.STORES, ACTIONS.CREATE), storesController.create);

// Update store
router.put('/:id', requirePermission(RESOURCES.STORES, ACTIONS.UPDATE), storesController.update);

// Delete (deactivate) store
router.delete('/:id', requirePermission(RESOURCES.STORES, ACTIONS.DELETE), storesController.remove);

/**
 * Store access request routes (temporary multi-store access)
 */

// Request temporary access to another store (Store Manager only)
router.post('/access-requests', storesAccessController.requestStoreAccess);

// Get pending store access requests (Owner/Super Admin only)
router.get('/access-requests/pending', storesAccessController.getPendingAccessRequests);

// Approve store access request (Owner/Super Admin only)
router.put('/access-requests/:requestId/approve', storesAccessController.approveAccessRequest);

// Reject store access request (Owner/Super Admin only)
router.put('/access-requests/:requestId/reject', storesAccessController.rejectAccessRequest);

/**
 * Inventory permission routes (CRUD permission management)
 */

// Request inventory manipulation permission (Store Manager only)
router.post('/inventory-permissions/request', storesAccessController.requestInventoryPermission);

// Get pending inventory permission requests (Owner/Super Admin only)
router.get('/inventory-permissions/pending', storesAccessController.getPendingInventoryPermissionRequests);

// Approve inventory permission request (Owner/Super Admin only)
router.put('/inventory-permissions/:requestId/approve', storesAccessController.approveInventoryPermission);

// Reject inventory permission request (Owner/Super Admin only)
router.put('/inventory-permissions/:requestId/reject', storesAccessController.rejectInventoryPermission);

// Revoke inventory permission from user (Owner/Super Admin only)
router.post('/inventory-permissions/revoke', storesAccessController.revokeInventoryPermission);

// Get users with inventory permissions in a store (Owner/Super Admin only)
router.get('/:storeId/users/permissions', storesAccessController.getUsersWithPermissions);

export default router;
