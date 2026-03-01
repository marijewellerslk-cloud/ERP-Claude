import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import { storeAccessService } from '../services/store-access.service.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to check if user can manipulate inventory
 * Used for CREATE, UPDATE, DELETE operations
 */
export async function checkInventoryManipulationPermission(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
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

    // Check if user can manipulate inventory
    const canManipulate = await storeAccessService.canManipulateInventory(
      userId,
      role,
      storeId
    );

    if (!canManipulate) {
      logger.warn('Inventory manipulation denied', {
        userId,
        role,
        storeId,
        endpoint: req.path,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'INVENTORY_MANIPULATION_DENIED',
          message:
            'You do not have permission to manipulate inventory. Please contact your administrator to request this permission.',
        },
      });
    }

    // User has permission, proceed
    next();
  } catch (error) {
    logger.error('Error in inventory permission middleware:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PERMISSION_CHECK_FAILED',
        message: 'Failed to verify inventory permissions',
      },
    });
  }
}

/**
 * Middleware to check if user can access a specific store
 * Used for multi-store queries
 */
export async function checkStoreAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
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
    const requestedStoreId = (req.query.storeId as string) || (req.body.storeId as string);

    // If no specific store requested, user accesses their own store
    if (!requestedStoreId) {
      return next();
    }

    // Get accessible stores for user
    const accessibleStores = await storeAccessService.getUserAccessibleStores(
      userId,
      role,
      userStoreId
    );

    // Check if requested store is accessible
    if (!accessibleStores.includes(requestedStoreId)) {
      logger.warn('Store access denied', {
        userId,
        role,
        userStoreId,
        requestedStoreId,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'STORE_ACCESS_DENIED',
          message: 'You do not have access to this store',
        },
      });
    }

    // User has access, proceed
    next();
  } catch (error) {
    logger.error('Error in store access middleware:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'ACCESS_CHECK_FAILED',
        message: 'Failed to verify store access',
      },
    });
  }
}
