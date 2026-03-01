import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { storeAccessService } from '../../services/store-access.service.js';
import { logger } from '../../utils/logger.js';
import { db } from '../../config/database.js';
import { stores } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Get all stores that the authenticated user can access
 */
export async function getAccessibleStores(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { userId, role, storeId } = req.user;

    const storesWithAccess = await storeAccessService.getStoresWithAccessStatus(
      userId,
      role,
      storeId
    );

    return res.json({
      success: true,
      data: storesWithAccess,
    });
  } catch (error) {
    logger.error('Error getting accessible stores:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch accessible stores',
      },
    });
  }
}

/**
 * Request temporary access to another store (Store Managers only)
 */
export async function requestStoreAccess(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { userId, role, storeId: userStoreId } = req.user;

    // Only Store Managers can request access
    if (role !== 'store_manager') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Store Managers can request store access',
        },
      });
    }

    const { requestedStoreId, reason, requestedDurationHours } = req.body;

    // Validate input
    if (!requestedStoreId || !reason || !requestedDurationHours) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'requestedStoreId, reason, and requestedDurationHours are required',
        },
      });
    }

    // Cannot request access to own store
    if (requestedStoreId === userStoreId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Cannot request access to your own store',
        },
      });
    }

    // Verify requested store exists
    const requestedStore = await db.query.stores.findFirst({
      where: eq(stores.id, requestedStoreId),
    });

    if (!requestedStore) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STORE_NOT_FOUND',
          message: 'Requested store not found',
        },
      });
    }

    const request = await storeAccessService.requestStoreAccess(
      userId,
      userStoreId,
      requestedStoreId,
      reason,
      requestedDurationHours
    );

    return res.status(201).json({
      success: true,
      data: request,
      message: 'Store access request submitted successfully',
    });
  } catch (error: any) {
    logger.error('Error requesting store access:', error);

    if (error.message?.includes('already have a pending request')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_REQUEST',
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to submit store access request',
      },
    });
  }
}

/**
 * Get pending store access requests (Owner/Super Admin only)
 */
export async function getPendingAccessRequests(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { role } = req.user;

    // Only Owner and Super Admin can view pending requests
    if (!['owner', 'super_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Owners and Super Admins can view pending requests',
        },
      });
    }

    const requests = await storeAccessService.getPendingStoreAccessRequests();

    return res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    logger.error('Error getting pending access requests:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch pending access requests',
      },
    });
  }
}

/**
 * Approve store access request with time limit
 */
export async function approveAccessRequest(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { userId, role } = req.user;

    // Only Owner and Super Admin can approve requests
    if (!['owner', 'super_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Owners and Super Admins can approve requests',
        },
      });
    }

    const { requestId } = req.params;
    const { validFromDate, validUntilDate } = req.body;

    // Validate input
    if (!validFromDate || !validUntilDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'validFromDate and validUntilDate are required',
        },
      });
    }

    const validFrom = new Date(validFromDate);
    const validUntil = new Date(validUntilDate);

    // Validate dates
    if (validFrom >= validUntil) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATES',
          message: 'validUntilDate must be after validFromDate',
        },
      });
    }

    const updatedRequest = await storeAccessService.approveStoreAccess(
      requestId,
      userId,
      validFrom,
      validUntil
    );

    return res.json({
      success: true,
      data: updatedRequest,
      message: 'Store access request approved successfully',
    });
  } catch (error) {
    logger.error('Error approving access request:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to approve store access request',
      },
    });
  }
}

/**
 * Reject store access request
 */
export async function rejectAccessRequest(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { userId, role } = req.user;

    // Only Owner and Super Admin can reject requests
    if (!['owner', 'super_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Owners and Super Admins can reject requests',
        },
      });
    }

    const { requestId } = req.params;
    const { rejectionReason } = req.body;

    // Validate input
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'rejectionReason is required',
        },
      });
    }

    const updatedRequest = await storeAccessService.rejectStoreAccess(
      requestId,
      userId,
      rejectionReason
    );

    return res.json({
      success: true,
      data: updatedRequest,
      message: 'Store access request rejected',
    });
  } catch (error) {
    logger.error('Error rejecting access request:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to reject store access request',
      },
    });
  }
}

/**
 * Request inventory manipulation permission (Store Managers only)
 */
export async function requestInventoryPermission(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { userId, role, storeId } = req.user;

    // Only Store Managers can request inventory permission
    if (role !== 'store_manager') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Store Managers can request inventory manipulation permission',
        },
      });
    }

    const { reason } = req.body;

    // Validate input
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'reason is required',
        },
      });
    }

    const request = await storeAccessService.requestInventoryPermission(
      userId,
      storeId,
      reason
    );

    return res.status(201).json({
      success: true,
      data: request,
      message: 'Inventory permission request submitted successfully',
    });
  } catch (error: any) {
    logger.error('Error requesting inventory permission:', error);

    if (error.message?.includes('already have a pending permission request')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_REQUEST',
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to submit inventory permission request',
      },
    });
  }
}

/**
 * Get pending inventory permission requests (Owner/Super Admin only)
 */
export async function getPendingInventoryPermissionRequests(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { role, storeId } = req.user;

    // Only Owner and Super Admin can view pending requests
    if (!['owner', 'super_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Owners and Super Admins can view pending requests',
        },
      });
    }

    // Super Admin can see all stores, Owner sees their store
    const filterStoreId = role === 'super_admin' ? undefined : storeId;

    const requests = await storeAccessService.getPendingInventoryPermissionRequests(
      filterStoreId
    );

    return res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    logger.error('Error getting pending inventory permission requests:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch pending permission requests',
      },
    });
  }
}

/**
 * Approve inventory permission request
 */
export async function approveInventoryPermission(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { userId, role } = req.user;

    // Only Owner and Super Admin can approve requests
    if (!['owner', 'super_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Owners and Super Admins can approve permission requests',
        },
      });
    }

    const { requestId } = req.params;

    const updatedRequest = await storeAccessService.approveInventoryPermission(
      requestId,
      userId
    );

    return res.json({
      success: true,
      data: updatedRequest,
      message: 'Inventory permission granted successfully',
    });
  } catch (error: any) {
    logger.error('Error approving inventory permission:', error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to approve inventory permission',
      },
    });
  }
}

/**
 * Reject inventory permission request
 */
export async function rejectInventoryPermission(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { userId, role } = req.user;

    // Only Owner and Super Admin can reject requests
    if (!['owner', 'super_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Owners and Super Admins can reject permission requests',
        },
      });
    }

    const { requestId } = req.params;
    const { rejectionReason } = req.body;

    // Validate input
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'rejectionReason is required',
        },
      });
    }

    const updatedRequest = await storeAccessService.rejectInventoryPermission(
      requestId,
      userId,
      rejectionReason
    );

    return res.json({
      success: true,
      data: updatedRequest,
      message: 'Inventory permission request rejected',
    });
  } catch (error) {
    logger.error('Error rejecting inventory permission:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to reject inventory permission request',
      },
    });
  }
}

/**
 * Revoke inventory manipulation permission from a user
 */
export async function revokeInventoryPermission(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { userId: approverId, role } = req.user;

    // Only Owner and Super Admin can revoke permissions
    if (!['owner', 'super_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Owners and Super Admins can revoke permissions',
        },
      });
    }

    const { userId, storeId } = req.body;

    // Validate input
    if (!userId || !storeId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userId and storeId are required',
        },
      });
    }

    await storeAccessService.revokeInventoryPermission(userId, storeId, approverId);

    return res.json({
      success: true,
      message: 'Inventory permission revoked successfully',
    });
  } catch (error) {
    logger.error('Error revoking inventory permission:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to revoke inventory permission',
      },
    });
  }
}

/**
 * Get list of users with inventory permissions in a store
 */
export async function getUsersWithPermissions(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    const { role, storeId } = req.user;

    // Only Owner and Super Admin can view this
    if (!['owner', 'super_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only Owners and Super Admins can view permissions',
        },
      });
    }

    const { storeId: queryStoreId } = req.params;
    const targetStoreId = queryStoreId || storeId;

    const users = await storeAccessService.getUsersWithInventoryPermissions(targetStoreId);

    return res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error('Error getting users with permissions:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch users with permissions',
      },
    });
  }
}
