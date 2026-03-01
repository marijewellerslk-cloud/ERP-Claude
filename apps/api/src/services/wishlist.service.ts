import { db } from '../config/database.js';
import {
  customerWishlists,
  customers,
  inventoryItems,
  inventoryCategories,
  inventoryBatchItems,
  inventoryBatches,
} from '../db/schema.js';
import { eq, and, or, gte, lte, desc, isNull, sql, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { whatsappService } from './whatsapp.service.js';

interface CreateWishlistItemParams {
  customerId: string;
  storeId: string;
  createdBy: string;
  // For specific item
  inventoryItemId?: string;
  // For custom description
  customDescription?: string;
  metalType?: string;
  purityPreference?: string;
  categoryId?: string;
  minWeight?: number;
  maxWeight?: number;
  minBudget?: number;
  maxBudget?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  notifyOnMatch?: boolean;
  expiresAt?: Date;
}

interface UpdateWishlistItemParams {
  customDescription?: string;
  metalType?: string;
  purityPreference?: string;
  categoryId?: string;
  minWeight?: number;
  maxWeight?: number;
  minBudget?: number;
  maxBudget?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'active' | 'fulfilled' | 'cancelled' | 'expired';
  notes?: string;
  notifyOnMatch?: boolean;
  expiresAt?: Date;
}

interface MatchResult {
  wishlistId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  whatsappOptIn: boolean;
  matchedItems: {
    itemId: string;
    sku: string;
    name: string;
    metalType: string;
    purity: string;
    weight: string;
    price: string;
  }[];
}

class WishlistService {
  // Create a wishlist item
  async createWishlistItem(params: CreateWishlistItemParams) {
    const {
      customerId,
      storeId,
      createdBy,
      inventoryItemId,
      customDescription,
      metalType,
      purityPreference,
      categoryId,
      minWeight,
      maxWeight,
      minBudget,
      maxBudget,
      priority = 'medium',
      notes,
      notifyOnMatch = true,
      expiresAt,
    } = params;

    // Determine wishlist type
    const wishlistType = inventoryItemId ? 'specific_item' : 'custom_description';

    // Validate: must have either item or description
    if (!inventoryItemId && !customDescription && !categoryId && !metalType) {
      throw new Error('Wishlist must have either a specific item or custom criteria');
    }

    const [wishlistItem] = await db.insert(customerWishlists).values({
      customerId,
      storeId,
      inventoryItemId,
      customDescription,
      wishlistType,
      metalType,
      purityPreference,
      categoryId,
      minWeight: minWeight?.toString(),
      maxWeight: maxWeight?.toString(),
      minBudget: minBudget?.toString(),
      maxBudget: maxBudget?.toString(),
      priority,
      notes,
      notifyOnMatch,
      expiresAt,
      createdBy,
    }).returning();

    logger.info(`Wishlist item created for customer ${customerId}: ${wishlistItem.id}`);
    return wishlistItem;
  }

  // Update a wishlist item
  async updateWishlistItem(wishlistId: string, params: UpdateWishlistItemParams) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (params.customDescription !== undefined) updateData.customDescription = params.customDescription;
    if (params.metalType !== undefined) updateData.metalType = params.metalType;
    if (params.purityPreference !== undefined) updateData.purityPreference = params.purityPreference;
    if (params.categoryId !== undefined) updateData.categoryId = params.categoryId;
    if (params.minWeight !== undefined) updateData.minWeight = params.minWeight.toString();
    if (params.maxWeight !== undefined) updateData.maxWeight = params.maxWeight.toString();
    if (params.minBudget !== undefined) updateData.minBudget = params.minBudget.toString();
    if (params.maxBudget !== undefined) updateData.maxBudget = params.maxBudget.toString();
    if (params.priority !== undefined) updateData.priority = params.priority;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.notes !== undefined) updateData.notes = params.notes;
    if (params.notifyOnMatch !== undefined) updateData.notifyOnMatch = params.notifyOnMatch;
    if (params.expiresAt !== undefined) updateData.expiresAt = params.expiresAt;

    const [updated] = await db.update(customerWishlists)
      .set(updateData)
      .where(eq(customerWishlists.id, wishlistId))
      .returning();

    return updated;
  }

  // Delete a wishlist item
  async deleteWishlistItem(wishlistId: string) {
    await db.delete(customerWishlists)
      .where(eq(customerWishlists.id, wishlistId));
  }

  // Get customer's wishlist
  async getCustomerWishlist(customerId: string, includeInactive = false) {
    const conditions = [eq(customerWishlists.customerId, customerId)];

    if (!includeInactive) {
      conditions.push(eq(customerWishlists.status, 'active'));
    }

    return db.query.customerWishlists.findMany({
      where: and(...conditions),
      with: {
        inventoryItem: {
          with: {
            category: true,
          },
        },
        category: true,
      },
      orderBy: [desc(customerWishlists.createdAt)],
    });
  }

  // Get wishlist item by ID
  async getWishlistItem(wishlistId: string) {
    return db.query.customerWishlists.findFirst({
      where: eq(customerWishlists.id, wishlistId),
      with: {
        customer: true,
        inventoryItem: {
          with: {
            category: true,
          },
        },
        category: true,
      },
    });
  }

  // Mark wishlist as fulfilled
  async markAsFulfilled(wishlistId: string, invoiceId: string) {
    const [updated] = await db.update(customerWishlists)
      .set({
        status: 'fulfilled',
        fulfilledAt: new Date(),
        fulfilledByInvoiceId: invoiceId,
        updatedAt: new Date(),
      })
      .where(eq(customerWishlists.id, wishlistId))
      .returning();

    return updated;
  }

  // Find matching inventory items for a wishlist
  async findMatchingItems(wishlistId: string): Promise<{
    wishlistItem: typeof customerWishlists.$inferSelect;
    matchingItems: (typeof inventoryItems.$inferSelect)[];
  } | null> {
    const wishlistItem = await db.query.customerWishlists.findFirst({
      where: eq(customerWishlists.id, wishlistId),
    });

    if (!wishlistItem || wishlistItem.status !== 'active') {
      return null;
    }

    // Build query conditions based on wishlist criteria
    const conditions = [
      eq(inventoryItems.storeId, wishlistItem.storeId),
      eq(inventoryItems.isActive, true),
    ];

    // If specific item, just check if it's still available
    if (wishlistItem.wishlistType === 'specific_item' && wishlistItem.inventoryItemId) {
      const item = await db.query.inventoryItems.findFirst({
        where: and(
          eq(inventoryItems.id, wishlistItem.inventoryItemId),
          eq(inventoryItems.isActive, true)
        ),
      });
      return {
        wishlistItem,
        matchingItems: item ? [item] : [],
      };
    }

    // For custom description, apply filters
    if (wishlistItem.metalType) {
      conditions.push(eq(inventoryItems.metalType, wishlistItem.metalType));
    }

    if (wishlistItem.purityPreference) {
      conditions.push(eq(inventoryItems.purity, wishlistItem.purityPreference));
    }

    if (wishlistItem.categoryId) {
      conditions.push(eq(inventoryItems.categoryId, wishlistItem.categoryId));
    }

    if (wishlistItem.minWeight) {
      conditions.push(gte(inventoryItems.grossWeight, wishlistItem.minWeight));
    }

    if (wishlistItem.maxWeight) {
      conditions.push(lte(inventoryItems.grossWeight, wishlistItem.maxWeight));
    }

    if (wishlistItem.minBudget) {
      conditions.push(gte(inventoryItems.calculatedCost, wishlistItem.minBudget));
    }

    if (wishlistItem.maxBudget) {
      conditions.push(lte(inventoryItems.calculatedCost, wishlistItem.maxBudget));
    }

    const matchingItems = await db.query.inventoryItems.findMany({
      where: and(...conditions),
      limit: 10,
    });

    return { wishlistItem, matchingItems };
  }

  // Check new inventory batch against all active wishlists
  async checkBatchAgainstWishlists(batchId: string): Promise<MatchResult[]> {
    // Get batch items
    const batch = await db.query.inventoryBatches.findFirst({
      where: eq(inventoryBatches.id, batchId),
      with: {
        batchItems: {
          with: {
            inventoryItem: true,
          },
        },
      },
    });

    if (!batch || !batch.batchItems.length) {
      return [];
    }

    const storeId = batch.storeId;
    const newItems = batch.batchItems.map(bi => bi.inventoryItem);

    // Get all active wishlists for this store
    const activeWishlists = await db.query.customerWishlists.findMany({
      where: and(
        eq(customerWishlists.storeId, storeId),
        eq(customerWishlists.status, 'active'),
        eq(customerWishlists.notifyOnMatch, true)
      ),
      with: {
        customer: true,
      },
    });

    const results: MatchResult[] = [];

    for (const wishlist of activeWishlists) {
      const matchedItems = newItems.filter(item => {
        // Check specific item match
        if (wishlist.wishlistType === 'specific_item') {
          return item.id === wishlist.inventoryItemId;
        }

        // Check criteria match
        let matches = true;

        if (wishlist.metalType && item.metalType !== wishlist.metalType) {
          matches = false;
        }

        if (wishlist.purityPreference && item.purity !== wishlist.purityPreference) {
          matches = false;
        }

        if (wishlist.categoryId && item.categoryId !== wishlist.categoryId) {
          matches = false;
        }

        if (wishlist.minWeight && parseFloat(item.grossWeight || '0') < parseFloat(wishlist.minWeight)) {
          matches = false;
        }

        if (wishlist.maxWeight && parseFloat(item.grossWeight || '0') > parseFloat(wishlist.maxWeight)) {
          matches = false;
        }

        if (wishlist.minBudget && parseFloat(item.calculatedCost || '0') < parseFloat(wishlist.minBudget)) {
          matches = false;
        }

        if (wishlist.maxBudget && parseFloat(item.calculatedCost || '0') > parseFloat(wishlist.maxBudget)) {
          matches = false;
        }

        return matches;
      });

      if (matchedItems.length > 0) {
        const customer = wishlist.customer!;
        results.push({
          wishlistId: wishlist.id,
          customerId: customer.id,
          customerName: `${customer.firstName} ${customer.lastName || ''}`.trim(),
          customerPhone: customer.whatsapp || customer.phone,
          whatsappOptIn: customer.whatsappOptIn,
          matchedItems: matchedItems.map(item => ({
            itemId: item.id,
            sku: item.sku,
            name: item.name,
            metalType: item.metalType || '',
            purity: item.purity || '',
            weight: item.grossWeight || '0',
            price: item.calculatedCost || '0',
          })),
        });
      }
    }

    return results;
  }

  // Send notifications for wishlist matches
  async sendWishlistNotifications(matches: MatchResult[], storeId: string, sentBy?: string) {
    const results = [];

    for (const match of matches) {
      if (!match.whatsappOptIn || !whatsappService.isConfigured()) {
        // Log that notification was skipped
        logger.info(`Wishlist notification skipped for customer ${match.customerId}: WhatsApp not opted in or not configured`);
        continue;
      }

      // Send notification for first matched item
      const firstItem = match.matchedItems[0];
      const itemDescription = `${firstItem.name} (${firstItem.metalType} ${firstItem.purity})`;
      const price = `₹${parseFloat(firstItem.price).toLocaleString('en-IN')}`;
      const weight = `${firstItem.weight}g`;

      const result = await whatsappService.sendWishlistAlert(
        storeId,
        match.customerId,
        match.customerPhone,
        itemDescription,
        price,
        weight,
        match.wishlistId,
        sentBy
      );

      if (result.success) {
        // Update last notified timestamp
        await db.update(customerWishlists)
          .set({ lastNotifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(customerWishlists.id, match.wishlistId));
      }

      results.push({
        wishlistId: match.wishlistId,
        customerId: match.customerId,
        ...result,
      });
    }

    return results;
  }

  // Get all active wishlists for a store (for staff view)
  async getStoreWishlists(storeId: string, options: {
    status?: string;
    priority?: string;
    metalType?: string;
    categoryId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const conditions = [eq(customerWishlists.storeId, storeId)];

    if (options.status) {
      conditions.push(eq(customerWishlists.status, options.status));
    }
    if (options.priority) {
      conditions.push(eq(customerWishlists.priority, options.priority));
    }
    if (options.metalType) {
      conditions.push(eq(customerWishlists.metalType, options.metalType));
    }
    if (options.categoryId) {
      conditions.push(eq(customerWishlists.categoryId, options.categoryId));
    }

    const wishlists = await db.query.customerWishlists.findMany({
      where: and(...conditions),
      with: {
        customer: true,
        inventoryItem: true,
        category: true,
      },
      orderBy: [
        sql`CASE
          WHEN ${customerWishlists.priority} = 'urgent' THEN 1
          WHEN ${customerWishlists.priority} = 'high' THEN 2
          WHEN ${customerWishlists.priority} = 'medium' THEN 3
          ELSE 4
        END`,
        desc(customerWishlists.createdAt),
      ],
      limit: options.limit || 50,
      offset: options.offset || 0,
    });

    return wishlists;
  }

  // Get wishlist statistics for a store
  async getWishlistStats(storeId: string) {
    const stats = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${customerWishlists.status} = 'active')::int`,
      fulfilled: sql<number>`count(*) filter (where ${customerWishlists.status} = 'fulfilled')::int`,
      expired: sql<number>`count(*) filter (where ${customerWishlists.status} = 'expired')::int`,
      urgent: sql<number>`count(*) filter (where ${customerWishlists.priority} = 'urgent' and ${customerWishlists.status} = 'active')::int`,
      high: sql<number>`count(*) filter (where ${customerWishlists.priority} = 'high' and ${customerWishlists.status} = 'active')::int`,
    })
      .from(customerWishlists)
      .where(eq(customerWishlists.storeId, storeId));

    return stats[0];
  }

  // Expire old wishlists
  async expireOldWishlists() {
    const now = new Date();

    const [result] = await db.update(customerWishlists)
      .set({ status: 'expired', updatedAt: now })
      .where(and(
        eq(customerWishlists.status, 'active'),
        lte(customerWishlists.expiresAt, now)
      ))
      .returning({ id: customerWishlists.id });

    const count = result ? 1 : 0;
    if (count > 0) {
      logger.info(`Expired ${count} wishlist items`);
    }

    return count;
  }

  // Check if purchased items fulfill any wishlists
  async checkAndFulfillWishlists(
    customerId: string,
    inventoryItemIds: string[],
    invoiceId: string
  ): Promise<string[]> {
    if (!inventoryItemIds.length) return [];

    // Find active wishlists for this customer that match purchased items
    const activeWishlists = await db.query.customerWishlists.findMany({
      where: and(
        eq(customerWishlists.customerId, customerId),
        eq(customerWishlists.status, 'active')
      ),
    });

    const fulfilledIds: string[] = [];

    for (const wishlist of activeWishlists) {
      // Check if specific item was purchased
      if (wishlist.wishlistType === 'specific_item' && wishlist.inventoryItemId) {
        if (inventoryItemIds.includes(wishlist.inventoryItemId)) {
          await this.markAsFulfilled(wishlist.id, invoiceId);
          fulfilledIds.push(wishlist.id);
          logger.info(`Wishlist ${wishlist.id} fulfilled by invoice ${invoiceId}`);
        }
      } else {
        // For custom wishlists, check if any purchased item matches criteria
        const purchasedItems = await db.query.inventoryItems.findMany({
          where: inArray(inventoryItems.id, inventoryItemIds),
        });

        for (const item of purchasedItems) {
          let matches = true;

          if (wishlist.metalType && item.metalType !== wishlist.metalType) {
            matches = false;
          }
          if (wishlist.purityPreference && item.purity !== wishlist.purityPreference) {
            matches = false;
          }
          if (wishlist.categoryId && item.categoryId !== wishlist.categoryId) {
            matches = false;
          }
          if (wishlist.minWeight && parseFloat(item.grossWeight || '0') < parseFloat(wishlist.minWeight)) {
            matches = false;
          }
          if (wishlist.maxWeight && parseFloat(item.grossWeight || '0') > parseFloat(wishlist.maxWeight)) {
            matches = false;
          }

          if (matches) {
            await this.markAsFulfilled(wishlist.id, invoiceId);
            fulfilledIds.push(wishlist.id);
            logger.info(`Wishlist ${wishlist.id} (custom) fulfilled by invoice ${invoiceId}`);
            break; // One match is enough
          }
        }
      }
    }

    return fulfilledIds;
  }
}

export const wishlistService = new WishlistService();
