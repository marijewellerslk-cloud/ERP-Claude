import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import { db } from '../config/database.js';
import { eq, or, inArray, sql } from 'drizzle-orm';
import { stores, userRoles } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { ROLES } from '@erp/shared';

/**
 * Cache for user's accessible stores (5 minute TTL)
 */
const storeAccessCache = new Map<string, { stores: string[]; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get list of store IDs that user has access to based on their role
 */
export async function getUserAccessibleStores(userId: string, userRole: string, userStoreId: string): Promise<string[]> {
  const cacheKey = `${userId}-${userRole}`;

  // Check cache first
  const cached = storeAccessCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.stores;
  }

  let accessibleStores: string[] = [];

  try {
    // Super admin can access all stores
    if (userRole === ROLES.SUPER_ADMIN) {
      const allStores = await db.select({ id: stores.id }).from(stores);
      accessibleStores = allStores.map(s => s.id);
    }
    // Owner can access their assigned stores and all child stores
    else if (userRole === ROLES.OWNER) {
      // Get user's directly assigned stores
      const assignedStores = await db
        .select({ storeId: userRoles.storeId })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));

      const assignedStoreIds = assignedStores.map(s => s.storeId);

      if (assignedStoreIds.length > 0) {
        // Get these stores and all their child stores (recursive)
        const storeHierarchy = await db
          .select({ id: stores.id, parentStoreId: stores.parentStoreId })
          .from(stores);

        // Build a set of accessible stores
        const accessibleSet = new Set<string>(assignedStoreIds);

        // Add child stores recursively
        let foundNew = true;
        while (foundNew) {
          foundNew = false;
          for (const store of storeHierarchy) {
            if (store.parentStoreId && accessibleSet.has(store.parentStoreId) && !accessibleSet.has(store.id)) {
              accessibleSet.add(store.id);
              foundNew = true;
            }
          }
        }

        accessibleStores = Array.from(accessibleSet);
      }
    }
    // Store manager can access their assigned store only
    else if (userRole === ROLES.STORE_MANAGER) {
      const assignedStores = await db
        .select({ storeId: userRoles.storeId })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));

      accessibleStores = assignedStores.map(s => s.storeId);
    }
    // Other roles only have access to their primary store
    else {
      accessibleStores = [userStoreId];
    }

    // Cache the result
    storeAccessCache.set(cacheKey, {
      stores: accessibleStores,
      expiry: Date.now() + CACHE_TTL,
    });

    return accessibleStores;
  } catch (error) {
    logger.error('Error getting accessible stores', { userId, userRole, error });
    // Fallback to user's primary store
    return [userStoreId];
  }
}

/**
 * Clear cache for a specific user (call when user's role changes)
 */
export function clearStoreAccessCache(userId: string) {
  for (const key of storeAccessCache.keys()) {
    if (key.startsWith(userId)) {
      storeAccessCache.delete(key);
    }
  }
}

/**
 * Middleware to ensure user can only access data from their assigned store
 * or child stores in the hierarchy
 */
export function enforceStoreAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }

  const requestedStoreId = req.body.storeId || req.query.storeId || req.params.storeId;

  if (!requestedStoreId) {
    // If no store specified, use user's current store
    req.body.storeId = req.user.storeId;
    return next();
  }

  if (requestedStoreId === req.user.storeId) {
    // User is accessing their own store
    return next();
  }

  // For super_admin and owner roles, check hierarchical access
  const userRole = req.user.role;

  if (userRole === ROLES.SUPER_ADMIN) {
    // Super admin can access any store
    return next();
  }

  // Check hierarchical access for owners
  if (userRole === ROLES.OWNER) {
    getUserAccessibleStores(req.user.userId, userRole, req.user.storeId)
      .then((accessibleStores) => {
        if (accessibleStores.includes(requestedStoreId)) {
          return next();
        }

        logger.warn('Store access denied', {
          userId: req.user?.userId,
          userStoreId: req.user?.storeId,
          requestedStoreId,
          accessibleStores,
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this store',
          },
        });
      })
      .catch((error) => {
        logger.error('Error checking store access', { error });
        return res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Error checking store access',
          },
        });
      });

    return; // Don't call next() here, it's handled in the promise
  }

  // For other roles, only allow access to their assigned store
  logger.warn('Store access denied', {
    userId: req.user.userId,
    userStoreId: req.user.storeId,
    requestedStoreId,
  });

  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Access denied to this store',
    },
  });
}

/**
 * Middleware to inject accessible stores into request
 * Useful for queries that need to filter by multiple stores
 */
export async function injectAccessibleStores(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }

  try {
    const accessibleStores = await getUserAccessibleStores(
      req.user.userId,
      req.user.role,
      req.user.storeId
    );

    // Attach to request for use in controllers
    (req as any).accessibleStores = accessibleStores;
    next();
  } catch (error) {
    logger.error('Error injecting accessible stores', { error });
    // Fallback to user's primary store
    (req as any).accessibleStores = [req.user.storeId];
    next();
  }
}
