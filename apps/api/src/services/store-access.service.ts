import { eq, and, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  stores,
  userRoles,
  storeAccessRequests,
  inventoryPermissionRequests,
  users,
  roles,
} from '../db/schema.js';
import { logger } from '../utils/logger.js';
import { ROLE_LEVELS } from '@mari-erp/shared/constants/roles';

export class StoreAccessService {
  /**
   * Get all stores a user can access (view)
   * - Super Admin & Owner: All stores
   * - Store Manager: Assigned store + temporarily approved stores
   * - Others: Only assigned store
   */
  async getUserAccessibleStores(
    userId: string,
    userRole: string,
    userStoreId: string
  ): Promise<string[]> {
    try {
      // Super Admin and Owner get all stores
      if (['super_admin', 'superadmin', 'owner'].includes(userRole)) {
        const allStores = await db
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.isActive, true));
        return allStores.map((s) => s.id);
      }

      // Store Manager: own store + approved temporary access
      if (userRole === 'store_manager') {
        const activeAccess = await db
          .select({ storeId: storeAccessRequests.requestedStoreId })
          .from(storeAccessRequests)
          .where(
            and(
              eq(storeAccessRequests.requesterId, userId),
              eq(storeAccessRequests.status, 'approved'),
              sql`${storeAccessRequests.validFrom} <= NOW()`,
              sql`${storeAccessRequests.validUntil} >= NOW()`
            )
          );

        return [userStoreId, ...activeAccess.map((a) => a.storeId)];
      }

      // Other roles: only their assigned store
      return [userStoreId];
    } catch (error) {
      logger.error('Error getting accessible stores:', error);
      throw error;
    }
  }

  /**
   * Check if user can manipulate inventory (create, update, delete)
   * - Super Admin & Owner: Always true
   * - Store Manager: Needs explicit permission in user_roles
   * - Others: Always false
   */
  async canManipulateInventory(
    userId: string,
    userRole: string,
    storeId: string
  ): Promise<boolean> {
    try {
      // Super Admin and Owner always allowed
      if (['super_admin', 'superadmin', 'owner'].includes(userRole)) {
        return true;
      }

      // Store Manager: check permission flag
      if (userRole === 'store_manager') {
        const userRoleRecord = await db.query.userRoles.findFirst({
          where: and(eq(userRoles.userId, userId), eq(userRoles.storeId, storeId)),
        });

        return userRoleRecord?.canManipulateInventory || false;
      }

      // All other roles cannot manipulate
      return false;
    } catch (error) {
      logger.error('Error checking inventory manipulation permission:', error);
      return false;
    }
  }

  /**
   * Get all stores with their access status for a user
   */
  async getStoresWithAccessStatus(userId: string, userRole: string, userStoreId: string) {
    try {
      const allStores = await db
        .select({
          id: stores.id,
          name: stores.name,
          code: stores.code,
          address: stores.address,
          phone: stores.phone,
        })
        .from(stores)
        .where(eq(stores.isActive, true));

      const accessibleStoreIds = await this.getUserAccessibleStores(
        userId,
        userRole,
        userStoreId
      );

      return allStores.map((store) => ({
        ...store,
        hasAccess: accessibleStoreIds.includes(store.id),
        isAssigned: store.id === userStoreId,
        canRequest: userRole === 'store_manager' && store.id !== userStoreId,
      }));
    } catch (error) {
      logger.error('Error getting stores with access status:', error);
      throw error;
    }
  }

  /**
   * Request temporary access to another store (Store Managers only)
   */
  async requestStoreAccess(
    requesterId: string,
    requesterStoreId: string,
    requestedStoreId: string,
    reason: string,
    requestedDurationHours: number
  ) {
    try {
      // Check if there's already a pending request
      const existingRequest = await db.query.storeAccessRequests.findFirst({
        where: and(
          eq(storeAccessRequests.requesterId, requesterId),
          eq(storeAccessRequests.requestedStoreId, requestedStoreId),
          eq(storeAccessRequests.status, 'pending')
        ),
      });

      if (existingRequest) {
        throw new Error('You already have a pending request for this store');
      }

      // Create new request
      const [request] = await db
        .insert(storeAccessRequests)
        .values({
          requesterId,
          requesterStoreId,
          requestedStoreId,
          reason,
          status: 'pending',
          requestedAt: new Date(),
        })
        .returning();

      logger.info('Store access requested', {
        requestId: request.id,
        requesterId,
        requestedStoreId,
      });

      return request;
    } catch (error) {
      logger.error('Error requesting store access:', error);
      throw error;
    }
  }

  /**
   * Approve store access request
   */
  async approveStoreAccess(
    requestId: string,
    approverId: string,
    validFromDate: Date,
    validUntilDate: Date
  ) {
    try {
      const [updated] = await db
        .update(storeAccessRequests)
        .set({
          status: 'approved',
          approvedBy: approverId,
          approvedAt: new Date(),
          validFrom: validFromDate,
          validUntil: validUntilDate,
          updatedAt: new Date(),
        })
        .where(eq(storeAccessRequests.id, requestId))
        .returning();

      logger.info('Store access approved', {
        requestId,
        approverId,
        validFrom: validFromDate,
        validUntil: validUntilDate,
      });

      return updated;
    } catch (error) {
      logger.error('Error approving store access:', error);
      throw error;
    }
  }

  /**
   * Reject store access request
   */
  async rejectStoreAccess(requestId: string, reviewerId: string, rejectionReason: string) {
    try {
      const [updated] = await db
        .update(storeAccessRequests)
        .set({
          status: 'rejected',
          approvedBy: reviewerId,
          approvedAt: new Date(),
          rejectionReason,
          updatedAt: new Date(),
        })
        .where(eq(storeAccessRequests.id, requestId))
        .returning();

      logger.info('Store access rejected', { requestId, reviewerId });

      return updated;
    } catch (error) {
      logger.error('Error rejecting store access:', error);
      throw error;
    }
  }

  /**
   * Get pending store access requests (for Owners/Super Admins)
   */
  async getPendingStoreAccessRequests() {
    try {
      const requests = await db.query.storeAccessRequests.findMany({
        where: eq(storeAccessRequests.status, 'pending'),
        with: {
          requester: {
            columns: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          requesterStore: {
            columns: {
              id: true,
              name: true,
              code: true,
            },
          },
          requestedStore: {
            columns: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: (table, { desc }) => [desc(table.requestedAt)],
      });

      return requests;
    } catch (error) {
      logger.error('Error getting pending store access requests:', error);
      throw error;
    }
  }

  /**
   * Request inventory manipulation permission (Store Managers only)
   */
  async requestInventoryPermission(requesterId: string, storeId: string, reason: string) {
    try {
      // Check if there's already a pending request
      const existingRequest = await db.query.inventoryPermissionRequests.findFirst({
        where: and(
          eq(inventoryPermissionRequests.requesterId, requesterId),
          eq(inventoryPermissionRequests.storeId, storeId),
          eq(inventoryPermissionRequests.status, 'pending')
        ),
      });

      if (existingRequest) {
        throw new Error('You already have a pending permission request for this store');
      }

      // Create new request
      const [request] = await db
        .insert(inventoryPermissionRequests)
        .values({
          requesterId,
          storeId,
          reason,
          status: 'pending',
          requestedAt: new Date(),
        })
        .returning();

      logger.info('Inventory permission requested', {
        requestId: request.id,
        requesterId,
        storeId,
      });

      return request;
    } catch (error) {
      logger.error('Error requesting inventory permission:', error);
      throw error;
    }
  }

  /**
   * Approve inventory manipulation permission
   */
  async approveInventoryPermission(requestId: string, approverId: string) {
    try {
      // Get the request
      const request = await db.query.inventoryPermissionRequests.findFirst({
        where: eq(inventoryPermissionRequests.id, requestId),
      });

      if (!request) {
        throw new Error('Permission request not found');
      }

      // Update the request status
      await db
        .update(inventoryPermissionRequests)
        .set({
          status: 'approved',
          reviewedBy: approverId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(inventoryPermissionRequests.id, requestId));

      // Grant permission in user_roles
      await db
        .update(userRoles)
        .set({
          canManipulateInventory: true,
        })
        .where(
          and(
            eq(userRoles.userId, request.requesterId),
            eq(userRoles.storeId, request.storeId)
          )
        );

      logger.info('Inventory permission approved', {
        requestId,
        approverId,
        userId: request.requesterId,
        storeId: request.storeId,
      });

      return request;
    } catch (error) {
      logger.error('Error approving inventory permission:', error);
      throw error;
    }
  }

  /**
   * Reject inventory manipulation permission
   */
  async rejectInventoryPermission(
    requestId: string,
    reviewerId: string,
    rejectionReason: string
  ) {
    try {
      const [updated] = await db
        .update(inventoryPermissionRequests)
        .set({
          status: 'rejected',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          rejectionReason,
          updatedAt: new Date(),
        })
        .where(eq(inventoryPermissionRequests.id, requestId))
        .returning();

      logger.info('Inventory permission rejected', { requestId, reviewerId });

      return updated;
    } catch (error) {
      logger.error('Error rejecting inventory permission:', error);
      throw error;
    }
  }

  /**
   * Get pending inventory permission requests (for Owners/Super Admins)
   */
  async getPendingInventoryPermissionRequests(storeId?: string) {
    try {
      const whereClause = storeId
        ? and(
          eq(inventoryPermissionRequests.status, 'pending'),
          eq(inventoryPermissionRequests.storeId, storeId)
        )
        : eq(inventoryPermissionRequests.status, 'pending');

      const requests = await db.query.inventoryPermissionRequests.findMany({
        where: whereClause,
        with: {
          requester: {
            columns: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          store: {
            columns: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: (table, { desc }) => [desc(table.requestedAt)],
      });

      return requests;
    } catch (error) {
      logger.error('Error getting pending inventory permission requests:', error);
      throw error;
    }
  }

  /**
   * Revoke inventory manipulation permission
   */
  async revokeInventoryPermission(userId: string, storeId: string, revokedBy: string) {
    try {
      await db
        .update(userRoles)
        .set({
          canManipulateInventory: false,
        })
        .where(and(eq(userRoles.userId, userId), eq(userRoles.storeId, storeId)));

      logger.info('Inventory permission revoked', {
        userId,
        storeId,
        revokedBy,
      });

      return { success: true };
    } catch (error) {
      logger.error('Error revoking inventory permission:', error);
      throw error;
    }
  }

  /**
   * Get users with inventory permissions in a store
   */
  async getUsersWithInventoryPermissions(storeId: string) {
    try {
      const usersWithPermissions = await db
        .select({
          userId: users.id,
          email: users.email,
          fullName: users.fullName,
          roleName: roles.name,
          canManipulate: userRoles.canManipulateInventory,
        })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.storeId, storeId));

      return usersWithPermissions;
    } catch (error) {
      logger.error('Error getting users with inventory permissions:', error);
      throw error;
    }
  }
}

export const storeAccessService = new StoreAccessService();
