import { db } from '../../config/database.js';
import { stores, roles, userRoles, users } from '../../db/schema.js';
import { eq, desc, ilike, or, and, isNull } from 'drizzle-orm';
import { CreateStoreInput, UpdateStoreInput } from './stores.validation.js';
import { logger } from '../../utils/logger.js';
import { accountingService } from '../accounting/accounting.service.js';

export async function getAllStores(filters?: {
  search?: string;
  isActive?: boolean;
  parentStoreId?: string | null;
}) {
  let query = db.select().from(stores);

  const conditions: any[] = [];

  if (filters?.search) {
    conditions.push(
      or(
        ilike(stores.name, `%${filters.search}%`),
        ilike(stores.code, `%${filters.search}%`)
      )
    );
  }

  if (filters?.isActive !== undefined) {
    conditions.push(eq(stores.isActive, filters.isActive));
  }

  if (filters?.parentStoreId === null) {
    conditions.push(isNull(stores.parentStoreId));
  } else if (filters?.parentStoreId) {
    conditions.push(eq(stores.parentStoreId, filters.parentStoreId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  return query.orderBy(desc(stores.createdAt));
}

export async function getStoreById(id: string) {
  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.id, id));

  if (!store) return null;

  // Fetch manager
  const managerRole = await db.query.roles.findFirst({
    where: eq(roles.name, 'store_manager'),
  });

  let manager = null;
  if (managerRole) {
    const managerUserRole = await db.query.userRoles.findFirst({
      where: and(
        eq(userRoles.storeId, id),
        eq(userRoles.roleId, managerRole.id)
      ),
      with: {
        user: true,
      },
    });
    if (managerUserRole) {
      manager = managerUserRole.user;
    }
  }

  return { ...store, manager, managerId: manager?.id };
}

export async function createStore(data: CreateStoreInput) {
  // Check if code already exists
  const existing = await db
    .select()
    .from(stores)
    .where(eq(stores.code, data.code));

  if (existing.length > 0) {
    throw new Error('A store with this code already exists');
  }

  // Validate manager if provided
  if (data.managerId) {
    const manager = await db.query.users.findFirst({
      where: eq(users.id, data.managerId),
    });
    if (!manager) {
      throw new Error('Manager user not found');
    }
  }

  const [store] = await db
    .insert(stores)
    .values({
      name: data.name,
      code: data.code,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      gstin: data.gstin || null,
      parentStoreId: data.parentStoreId || null,
      isActive: data.isActive ?? true,
    })
    .returning();

  // Assign manager if provided
  if (data.managerId) {
    await assignStoreManager(store.id, data.managerId);
  }

  // Automatically initialize Chart of Accounts for the new store
  try {
    await accountingService.initializeChartOfAccounts(store.id);
    logger.info('Chart of accounts initialized for new store', { storeId: store.id });
  } catch (error) {
    logger.error('Failed to initialize chart of accounts for new store', { storeId: store.id, error });
  }

  logger.info('Store created', { storeId: store.id, storeName: store.name });

  return store;
}

// Helper to assign manager
async function assignStoreManager(storeId: string, userId: string) {
  // Get store_manager role
  const role = await db.query.roles.findFirst({
    where: eq(roles.name, 'store_manager'),
  });
  if (!role) {
    logger.warn('Role store_manager not found, cannot assign manager');
    return;
  }

  // Remove existing managers for this store
  await db.delete(userRoles)
    .where(and(
      eq(userRoles.storeId, storeId),
      eq(userRoles.roleId, role.id)
    ));

  // Assign new manager
  await db.insert(userRoles).values({
    userId,
    storeId,
    roleId: role.id,
  });
}

export async function updateStore(id: string, data: UpdateStoreInput) {
  // Check if store exists
  const existing = await getStoreById(id);
  if (!existing) {
    throw new Error('Store not found');
  }

  // Check if code is being changed and if it conflicts
  if (data.code && data.code !== existing.code) {
    const codeConflict = await db
      .select()
      .from(stores)
      .where(eq(stores.code, data.code));

    if (codeConflict.length > 0) {
      throw new Error('A store with this code already exists');
    }
  }

  // Validate manager if provided
  if (data.managerId) {
    const manager = await db.query.users.findFirst({
      where: eq(users.id, data.managerId),
    });
    if (!manager) {
      throw new Error('Manager user not found');
    }
  }

  const [store] = await db
    .update(stores)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, id))
    .returning();

  // Update manager if provided (allow null to remove?) 
  // For now assume strictly setting a new manager if provided.
  if (data.managerId) {
    await assignStoreManager(store.id, data.managerId);
  }

  logger.info('Store updated', { storeId: store.id });

  return store;
}

export async function deleteStore(id: string) {
  // Check if store exists
  const existing = await getStoreById(id);
  if (!existing) {
    throw new Error('Store not found');
  }

  // Check if store has child stores
  const childStores = await db
    .select()
    .from(stores)
    .where(eq(stores.parentStoreId, id));

  if (childStores.length > 0) {
    throw new Error('Cannot delete store with child stores. Delete or reassign child stores first.');
  }

  // CRITICAL SAFETY: Prevent deleting Head Office
  if (existing.code === 'MAIN-001') {
    throw new Error('Cannot delete Head Office store (MAIN-001). This store is required for system operation.');
  }

  // Soft delete by setting isActive to false
  const [store] = await db
    .update(stores)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, id))
    .returning();

  logger.info('Store deactivated', { storeId: store.id });

  return store;
}

export async function getStoreHierarchy() {
  const allStores = await db.select().from(stores).orderBy(stores.name);

  // Build hierarchy tree
  const storeMap = new Map(allStores.map(s => [s.id, { ...s, children: [] as any[] }]));
  const rootStores: any[] = [];

  allStores.forEach(store => {
    const storeNode = storeMap.get(store.id)!;
    if (store.parentStoreId && storeMap.has(store.parentStoreId)) {
      storeMap.get(store.parentStoreId)!.children.push(storeNode);
    } else {
      rootStores.push(storeNode);
    }
  });

  return rootStores;
}
