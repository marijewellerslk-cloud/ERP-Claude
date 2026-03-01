import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import * as storesAccessController from './stores-access.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Multi-store access routes
 */

// Get stores accessible to current user
router.get('/accessible', storesAccessController.getAccessibleStores);

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
router.post(
  '/inventory-permissions/request',
  storesAccessController.requestInventoryPermission
);

// Get pending inventory permission requests (Owner/Super Admin only)
router.get(
  '/inventory-permissions/pending',
  storesAccessController.getPendingInventoryPermissionRequests
);

// Approve inventory permission request (Owner/Super Admin only)
router.put(
  '/inventory-permissions/:requestId/approve',
  storesAccessController.approveInventoryPermission
);

// Reject inventory permission request (Owner/Super Admin only)
router.put(
  '/inventory-permissions/:requestId/reject',
  storesAccessController.rejectInventoryPermission
);

// Revoke inventory permission from user (Owner/Super Admin only)
router.post('/inventory-permissions/revoke', storesAccessController.revokeInventoryPermission);

// Get users with inventory permissions in a store (Owner/Super Admin only)
router.get('/:storeId/users/permissions', storesAccessController.getUsersWithPermissions);

export default router;
