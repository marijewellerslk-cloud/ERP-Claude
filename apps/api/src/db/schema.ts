import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    phoneIdx: index('users_phone_idx').on(table.phone),
  })
);

// Stores table
export const stores = pgTable(
  'stores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    address: text('address'),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    gstin: varchar('gstin', { length: 15 }),
    parentStoreId: uuid('parent_store_id'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index('stores_code_idx').on(table.code),
  })
);

// Roles table
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Permissions table
export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  resource: varchar('resource', { length: 100 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Role Permissions junction table
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: unique().on(table.roleId, table.permissionId),
  })
);

// User Roles table (scoped by store)
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    canManipulateInventory: boolean('can_manipulate_inventory').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userStoreRoleIdx: unique().on(table.userId, table.roleId, table.storeId),
    inventoryPermissionIdx: index('user_roles_inventory_permission_idx').on(
      table.userId,
      table.storeId,
      table.canManipulateInventory
    ),
  })
);

// Sessions table
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('sessions_user_idx').on(table.userId),
    tokenIdx: index('sessions_token_idx').on(table.tokenHash),
  })
);

// Audit Logs table
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    storeId: uuid('store_id').references(() => stores.id),
    action: varchar('action', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id'),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('audit_logs_user_idx').on(table.userId),
    entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
);

// Login History
export const loginHistory = pgTable(
  'login_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    status: varchar('status', { length: 20 }).notNull(), // 'success', 'failed'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('login_history_user_idx').on(table.userId),
    createdAtIdx: index('login_history_created_at_idx').on(table.createdAt),
  })
);


// Relations
export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  sessions: many(sessions),
  loginHistory: many(loginHistory),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  parentStore: one(stores, {
    fields: [stores.parentStoreId],
    references: [stores.id],
  }),
  childStores: many(stores),
  userRoles: many(userRoles),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  store: one(stores, {
    fields: [userRoles.storeId],
    references: [stores.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [sessions.storeId],
    references: [stores.id],
  }),
}));

export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
  user: one(users, {
    fields: [loginHistory.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// INVENTORY MANAGEMENT SCHEMA
// ============================================================================

// Inventory Categories
export const inventoryCategories = pgTable('inventory_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  parentId: uuid('parent_id'),
  description: text('description'),
  // Dimension configuration - which fields to show for this category
  requiresLength: boolean('requires_length').default(false),
  requiresWidth: boolean('requires_width').default(false),
  requiresHeight: boolean('requires_height').default(false),
  requiresInternalSize: boolean('requires_internal_size').default(false),
  requiresRingSize: boolean('requires_ring_size').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Inventory Items
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    categoryId: uuid('category_id').references(() => inventoryCategories.id),
    sku: varchar('sku', { length: 100 }).notNull().unique(),
    barcode: varchar('barcode', { length: 100 }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    itemType: varchar('item_type', { length: 50 }).notNull(), // 'finished_goods', 'raw_material', 'semi_finished'
    metalType: varchar('metal_type', { length: 50 }), // 'gold', 'silver', 'platinum', 'diamond', 'other'
    purity: varchar('purity', { length: 50 }), // '22K', '18K', '916', '750', etc.
    grossWeight: decimal('gross_weight', { precision: 10, scale: 3 }), // in grams
    netWeight: decimal('net_weight', { precision: 10, scale: 3 }),
    stoneWeight: decimal('stone_weight', { precision: 10, scale: 3 }),
    makingCharges: decimal('making_charges', { precision: 10, scale: 2 }),
    wastagePercentage: decimal('wastage_percentage', { precision: 5, scale: 2 }),
    costRatePercentage: decimal('cost_rate_percentage', { precision: 5, scale: 2 }), // For rate-based calculation
    calculatedCost: decimal('calculated_cost', { precision: 12, scale: 2 }), // Calculated item cost
    costCalculationMethod: varchar('cost_calculation_method', { length: 50 }), // 'rate_based' or 'making_charges'
    isHallmarked: boolean('is_hallmarked').default(false),
    hallmarkNumber: varchar('hallmark_number', { length: 100 }),
    huidNumber: varchar('huid_number', { length: 100 }), // Hallmark Unique ID
    certificationNumber: varchar('certification_number', { length: 100 }),
    certificationAgency: varchar('certification_agency', { length: 100 }), // 'GIA', 'IGI', etc.
    certificationDate: timestamp('certification_date'),
    countryOfOrigin: varchar('country_of_origin', { length: 100 }), // Added for label requirements
    imageUrls: jsonb('image_urls'), // Array of image URLs
    dimensions: jsonb('dimensions'), // Category-specific dimensions (length, width, height, size, etc.)
    // Sold item tracking
    status: varchar('status', { length: 50 }).default('available').notNull(), // 'available', 'sold', 'reserved', 'returned'
    soldAt: timestamp('sold_at'),
    soldPrice: decimal('sold_price', { precision: 12, scale: 2 }),
    soldInvoiceId: uuid('sold_invoice_id').references(() => invoices.id),
    profit: decimal('profit', { precision: 12, scale: 2 }),
    dailyGoldRate: decimal('daily_gold_rate', { precision: 12, scale: 2 }),
    isActive: boolean('is_active').default(true).notNull(),
    // Fine Gold & Valuation Fields (Metal Accounting)
    fineGoldEquivalent: decimal('fine_gold_equivalent', { precision: 10, scale: 4 }), // Converted to 24K equivalent
    lastValuationDate: timestamp('last_valuation_date'), // Last MTM calculation date
    currentMarketValue: decimal('current_market_value', { precision: 12, scale: 2 }), // Latest market value
    unrealizedGainLoss: decimal('unrealized_gain_loss', { precision: 12, scale: 2 }), // Gain/loss vs calculatedCost
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    version: integer('version').default(0).notNull(), // For optimistic locking
  },
  (table) => ({
    skuIdx: index('inventory_items_sku_idx').on(table.sku),
    barcodeIdx: index('inventory_items_barcode_idx').on(table.barcode),
    storeIdx: index('inventory_items_store_idx').on(table.storeId),
    categoryIdx: index('inventory_items_category_idx').on(table.categoryId),
  })
);

// Stones (for jewelry items)
export const stones = pgTable('stones', {
  id: uuid('id').defaultRandom().primaryKey(),
  inventoryItemId: uuid('inventory_item_id')
    .notNull()
    .references(() => inventoryItems.id, { onDelete: 'cascade' }),
  stoneType: varchar('stone_type', { length: 100 }).notNull(), // 'diamond', 'ruby', 'emerald', etc.
  count: integer('count').notNull(),
  totalWeight: decimal('total_weight', { precision: 10, scale: 3 }), // carats
  averageWeight: decimal('average_weight', { precision: 10, scale: 3 }),
  shape: varchar('shape', { length: 50 }), // 'round', 'princess', 'oval', etc.
  color: varchar('color', { length: 50 }),
  clarity: varchar('clarity', { length: 50 }),
  cutGrade: varchar('cut_grade', { length: 50 }),
  certificationNumber: varchar('certification_number', { length: 100 }),
  certificationAgency: varchar('certification_agency', { length: 100 }),
  pricePerCarat: decimal('price_per_carat', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Inventory Batches (for batch-based entry)
export const inventoryBatches = pgTable(
  'inventory_batches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    batchNumber: varchar('batch_number', { length: 100 }).notNull().unique(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    supplierId: uuid('supplier_id'), // Will be made NOT NULL in migration after creating suppliers table
    purchaseDate: timestamp('purchase_date').notNull(),
    expectedTotalItems: integer('expected_total_items').notNull(),
    actualTotalItems: integer('actual_total_items').default(0).notNull(),
    expectedTotalWeight: decimal('expected_total_weight', { precision: 10, scale: 3 }).notNull(),
    actualTotalWeight: decimal('actual_total_weight', { precision: 10, scale: 3 }).default('0').notNull(),
    // Purchase type: 'monetary' (cash/bank) or 'gold_exchange' (gold-to-gold)
    purchaseType: varchar('purchase_type', { length: 20 }).default('monetary').notNull(), // 'monetary', 'gold_exchange'
    // Financial fields for monetary purchases
    totalCost: decimal('total_cost', { precision: 12, scale: 2 }),
    goldRatePerGram: decimal('gold_rate_per_gram', { precision: 10, scale: 2 }),
    totalPaid: decimal('total_paid', { precision: 12, scale: 2 }).default('0'),
    outstandingBalance: decimal('outstanding_balance', { precision: 12, scale: 2 }).default('0'),
    dueDate: timestamp('due_date'),
    paymentStatus: varchar('payment_status', { length: 50 }).default('pending'), // 'pending', 'partial', 'paid'
    // Gold exchange fields (for gold-to-gold purchases)
    goldGivenWeight: decimal('gold_given_weight', { precision: 10, scale: 3 }).default('0').notNull(), // Gold given to supplier
    goldGivenPurity: decimal('gold_given_purity', { precision: 5, scale: 2 }), // Purity of gold given (e.g., 22, 18)
    goldGivenValue: decimal('gold_given_value', { precision: 12, scale: 2 }).default('0').notNull(), // Value of gold given
    goldBalancePaid: decimal('gold_balance_paid', { precision: 12, scale: 2 }).default('0').notNull(), // If any cash balance paid
    goldBalanceReceived: decimal('gold_balance_received', { precision: 12, scale: 2 }).default('0').notNull(), // If any cash balance received
    goldExchangeStatus: varchar('gold_exchange_status', { length: 50 }).default('balanced'), // 'balanced', 'owe_gold', 'owe_cash'
    // Common fields
    status: varchar('status', { length: 50 }).notNull().default('in_progress'), // 'in_progress', 'completed', 'discrepancy'
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    batchNumberIdx: index('inventory_batches_batch_number_idx').on(table.batchNumber),
    storeIdx: index('inventory_batches_store_idx').on(table.storeId),
    statusIdx: index('inventory_batches_status_idx').on(table.status),
    paymentStatusIdx: index('inventory_batches_payment_status_idx').on(table.paymentStatus),
    supplierIdx: index('inventory_batches_supplier_idx').on(table.supplierId),
  })
);

// Inventory Batch Items (junction table)
export const inventoryBatchItems = pgTable('inventory_batch_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id')
    .notNull()
    .references(() => inventoryBatches.id, { onDelete: 'cascade' }),
  inventoryItemId: uuid('inventory_item_id')
    .notNull()
    .references(() => inventoryItems.id, { onDelete: 'cascade' }),
  sequenceNumber: integer('sequence_number').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Stock Levels
export const stockLevels = pgTable(
  'stock_levels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    quantity: integer('quantity').default(0).notNull(),
    reservedQuantity: integer('reserved_quantity').default(0).notNull(),
    reorderLevel: integer('reorder_level').default(0),
    location: varchar('location', { length: 100 }), // 'showcase_1', 'vault', etc.
    lastCountedAt: timestamp('last_counted_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    version: integer('version').default(0).notNull(), // For optimistic locking
  },
  (table) => ({
    itemStoreUnique: unique().on(table.inventoryItemId, table.storeId),
    itemIdx: index('stock_levels_item_idx').on(table.inventoryItemId),
    storeIdx: index('stock_levels_store_idx').on(table.storeId),
  })
);

// Stock Movements
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    movementType: varchar('movement_type', { length: 50 }).notNull(), // 'purchase', 'sale', 'transfer', 'adjustment', 'return'
    quantity: integer('quantity').notNull(),
    fromLocation: varchar('from_location', { length: 100 }),
    toLocation: varchar('to_location', { length: 100 }),
    referenceType: varchar('reference_type', { length: 50 }), // 'batch', 'invoice', 'transfer', etc.
    referenceId: uuid('reference_id'),
    performedBy: uuid('performed_by')
      .notNull()
      .references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    itemIdx: index('stock_movements_item_idx').on(table.inventoryItemId),
    storeIdx: index('stock_movements_store_idx').on(table.storeId),
    typeIdx: index('stock_movements_type_idx').on(table.movementType),
    createdAtIdx: index('stock_movements_created_at_idx').on(table.createdAt),
  })
);

// Inventory Transfers
export const inventoryTransfers = pgTable(
  'inventory_transfers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transferNumber: varchar('transfer_number', { length: 100 }).notNull().unique(),
    sourceStoreId: uuid('source_store_id')
      .notNull()
      .references(() => stores.id),
    destinationStoreId: uuid('destination_store_id')
      .notNull()
      .references(() => stores.id),
    status: varchar('status', { length: 50 }).notNull().default('requested'), // 'requested', 'in_transit', 'completed', 'cancelled', 'rejected'
    // Financial & Invoice Fields
    totalWeight: decimal('total_weight', { precision: 10, scale: 3 }), // Total weight of transferred items
    totalValue: decimal('total_value', { precision: 12, scale: 2 }), // Total value based on gold rate
    goldRate: decimal('gold_rate', { precision: 10, scale: 2 }), // Gold rate at time of transfer
    invoiceNumber: varchar('invoice_number', { length: 100 }), // Generated internal invoice number
    invoiceDate: timestamp('invoice_date'),
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    approvedBy: uuid('approved_by').references(() => users.id),
    receivedBy: uuid('received_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    transferNumberIdx: index('inventory_transfers_number_idx').on(table.transferNumber),
    sourceStoreIdx: index('inventory_transfers_source_store_idx').on(table.sourceStoreId),
    destStoreIdx: index('inventory_transfers_dest_store_idx').on(table.destinationStoreId),
    statusIdx: index('inventory_transfers_status_idx').on(table.status),
    invoiceIdx: index('inventory_transfers_invoice_idx').on(table.invoiceNumber),
  })
);

// Inventory Transfer Items
export const inventoryTransferItems = pgTable(
  'inventory_transfer_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transferId: uuid('transfer_id')
      .notNull()
      .references(() => inventoryTransfers.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id),
    quantity: integer('quantity').notNull().default(1),
    // Item Financials Snapshot
    weight: decimal('weight', { precision: 10, scale: 3 }),
    rate: decimal('rate', { precision: 10, scale: 2 }), // Rate used for valuation
    value: decimal('value', { precision: 12, scale: 2 }), // Calculated value
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'received', 'rejected'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    transferIdx: index('inventory_transfer_items_transfer_idx').on(table.transferId),
    itemIdx: index('inventory_transfer_items_item_idx').on(table.inventoryItemId),
  })
);

// Relations for inventory
export const inventoryCategoriesRelations = relations(inventoryCategories, ({ one, many }) => ({
  parent: one(inventoryCategories, {
    fields: [inventoryCategories.parentId],
    references: [inventoryCategories.id],
    relationName: 'categoryHierarchy',
  }),
  children: many(inventoryCategories, {
    relationName: 'categoryHierarchy',
  }),
  items: many(inventoryItems),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  store: one(stores, {
    fields: [inventoryItems.storeId],
    references: [stores.id],
  }),
  category: one(inventoryCategories, {
    fields: [inventoryItems.categoryId],
    references: [inventoryCategories.id],
  }),
  stones: many(stones),
  batchItems: many(inventoryBatchItems),
  stockLevels: many(stockLevels),
  stockMovements: many(stockMovements),
  salesReturnItems: many(salesReturnItems),
}));

export const stonesRelations = relations(stones, ({ one }) => ({
  inventoryItem: one(inventoryItems, {
    fields: [stones.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const inventoryBatchesRelations = relations(inventoryBatches, ({ one, many }) => ({
  store: one(stores, {
    fields: [inventoryBatches.storeId],
    references: [stores.id],
  }),
  supplier: one(suppliers, {
    fields: [inventoryBatches.supplierId],
    references: [suppliers.id],
  }),
  createdByUser: one(users, {
    fields: [inventoryBatches.createdBy],
    references: [users.id],
  }),
  batchItems: many(inventoryBatchItems),
  purchasePayments: many(purchasePayments),
}));

export const inventoryBatchItemsRelations = relations(inventoryBatchItems, ({ one }) => ({
  batch: one(inventoryBatches, {
    fields: [inventoryBatchItems.batchId],
    references: [inventoryBatches.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [inventoryBatchItems.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  inventoryItem: one(inventoryItems, {
    fields: [stockLevels.inventoryItemId],
    references: [inventoryItems.id],
  }),
  store: one(stores, {
    fields: [stockLevels.storeId],
    references: [stores.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  inventoryItem: one(inventoryItems, {
    fields: [stockMovements.inventoryItemId],
    references: [inventoryItems.id],
  }),
  store: one(stores, {
    fields: [stockMovements.storeId],
    references: [stores.id],
  }),
  performedByUser: one(users, {
    fields: [stockMovements.performedBy],
    references: [users.id],
  }),
}));

export const inventoryTransfersRelations = relations(inventoryTransfers, ({ one, many }) => ({
  sourceStore: one(stores, {
    fields: [inventoryTransfers.sourceStoreId],
    references: [stores.id],
    relationName: 'transfersFrom',
  }),
  destinationStore: one(stores, {
    fields: [inventoryTransfers.destinationStoreId],
    references: [stores.id],
    relationName: 'transfersTo',
  }),
  createdByUser: one(users, {
    fields: [inventoryTransfers.createdBy],
    references: [users.id],
    relationName: 'createdTransfers',
  }),
  approvedByUser: one(users, {
    fields: [inventoryTransfers.approvedBy],
    references: [users.id],
    relationName: 'approvedTransfers',
  }),
  receivedByUser: one(users, {
    fields: [inventoryTransfers.receivedBy],
    references: [users.id],
    relationName: 'receivedTransfers',
  }),
  items: many(inventoryTransferItems),
}));

export const inventoryTransferItemsRelations = relations(inventoryTransferItems, ({ one }) => ({
  transfer: one(inventoryTransfers, {
    fields: [inventoryTransferItems.transferId],
    references: [inventoryTransfers.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [inventoryTransferItems.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

// ============================================================================
// CUSTOMER MANAGEMENT SCHEMA
// ============================================================================

// Customers
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    customerCode: varchar('customer_code', { length: 50 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }).notNull(),
    whatsapp: varchar('whatsapp', { length: 20 }),
    dateOfBirth: timestamp('date_of_birth'),
    gender: varchar('gender', { length: 20 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    pincode: varchar('pincode', { length: 10 }),
    gstNumber: varchar('gst_number', { length: 15 }),
    loyaltyPoints: integer('loyalty_points').default(0).notNull(),
    tier: varchar('tier', { length: 50 }).default('silver'), // 'bronze', 'silver', 'gold', 'platinum'
    // Communication preferences
    communicationPreferences: jsonb('communication_preferences'), // { whatsapp: true, email: true, sms: false }
    whatsappOptIn: boolean('whatsapp_opt_in').default(false).notNull(),
    emailOptIn: boolean('email_opt_in').default(true).notNull(),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    customerCodeIdx: unique().on(table.storeId, table.customerCode),
    phoneIdx: index('customers_phone_idx').on(table.phone),
    emailIdx: index('customers_email_idx').on(table.email),
    storeIdx: index('customers_store_idx').on(table.storeId),
  })
);

// Customer Addresses
export const customerAddresses = pgTable('customer_addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  addressType: varchar('address_type', { length: 50 }).notNull(), // 'home', 'work', 'billing', 'shipping'
  addressLine1: varchar('address_line1', { length: 255 }).notNull(),
  addressLine2: varchar('address_line2', { length: 255 }),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  pincode: varchar('pincode', { length: 10 }).notNull(),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Loyalty Transactions
export const loyaltyTransactions = pgTable(
  'loyalty_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    transactionDate: timestamp('transaction_date').defaultNow().notNull(),
    points: integer('points').notNull(), // Can be positive (earned) or negative (redeemed)
    type: varchar('type', { length: 50 }).notNull(), // 'earned', 'redeemed', 'expired', 'adjusted'
    referenceType: varchar('reference_type', { length: 50 }), // 'invoice', 'adjustment', etc.
    referenceId: uuid('reference_id'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index('loyalty_transactions_customer_idx').on(table.customerId),
    dateIdx: index('loyalty_transactions_date_idx').on(table.transactionDate),
  })
);

// ============================================================================
// CUSTOMER CRM EXTENSION SCHEMA
// ============================================================================

// Customer Wishlists - Both specific items and custom descriptions
export const customerWishlists = pgTable(
  'customer_wishlists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    // For specific inventory items
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id, { onDelete: 'set null' }),
    // For custom wishlist descriptions
    customDescription: text('custom_description'), // e.g., "22K gold ring, 5-6g, ₹30-40k budget"
    // Wishlist item details
    wishlistType: varchar('wishlist_type', { length: 20 }).notNull(), // 'specific_item', 'custom_description'
    metalType: varchar('metal_type', { length: 50 }), // 'gold', 'silver', 'platinum', 'diamond'
    purityPreference: varchar('purity_preference', { length: 50 }), // '22K', '18K', etc.
    categoryId: uuid('category_id').references(() => inventoryCategories.id),
    minWeight: decimal('min_weight', { precision: 10, scale: 3 }),
    maxWeight: decimal('max_weight', { precision: 10, scale: 3 }),
    minBudget: decimal('min_budget', { precision: 12, scale: 2 }),
    maxBudget: decimal('max_budget', { precision: 12, scale: 2 }),
    priority: varchar('priority', { length: 20 }).default('medium'), // 'low', 'medium', 'high', 'urgent'
    status: varchar('status', { length: 20 }).default('active'), // 'active', 'fulfilled', 'cancelled', 'expired'
    notes: text('notes'),
    notifyOnMatch: boolean('notify_on_match').default(true).notNull(),
    lastNotifiedAt: timestamp('last_notified_at'),
    fulfilledAt: timestamp('fulfilled_at'),
    fulfilledByInvoiceId: uuid('fulfilled_by_invoice_id'),
    expiresAt: timestamp('expires_at'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index('customer_wishlists_customer_idx').on(table.customerId),
    storeIdx: index('customer_wishlists_store_idx').on(table.storeId),
    itemIdx: index('customer_wishlists_item_idx').on(table.inventoryItemId),
    statusIdx: index('customer_wishlists_status_idx').on(table.status),
    typeIdx: index('customer_wishlists_type_idx').on(table.wishlistType),
    metalTypeIdx: index('customer_wishlists_metal_type_idx').on(table.metalType),
    categoryIdx: index('customer_wishlists_category_idx').on(table.categoryId),
  })
);

// Customer Buying Habits - Analytics and preferences
export const customerBuyingHabits = pgTable(
  'customer_buying_habits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' })
      .unique(), // One record per customer
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    // Metal preferences (percentage based on purchases)
    preferredMetalTypes: jsonb('preferred_metal_types'), // { gold: 70, silver: 20, platinum: 10 }
    // Category preferences
    preferredCategories: jsonb('preferred_categories'), // [{ categoryId, name, percentage, count }]
    // Purchase occasions
    purchaseOccasions: jsonb('purchase_occasions'), // { wedding: 40, birthday: 30, anniversary: 20, self: 10 }
    // Budget analysis
    averagePurchaseValue: decimal('average_purchase_value', { precision: 12, scale: 2 }),
    minPurchaseValue: decimal('min_purchase_value', { precision: 12, scale: 2 }),
    maxPurchaseValue: decimal('max_purchase_value', { precision: 12, scale: 2 }),
    budgetTier: varchar('budget_tier', { length: 20 }), // 'economy', 'mid_range', 'premium', 'luxury'
    // RFM Analysis
    recencyScore: integer('recency_score'), // 1-5 (5 = most recent)
    frequencyScore: integer('frequency_score'), // 1-5 (5 = most frequent)
    monetaryScore: integer('monetary_score'), // 1-5 (5 = highest spender)
    rfmSegment: varchar('rfm_segment', { length: 50 }), // 'champions', 'loyal', 'potential', 'new', 'at_risk', 'lost'
    // Purchase patterns
    totalPurchases: integer('total_purchases').default(0).notNull(),
    totalSpent: decimal('total_spent', { precision: 12, scale: 2 }).default('0').notNull(),
    totalGoldWeightPurchased: decimal('total_gold_weight_purchased', { precision: 10, scale: 3 }).default('0'),
    firstPurchaseDate: timestamp('first_purchase_date'),
    lastPurchaseDate: timestamp('last_purchase_date'),
    averageDaysBetweenPurchases: integer('average_days_between_purchases'),
    // Seasonal preferences
    preferredPurchaseMonths: jsonb('preferred_purchase_months'), // [1, 10, 11] for Jan, Oct, Nov
    preferredPurchaseDays: jsonb('preferred_purchase_days'), // ['saturday', 'sunday']
    // Churn prediction
    churnRiskScore: decimal('churn_risk_score', { precision: 5, scale: 2 }), // 0-100
    predictedNextPurchaseDate: timestamp('predicted_next_purchase_date'),
    // Customer lifetime value
    lifetimeValue: decimal('lifetime_value', { precision: 12, scale: 2 }),
    predictedLifetimeValue: decimal('predicted_lifetime_value', { precision: 12, scale: 2 }),
    lastCalculatedAt: timestamp('last_calculated_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index('customer_buying_habits_customer_idx').on(table.customerId),
    storeIdx: index('customer_buying_habits_store_idx').on(table.storeId),
    rfmSegmentIdx: index('customer_buying_habits_rfm_segment_idx').on(table.rfmSegment),
    budgetTierIdx: index('customer_buying_habits_budget_tier_idx').on(table.budgetTier),
    churnRiskIdx: index('customer_buying_habits_churn_risk_idx').on(table.churnRiskScore),
  })
);

// Customer Referrals - Track referral relationships
export const customerReferrals = pgTable(
  'customer_referrals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }), // Customer who referred
    referredId: uuid('referred_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }), // New customer who was referred
    referralCode: varchar('referral_code', { length: 50 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'qualified', 'rewarded', 'cancelled'
    // Qualification criteria
    qualificationDate: timestamp('qualification_date'), // When referred customer made qualifying purchase
    qualifyingInvoiceId: uuid('qualifying_invoice_id'),
    qualifyingAmount: decimal('qualifying_amount', { precision: 12, scale: 2 }),
    // Reward tracking
    referrerRewardPoints: integer('referrer_reward_points'),
    referrerRewardedAt: timestamp('referrer_rewarded_at'),
    referredRewardPoints: integer('referred_reward_points'), // Welcome bonus for new customer
    referredRewardedAt: timestamp('referred_rewarded_at'),
    // Staff tracking
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('customer_referrals_store_idx').on(table.storeId),
    referrerIdx: index('customer_referrals_referrer_idx').on(table.referrerId),
    referredIdx: index('customer_referrals_referred_idx').on(table.referredId),
    statusIdx: index('customer_referrals_status_idx').on(table.status),
    referralCodeIdx: index('customer_referrals_code_idx').on(table.referralCode),
  })
);

// Loyalty Rewards Catalog - Available rewards for redemption
export const loyaltyRewardsCatalog = pgTable(
  'loyalty_rewards_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    rewardType: varchar('reward_type', { length: 50 }).notNull(), // 'free_service', 'discount_percentage', 'discount_fixed', 'free_product', 'cashback'
    // Reward value
    pointsCost: integer('points_cost').notNull(),
    discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }), // For percentage discounts
    discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }), // For fixed discounts
    maxDiscountAmount: decimal('max_discount_amount', { precision: 12, scale: 2 }), // Cap for percentage discounts
    // Service details (for free services)
    serviceType: varchar('service_type', { length: 50 }), // 'repair', 'repolishing', 'cleaning', 'resizing', 'engraving'
    // Product details (for free products)
    applicableCategories: jsonb('applicable_categories'), // Array of category IDs
    applicableProducts: jsonb('applicable_products'), // Array of product IDs for dead stock
    // Eligibility
    minTier: varchar('min_tier', { length: 20 }).default('bronze'), // Minimum tier required
    minPurchaseAmount: decimal('min_purchase_amount', { precision: 12, scale: 2 }), // Minimum purchase to use reward
    // Validity
    validityDays: integer('validity_days').default(90), // Days after redemption to use
    maxRedemptionsPerCustomer: integer('max_redemptions_per_customer'), // null = unlimited
    totalAvailable: integer('total_available'), // null = unlimited
    totalRedeemed: integer('total_redeemed').default(0).notNull(),
    // Display
    displayOrder: integer('display_order').default(0),
    imageUrl: varchar('image_url', { length: 500 }),
    isActive: boolean('is_active').default(true).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('loyalty_rewards_catalog_store_idx').on(table.storeId),
    typeIdx: index('loyalty_rewards_catalog_type_idx').on(table.rewardType),
    tierIdx: index('loyalty_rewards_catalog_tier_idx').on(table.minTier),
    activeIdx: index('loyalty_rewards_catalog_active_idx').on(table.isActive),
    featuredIdx: index('loyalty_rewards_catalog_featured_idx').on(table.isFeatured),
  })
);

// Loyalty Reward Redemptions - Track when customers redeem rewards
export const loyaltyRewardRedemptions = pgTable(
  'loyalty_reward_redemptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    rewardId: uuid('reward_id')
      .notNull()
      .references(() => loyaltyRewardsCatalog.id),
    // Redemption details
    pointsSpent: integer('points_spent').notNull(),
    redemptionCode: varchar('redemption_code', { length: 50 }).notNull().unique(),
    status: varchar('status', { length: 20 }).default('active').notNull(), // 'active', 'used', 'expired', 'cancelled'
    // Usage tracking
    usedAt: timestamp('used_at'),
    usedInInvoiceId: uuid('used_in_invoice_id'),
    discountApplied: decimal('discount_applied', { precision: 12, scale: 2 }),
    // Validity
    expiresAt: timestamp('expires_at').notNull(),
    // Staff tracking
    redeemedBy: uuid('redeemed_by')
      .notNull()
      .references(() => users.id), // Staff who processed redemption
    usedBy: uuid('used_by').references(() => users.id), // Staff who applied the reward
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('loyalty_reward_redemptions_store_idx').on(table.storeId),
    customerIdx: index('loyalty_reward_redemptions_customer_idx').on(table.customerId),
    rewardIdx: index('loyalty_reward_redemptions_reward_idx').on(table.rewardId),
    statusIdx: index('loyalty_reward_redemptions_status_idx').on(table.status),
    codeIdx: index('loyalty_reward_redemptions_code_idx').on(table.redemptionCode),
    expiresIdx: index('loyalty_reward_redemptions_expires_idx').on(table.expiresAt),
  })
);

// WhatsApp Leads - Track leads from WhatsApp enquiries
export const whatsappLeads = pgTable(
  'whatsapp_leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    // Lead contact info
    phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
    name: varchar('name', { length: 255 }),
    // Lead details
    source: varchar('source', { length: 50 }).default('whatsapp_enquiry'), // 'whatsapp_enquiry', 'whatsapp_campaign', 'referral'
    campaignId: varchar('campaign_id', { length: 100 }), // If from a campaign
    // Lead scoring
    leadScore: integer('lead_score').default(0), // 0-100
    scoringFactors: jsonb('scoring_factors'), // { responseTime: 10, enquiryCount: 20, productInterest: 30 }
    // Pipeline stage
    stage: varchar('stage', { length: 30 }).default('new').notNull(), // 'new', 'contacted', 'interested', 'negotiating', 'converted', 'lost'
    // Enquiry details
    enquiryType: varchar('enquiry_type', { length: 50 }), // 'product', 'pricing', 'availability', 'custom_order', 'general'
    interestedProducts: jsonb('interested_products'), // Array of category/product interests
    budgetRange: varchar('budget_range', { length: 50 }), // 'under_10k', '10k_50k', '50k_1l', '1l_5l', 'above_5l'
    // Conversion tracking
    convertedToCustomerId: uuid('converted_to_customer_id').references(() => customers.id),
    conversionDate: timestamp('conversion_date'),
    conversionValue: decimal('conversion_value', { precision: 12, scale: 2 }),
    // Assignment
    assignedTo: uuid('assigned_to').references(() => users.id),
    // Follow-up
    nextFollowUpDate: timestamp('next_follow_up_date'),
    lastContactedAt: timestamp('last_contacted_at'),
    totalInteractions: integer('total_interactions').default(0).notNull(),
    // Notes
    notes: text('notes'),
    tags: jsonb('tags'), // Array of tags for categorization
    // Tracking
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('whatsapp_leads_store_idx').on(table.storeId),
    phoneIdx: index('whatsapp_leads_phone_idx').on(table.phoneNumber),
    stageIdx: index('whatsapp_leads_stage_idx').on(table.stage),
    scoreIdx: index('whatsapp_leads_score_idx').on(table.leadScore),
    assignedIdx: index('whatsapp_leads_assigned_idx').on(table.assignedTo),
    followUpIdx: index('whatsapp_leads_follow_up_idx').on(table.nextFollowUpDate),
    convertedIdx: index('whatsapp_leads_converted_idx').on(table.convertedToCustomerId),
  })
);

// WhatsApp Messages - Track all WhatsApp communications
export const whatsappMessages = pgTable(
  'whatsapp_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    // Recipient/Sender
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => whatsappLeads.id, { onDelete: 'set null' }),
    phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
    // Message details
    direction: varchar('direction', { length: 10 }).notNull(), // 'inbound', 'outbound'
    messageType: varchar('message_type', { length: 30 }).notNull(), // 'text', 'image', 'document', 'template', 'receipt', 'notification'
    templateName: varchar('template_name', { length: 100 }), // For template messages
    content: text('content'),
    mediaUrl: varchar('media_url', { length: 500 }),
    // Reference to related entities
    referenceType: varchar('reference_type', { length: 50 }), // 'invoice', 'wishlist_alert', 'loyalty_milestone', 'campaign', 'enquiry'
    referenceId: uuid('reference_id'),
    // Delivery status
    whatsappMessageId: varchar('whatsapp_message_id', { length: 255 }), // ID from WhatsApp API
    status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'sent', 'delivered', 'read', 'failed'
    statusUpdatedAt: timestamp('status_updated_at'),
    errorMessage: text('error_message'),
    // Tracking
    sentBy: uuid('sent_by').references(() => users.id), // Staff who sent (for outbound)
    sentAt: timestamp('sent_at'),
    deliveredAt: timestamp('delivered_at'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('whatsapp_messages_store_idx').on(table.storeId),
    customerIdx: index('whatsapp_messages_customer_idx').on(table.customerId),
    leadIdx: index('whatsapp_messages_lead_idx').on(table.leadId),
    phoneIdx: index('whatsapp_messages_phone_idx').on(table.phoneNumber),
    directionIdx: index('whatsapp_messages_direction_idx').on(table.direction),
    statusIdx: index('whatsapp_messages_status_idx').on(table.status),
    referenceIdx: index('whatsapp_messages_reference_idx').on(table.referenceType, table.referenceId),
    createdAtIdx: index('whatsapp_messages_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// SALES & POS SCHEMA
// ============================================================================

// Gold Rates
export const goldRates = pgTable(
  'gold_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    date: timestamp('date').notNull(),
    goldType: varchar('gold_type', { length: 50 }).notNull(), // '24K', '22K', '18K', etc.
    purity: varchar('purity', { length: 50 }).notNull(), // '999', '916', '750', etc.
    ratePerGram: decimal('rate_per_gram', { precision: 10, scale: 2 }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    dateTypeIdx: unique().on(table.date, table.goldType, table.purity),
    dateIdx: index('gold_rates_date_idx').on(table.date),
  })
);

// Sales Invoices
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
    customerId: uuid('customer_id').references(() => customers.id),
    invoiceDate: timestamp('invoice_date').defaultNow().notNull(),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    taxAmount: decimal('tax_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    finalAmount: decimal('final_amount', { precision: 12, scale: 2 }).notNull(),
    goldRateId: uuid('gold_rate_id').references(() => goldRates.id),
    paymentStatus: varchar('payment_status', { length: 50 }).notNull().default('pending'), // 'pending', 'partial', 'paid', 'refunded'
    // Purchase occasion for buying habits tracking
    purchaseOccasion: varchar('purchase_occasion', { length: 50 }), // 'wedding', 'birthday', 'anniversary', 'festival', 'self', 'gift', 'other'
    // Loyalty points earned/redeemed
    loyaltyPointsEarned: integer('loyalty_points_earned').default(0),
    loyaltyPointsRedeemed: integer('loyalty_points_redeemed').default(0),
    redemptionId: uuid('redemption_id'), // Reference to loyalty_reward_redemptions if reward was used
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    version: integer('version').default(0).notNull(),
  },
  (table) => ({
    invoiceNumberIdx: unique().on(table.storeId, table.invoiceNumber),
    storeIdx: index('invoices_store_idx').on(table.storeId),
    customerIdx: index('invoices_customer_idx').on(table.customerId),
    dateIdx: index('invoices_date_idx').on(table.invoiceDate),
    statusIdx: index('invoices_status_idx').on(table.paymentStatus),
  })
);

// Invoice Line Items
export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id),
  itemDescription: varchar('item_description', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  makingCharges: decimal('making_charges', { precision: 12, scale: 2 }).default('0').notNull(),
  wastageCharges: decimal('wastage_charges', { precision: 12, scale: 2 }).default('0').notNull(),
  discount: decimal('discount', { precision: 12, scale: 2 }).default('0').notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0').notNull(),
  lineTotal: decimal('line_total', { precision: 12, scale: 2 }).notNull(),
  goldWeight: decimal('gold_weight', { precision: 10, scale: 3 }),
  goldPurity: varchar('gold_purity', { length: 50 }),

  // ROI & Margin Analysis fields
  unitCost: decimal('unit_cost', { precision: 12, scale: 2 }), // Original cost when item was added
  metalCostAtSale: decimal('metal_cost_at_sale', { precision: 12, scale: 2 }), // MTM cost at sale time
  metalMarginGrams: decimal('metal_margin_grams', { precision: 10, scale: 4 }), // Profit in grams
  holdingPeriodDays: integer('holding_period_days'), // Days item was in inventory
  effectiveROI: decimal('effective_roi', { precision: 8, scale: 4 }), // ROI percentage
  grossMargin: decimal('gross_margin', { precision: 12, scale: 2 }), // lineTotal - metalCostAtSale
  grossMarginPercent: decimal('gross_margin_percent', { precision: 8, scale: 4 }), // (grossMargin / metalCostAtSale) * 100

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sales Returns
export const salesReturns = pgTable(
  'sales_returns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    returnNumber: varchar('return_number', { length: 100 }).notNull().unique(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    customerId: uuid('customer_id').references(() => customers.id),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    status: varchar('status', { length: 50 }).notNull().default('requested'), // 'requested', 'approved', 'completed', 'rejected'
    totalRefundAmount: decimal('total_refund_amount', { precision: 12, scale: 2 }).notNull(),
    refundMethod: varchar('refund_method', { length: 50 }), // 'cash', 'card', 'store_credit', 'bank_transfer'
    reason: text('reason'),
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    approvedBy: uuid('approved_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    returnNumberIdx: index('sales_returns_number_idx').on(table.returnNumber),
    invoiceIdx: index('sales_returns_invoice_idx').on(table.invoiceId),
    storeIdx: index('sales_returns_store_idx').on(table.storeId),
    statusIdx: index('sales_returns_status_idx').on(table.status),
  })
);

// Sales Return Items
export const salesReturnItems = pgTable(
  'sales_return_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    returnId: uuid('return_id')
      .notNull()
      .references(() => salesReturns.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id),
    invoiceItemId: uuid('invoice_item_id')
      .notNull()
      .references(() => invoiceItems.id),
    quantity: integer('quantity').notNull().default(1),
    refundAmount: decimal('refund_amount', { precision: 12, scale: 2 }).notNull(),
    condition: varchar('condition', { length: 50 }).notNull().default('good'), // 'good', 'damaged', 'scrap'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    returnIdx: index('sales_return_items_return_idx').on(table.returnId),
    itemIdx: index('sales_return_items_item_idx').on(table.inventoryItemId),
  })
);

// Payments
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    paymentDate: timestamp('payment_date').defaultNow().notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // 'cash', 'card', 'upi', 'bank_transfer', etc.
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    transactionReference: varchar('transaction_reference', { length: 255 }),
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    invoiceIdx: index('payments_invoice_idx').on(table.invoiceId),
    dateIdx: index('payments_date_idx').on(table.paymentDate),
  })
);

// Quotations
export const quotations = pgTable(
  'quotations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    quotationNumber: varchar('quotation_number', { length: 100 }).notNull(),
    customerId: uuid('customer_id').references(() => customers.id),
    quotationDate: timestamp('quotation_date').defaultNow().notNull(),
    validUntil: timestamp('valid_until').notNull(),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'accepted', 'rejected', 'expired'
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    quotationNumberIdx: unique().on(table.storeId, table.quotationNumber),
    storeIdx: index('quotations_store_idx').on(table.storeId),
    customerIdx: index('quotations_customer_idx').on(table.customerId),
  })
);

// ============================================================================
// GOLD LOAN SCHEMA
// ============================================================================

// Gold Loans
export const goldLoans = pgTable(
  'gold_loans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    loanNumber: varchar('loan_number', { length: 100 }).notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    applicationDate: timestamp('application_date').defaultNow().notNull(),
    loanAmount: decimal('loan_amount', { precision: 12, scale: 2 }).notNull(),
    interestRate: decimal('interest_rate', { precision: 5, scale: 2 }).notNull(), // Annual rate
    tenure: integer('tenure').notNull(), // in months
    monthlyEmi: decimal('monthly_emi', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'approved', 'active', 'closed', 'defaulted', 'margin_call', 'auction_initiated', 'auctioned', 'renewed'
    maturityDate: timestamp('maturity_date'),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    closedAt: timestamp('closed_at'),
    // Gold Pawning Enhanced Fields
    loanType: varchar('loan_type', { length: 20 }).default('bullet'), // 'bullet', 'emi', 'interest_only'
    interestRateConfigId: uuid('interest_rate_config_id'), // References loanInterestRates (added post-table)
    disbursementDate: timestamp('disbursement_date'),
    disbursementMethod: varchar('disbursement_method', { length: 50 }), // 'cash', 'bank_transfer', 'upi', 'cheque'
    disbursementReference: varchar('disbursement_reference', { length: 255 }),
    // LTV Tracking
    originalLtv: decimal('original_ltv', { precision: 5, scale: 2 }), // LTV at disbursement
    currentLtv: decimal('current_ltv', { precision: 5, scale: 2 }), // Latest calculated LTV
    ltvStatus: varchar('ltv_status', { length: 20 }).default('safe'), // 'safe', 'warning', 'breach'
    totalGoldValue: decimal('total_gold_value', { precision: 12, scale: 2 }), // Sum of appraised gold
    // KYC Compliance
    kycVerified: boolean('kyc_verified').default(false),
    borrowerPresentAtValuation: boolean('borrower_present_at_valuation').default(false), // Regulatory requirement
    // Interest Accrual
    accruedInterest: decimal('accrued_interest', { precision: 12, scale: 2 }).default('0'),
    lastInterestCalcDate: timestamp('last_interest_calc_date'),
    totalInterestPaid: decimal('total_interest_paid', { precision: 12, scale: 2 }).default('0'),
    totalPenaltyPaid: decimal('total_penalty_paid', { precision: 12, scale: 2 }).default('0'),
    outstandingBalance: decimal('outstanding_balance', { precision: 12, scale: 2 }), // Principal + accrued interest
    // Renewal Tracking
    renewalCount: integer('renewal_count').default(0),
    parentLoanId: uuid('parent_loan_id'), // If this loan is a renewal of another
    // Notes
    internalNotes: text('internal_notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    version: integer('version').default(0).notNull(),
  },
  (table) => ({
    loanNumberIdx: unique().on(table.storeId, table.loanNumber),
    storeIdx: index('gold_loans_store_idx').on(table.storeId),
    customerIdx: index('gold_loans_customer_idx').on(table.customerId),
    statusIdx: index('gold_loans_status_idx').on(table.status),
    ltvStatusIdx: index('gold_loans_ltv_status_idx').on(table.ltvStatus),
    maturityIdx: index('gold_loans_maturity_idx').on(table.maturityDate),
  })
);

// Pledged Gold Items
export const pledgedGold = pgTable(
  'pledged_gold',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => goldLoans.id, { onDelete: 'cascade' }),
    itemDescription: varchar('item_description', { length: 255 }).notNull(),
    itemType: varchar('item_type', { length: 50 }), // 'necklace', 'chain', 'ring', 'bangle', 'earring', 'coin', 'bar', 'other'
    quantity: integer('quantity').default(1).notNull(),
    grossWeight: decimal('gross_weight', { precision: 10, scale: 3 }).notNull(), // in grams
    netWeight: decimal('net_weight', { precision: 10, scale: 3 }).notNull(),
    stoneWeight: decimal('stone_weight', { precision: 10, scale: 3 }).default('0'), // Deducted weight
    purity: varchar('purity', { length: 50 }).notNull(), // '22K', '18K', etc.
    purityPercentage: decimal('purity_percentage', { precision: 5, scale: 2 }), // 91.67 for 22K
    fineGoldEquivalent: decimal('fine_gold_equivalent', { precision: 10, scale: 4 }), // 24K equivalent
    goldRateAtPledge: decimal('gold_rate_at_pledge', { precision: 10, scale: 2 }), // Rate used for valuation
    goldValue: decimal('gold_value', { precision: 12, scale: 2 }).notNull(),
    appraisalValue: decimal('appraisal_value', { precision: 12, scale: 2 }).notNull(),
    currentMarketValue: decimal('current_market_value', { precision: 12, scale: 2 }), // Updated by nightly job
    // Hallmark & Certification
    isHallmarked: boolean('is_hallmarked').default(false),
    hallmarkNumber: varchar('hallmark_number', { length: 50 }),
    huidNumber: varchar('huid_number', { length: 50 }), // BIS Hallmark Unique ID
    // Storage & Custody
    storageLocation: varchar('storage_location', { length: 100 }), // 'vault_1', 'locker_A3', etc.
    sealNumber: varchar('seal_number', { length: 50 }), // Tamper-evident seal number
    // Release tracking
    isReleased: boolean('is_released').default(false),
    releasedAt: timestamp('released_at'),
    releasedTo: varchar('released_to', { length: 255 }),
    photos: jsonb('photos'), // Array of photo URLs
    appraisalNotes: text('appraisal_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    loanIdx: index('pledged_gold_loan_idx').on(table.loanId),
  })
);

// Loan Payments
export const loanPayments = pgTable(
  'loan_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => goldLoans.id, { onDelete: 'cascade' }),
    paymentDate: timestamp('payment_date').defaultNow().notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    paymentType: varchar('payment_type', { length: 50 }).notNull(), // 'emi', 'partial', 'full', 'interest_only'
    principalAmount: decimal('principal_amount', { precision: 12, scale: 2 }).notNull(),
    interestAmount: decimal('interest_amount', { precision: 12, scale: 2 }).notNull(),
    penaltyAmount: decimal('penalty_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    outstandingBalance: decimal('outstanding_balance', { precision: 12, scale: 2 }).notNull(),
    transactionReference: varchar('transaction_reference', { length: 255 }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    loanIdx: index('loan_payments_loan_idx').on(table.loanId),
    dateIdx: index('loan_payments_date_idx').on(table.paymentDate),
  })
);

// Loan Releases
export const loanReleases = pgTable('loan_releases', {
  id: uuid('id').defaultRandom().primaryKey(),
  loanId: uuid('loan_id')
    .notNull()
    .references(() => goldLoans.id, { onDelete: 'cascade' }),
  releaseDate: timestamp('release_date').defaultNow().notNull(),
  totalPaid: decimal('total_paid', { precision: 12, scale: 2 }).notNull(),
  totalInterest: decimal('total_interest', { precision: 12, scale: 2 }).notNull(),
  penalty: decimal('penalty', { precision: 12, scale: 2 }).default('0').notNull(),
  releasedBy: uuid('released_by')
    .notNull()
    .references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// RELATIONS FOR NEW MODULES
// ============================================================================

export const customersRelations = relations(customers, ({ one, many }) => ({
  store: one(stores, {
    fields: [customers.storeId],
    references: [stores.id],
  }),
  addresses: many(customerAddresses),
  loyaltyTransactions: many(loyaltyTransactions),
  invoices: many(invoices),
  goldLoans: many(goldLoans),
  // New CRM relations
  wishlists: many(customerWishlists),
  buyingHabits: one(customerBuyingHabits, {
    fields: [customers.id],
    references: [customerBuyingHabits.customerId],
  }),
  referralsMade: many(customerReferrals, { relationName: 'referrer' }),
  referredBy: many(customerReferrals, { relationName: 'referred' }),
  rewardRedemptions: many(loyaltyRewardRedemptions),
  whatsappMessages: many(whatsappMessages),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAddresses.customerId],
    references: [customers.id],
  }),
}));

export const loyaltyTransactionsRelations = relations(loyaltyTransactions, ({ one }) => ({
  customer: one(customers, {
    fields: [loyaltyTransactions.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyTransactions.createdBy],
    references: [users.id],
  }),
}));

export const goldRatesRelations = relations(goldRates, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [goldRates.createdBy],
    references: [users.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  store: one(stores, {
    fields: [invoices.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  goldRate: one(goldRates, {
    fields: [invoices.goldRateId],
    references: [goldRates.id],
  }),
  createdByUser: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
  invoiceItems: many(invoiceItems),
  payments: many(payments),
  salesReturns: many(salesReturns),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [invoiceItems.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  createdByUser: one(users, {
    fields: [payments.createdBy],
    references: [users.id],
  }),
}));

export const quotationsRelations = relations(quotations, ({ one }) => ({
  store: one(stores, {
    fields: [quotations.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [quotations.createdBy],
    references: [users.id],
  }),
}));

export const goldLoansRelations = relations(goldLoans, ({ one, many }) => ({
  store: one(stores, {
    fields: [goldLoans.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [goldLoans.customerId],
    references: [customers.id],
  }),
  approvedByUser: one(users, {
    fields: [goldLoans.approvedBy],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [goldLoans.createdBy],
    references: [users.id],
  }),
  pledgedGoldItems: many(pledgedGold),
  loanPayments: many(loanPayments),
  loanReleases: many(loanReleases),
  ltvHistory: many(loanLtvHistory),
  documents: many(loanDocuments),
  marginCalls: many(marginCalls),
  notifications: many(loanNotifications),
}));

export const pledgedGoldRelations = relations(pledgedGold, ({ one }) => ({
  loan: one(goldLoans, {
    fields: [pledgedGold.loanId],
    references: [goldLoans.id],
  }),
}));

export const loanPaymentsRelations = relations(loanPayments, ({ one }) => ({
  loan: one(goldLoans, {
    fields: [loanPayments.loanId],
    references: [goldLoans.id],
  }),
  createdByUser: one(users, {
    fields: [loanPayments.createdBy],
    references: [users.id],
  }),
}));

export const loanReleasesRelations = relations(loanReleases, ({ one }) => ({
  loan: one(goldLoans, {
    fields: [loanReleases.loanId],
    references: [goldLoans.id],
  }),
  releasedByUser: one(users, {
    fields: [loanReleases.releasedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// SUPPLIER MANAGEMENT SCHEMA
// ============================================================================

// Suppliers
export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    supplierCode: varchar('supplier_code', { length: 50 }).notNull(),
    businessName: varchar('business_name', { length: 255 }).notNull(),
    contactPersonName: varchar('contact_person_name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }).notNull(),
    whatsapp: varchar('whatsapp', { length: 20 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    pincode: varchar('pincode', { length: 10 }),
    gstNumber: varchar('gst_number', { length: 20 }),
    panNumber: varchar('pan_number', { length: 20 }),
    supplierType: varchar('supplier_type', { length: 50 }).default('wholesaler'), // 'wholesaler', 'manufacturer', 'artisan', 'broker', 'other'
    specialization: jsonb('specialization'), // Array of specializations: ['Gold', 'Silver', 'Diamonds', etc.]
    bankName: varchar('bank_name', { length: 255 }),
    accountNumber: varchar('account_number', { length: 50 }),
    ifscCode: varchar('ifsc_code', { length: 20 }),
    upiId: varchar('upi_id', { length: 100 }),
    defaultCreditDays: integer('default_credit_days').default(0),
    creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).default('0'),
    rating: integer('rating'), // 1-5 rating
    notes: text('notes'),
    // Account tracking fields - Monetary Ledger
    currentBalance: decimal('current_balance', { precision: 12, scale: 2 }).default('0').notNull(),
    totalLifetimePurchases: decimal('total_lifetime_purchases', { precision: 12, scale: 2 }).default('0').notNull(),
    totalLifetimePayments: decimal('total_lifetime_payments', { precision: 12, scale: 2 }).default('0').notNull(),
    lastPurchaseDate: timestamp('last_purchase_date'),
    lastPaymentDate: timestamp('last_payment_date'),
    accountStatus: varchar('account_status', { length: 20 }).default('active').notNull(), // 'active', 'on_hold', 'suspended'
    // Gold Ledger - for gold-to-gold transactions
    goldBalanceGrams: decimal('gold_balance_grams', { precision: 10, scale: 3 }).default('0').notNull(), // Outstanding gold in grams (we owe supplier)
    totalGoldReceived: decimal('total_gold_received', { precision: 10, scale: 3 }).default('0').notNull(), // Lifetime gold received from supplier
    totalGoldReturned: decimal('total_gold_returned', { precision: 10, scale: 3 }).default('0').notNull(), // Lifetime gold returned to supplier
    // Gold-to-Gold Exchange Ledger - separate tracking for gold exchanges
    goldExchangeBalanceGrams: decimal('gold_exchange_balance_grams', { precision: 10, scale: 3 }).default('0').notNull(), // Outstanding gold in exchanges (they owe us)
    totalGoldGivenInExchange: decimal('total_gold_given_in_exchange', { precision: 10, scale: 3 }).default('0').notNull(), // Lifetime gold given to supplier in exchanges
    totalGoldReceivedInExchange: decimal('total_gold_received_in_exchange', { precision: 10, scale: 3 }).default('0').notNull(), // Lifetime gold received in exchanges
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    supplierCodeIdx: unique().on(table.storeId, table.supplierCode),
    phoneIdx: index('suppliers_phone_idx').on(table.phone),
    emailIdx: index('suppliers_email_idx').on(table.email),
    storeIdx: index('suppliers_store_idx').on(table.storeId),
    supplierTypeIdx: index('suppliers_type_idx').on(table.supplierType),
  })
);

// Supplier Contacts (Multiple contact persons per supplier)
export const supplierContacts = pgTable(
  'supplier_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    designation: varchar('designation', { length: 100 }), // e.g., 'Sales Manager', 'Accountant'
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 255 }),
    isPrimary: boolean('is_primary').default(false).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    supplierIdx: index('supplier_contacts_supplier_idx').on(table.supplierId),
  })
);

// Purchase Payments (for tracking payments to suppliers)
export const purchasePayments = pgTable(
  'purchase_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => inventoryBatches.id, { onDelete: 'cascade' }),
    paymentDate: timestamp('payment_date').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // 'cash', 'cheque', 'bank_transfer', 'upi', 'card', 'adjustment'
    paymentType: varchar('payment_type', { length: 50 }).notNull(), // 'initial', 'partial', 'full_settlement', 'advance'
    transactionReference: varchar('transaction_reference', { length: 255 }),
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    batchIdx: index('purchase_payments_batch_idx').on(table.batchId),
    dateIdx: index('purchase_payments_date_idx').on(table.paymentDate),
  })
);

// Supplier Account Transactions - Dual ledger for supplier accounts (Monetary + Gold)
export const supplierAccountTransactions = pgTable(
  'supplier_account_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    transactionType: varchar('transaction_type', { length: 50 }).notNull(), // 'purchase', 'payment', 'adjustment', 'reversal', 'gold_received', 'gold_returned'
    referenceType: varchar('reference_type', { length: 50 }).notNull(), // 'batch', 'payment', 'manual', 'gold_exchange'
    referenceId: uuid('reference_id'),
    ledgerType: varchar('ledger_type', { length: 20 }).notNull().default('monetary'), // 'monetary' or 'gold'
    // Monetary ledger fields
    debit: decimal('debit', { precision: 12, scale: 2 }).default('0').notNull(), // Increases balance (purchases)
    credit: decimal('credit', { precision: 12, scale: 2 }).default('0').notNull(), // Decreases balance (payments)
    balance: decimal('balance', { precision: 12, scale: 2 }).notNull(), // Running monetary balance after transaction
    // Gold ledger fields
    goldDebit: decimal('gold_debit', { precision: 10, scale: 3 }).default('0').notNull(), // Gold received from supplier (increases our gold balance)
    goldCredit: decimal('gold_credit', { precision: 10, scale: 3 }).default('0').notNull(), // Gold returned to supplier (decreases our gold balance)
    goldBalance: decimal('gold_balance', { precision: 10, scale: 3 }).notNull(), // Running gold balance in grams
    // Fine Gold Tracking (Metal Accounting)
    purityPercentage: decimal('purity_percentage', { precision: 5, scale: 2 }), // Purity of gold (e.g., 91.67 for 22K)
    fineGoldEquivalent: decimal('fine_gold_equivalent', { precision: 10, scale: 4 }), // Converted to 24K equivalent
    // Payment details (for monetary transactions)
    paymentMethod: varchar('payment_method', { length: 50 }), // 'cash', 'cheque', 'bank_transfer', 'upi', 'card'
    paymentReference: varchar('payment_reference', { length: 255 }), // Cheque number, UPI ref, etc.
    // Common fields
    description: text('description').notNull(),
    transactionDate: timestamp('transaction_date').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    supplierIdx: index('supplier_account_transactions_supplier_idx').on(table.supplierId),
    storeIdx: index('supplier_account_transactions_store_idx').on(table.storeId),
    dateIdx: index('supplier_account_transactions_date_idx').on(table.transactionDate),
    typeIdx: index('supplier_account_transactions_type_idx').on(table.transactionType),
    ledgerTypeIdx: index('supplier_account_transactions_ledger_type_idx').on(table.ledgerType),
    referenceIdx: index('supplier_account_transactions_reference_idx').on(table.referenceType, table.referenceId),
  })
);

// Relations for Supplier Management
export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  store: one(stores, {
    fields: [suppliers.storeId],
    references: [stores.id],
  }),
  inventoryBatches: many(inventoryBatches),
  accountTransactions: many(supplierAccountTransactions),
  contacts: many(supplierContacts),
}));

export const supplierContactsRelations = relations(supplierContacts, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierContacts.supplierId],
    references: [suppliers.id],
  }),
}));

export const purchasePaymentsRelations = relations(purchasePayments, ({ one }) => ({
  batch: one(inventoryBatches, {
    fields: [purchasePayments.batchId],
    references: [inventoryBatches.id],
  }),
  createdByUser: one(users, {
    fields: [purchasePayments.createdBy],
    references: [users.id],
  }),
}));

export const supplierAccountTransactionsRelations = relations(supplierAccountTransactions, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierAccountTransactions.supplierId],
    references: [suppliers.id],
  }),
  store: one(stores, {
    fields: [supplierAccountTransactions.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [supplierAccountTransactions.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// CUSTOMER CRM EXTENSION RELATIONS
// ============================================================================

export const customerWishlistsRelations = relations(customerWishlists, ({ one }) => ({
  customer: one(customers, {
    fields: [customerWishlists.customerId],
    references: [customers.id],
  }),
  store: one(stores, {
    fields: [customerWishlists.storeId],
    references: [stores.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [customerWishlists.inventoryItemId],
    references: [inventoryItems.id],
  }),
  category: one(inventoryCategories, {
    fields: [customerWishlists.categoryId],
    references: [inventoryCategories.id],
  }),
  createdByUser: one(users, {
    fields: [customerWishlists.createdBy],
    references: [users.id],
  }),
}));

export const customerBuyingHabitsRelations = relations(customerBuyingHabits, ({ one }) => ({
  customer: one(customers, {
    fields: [customerBuyingHabits.customerId],
    references: [customers.id],
  }),
  store: one(stores, {
    fields: [customerBuyingHabits.storeId],
    references: [stores.id],
  }),
}));

export const customerReferralsRelations = relations(customerReferrals, ({ one }) => ({
  store: one(stores, {
    fields: [customerReferrals.storeId],
    references: [stores.id],
  }),
  referrer: one(customers, {
    fields: [customerReferrals.referrerId],
    references: [customers.id],
    relationName: 'referrer',
  }),
  referred: one(customers, {
    fields: [customerReferrals.referredId],
    references: [customers.id],
    relationName: 'referred',
  }),
  recordedByUser: one(users, {
    fields: [customerReferrals.recordedBy],
    references: [users.id],
  }),
}));

export const loyaltyRewardsCatalogRelations = relations(loyaltyRewardsCatalog, ({ one, many }) => ({
  store: one(stores, {
    fields: [loyaltyRewardsCatalog.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [loyaltyRewardsCatalog.createdBy],
    references: [users.id],
  }),
  redemptions: many(loyaltyRewardRedemptions),
}));

export const loyaltyRewardRedemptionsRelations = relations(loyaltyRewardRedemptions, ({ one }) => ({
  store: one(stores, {
    fields: [loyaltyRewardRedemptions.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [loyaltyRewardRedemptions.customerId],
    references: [customers.id],
  }),
  reward: one(loyaltyRewardsCatalog, {
    fields: [loyaltyRewardRedemptions.rewardId],
    references: [loyaltyRewardsCatalog.id],
  }),
  redeemedByUser: one(users, {
    fields: [loyaltyRewardRedemptions.redeemedBy],
    references: [users.id],
  }),
  usedByUser: one(users, {
    fields: [loyaltyRewardRedemptions.usedBy],
    references: [users.id],
  }),
}));

export const whatsappLeadsRelations = relations(whatsappLeads, ({ one, many }) => ({
  store: one(stores, {
    fields: [whatsappLeads.storeId],
    references: [stores.id],
  }),
  convertedCustomer: one(customers, {
    fields: [whatsappLeads.convertedToCustomerId],
    references: [customers.id],
  }),
  assignedToUser: one(users, {
    fields: [whatsappLeads.assignedTo],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [whatsappLeads.createdBy],
    references: [users.id],
  }),
  messages: many(whatsappMessages),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  store: one(stores, {
    fields: [whatsappMessages.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [whatsappMessages.customerId],
    references: [customers.id],
  }),
  lead: one(whatsappLeads, {
    fields: [whatsappMessages.leadId],
    references: [whatsappLeads.id],
  }),
  sentByUser: one(users, {
    fields: [whatsappMessages.sentBy],
    references: [users.id],
  }),
}));

// ============================================================================
// DAILY SUMMARY AND REPORTING SCHEMA
// ============================================================================

// Daily Summaries - Aggregated daily statistics
export const dailySummaries = pgTable(
  'daily_summaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    summaryDate: timestamp('summary_date').notNull(), // Date for which summary is generated

    // Sales metrics
    totalSales: decimal('total_sales', { precision: 12, scale: 2 }).default('0').notNull(),
    totalInvoices: integer('total_invoices').default(0).notNull(),
    totalCustomers: integer('total_customers').default(0).notNull(),
    averageInvoiceValue: decimal('average_invoice_value', { precision: 12, scale: 2 }).default('0'),

    // Inventory metrics
    itemsAdded: integer('items_added').default(0).notNull(),
    itemsSold: integer('items_sold').default(0).notNull(),
    batchesCreated: integer('batches_created').default(0).notNull(),
    batchesCompleted: integer('batches_completed').default(0).notNull(),
    totalGrossWeightAdded: decimal('total_gross_weight_added', { precision: 12, scale: 3 }).default('0'),
    totalGrossWeightSold: decimal('total_gross_weight_sold', { precision: 12, scale: 3 }).default('0'),

    // Financial metrics
    totalPaymentsReceived: decimal('total_payments_received', { precision: 12, scale: 2 }).default('0').notNull(),
    totalPaymentsMade: decimal('total_payments_made', { precision: 12, scale: 2 }).default('0').notNull(),
    outstandingReceivables: decimal('outstanding_receivables', { precision: 12, scale: 2 }).default('0'),
    outstandingPayables: decimal('outstanding_payables', { precision: 12, scale: 2 }).default('0'),

    // Activity metrics
    totalActivities: integer('total_activities').default(0).notNull(),
    activeUsers: integer('active_users').default(0).notNull(),

    // Additional data (JSONB for flexibility)
    topSellingCategories: jsonb('top_selling_categories'), // Array of {categoryName, count, totalValue}
    topCustomers: jsonb('top_customers'), // Array of {customerId, name, totalPurchase}
    inventoryChanges: jsonb('inventory_changes'), // Summary of major inventory changes

    generatedAt: timestamp('generated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('daily_summaries_store_idx').on(table.storeId),
    dateIdx: unique().on(table.storeId, table.summaryDate),
    generatedAtIdx: index('daily_summaries_generated_at_idx').on(table.generatedAt),
  })
);

// Email Notifications - Track sent emails
export const emailNotifications = pgTable(
  'email_notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    notificationType: varchar('notification_type', { length: 50 }).notNull(), // 'daily_briefing', 'weekly_report', 'alert', etc.
    subject: varchar('subject', { length: 500 }).notNull(),
    recipients: jsonb('recipients').notNull(), // Array of email addresses
    templateData: jsonb('template_data'), // Data used to generate the email
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'sent', 'failed'
    sentAt: timestamp('sent_at'),
    errorMessage: text('error_message'),
    scheduledFor: timestamp('scheduled_for'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('email_notifications_store_idx').on(table.storeId),
    statusIdx: index('email_notifications_status_idx').on(table.status),
    scheduledIdx: index('email_notifications_scheduled_idx').on(table.scheduledFor),
    typeIdx: index('email_notifications_type_idx').on(table.notificationType),
  })
);

// Activity Summary - Detailed activity logs with categorization
export const activitySummaries = pgTable(
  'activity_summaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    activityDate: timestamp('activity_date').notNull(),
    category: varchar('category', { length: 50 }).notNull(), // 'sales', 'inventory', 'customer', 'finance', 'system'
    activityType: varchar('activity_type', { length: 100 }).notNull(), // 'item_added', 'sale_completed', 'payment_received', etc.
    description: text('description').notNull(),
    entityType: varchar('entity_type', { length: 100 }),
    entityId: uuid('entity_id'),
    quantityChange: integer('quantity_change'), // For inventory changes
    amountChange: decimal('amount_change', { precision: 12, scale: 2 }), // For financial changes
    metadata: jsonb('metadata'), // Additional flexible data
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('activity_summaries_store_idx').on(table.storeId),
    userIdx: index('activity_summaries_user_idx').on(table.userId),
    dateIdx: index('activity_summaries_date_idx').on(table.activityDate),
    categoryIdx: index('activity_summaries_category_idx').on(table.category),
    typeIdx: index('activity_summaries_type_idx').on(table.activityType),
  })
);

// Relations for reporting tables
export const dailySummariesRelations = relations(dailySummaries, ({ one }) => ({
  store: one(stores, {
    fields: [dailySummaries.storeId],
    references: [stores.id],
  }),
}));

export const emailNotificationsRelations = relations(emailNotifications, ({ one }) => ({
  store: one(stores, {
    fields: [emailNotifications.storeId],
    references: [stores.id],
  }),
}));

export const activitySummariesRelations = relations(activitySummaries, ({ one }) => ({
  store: one(stores, {
    fields: [activitySummaries.storeId],
    references: [stores.id],
  }),
  user: one(users, {
    fields: [activitySummaries.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// LABEL DESIGNER SCHEMA
// ============================================================================

// Label Templates - Customizable label templates for printing
export const labelTemplates = pgTable(
  'label_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Page configuration
    pageSize: varchar('page_size', { length: 50 }).default('A4'), // 'A4', 'letter', 'custom'
    pageWidth: decimal('page_width', { precision: 5, scale: 2 }), // in mm (for custom size), allowing decimals
    pageHeight: decimal('page_height', { precision: 5, scale: 2 }), // in mm (for custom size), allowing decimals
    pageOrientation: varchar('page_orientation', { length: 20 }).default('portrait'), // 'portrait' or 'landscape'

    // Label configuration
    labelWidth: decimal('label_width', { precision: 5, scale: 2 }).notNull(), // in mm, allowing decimals
    labelHeight: decimal('label_height', { precision: 5, scale: 2 }).notNull(), // in mm, allowing decimals
    labelsPerRow: integer('labels_per_row').default(2).notNull(),
    labelsPerColumn: integer('labels_per_column').default(4).notNull(),

    // Margins and spacing
    marginTop: decimal('margin_top', { precision: 5, scale: 2 }).default('10').notNull(), // in mm
    marginBottom: decimal('margin_bottom', { precision: 5, scale: 2 }).default('10').notNull(),
    marginLeft: decimal('margin_left', { precision: 5, scale: 2 }).default('10').notNull(),
    marginRight: decimal('margin_right', { precision: 5, scale: 2 }).default('10').notNull(),
    horizontalSpacing: decimal('horizontal_spacing', { precision: 5, scale: 2 }).default('5').notNull(), // Gap between columns
    verticalSpacing: decimal('vertical_spacing', { precision: 5, scale: 2 }).default('5').notNull(), // Gap between rows

    // Label content configuration (JSONB for flexibility)
    fields: jsonb('fields').notNull(), // Array of field configurations: [{type, position, style, content}, ...]
    // Example field: {
    //   type: 'text|barcode|image|qr|line|rectangle',
    //   field: 'sku|name|grossWeight|...', (for data fields)
    //   label: 'SKU:', (optional label text)
    //   x: 10, y: 5, (position in mm from top-left of label)
    //   width: 80, height: 10, (dimensions in mm)
    //   fontSize: 12,
    //   fontFamily: 'Arial|Courier|...',
    //   fontWeight: 'normal|bold',
    //   textAlign: 'left|center|right',
    //   color: '#000000',
    //   backgroundColor: '#ffffff',
    //   borderWidth: 1,
    //   borderColor: '#000000',
    //   ...
    // }

    // Style configuration
    companyName: varchar('company_name', { length: 255 }).default('MARI Jewellers'),
    showCompanyHeader: boolean('show_company_header').default(true).notNull(),
    headerFontSize: decimal('header_font_size', { precision: 5, scale: 2 }).default('16'),
    showBorder: boolean('show_border').default(true).notNull(),
    borderWidth: decimal('border_width', { precision: 5, scale: 2 }).default('2'),
    borderColor: varchar('border_color', { length: 7 }).default('#000000'), // Hex color
    borderRadius: decimal('border_radius', { precision: 5, scale: 2 }).default('4'), // in pixels
    backgroundColor: varchar('background_color', { length: 7 }).default('#FFFFFF'),

    // Template metadata
    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),

    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('label_templates_store_idx').on(table.storeId),
    defaultIdx: index('label_templates_default_idx').on(table.isDefault, table.storeId),
    activeIdx: index('label_templates_active_idx').on(table.isActive),
  })
);

// Relations for label templates
export const labelTemplatesRelations = relations(labelTemplates, ({ one }) => ({
  store: one(stores, {
    fields: [labelTemplates.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [labelTemplates.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [labelTemplates.updatedBy],
    references: [users.id],
  }),
}));

// ==========================================
// REPAIRS & EXCHANGE MODULE
// ==========================================

// Repairs - Main repair orders table
export const repairs = pgTable(
  'repairs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),

    // Repair identification
    repairNumber: varchar('repair_number', { length: 50 }).notNull().unique(), // REP-YYYYMMDD-NNN

    // Repair type and status
    repairType: varchar('repair_type', { length: 50 }).notNull(), // 'repair', 'resize', 'repolish', 'cleaning', 'stone_replacement', 'chain_repair', 'clasp_repair', 'engraving', 'other'
    status: varchar('status', { length: 30 }).default('received').notNull(), // 'received', 'assessment', 'quoted', 'approved', 'in_progress', 'quality_check', 'ready', 'delivered', 'cancelled'
    priority: varchar('priority', { length: 20 }).default('normal'), // 'low', 'normal', 'high', 'urgent'

    // Customer item details (brought in for repair)
    itemDescription: text('item_description').notNull(),
    metalType: varchar('metal_type', { length: 50 }), // 'gold', 'silver', 'platinum'
    purity: varchar('purity', { length: 20 }), // '22K', '18K', etc.
    estimatedWeight: decimal('estimated_weight', { precision: 10, scale: 3 }), // grams

    // Problem description
    problemDescription: text('problem_description').notNull(),
    customerInstructions: text('customer_instructions'),

    // Assessment and quotation
    assessmentNotes: text('assessment_notes'),
    assessmentDate: timestamp('assessment_date'),
    assessedBy: uuid('assessed_by').references(() => users.id),

    // Pricing
    estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }),
    laborCharges: decimal('labor_charges', { precision: 12, scale: 2 }),
    materialCost: decimal('material_cost', { precision: 12, scale: 2 }),
    additionalCharges: decimal('additional_charges', { precision: 12, scale: 2 }),
    discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'),
    finalCost: decimal('final_cost', { precision: 12, scale: 2 }),

    // Customer approval
    quotationApproved: boolean('quotation_approved').default(false),
    approvedAt: timestamp('approved_at'),
    approvalMethod: varchar('approval_method', { length: 30 }), // 'in_person', 'phone', 'whatsapp', 'email'

    // Payment tracking
    advanceAmount: decimal('advance_amount', { precision: 12, scale: 2 }).default('0'),
    advancePaidAt: timestamp('advance_paid_at'),
    paymentStatus: varchar('payment_status', { length: 20 }).default('pending'), // 'pending', 'partial', 'paid'
    balanceAmount: decimal('balance_amount', { precision: 12, scale: 2 }),

    // Timeline
    expectedCompletionDate: timestamp('expected_completion_date'),
    actualCompletionDate: timestamp('actual_completion_date'),
    deliveredAt: timestamp('delivered_at'),

    // Photos/Documentation
    intakePhotos: jsonb('intake_photos'), // Array of photo URLs
    completionPhotos: jsonb('completion_photos'), // Array of photo URLs

    // Staff tracking
    receivedBy: uuid('received_by')
      .notNull()
      .references(() => users.id),
    assignedTo: uuid('assigned_to').references(() => users.id), // Craftsman/technician
    deliveredBy: uuid('delivered_by').references(() => users.id),

    // Warranty
    warrantyDays: integer('warranty_days').default(30),
    warrantyExpiresAt: timestamp('warranty_expires_at'),

    notes: text('notes'),
    internalNotes: text('internal_notes'), // Staff-only notes

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('repairs_store_idx').on(table.storeId),
    customerIdx: index('repairs_customer_idx').on(table.customerId),
    repairNumberIdx: index('repairs_number_idx').on(table.repairNumber),
    statusIdx: index('repairs_status_idx').on(table.status),
    typeIdx: index('repairs_type_idx').on(table.repairType),
    assignedIdx: index('repairs_assigned_idx').on(table.assignedTo),
    expectedDateIdx: index('repairs_expected_date_idx').on(table.expectedCompletionDate),
  })
);

// Repair Items - Individual items within a repair order (if multiple items)
export const repairItems = pgTable(
  'repair_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    repairId: uuid('repair_id')
      .notNull()
      .references(() => repairs.id, { onDelete: 'cascade' }),

    // Item details
    itemName: varchar('item_name', { length: 255 }).notNull(),
    itemType: varchar('item_type', { length: 100 }), // 'ring', 'necklace', 'bangle', etc.
    metalType: varchar('metal_type', { length: 50 }),
    purity: varchar('purity', { length: 20 }),
    weight: decimal('weight', { precision: 10, scale: 3 }),

    // Problem and repair details
    issueDescription: text('issue_description'),
    repairAction: text('repair_action'), // What was done

    // Linked inventory item (if it's from store inventory)
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id),

    // Photos
    beforePhotos: jsonb('before_photos'),
    afterPhotos: jsonb('after_photos'),

    // Cost breakdown
    laborCost: decimal('labor_cost', { precision: 12, scale: 2 }),
    materialCost: decimal('material_cost', { precision: 12, scale: 2 }),

    status: varchar('status', { length: 30 }).default('pending'), // 'pending', 'in_progress', 'completed'
    completedAt: timestamp('completed_at'),

    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    repairIdx: index('repair_items_repair_idx').on(table.repairId),
    statusIdx: index('repair_items_status_idx').on(table.status),
  })
);

// Repair Stages - Track repair progress through stages
export const repairStages = pgTable(
  'repair_stages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    repairId: uuid('repair_id')
      .notNull()
      .references(() => repairs.id, { onDelete: 'cascade' }),

    stageName: varchar('stage_name', { length: 50 }).notNull(), // 'received', 'assessment', 'quoted', 'approved', 'in_progress', 'quality_check', 'ready', 'delivered'
    stageOrder: integer('stage_order').notNull(),

    status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'current', 'completed', 'skipped'

    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),

    processedBy: uuid('processed_by').references(() => users.id),
    notes: text('notes'),

    // Notifications sent
    customerNotified: boolean('customer_notified').default(false),
    notifiedAt: timestamp('notified_at'),
    notificationMethod: varchar('notification_method', { length: 30 }), // 'sms', 'whatsapp', 'email', 'call'

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    repairIdx: index('repair_stages_repair_idx').on(table.repairId),
    stageIdx: index('repair_stages_stage_idx').on(table.stageName),
    statusIdx: index('repair_stages_status_idx').on(table.status),
  })
);

// Exchange Valuations - For gold/jewelry exchange
export const exchangeValuations = pgTable(
  'exchange_valuations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),

    // Valuation identification
    valuationNumber: varchar('valuation_number', { length: 50 }).notNull().unique(), // EXV-YYYYMMDD-NNN

    status: varchar('status', { length: 30 }).default('pending').notNull(), // 'pending', 'assessed', 'offered', 'accepted', 'rejected', 'completed', 'expired'

    // Item details brought for exchange
    itemDescription: text('item_description').notNull(),
    itemType: varchar('item_type', { length: 100 }), // 'ring', 'necklace', 'bangle', 'chain', 'coin', 'bar'
    metalType: varchar('metal_type', { length: 50 }).notNull(), // 'gold', 'silver', 'platinum'
    claimedPurity: varchar('claimed_purity', { length: 20 }), // What customer claims
    testedPurity: varchar('tested_purity', { length: 20 }), // Actual tested purity

    // Weight details
    grossWeight: decimal('gross_weight', { precision: 10, scale: 3 }).notNull(), // Total weight
    stoneWeight: decimal('stone_weight', { precision: 10, scale: 3 }).default('0'), // Weight of stones
    netWeight: decimal('net_weight', { precision: 10, scale: 3 }), // Pure metal weight after testing

    // Testing
    testingMethod: varchar('testing_method', { length: 50 }), // 'acid_test', 'xrf', 'specific_gravity', 'hallmark_verified'
    testingNotes: text('testing_notes'),
    testedBy: uuid('tested_by').references(() => users.id),
    testedAt: timestamp('tested_at'),

    // Valuation calculation
    marketRate: decimal('market_rate', { precision: 12, scale: 2 }), // Current market rate per gram
    exchangeRate: decimal('exchange_rate', { precision: 12, scale: 2 }), // Rate offered for exchange (usually less than market)
    deductionPercentage: decimal('deduction_percentage', { precision: 5, scale: 2 }), // Percentage deducted from market rate
    stoneValue: decimal('stone_value', { precision: 12, scale: 2 }).default('0'), // Value of any stones

    // Final valuation
    grossValue: decimal('gross_value', { precision: 12, scale: 2 }), // Before deductions
    deductions: decimal('deductions', { precision: 12, scale: 2 }).default('0'), // Making charges recovery, etc.
    finalValue: decimal('final_value', { precision: 12, scale: 2 }), // Amount offered to customer

    // Customer decision
    offerValidUntil: timestamp('offer_valid_until'),
    customerDecision: varchar('customer_decision', { length: 20 }), // 'accepted', 'rejected', 'pending'
    decisionAt: timestamp('decision_at'),
    rejectionReason: text('rejection_reason'),

    // If accepted - linked to purchase/invoice
    linkedInvoiceId: uuid('linked_invoice_id').references(() => invoices.id),
    appliedToInvoice: boolean('applied_to_invoice').default(false),

    // Payment if cash exchange (not purchase offset)
    paymentMethod: varchar('payment_method', { length: 30 }), // 'cash', 'bank_transfer', 'cheque', 'applied_to_purchase'
    paymentReference: varchar('payment_reference', { length: 100 }),
    paidAt: timestamp('paid_at'),

    // Photos
    itemPhotos: jsonb('item_photos'),
    testingPhotos: jsonb('testing_photos'),

    // Staff tracking
    receivedBy: uuid('received_by')
      .notNull()
      .references(() => users.id),
    valuedBy: uuid('valued_by').references(() => users.id),
    approvedBy: uuid('approved_by').references(() => users.id), // Manager approval for large values

    notes: text('notes'),
    internalNotes: text('internal_notes'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('exchange_valuations_store_idx').on(table.storeId),
    customerIdx: index('exchange_valuations_customer_idx').on(table.customerId),
    valuationNumberIdx: index('exchange_valuations_number_idx').on(table.valuationNumber),
    statusIdx: index('exchange_valuations_status_idx').on(table.status),
    metalTypeIdx: index('exchange_valuations_metal_idx').on(table.metalType),
  })
);

// Relations for Repairs
export const repairsRelations = relations(repairs, ({ one, many }) => ({
  store: one(stores, {
    fields: [repairs.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [repairs.customerId],
    references: [customers.id],
  }),
  assessedByUser: one(users, {
    fields: [repairs.assessedBy],
    references: [users.id],
    relationName: 'repairAssessor',
  }),
  receivedByUser: one(users, {
    fields: [repairs.receivedBy],
    references: [users.id],
    relationName: 'repairReceiver',
  }),
  assignedToUser: one(users, {
    fields: [repairs.assignedTo],
    references: [users.id],
    relationName: 'repairAssignee',
  }),
  deliveredByUser: one(users, {
    fields: [repairs.deliveredBy],
    references: [users.id],
    relationName: 'repairDeliverer',
  }),
  items: many(repairItems),
  stages: many(repairStages),
}));

export const repairItemsRelations = relations(repairItems, ({ one }) => ({
  repair: one(repairs, {
    fields: [repairItems.repairId],
    references: [repairs.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [repairItems.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

export const repairStagesRelations = relations(repairStages, ({ one }) => ({
  repair: one(repairs, {
    fields: [repairStages.repairId],
    references: [repairs.id],
  }),
  processedByUser: one(users, {
    fields: [repairStages.processedBy],
    references: [users.id],
  }),
}));

export const exchangeValuationsRelations = relations(exchangeValuations, ({ one }) => ({
  store: one(stores, {
    fields: [exchangeValuations.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [exchangeValuations.customerId],
    references: [customers.id],
  }),
  testedByUser: one(users, {
    fields: [exchangeValuations.testedBy],
    references: [users.id],
    relationName: 'exchangeTester',
  }),
  receivedByUser: one(users, {
    fields: [exchangeValuations.receivedBy],
    references: [users.id],
    relationName: 'exchangeReceiver',
  }),
  valuedByUser: one(users, {
    fields: [exchangeValuations.valuedBy],
    references: [users.id],
    relationName: 'exchangeValuer',
  }),
  approvedByUser: one(users, {
    fields: [exchangeValuations.approvedBy],
    references: [users.id],
    relationName: 'exchangeApprover',
  }),
  linkedInvoice: one(invoices, {
    fields: [exchangeValuations.linkedInvoiceId],
    references: [invoices.id],
  }),
}));

// ============================================================================
// CUSTOM ORDERS MODULE
// ============================================================================

// Custom Orders - Custom jewelry design orders
export const customOrders = pgTable(
  'custom_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),

    // Order identification
    orderNumber: varchar('order_number', { length: 50 }).notNull().unique(), // CO-YYYYMMDD-NNN

    // Order type and status
    orderType: varchar('order_type', { length: 50 }).notNull(), // 'ring', 'necklace', 'earrings', 'bangle', 'pendant', 'bracelet', 'chain', 'set', 'other'
    status: varchar('status', { length: 30 }).default('consultation').notNull(), // 'consultation', 'design', 'quoted', 'approved', 'production', 'quality_check', 'ready', 'delivered', 'cancelled'
    priority: varchar('priority', { length: 20 }).default('normal'), // 'low', 'normal', 'high', 'urgent'

    // Design details
    designTitle: varchar('design_title', { length: 255 }).notNull(),
    designDescription: text('design_description'),
    customerRequirements: text('customer_requirements'), // Original customer brief
    referenceImages: jsonb('reference_images'), // Array of URLs customer provided as inspiration

    // Specifications
    metalType: varchar('metal_type', { length: 50 }), // 'gold', 'silver', 'platinum'
    purity: varchar('purity', { length: 20 }), // '22K', '18K', etc.
    estimatedWeight: decimal('estimated_weight', { precision: 10, scale: 3 }), // grams
    actualWeight: decimal('actual_weight', { precision: 10, scale: 3 }),
    ringSize: varchar('ring_size', { length: 20 }),
    bangleSize: varchar('bangle_size', { length: 20 }),
    chainLength: varchar('chain_length', { length: 20 }),
    dimensions: jsonb('dimensions'), // Custom dimensions object

    // Stones/Gems
    hasStones: boolean('has_stones').default(false),
    stoneDetails: jsonb('stone_details'), // Array of stone specs: type, count, size, quality, source

    // Pricing
    goldRateAtQuote: decimal('gold_rate_at_quote', { precision: 12, scale: 2 }), // Gold rate when quote was made
    estimatedGoldCost: decimal('estimated_gold_cost', { precision: 12, scale: 2 }),
    estimatedStoneCost: decimal('estimated_stone_cost', { precision: 12, scale: 2 }),
    makingCharges: decimal('making_charges', { precision: 12, scale: 2 }),
    designCharges: decimal('design_charges', { precision: 12, scale: 2 }),
    wastagePercentage: decimal('wastage_percentage', { precision: 5, scale: 2 }),
    wastageAmount: decimal('wastage_amount', { precision: 12, scale: 2 }),
    additionalCharges: decimal('additional_charges', { precision: 12, scale: 2 }),
    discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'),
    estimatedTotal: decimal('estimated_total', { precision: 12, scale: 2 }),
    finalTotal: decimal('final_total', { precision: 12, scale: 2 }),

    // Design quotation
    quotedAt: timestamp('quoted_at'),
    quotedBy: uuid('quoted_by').references(() => users.id),
    quoteValidUntil: timestamp('quote_valid_until'),
    revisionCount: integer('revision_count').default(0), // Number of design revisions

    // Customer approval
    designApproved: boolean('design_approved').default(false),
    approvedAt: timestamp('approved_at'),
    approvalMethod: varchar('approval_method', { length: 30 }), // 'in_person', 'phone', 'whatsapp', 'email'
    signedDocumentUrl: varchar('signed_document_url', { length: 500 }), // Signed approval document

    // Payment tracking
    advanceAmount: decimal('advance_amount', { precision: 12, scale: 2 }).default('0'),
    advancePercentage: decimal('advance_percentage', { precision: 5, scale: 2 }).default('50'), // Typically 50%
    advancePaidAt: timestamp('advance_paid_at'),
    paymentStatus: varchar('payment_status', { length: 20 }).default('pending'), // 'pending', 'advance_paid', 'partial', 'paid'
    balanceAmount: decimal('balance_amount', { precision: 12, scale: 2 }),

    // Production
    productionStartedAt: timestamp('production_started_at'),
    expectedCompletionDate: timestamp('expected_completion_date'),
    actualCompletionDate: timestamp('actual_completion_date'),
    craftsman: varchar('craftsman', { length: 255 }), // Name of craftsman/workshop
    workshopNotes: text('workshop_notes'),

    // Quality check
    qualityCheckDate: timestamp('quality_check_date'),
    qualityCheckPassed: boolean('quality_check_passed'),
    qualityCheckNotes: text('quality_check_notes'),

    // Delivery
    readyForPickupAt: timestamp('ready_for_pickup_at'),
    deliveredAt: timestamp('delivered_at'),
    deliveryMethod: varchar('delivery_method', { length: 30 }), // 'pickup', 'delivery'
    deliveryAddress: text('delivery_address'),

    // Photos/Documentation at each stage
    designSketchUrls: jsonb('design_sketch_urls'), // Designer sketches
    cadModelUrls: jsonb('cad_model_urls'), // 3D CAD models if available
    productionPhotos: jsonb('production_photos'), // Work in progress photos
    completionPhotos: jsonb('completion_photos'), // Final product photos
    packagingPhotos: jsonb('packaging_photos'), // Packaged product

    // Staff tracking
    consultedBy: uuid('consulted_by')
      .notNull()
      .references(() => users.id),
    designedBy: uuid('designed_by').references(() => users.id),
    assignedTo: uuid('assigned_to').references(() => users.id), // Production manager
    deliveredBy: uuid('delivered_by').references(() => users.id),

    // Hallmarking
    isHallmarked: boolean('is_hallmarked').default(false),
    hallmarkNumber: varchar('hallmark_number', { length: 100 }),
    huidNumber: varchar('huid_number', { length: 100 }),

    // Warranty
    warrantyMonths: integer('warranty_months').default(6),
    warrantyExpiresAt: timestamp('warranty_expires_at'),

    // If item is added to inventory after completion
    inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id),

    // Linked to invoice when delivered
    invoiceId: uuid('invoice_id').references(() => invoices.id),

    notes: text('notes'),
    internalNotes: text('internal_notes'), // Staff-only notes

    cancellationReason: text('cancellation_reason'),
    cancelledAt: timestamp('cancelled_at'),
    cancelledBy: uuid('cancelled_by').references(() => users.id),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('custom_orders_store_idx').on(table.storeId),
    customerIdx: index('custom_orders_customer_idx').on(table.customerId),
    orderNumberIdx: index('custom_orders_number_idx').on(table.orderNumber),
    statusIdx: index('custom_orders_status_idx').on(table.status),
    typeIdx: index('custom_orders_type_idx').on(table.orderType),
    assignedIdx: index('custom_orders_assigned_idx').on(table.assignedTo),
    expectedDateIdx: index('custom_orders_expected_date_idx').on(table.expectedCompletionDate),
  })
);

// Custom Order Items - Individual design specifications/components
export const customOrderItems = pgTable(
  'custom_order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customOrderId: uuid('custom_order_id')
      .notNull()
      .references(() => customOrders.id, { onDelete: 'cascade' }),

    // Item details
    itemName: varchar('item_name', { length: 255 }).notNull(),
    itemType: varchar('item_type', { length: 100 }), // 'main_piece', 'earring_pair', 'pendant', 'matching_ring', etc.
    quantity: integer('quantity').default(1).notNull(),

    // Specifications
    metalType: varchar('metal_type', { length: 50 }),
    purity: varchar('purity', { length: 20 }),
    estimatedWeight: decimal('estimated_weight', { precision: 10, scale: 3 }),
    actualWeight: decimal('actual_weight', { precision: 10, scale: 3 }),

    // Stone details for this item
    stoneType: varchar('stone_type', { length: 100 }),
    stoneCount: integer('stone_count'),
    stoneTotalWeight: decimal('stone_total_weight', { precision: 10, scale: 3 }), // carats
    stoneQuality: varchar('stone_quality', { length: 50 }),
    stoneSource: varchar('stone_source', { length: 50 }), // 'customer_provided', 'store_stock', 'to_procure'

    // Dimensions
    size: varchar('size', { length: 50 }), // Ring size, bangle size, etc.
    length: decimal('length', { precision: 10, scale: 2 }), // mm
    width: decimal('width', { precision: 10, scale: 2 }), // mm
    thickness: decimal('thickness', { precision: 10, scale: 2 }), // mm

    // Pricing for this item
    goldCost: decimal('gold_cost', { precision: 12, scale: 2 }),
    stoneCost: decimal('stone_cost', { precision: 12, scale: 2 }),
    makingCharges: decimal('making_charges', { precision: 12, scale: 2 }),
    itemTotal: decimal('item_total', { precision: 12, scale: 2 }),

    // Status
    status: varchar('status', { length: 30 }).default('pending'), // 'pending', 'in_production', 'completed'
    completedAt: timestamp('completed_at'),

    // Photos
    designImages: jsonb('design_images'),
    completionPhotos: jsonb('completion_photos'),

    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index('custom_order_items_order_idx').on(table.customOrderId),
    statusIdx: index('custom_order_items_status_idx').on(table.status),
  })
);

// Custom Order Stages - Track order progress through stages
export const customOrderStages = pgTable(
  'custom_order_stages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customOrderId: uuid('custom_order_id')
      .notNull()
      .references(() => customOrders.id, { onDelete: 'cascade' }),

    stageName: varchar('stage_name', { length: 50 }).notNull(), // 'consultation', 'design', 'quoted', 'approved', 'production', 'quality_check', 'ready', 'delivered'
    stageOrder: integer('stage_order').notNull(),

    status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'current', 'completed', 'skipped'

    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),

    // Staff who processed this stage
    processedBy: uuid('processed_by').references(() => users.id),

    // Customer notification
    customerNotified: boolean('customer_notified').default(false),
    notificationMethod: varchar('notification_method', { length: 30 }), // 'sms', 'whatsapp', 'email', 'phone'
    notifiedAt: timestamp('notified_at'),

    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index('custom_order_stages_order_idx').on(table.customOrderId),
    stageIdx: index('custom_order_stages_stage_idx').on(table.stageName),
    statusIdx: index('custom_order_stages_status_idx').on(table.status),
  })
);

// Custom Order Design Versions - Track design iterations
export const customOrderDesignVersions = pgTable(
  'custom_order_design_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customOrderId: uuid('custom_order_id')
      .notNull()
      .references(() => customOrders.id, { onDelete: 'cascade' }),

    versionNumber: integer('version_number').notNull(),
    versionName: varchar('version_name', { length: 255 }), // 'Initial Design', 'Revision 1', etc.

    // Design files
    sketchUrls: jsonb('sketch_urls'),
    cadModelUrls: jsonb('cad_model_urls'),
    renderUrls: jsonb('render_urls'), // 3D renders

    // Design details
    designNotes: text('design_notes'),
    changes: text('changes'), // What changed from previous version

    // Pricing for this version
    estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }),
    costBreakdown: jsonb('cost_breakdown'), // Detailed cost breakdown

    // Customer feedback
    customerFeedback: text('customer_feedback'),
    feedbackReceivedAt: timestamp('feedback_received_at'),

    // Status
    status: varchar('status', { length: 20 }).default('draft'), // 'draft', 'presented', 'approved', 'rejected', 'superseded'
    presentedAt: timestamp('presented_at'),
    approvedAt: timestamp('approved_at'),
    rejectedAt: timestamp('rejected_at'),
    rejectionReason: text('rejection_reason'),

    // Designer
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index('custom_order_design_versions_order_idx').on(table.customOrderId),
    versionIdx: index('custom_order_design_versions_version_idx').on(table.versionNumber),
    statusIdx: index('custom_order_design_versions_status_idx').on(table.status),
  })
);

// Relations for Custom Orders
export const customOrdersRelations = relations(customOrders, ({ one, many }) => ({
  store: one(stores, {
    fields: [customOrders.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [customOrders.customerId],
    references: [customers.id],
  }),
  consultedByUser: one(users, {
    fields: [customOrders.consultedBy],
    references: [users.id],
    relationName: 'customOrderConsultant',
  }),
  designedByUser: one(users, {
    fields: [customOrders.designedBy],
    references: [users.id],
    relationName: 'customOrderDesigner',
  }),
  quotedByUser: one(users, {
    fields: [customOrders.quotedBy],
    references: [users.id],
    relationName: 'customOrderQuoter',
  }),
  assignedToUser: one(users, {
    fields: [customOrders.assignedTo],
    references: [users.id],
    relationName: 'customOrderAssignee',
  }),
  deliveredByUser: one(users, {
    fields: [customOrders.deliveredBy],
    references: [users.id],
    relationName: 'customOrderDeliverer',
  }),
  cancelledByUser: one(users, {
    fields: [customOrders.cancelledBy],
    references: [users.id],
    relationName: 'customOrderCanceller',
  }),
  inventoryItem: one(inventoryItems, {
    fields: [customOrders.inventoryItemId],
    references: [inventoryItems.id],
  }),
  invoice: one(invoices, {
    fields: [customOrders.invoiceId],
    references: [invoices.id],
  }),
  items: many(customOrderItems),
  stages: many(customOrderStages),
  designVersions: many(customOrderDesignVersions),
}));

export const customOrderItemsRelations = relations(customOrderItems, ({ one }) => ({
  customOrder: one(customOrders, {
    fields: [customOrderItems.customOrderId],
    references: [customOrders.id],
  }),
}));

export const customOrderStagesRelations = relations(customOrderStages, ({ one }) => ({
  customOrder: one(customOrders, {
    fields: [customOrderStages.customOrderId],
    references: [customOrders.id],
  }),
  processedByUser: one(users, {
    fields: [customOrderStages.processedBy],
    references: [users.id],
  }),
}));

export const customOrderDesignVersionsRelations = relations(customOrderDesignVersions, ({ one }) => ({
  customOrder: one(customOrders, {
    fields: [customOrderDesignVersions.customOrderId],
    references: [customOrders.id],
  }),
  createdByUser: one(users, {
    fields: [customOrderDesignVersions.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// ACCOUNTING MODULE
// ============================================================================

// Account Types for Chart of Accounts
// 'asset', 'liability', 'equity', 'income', 'expense'

// Chart of Accounts - Account heads
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),

    // Account identification
    accountCode: varchar('account_code', { length: 50 }).notNull(), // e.g., '1001', '2001', etc.
    accountName: varchar('account_name', { length: 255 }).notNull(),

    // Account classification
    accountType: varchar('account_type', { length: 50 }).notNull(), // 'asset', 'liability', 'equity', 'income', 'expense'
    accountSubType: varchar('account_sub_type', { length: 50 }), // 'current_asset', 'fixed_asset', 'bank', 'cash', etc.

    // Hierarchy
    parentAccountId: uuid('parent_account_id'),
    level: integer('level').default(1).notNull(), // Depth in hierarchy

    // Account nature
    normalBalance: varchar('normal_balance', { length: 10 }).notNull(), // 'debit' or 'credit'

    // Opening balance
    openingBalance: decimal('opening_balance', { precision: 15, scale: 2 }).default('0'),
    openingBalanceDate: timestamp('opening_balance_date'),

    // Current balance (updated via triggers or service)
    currentBalance: decimal('current_balance', { precision: 15, scale: 2 }).default('0'),

    // GST related
    gstApplicable: boolean('gst_applicable').default(false),
    gstRate: decimal('gst_rate', { precision: 5, scale: 2 }),
    hsnSacCode: varchar('hsn_sac_code', { length: 20 }),

    // System accounts (cannot be deleted)
    isSystemAccount: boolean('is_system_account').default(false),

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('accounts_store_idx').on(table.storeId),
    codeIdx: index('accounts_code_idx').on(table.accountCode),
    typeIdx: index('accounts_type_idx').on(table.accountType),
    storeCodeUnique: unique().on(table.storeId, table.accountCode),
  })
);

// Bank Accounts - Cash and Bank management
export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),

    // Link to chart of accounts
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),

    // Bank details
    bankName: varchar('bank_name', { length: 255 }),
    branchName: varchar('branch_name', { length: 255 }),
    accountNumber: varchar('account_number', { length: 50 }),
    ifscCode: varchar('ifsc_code', { length: 20 }),
    accountHolderName: varchar('account_holder_name', { length: 255 }),

    // Account type
    bankAccountType: varchar('bank_account_type', { length: 30 }).notNull(), // 'cash', 'savings', 'current', 'credit_card', 'upi'

    // Balance tracking
    currentBalance: decimal('current_balance', { precision: 15, scale: 2 }).default('0'),
    lastReconciled: timestamp('last_reconciled'),
    reconciledBalance: decimal('reconciled_balance', { precision: 15, scale: 2 }),

    // Credit limit (for credit cards)
    creditLimit: decimal('credit_limit', { precision: 15, scale: 2 }),

    // Status
    isDefault: boolean('is_default').default(false), // Default account for payments
    isActive: boolean('is_active').default(true).notNull(),

    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('bank_accounts_store_idx').on(table.storeId),
    accountIdx: index('bank_accounts_account_idx').on(table.accountId),
    typeIdx: index('bank_accounts_type_idx').on(table.bankAccountType),
  })
);

// Journal Entries - Transaction headers
export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),

    // Entry identification
    entryNumber: varchar('entry_number', { length: 50 }).notNull(), // JE-YYYYMMDD-NNN
    entryDate: timestamp('entry_date').notNull(),

    // Entry type
    entryType: varchar('entry_type', { length: 50 }).notNull(), // 'sales', 'purchase', 'payment', 'receipt', 'expense', 'transfer', 'adjustment', 'opening'

    // Reference
    referenceType: varchar('reference_type', { length: 50 }), // 'invoice', 'payment', 'expense', 'batch', 'repair', 'custom_order', etc.
    referenceId: uuid('reference_id'),
    referenceNumber: varchar('reference_number', { length: 100 }),

    // Amounts
    totalDebit: decimal('total_debit', { precision: 15, scale: 2 }).notNull(),
    totalCredit: decimal('total_credit', { precision: 15, scale: 2 }).notNull(),

    // Narration/Description
    narration: text('narration'),

    // GST
    gstAmount: decimal('gst_amount', { precision: 12, scale: 2 }),
    cgstAmount: decimal('cgst_amount', { precision: 12, scale: 2 }),
    sgstAmount: decimal('sgst_amount', { precision: 12, scale: 2 }),
    igstAmount: decimal('igst_amount', { precision: 12, scale: 2 }),

    // Status
    status: varchar('status', { length: 20 }).default('posted').notNull(), // 'draft', 'posted', 'reversed'
    ledgerVisibility: varchar('ledger_visibility', { length: 20 }).default('public').notNull(), // 'public' or 'private'
    reversedEntryId: uuid('reversed_entry_id'), // If this is a reversal, link to original

    // Posting
    postedAt: timestamp('posted_at'),
    postedBy: uuid('posted_by').references(() => users.id),

    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('journal_entries_store_idx').on(table.storeId),
    entryNumberIdx: index('journal_entries_number_idx').on(table.entryNumber),
    dateIdx: index('journal_entries_date_idx').on(table.entryDate),
    typeIdx: index('journal_entries_type_idx').on(table.entryType),
    referenceIdx: index('journal_entries_reference_idx').on(table.referenceType, table.referenceId),
    statusIdx: index('journal_entries_status_idx').on(table.status),
  })
);

// Journal Entry Lines - Double-entry line items
export const journalEntryLines = pgTable(
  'journal_entry_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    journalEntryId: uuid('journal_entry_id')
      .notNull()
      .references(() => journalEntries.id, { onDelete: 'cascade' }),

    // Account
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),

    // Debit or Credit
    debitAmount: decimal('debit_amount', { precision: 15, scale: 2 }).default('0'),
    creditAmount: decimal('credit_amount', { precision: 15, scale: 2 }).default('0'),

    // Party (customer/supplier) if applicable
    partyType: varchar('party_type', { length: 30 }), // 'customer', 'supplier'
    partyId: uuid('party_id'),

    // Description for this line
    description: text('description'),

    // Cost center tracking (optional)
    costCenter: varchar('cost_center', { length: 100 }),

    // GST details for this line
    gstRate: decimal('gst_rate', { precision: 5, scale: 2 }),
    gstAmount: decimal('gst_amount', { precision: 12, scale: 2 }),

    lineOrder: integer('line_order').default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    entryIdx: index('journal_entry_lines_entry_idx').on(table.journalEntryId),
    accountIdx: index('journal_entry_lines_account_idx').on(table.accountId),
    partyIdx: index('journal_entry_lines_party_idx').on(table.partyType, table.partyId),
  })
);

// Expenses - Expense tracking
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),

    // Expense identification
    expenseNumber: varchar('expense_number', { length: 50 }).notNull(), // EXP-YYYYMMDD-NNN
    expenseDate: timestamp('expense_date').notNull(),

    // Expense category/account
    expenseAccountId: uuid('expense_account_id')
      .notNull()
      .references(() => accounts.id),

    // Payment details
    paidFromAccountId: uuid('paid_from_account_id').references(() => bankAccounts.id),
    paymentMethod: varchar('payment_method', { length: 30 }).notNull(), // 'cash', 'bank', 'upi', 'card', 'cheque'

    // Amounts
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    gstAmount: decimal('gst_amount', { precision: 12, scale: 2 }),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),

    // Vendor/Payee
    vendorName: varchar('vendor_name', { length: 255 }),
    vendorGstin: varchar('vendor_gstin', { length: 20 }),

    // Invoice reference
    invoiceNumber: varchar('invoice_number', { length: 100 }),
    invoiceDate: timestamp('invoice_date'),

    // Description
    description: text('description').notNull(),
    category: varchar('category', { length: 100 }), // 'rent', 'utilities', 'salaries', 'maintenance', 'supplies', etc.

    // Attachments
    receiptUrls: jsonb('receipt_urls'), // Array of receipt image URLs

    // Journal entry link
    journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id),

    // Approval
    approvalStatus: varchar('approval_status', { length: 20 }).default('approved'), // 'pending', 'approved', 'rejected'
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),

    // Recurring expense
    isRecurring: boolean('is_recurring').default(false),
    recurringFrequency: varchar('recurring_frequency', { length: 20 }), // 'daily', 'weekly', 'monthly', 'yearly'

    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('expenses_store_idx').on(table.storeId),
    expenseNumberIdx: index('expenses_number_idx').on(table.expenseNumber),
    dateIdx: index('expenses_date_idx').on(table.expenseDate),
    categoryIdx: index('expenses_category_idx').on(table.category),
    accountIdx: index('expenses_account_idx').on(table.expenseAccountId),
  })
);

// Cash Register - Daily cash tracking
export const cashRegister = pgTable(
  'cash_register',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),

    // Register date
    registerDate: timestamp('register_date').notNull(),

    // Opening balance
    openingBalance: decimal('opening_balance', { precision: 12, scale: 2 }).notNull(),
    openingTime: timestamp('opening_time').notNull(),
    openedBy: uuid('opened_by')
      .notNull()
      .references(() => users.id),

    // Closing balance
    closingBalance: decimal('closing_balance', { precision: 12, scale: 2 }),
    closingTime: timestamp('closing_time'),
    closedBy: uuid('closed_by').references(() => users.id),

    // Calculated totals
    totalCashSales: decimal('total_cash_sales', { precision: 12, scale: 2 }).default('0'),
    totalCashReceived: decimal('total_cash_received', { precision: 12, scale: 2 }).default('0'),
    totalCashExpenses: decimal('total_cash_expenses', { precision: 12, scale: 2 }).default('0'),
    totalCashPayments: decimal('total_cash_payments', { precision: 12, scale: 2 }).default('0'),

    // Expected vs Actual
    expectedClosingBalance: decimal('expected_closing_balance', { precision: 12, scale: 2 }),
    variance: decimal('variance', { precision: 12, scale: 2 }), // Difference between expected and actual

    // Status
    status: varchar('status', { length: 20 }).default('open').notNull(), // 'open', 'closed', 'verified'

    // Verification
    verifiedBy: uuid('verified_by').references(() => users.id),
    verifiedAt: timestamp('verified_at'),
    varianceExplanation: text('variance_explanation'),

    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('cash_register_store_idx').on(table.storeId),
    dateIdx: index('cash_register_date_idx').on(table.registerDate),
    statusIdx: index('cash_register_status_idx').on(table.status),
    storeDateUnique: unique().on(table.storeId, table.registerDate),
  })
);

// Financial Period - Accounting periods
export const financialPeriods = pgTable(
  'financial_periods',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),

    // Period details
    periodName: varchar('period_name', { length: 100 }).notNull(), // 'FY 2024-25', 'Q1 2024', etc.
    periodType: varchar('period_type', { length: 20 }).notNull(), // 'year', 'quarter', 'month'

    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),

    // Status
    status: varchar('status', { length: 20 }).default('open').notNull(), // 'open', 'closed', 'locked'

    // Closing
    closedAt: timestamp('closed_at'),
    closedBy: uuid('closed_by').references(() => users.id),

    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('financial_periods_store_idx').on(table.storeId),
    dateIdx: index('financial_periods_date_idx').on(table.startDate, table.endDate),
    statusIdx: index('financial_periods_status_idx').on(table.status),
  })
);

// Relations for Accounting
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  store: one(stores, {
    fields: [accounts.storeId],
    references: [stores.id],
  }),
  parentAccount: one(accounts, {
    fields: [accounts.parentAccountId],
    references: [accounts.id],
    relationName: 'accountParent',
  }),
  childAccounts: many(accounts, {
    relationName: 'accountParent',
  }),
  bankAccounts: many(bankAccounts),
  journalEntryLines: many(journalEntryLines),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  store: one(stores, {
    fields: [bankAccounts.storeId],
    references: [stores.id],
  }),
  account: one(accounts, {
    fields: [bankAccounts.accountId],
    references: [accounts.id],
  }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  store: one(stores, {
    fields: [journalEntries.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [journalEntries.createdBy],
    references: [users.id],
    relationName: 'journalEntryCreator',
  }),
  postedByUser: one(users, {
    fields: [journalEntries.postedBy],
    references: [users.id],
    relationName: 'journalEntryPoster',
  }),
  lines: many(journalEntryLines),
}));

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(accounts, {
    fields: [journalEntryLines.accountId],
    references: [accounts.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  store: one(stores, {
    fields: [expenses.storeId],
    references: [stores.id],
  }),
  expenseAccount: one(accounts, {
    fields: [expenses.expenseAccountId],
    references: [accounts.id],
  }),
  paidFromAccount: one(bankAccounts, {
    fields: [expenses.paidFromAccountId],
    references: [bankAccounts.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [expenses.journalEntryId],
    references: [journalEntries.id],
  }),
  createdByUser: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [expenses.approvedBy],
    references: [users.id],
  }),
}));

export const cashRegisterRelations = relations(cashRegister, ({ one }) => ({
  store: one(stores, {
    fields: [cashRegister.storeId],
    references: [stores.id],
  }),
  openedByUser: one(users, {
    fields: [cashRegister.openedBy],
    references: [users.id],
    relationName: 'cashRegisterOpener',
  }),
  closedByUser: one(users, {
    fields: [cashRegister.closedBy],
    references: [users.id],
    relationName: 'cashRegisterCloser',
  }),
  verifiedByUser: one(users, {
    fields: [cashRegister.verifiedBy],
    references: [users.id],
    relationName: 'cashRegisterVerifier',
  }),
}));

export const financialPeriodsRelations = relations(financialPeriods, ({ one }) => ({
  store: one(stores, {
    fields: [financialPeriods.storeId],
    references: [stores.id],
  }),
  closedByUser: one(users, {
    fields: [financialPeriods.closedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// HRM MODULE - Human Resource Management
// ============================================================================

// Employees table - Staff members with employment details
export const employees = pgTable(
  'employees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'set null' }), // Link to auth user
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id), // Primary work location
    employeeCode: varchar('employee_code', { length: 20 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    dateOfBirth: timestamp('date_of_birth'),
    dateOfJoining: timestamp('date_of_joining').notNull(),
    department: varchar('department', { length: 50 }).notNull(), // 'sales', 'accounting', 'management', 'operations'
    position: varchar('position', { length: 100 }).notNull(), // e.g., "Sales Associate", "Store Manager"
    employmentType: varchar('employment_type', { length: 20 }).default('full_time').notNull(), // 'full_time', 'part_time', 'contract', 'probationary'
    payrollFrequency: varchar('payroll_frequency', { length: 20 }).default('monthly').notNull(), // 'monthly', 'weekly'
    salary: decimal('salary', { precision: 12, scale: 2 }).notNull(), // Base monthly salary
    bankAccountNumber: varchar('bank_account_number', { length: 50 }), // Encrypted in practice
    bankName: varchar('bank_name', { length: 100 }),
    ifscCode: varchar('ifsc_code', { length: 15 }), // Bank/Branch Code
    nicNumber: varchar('nic_number', { length: 20 }), // Sri Lankan NIC
    nicPhotoUrl: text('nic_photo_url'),
    emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
    emergencyContactPhone: varchar('emergency_contact_phone', { length: 20 }),
    emergencyContactName2: varchar('emergency_contact_name_2', { length: 255 }),
    emergencyContactPhone2: varchar('emergency_contact_phone_2', { length: 20 }),
    address: text('address'),
    status: varchar('status', { length: 20 }).default('active').notNull(), // 'active', 'on_leave', 'terminated', 'resigned'
    terminationDate: timestamp('termination_date'),
    terminationReason: text('termination_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    employeeCodeStoreIdx: unique().on(table.storeId, table.employeeCode),
    userIdx: index('employees_user_idx').on(table.userId),
    storeIdx: index('employees_store_idx').on(table.storeId),
    departmentIdx: index('employees_department_idx').on(table.department),
    statusIdx: index('employees_status_idx').on(table.status),
    nicIdx: index('employees_nic_idx').on(table.nicNumber),
  })
);

// Attendance table - Daily attendance records
export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id), // Which store they worked at
    date: timestamp('date').notNull(),
    checkIn: timestamp('check_in'),
    checkOut: timestamp('check_out'),
    workHours: decimal('work_hours', { precision: 4, scale: 2 }), // Calculated
    overtimeHours: decimal('overtime_hours', { precision: 4, scale: 2 }).default('0'),
    status: varchar('status', { length: 20 }).default('present').notNull(), // 'present', 'absent', 'half_day', 'late', 'on_leave'
    notes: text('notes'),
    createdBy: uuid('created_by')
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    employeeDateIdx: unique().on(table.employeeId, table.date),
    storeIdx: index('attendance_store_idx').on(table.storeId),
    dateIdx: index('attendance_date_idx').on(table.date),
    statusIdx: index('attendance_status_idx').on(table.status),
  })
);

// Leave Types table - Types of leave available
export const leaveTypes = pgTable(
  'leave_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    name: varchar('name', { length: 100 }).notNull(), // e.g., "Annual Leave", "Sick Leave"
    daysAllowed: integer('days_allowed').notNull(), // Per year
    isPaid: boolean('is_paid').default(true).notNull(),
    carryForward: boolean('carry_forward').default(false).notNull(),
    maxCarryForward: integer('max_carry_forward').default(0),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeNameIdx: unique().on(table.storeId, table.name),
    storeIdx: index('leave_types_store_idx').on(table.storeId),
  })
);

// Leave Requests table - Employee leave applications
export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    leaveTypeId: uuid('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    totalDays: decimal('total_days', { precision: 4, scale: 1 }).notNull(),
    reason: text('reason'),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'approved', 'rejected', 'cancelled'
    approvedBy: uuid('approved_by')
      .references(() => users.id),
    approvedAt: timestamp('approved_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    employeeIdx: index('leave_requests_employee_idx').on(table.employeeId),
    storeIdx: index('leave_requests_store_idx').on(table.storeId),
    statusIdx: index('leave_requests_status_idx').on(table.status),
    dateIdx: index('leave_requests_date_idx').on(table.startDate, table.endDate),
  })
);

// Leave Balances table - Track remaining leave per employee
export const leaveBalances = pgTable(
  'leave_balances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    leaveTypeId: uuid('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id),
    year: integer('year').notNull(),
    allocated: decimal('allocated', { precision: 4, scale: 1 }).notNull(),
    used: decimal('used', { precision: 4, scale: 1 }).default('0').notNull(),
    carriedForward: decimal('carried_forward', { precision: 4, scale: 1 }).default('0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    employeeLeaveYearIdx: unique().on(table.employeeId, table.leaveTypeId, table.year),
    employeeIdx: index('leave_balances_employee_idx').on(table.employeeId),
    yearIdx: index('leave_balances_year_idx').on(table.year),
  })
);

// Payroll table - Monthly payroll records
export const payroll = pgTable(
  'payroll',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    month: integer('month').notNull(), // 1-12
    year: integer('year').notNull(),
    cycle: varchar('cycle', { length: 20 }).default('monthly').notNull(), // 'monthly', 'weekly'
    baseSalary: decimal('base_salary', { precision: 12, scale: 2 }).notNull(),
    workingDays: integer('working_days').notNull(),
    daysWorked: integer('days_worked').notNull(),
    overtimeHours: decimal('overtime_hours', { precision: 5, scale: 2 }).default('0'),
    overtimeAmount: decimal('overtime_amount', { precision: 10, scale: 2 }).default('0'),
    bonus: decimal('bonus', { precision: 10, scale: 2 }).default('0'),
    bonusType: varchar('bonus_type', { length: 50 }).default('none'), // 'none', 'performance', 'festive'
    festiveBonusMonth: integer('festive_bonus_month'),
    allowances: decimal('allowances', { precision: 10, scale: 2 }).default('0'),
    deductions: decimal('deductions', { precision: 10, scale: 2 }).default('0'),
    epfEmployee: decimal('epf_employee', { precision: 10, scale: 2 }).default('0'), // 8% contribution
    epfEmployer: decimal('epf_employer', { precision: 10, scale: 2 }).default('0'), // 12% contribution
    etfEmployer: decimal('etf_employer', { precision: 10, scale: 2 }).default('0'), // 3% contribution
    apit: decimal('apit', { precision: 10, scale: 2 }).default('0'), // Advance Personal Income Tax
    deductionNotes: text('deduction_notes'),
    advanceDeduction: decimal('advance_deduction', { precision: 10, scale: 2 }).default('0'),
    netSalary: decimal('net_salary', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(), // 'draft', 'pending_approval', 'approved', 'paid'
    approvedBy: uuid('approved_by')
      .references(() => users.id),
    approvedAt: timestamp('approved_at'),
    paidAt: timestamp('paid_at'),
    paidBy: uuid('paid_by')
      .references(() => users.id),
    paymentMethod: varchar('payment_method', { length: 50 }), // 'cash', 'bank_transfer', 'cheque'
    paymentReference: varchar('payment_reference', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    employeeMonthIdx: unique().on(table.employeeId, table.month, table.year),
    storeIdx: index('payroll_store_idx').on(table.storeId),
    monthYearIdx: index('payroll_month_year_idx').on(table.month, table.year),
    statusIdx: index('payroll_status_idx').on(table.status),
  })
);

// Salary Advances table - Track advance salary payments
export const salaryAdvances = pgTable(
  'salary_advances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    requestDate: timestamp('request_date').notNull(),
    reason: text('reason'),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'approved', 'rejected', 'deducted'
    approvedBy: uuid('approved_by')
      .references(() => users.id),
    approvedAt: timestamp('approved_at'),
    rejectionReason: text('rejection_reason'),
    deductFromPayrollId: uuid('deduct_from_payroll_id')
      .references(() => payroll.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    employeeIdx: index('salary_advances_employee_idx').on(table.employeeId),
    storeIdx: index('salary_advances_store_idx').on(table.storeId),
    statusIdx: index('salary_advances_status_idx').on(table.status),
  })
);

// ============================================================================
// HRM RELATIONS
// ============================================================================

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [employees.storeId],
    references: [stores.id],
  }),
  attendanceRecords: many(attendance),
  leaveRequests: many(leaveRequests),
  leaveBalances: many(leaveBalances),
  payrollRecords: many(payroll),
  salaryAdvances: many(salaryAdvances),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  employee: one(employees, {
    fields: [attendance.employeeId],
    references: [employees.id],
  }),
  store: one(stores, {
    fields: [attendance.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [attendance.createdBy],
    references: [users.id],
  }),
}));

export const leaveTypesRelations = relations(leaveTypes, ({ one, many }) => ({
  store: one(stores, {
    fields: [leaveTypes.storeId],
    references: [stores.id],
  }),
  leaveRequests: many(leaveRequests),
  leaveBalances: many(leaveBalances),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveRequests.employeeId],
    references: [employees.id],
  }),
  store: one(stores, {
    fields: [leaveRequests.storeId],
    references: [stores.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveRequests.leaveTypeId],
    references: [leaveTypes.id],
  }),
  approvedByUser: one(users, {
    fields: [leaveRequests.approvedBy],
    references: [users.id],
  }),
}));

export const leaveBalancesRelations = relations(leaveBalances, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveBalances.employeeId],
    references: [employees.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveBalances.leaveTypeId],
    references: [leaveTypes.id],
  }),
}));

export const payrollRelations = relations(payroll, ({ one, many }) => ({
  employee: one(employees, {
    fields: [payroll.employeeId],
    references: [employees.id],
  }),
  store: one(stores, {
    fields: [payroll.storeId],
    references: [stores.id],
  }),
  approvedByUser: one(users, {
    fields: [payroll.approvedBy],
    references: [users.id],
  }),
  paidByUser: one(users, {
    fields: [payroll.paidBy],
    references: [users.id],
  }),
  advanceDeductions: many(salaryAdvances),
}));

export const salaryAdvancesRelations = relations(salaryAdvances, ({ one }) => ({
  employee: one(employees, {
    fields: [salaryAdvances.employeeId],
    references: [employees.id],
  }),
  store: one(stores, {
    fields: [salaryAdvances.storeId],
    references: [stores.id],
  }),
  approvedByUser: one(users, {
    fields: [salaryAdvances.approvedBy],
    references: [users.id],
  }),
  deductedFromPayroll: one(payroll, {
    fields: [salaryAdvances.deductFromPayrollId],
    references: [payroll.id],
  }),
}));

// ============================================================================
// KARIGAR (ARTISAN) MANAGEMENT MODULE
// ============================================================================

// Karigars (Artisans/Craftsmen)
export const karigars = pgTable(
  'karigars',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    karigarCode: varchar('karigar_code', { length: 20 }).unique(), // Auto-generated code
    name: varchar('name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    address: text('address'),
    // Specialization
    specialization: varchar('specialization', { length: 100 }), // rings, chains, bangles, necklaces
    skillLevel: varchar('skill_level', { length: 20 }).default('standard'), // junior, standard, senior, master
    // Rates
    baseLabourRate: decimal('base_labour_rate', { precision: 10, scale: 2 }), // Per gram or per piece
    rateType: varchar('rate_type', { length: 20 }).default('per_gram'), // 'per_gram', 'per_piece', 'fixed'
    // Account Balances
    goldBalance: decimal('gold_balance', { precision: 10, scale: 3 }).default('0').notNull(), // Gold held by karigar
    fineGoldBalance: decimal('fine_gold_balance', { precision: 10, scale: 4 }).default('0').notNull(), // In fine gold equivalent
    pendingLabour: decimal('pending_labour', { precision: 12, scale: 2 }).default('0').notNull(), // Unpaid labour charges
    advanceBalance: decimal('advance_balance', { precision: 12, scale: 2 }).default('0').notNull(), // Advance paid to karigar
    // Wastage Settings
    wastageAllowance: decimal('wastage_allowance', { precision: 5, scale: 2 }).default('2.00').notNull(), // Default allowed wastage %
    // Status and metadata
    status: varchar('status', { length: 20 }).default('active').notNull(), // 'active', 'inactive', 'blocked'
    joiningDate: timestamp('joining_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('karigars_store_idx').on(table.storeId),
    statusIdx: index('karigars_status_idx').on(table.status),
    codeIdx: index('karigars_code_idx').on(table.karigarCode),
  })
);

// Job Cards (Manufacturing Jobs)
export const jobCards = pgTable(
  'job_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobNumber: varchar('job_number', { length: 30 }).unique().notNull(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    karigarId: uuid('karigar_id')
      .notNull()
      .references(() => karigars.id),
    customOrderId: uuid('custom_order_id').references(() => customOrders.id), // Optional link to custom order
    // Job Details
    jobType: varchar('job_type', { length: 50 }).notNull(), // 'new_piece', 'repair', 'polish', 'resize', 'remake'
    itemDescription: text('item_description'),
    category: varchar('category', { length: 50 }), // ring, chain, bangle, etc.
    // Metal Issue Details
    metalIssued: decimal('metal_issued', { precision: 10, scale: 3 }).notNull(), // Weight issued in grams
    metalPurity: decimal('metal_purity', { precision: 5, scale: 2 }).notNull(), // Purity (e.g., 91.67 for 22K)
    fineGoldIssued: decimal('fine_gold_issued', { precision: 10, scale: 4 }).notNull(), // Fine gold equivalent
    metalType: varchar('metal_type', { length: 20 }).default('gold').notNull(), // gold, silver, platinum
    issueDate: timestamp('issue_date').notNull(),
    issuedBy: uuid('issued_by')
      .notNull()
      .references(() => users.id),
    // Additional Materials
    stonesIssued: jsonb('stones_issued'), // Array of {type, count, weight, value}
    otherMaterialsIssued: jsonb('other_materials_issued'),
    // Metal Return Details
    finishedWeight: decimal('finished_weight', { precision: 10, scale: 3 }), // Weight of finished piece
    scrapReturned: decimal('scrap_returned', { precision: 10, scale: 3 }).default('0'), // Scrap/dust returned
    actualWastage: decimal('actual_wastage', { precision: 10, scale: 3 }), // Actual loss (issued - finished - scrap)
    wastagePercentage: decimal('wastage_percentage', { precision: 5, scale: 2 }), // Calculated wastage %
    returnDate: timestamp('return_date'),
    receivedBy: uuid('received_by').references(() => users.id),
    // Wastage Assessment
    allowedWastage: decimal('allowed_wastage', { precision: 10, scale: 3 }), // Based on karigar's allowance
    excessWastage: decimal('excess_wastage', { precision: 10, scale: 3 }), // wastage - allowed (deducted from karigar)
    wastageDeductionValue: decimal('wastage_deduction_value', { precision: 12, scale: 2 }), // Monetary value deducted
    // Labour Details
    labourCharge: decimal('labour_charge', { precision: 10, scale: 2 }), // Labour for this job
    labourPaid: decimal('labour_paid', { precision: 10, scale: 2 }).default('0'), // Amount paid
    // Quality & Timing
    qualityRating: integer('quality_rating'), // 1-5 stars
    expectedCompletionDate: timestamp('expected_completion_date'),
    actualCompletionDate: timestamp('actual_completion_date'),
    // Inventory Link
    resultingInventoryItemId: uuid('resulting_inventory_item_id').references(() => inventoryItems.id),
    // Status
    status: varchar('status', { length: 20 }).default('issued').notNull(), // 'issued', 'in_progress', 'returned', 'inspected', 'settled', 'cancelled'
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('job_cards_store_idx').on(table.storeId),
    karigarIdx: index('job_cards_karigar_idx').on(table.karigarId),
    statusIdx: index('job_cards_status_idx').on(table.status),
    jobNumberIdx: index('job_cards_job_number_idx').on(table.jobNumber),
    issueDateIdx: index('job_cards_issue_date_idx').on(table.issueDate),
  })
);

// Karigar Transactions (Ledger)
export const karigarTransactions = pgTable(
  'karigar_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    karigarId: uuid('karigar_id')
      .notNull()
      .references(() => karigars.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    jobCardId: uuid('job_card_id').references(() => jobCards.id),
    // Transaction Type
    transactionType: varchar('transaction_type', { length: 30 }).notNull(),
    // 'metal_issue', 'metal_return', 'scrap_return', 'labour_credit',
    // 'wastage_debit', 'payment', 'advance', 'adjustment'
    // Gold Movement (positive = to karigar, negative = from karigar)
    goldAmount: decimal('gold_amount', { precision: 10, scale: 3 }).default('0').notNull(),
    fineGoldAmount: decimal('fine_gold_amount', { precision: 10, scale: 4 }).default('0').notNull(),
    goldPurity: decimal('gold_purity', { precision: 5, scale: 2 }),
    // Cash Movement (positive = credit to karigar, negative = debit)
    cashAmount: decimal('cash_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    // Running Balances
    runningGoldBalance: decimal('running_gold_balance', { precision: 10, scale: 3 }).notNull(),
    runningFineGoldBalance: decimal('running_fine_gold_balance', { precision: 10, scale: 4 }).notNull(),
    runningCashBalance: decimal('running_cash_balance', { precision: 12, scale: 2 }).notNull(),
    // Payment Details (for payment transactions)
    paymentMethod: varchar('payment_method', { length: 50 }), // cash, bank_transfer, upi, cheque
    paymentReference: varchar('payment_reference', { length: 255 }),
    // Description and metadata
    description: text('description').notNull(),
    transactionDate: timestamp('transaction_date').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    karigarIdx: index('karigar_transactions_karigar_idx').on(table.karigarId),
    storeIdx: index('karigar_transactions_store_idx').on(table.storeId),
    jobCardIdx: index('karigar_transactions_job_card_idx').on(table.jobCardId),
    dateIdx: index('karigar_transactions_date_idx').on(table.transactionDate),
    typeIdx: index('karigar_transactions_type_idx').on(table.transactionType),
  })
);

// ============================================================================
// SCRAP & WASTAGE MANAGEMENT
// ============================================================================

// Scrap Inventory
export const scrapInventory = pgTable(
  'scrap_inventory',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    // Scrap Details
    scrapCode: varchar('scrap_code', { length: 30 }).unique(),
    scrapType: varchar('scrap_type', { length: 50 }).notNull(), // dust, filings, rejected, polishing_waste, cuttings
    metalType: varchar('metal_type', { length: 20 }).default('gold').notNull(),
    // Weight and Purity
    grossWeight: decimal('gross_weight', { precision: 10, scale: 3 }).notNull(), // Total weight including impurities
    estimatedPurity: decimal('estimated_purity', { precision: 5, scale: 2 }), // Estimated purity %
    estimatedFineWeight: decimal('estimated_fine_weight', { precision: 10, scale: 4 }), // Estimated fine gold
    // Source Tracking
    sourceJobCardId: uuid('source_job_card_id').references(() => jobCards.id),
    sourceKarigarId: uuid('source_karigar_id').references(() => karigars.id),
    sourceDescription: text('source_description'),
    // Valuation
    estimatedValue: decimal('estimated_value', { precision: 12, scale: 2 }),
    goldRateAtCollection: decimal('gold_rate_at_collection', { precision: 12, scale: 2 }),
    // Status
    status: varchar('status', { length: 20 }).default('accumulated').notNull(), // accumulated, sent_for_melting, refined, sold
    collectedAt: timestamp('collected_at').defaultNow().notNull(),
    collectedBy: uuid('collected_by').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('scrap_inventory_store_idx').on(table.storeId),
    statusIdx: index('scrap_inventory_status_idx').on(table.status),
    typeIdx: index('scrap_inventory_type_idx').on(table.scrapType),
  })
);

// Melting/Refining Records
export const meltingRecords = pgTable(
  'melting_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    meltingNumber: varchar('melting_number', { length: 30 }).unique().notNull(),
    meltingDate: timestamp('melting_date').notNull(),
    // Input (scrap going in)
    inputWeight: decimal('input_weight', { precision: 10, scale: 3 }).notNull(),
    inputPurity: decimal('input_purity', { precision: 5, scale: 2 }), // Estimated purity before melting
    inputFineGold: decimal('input_fine_gold', { precision: 10, scale: 4 }), // Estimated fine gold
    scrapItems: jsonb('scrap_items'), // Array of scrap inventory IDs included
    // Output (refined gold)
    outputWeight: decimal('output_weight', { precision: 10, scale: 3 }),
    outputPurity: decimal('output_purity', { precision: 5, scale: 2 }), // Actual purity after refining
    outputFineGold: decimal('output_fine_gold', { precision: 10, scale: 4 }), // Actual fine gold recovered
    // Recovery Analysis
    recoveryPercentage: decimal('recovery_percentage', { precision: 5, scale: 2 }), // (output_fine / input_fine) * 100
    meltingLoss: decimal('melting_loss', { precision: 10, scale: 4 }), // Fine gold lost in process
    meltingLossPercentage: decimal('melting_loss_percentage', { precision: 5, scale: 2 }),
    // Financials
    refiningCost: decimal('refining_cost', { precision: 10, scale: 2 }),
    refinerName: varchar('refiner_name', { length: 100 }),
    refinerInvoice: varchar('refiner_invoice', { length: 100 }),
    // Output Disposition
    outputDisposition: varchar('output_disposition', { length: 30 }), // 'added_to_inventory', 'sold', 'given_to_supplier'
    resultingInventoryItemId: uuid('resulting_inventory_item_id').references(() => inventoryItems.id),
    // Status
    status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, sent, completed, cancelled
    completedAt: timestamp('completed_at'),
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('melting_records_store_idx').on(table.storeId),
    statusIdx: index('melting_records_status_idx').on(table.status),
    dateIdx: index('melting_records_date_idx').on(table.meltingDate),
  })
);

// Wastage Allowances (by category/item type)
export const wastageAllowances = pgTable(
  'wastage_allowances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').references(() => stores.id), // NULL for global defaults
    categoryId: uuid('category_id').references(() => inventoryCategories.id),
    itemType: varchar('item_type', { length: 50 }), // ring, chain, bangle, necklace, etc.
    jobType: varchar('job_type', { length: 50 }), // new_piece, repair, polish, resize
    // Allowance Settings
    allowedPercentage: decimal('allowed_percentage', { precision: 5, scale: 2 }).notNull(),
    minWeight: decimal('min_weight', { precision: 10, scale: 3 }), // For weight-based rules
    maxWeight: decimal('max_weight', { precision: 10, scale: 3 }),
    // Validity
    effectiveFrom: timestamp('effective_from').defaultNow().notNull(),
    effectiveTo: timestamp('effective_to'),
    isActive: boolean('is_active').default(true).notNull(),
    // Metadata
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('wastage_allowances_store_idx').on(table.storeId),
    categoryIdx: index('wastage_allowances_category_idx').on(table.categoryId),
    itemTypeIdx: index('wastage_allowances_item_type_idx').on(table.itemType),
    activeIdx: index('wastage_allowances_active_idx').on(table.isActive),
  })
);

// ============================================================================
// KARIGAR MODULE RELATIONS
// ============================================================================

export const karigarsRelations = relations(karigars, ({ one, many }) => ({
  store: one(stores, {
    fields: [karigars.storeId],
    references: [stores.id],
  }),
  jobCards: many(jobCards),
  transactions: many(karigarTransactions),
  scrapItems: many(scrapInventory),
}));

export const jobCardsRelations = relations(jobCards, ({ one, many }) => ({
  store: one(stores, {
    fields: [jobCards.storeId],
    references: [stores.id],
  }),
  karigar: one(karigars, {
    fields: [jobCards.karigarId],
    references: [karigars.id],
  }),
  customOrder: one(customOrders, {
    fields: [jobCards.customOrderId],
    references: [customOrders.id],
  }),
  issuedByUser: one(users, {
    fields: [jobCards.issuedBy],
    references: [users.id],
  }),
  receivedByUser: one(users, {
    fields: [jobCards.receivedBy],
    references: [users.id],
  }),
  resultingItem: one(inventoryItems, {
    fields: [jobCards.resultingInventoryItemId],
    references: [inventoryItems.id],
  }),
  transactions: many(karigarTransactions),
}));

export const karigarTransactionsRelations = relations(karigarTransactions, ({ one }) => ({
  karigar: one(karigars, {
    fields: [karigarTransactions.karigarId],
    references: [karigars.id],
  }),
  store: one(stores, {
    fields: [karigarTransactions.storeId],
    references: [stores.id],
  }),
  jobCard: one(jobCards, {
    fields: [karigarTransactions.jobCardId],
    references: [jobCards.id],
  }),
  createdByUser: one(users, {
    fields: [karigarTransactions.createdBy],
    references: [users.id],
  }),
}));

export const scrapInventoryRelations = relations(scrapInventory, ({ one }) => ({
  store: one(stores, {
    fields: [scrapInventory.storeId],
    references: [stores.id],
  }),
  sourceJobCard: one(jobCards, {
    fields: [scrapInventory.sourceJobCardId],
    references: [jobCards.id],
  }),
  sourceKarigar: one(karigars, {
    fields: [scrapInventory.sourceKarigarId],
    references: [karigars.id],
  }),
  collectedByUser: one(users, {
    fields: [scrapInventory.collectedBy],
    references: [users.id],
  }),
}));

export const meltingRecordsRelations = relations(meltingRecords, ({ one }) => ({
  store: one(stores, {
    fields: [meltingRecords.storeId],
    references: [stores.id],
  }),
  resultingItem: one(inventoryItems, {
    fields: [meltingRecords.resultingInventoryItemId],
    references: [inventoryItems.id],
  }),
  createdByUser: one(users, {
    fields: [meltingRecords.createdBy],
    references: [users.id],
  }),
}));

export const wastageAllowancesRelations = relations(wastageAllowances, ({ one }) => ({
  store: one(stores, {
    fields: [wastageAllowances.storeId],
    references: [stores.id],
  }),
  category: one(inventoryCategories, {
    fields: [wastageAllowances.categoryId],
    references: [inventoryCategories.id],
  }),
  createdByUser: one(users, {
    fields: [wastageAllowances.createdBy],
    references: [users.id],
  }),
}));

// ============================================================================
// SALESPERSON COMMISSION TRACKING
// ============================================================================

// Commission rates configuration table
export const commissionRates = pgTable(
  'commission_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    categoryId: uuid('category_id').references(() => inventoryCategories.id),
    metalType: varchar('metal_type', { length: 20 }),
    minSaleAmount: decimal('min_sale_amount', { precision: 12, scale: 2 }).default('0'),
    maxSaleAmount: decimal('max_sale_amount', { precision: 12, scale: 2 }),
    commissionPercent: decimal('commission_percent', { precision: 5, scale: 2 }).notNull(),
    commissionType: varchar('commission_type', { length: 20 }).default('percentage'), // percentage, fixed, tiered
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    storeIdx: index('commission_rates_store_idx').on(table.storeId),
    categoryIdx: index('commission_rates_category_idx').on(table.categoryId),
  })
);

// Commission ledger for tracking payouts
export const commissionLedger = pgTable(
  'commission_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    salespersonId: uuid('salesperson_id').notNull().references(() => users.id),
    invoiceId: uuid('invoice_id').references(() => invoices.id),
    transactionType: varchar('transaction_type', { length: 20 }).notNull(), // earned, paid, adjustment
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    runningBalance: decimal('running_balance', { precision: 12, scale: 2 }).notNull(),
    description: text('description'),
    paymentMethod: varchar('payment_method', { length: 50 }),
    paymentReference: varchar('payment_reference', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (table) => ({
    salespersonIdx: index('commission_ledger_salesperson_idx').on(table.salespersonId),
    storeIdx: index('commission_ledger_store_idx').on(table.storeId),
    dateIdx: index('commission_ledger_date_idx').on(table.createdAt),
  })
);

// Salesperson monthly summary
export const salespersonSummary = pgTable(
  'salesperson_summary',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    salespersonId: uuid('salesperson_id').notNull().references(() => users.id),
    periodMonth: integer('period_month').notNull(),
    periodYear: integer('period_year').notNull(),
    totalSales: decimal('total_sales', { precision: 12, scale: 2 }).default('0'),
    totalTransactions: integer('total_transactions').default(0),
    totalCommissionEarned: decimal('total_commission_earned', { precision: 12, scale: 2 }).default('0'),
    totalCommissionPaid: decimal('total_commission_paid', { precision: 12, scale: 2 }).default('0'),
    pendingCommission: decimal('pending_commission', { precision: 12, scale: 2 }).default('0'),
    avgSaleAmount: decimal('avg_sale_amount', { precision: 12, scale: 2 }).default('0'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniquePeriod: unique().on(table.storeId, table.salespersonId, table.periodMonth, table.periodYear),
    lookupIdx: index('salesperson_summary_lookup_idx').on(table.storeId, table.salespersonId, table.periodYear, table.periodMonth),
  })
);

// Commission Relations
export const commissionRatesRelations = relations(commissionRates, ({ one }) => ({
  store: one(stores, {
    fields: [commissionRates.storeId],
    references: [stores.id],
  }),
  category: one(inventoryCategories, {
    fields: [commissionRates.categoryId],
    references: [inventoryCategories.id],
  }),
}));

export const commissionLedgerRelations = relations(commissionLedger, ({ one }) => ({
  store: one(stores, {
    fields: [commissionLedger.storeId],
    references: [stores.id],
  }),
  salesperson: one(users, {
    fields: [commissionLedger.salespersonId],
    references: [users.id],
  }),
  invoice: one(invoices, {
    fields: [commissionLedger.invoiceId],
    references: [invoices.id],
  }),
  createdByUser: one(users, {
    fields: [commissionLedger.createdBy],
    references: [users.id],
  }),
}));

export const salespersonSummaryRelations = relations(salespersonSummary, ({ one }) => ({
  store: one(stores, {
    fields: [salespersonSummary.storeId],
    references: [stores.id],
  }),
  salesperson: one(users, {
    fields: [salespersonSummary.salespersonId],
    references: [users.id],
  }),
}));

// ============================================================================
// PHASE 4: STOCK AGING & DYNAMIC VALUATION HISTORY
// ============================================================================

// Inventory Valuation History (for audit trail)
export const inventoryValuations = pgTable(
  'inventory_valuations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    valuationDate: timestamp('valuation_date').notNull(),

    // Summary
    totalItems: integer('total_items'),
    totalWeight: decimal('total_weight', { precision: 12, scale: 3 }),
    totalFineGold: decimal('total_fine_gold', { precision: 12, scale: 4 }),

    // Values
    totalCostValue: decimal('total_cost_value', { precision: 14, scale: 2 }), // sum of calculatedCost
    totalMarketValue: decimal('total_market_value', { precision: 14, scale: 2 }), // sum of currentMarketValue
    totalUnrealizedGainLoss: decimal('total_unrealized_gain_loss', { precision: 14, scale: 2 }),

    // Gold rate used
    goldRateUsed: decimal('gold_rate_used', { precision: 10, scale: 2 }),
    silverRateUsed: decimal('silver_rate_used', { precision: 10, scale: 2 }),

    // Valuation method
    valuationMethod: varchar('valuation_method', { length: 20 }).default('fifo'),

    // Breakdown by category (JSON)
    categoryBreakdown: text('category_breakdown'),

    // Breakdown by aging (JSON)
    agingBreakdown: text('aging_breakdown'),

    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    storeDateIdx: index('inventory_valuations_store_date_idx').on(table.storeId, table.valuationDate),
  })
);

// Stock Aging Snapshots
export const stockAgingSnapshots = pgTable(
  'stock_aging_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    snapshotDate: timestamp('snapshot_date').notNull(),

    // Aging buckets (item count)
    items0_30Days: integer('items_0_30_days').default(0),
    items31_60Days: integer('items_31_60_days').default(0),
    items61_90Days: integer('items_61_90_days').default(0),
    items91_180Days: integer('items_91_180_days').default(0),
    items181_365Days: integer('items_181_365_days').default(0),
    itemsOver365Days: integer('items_over_365_days').default(0),

    // Aging buckets (value)
    value0_30Days: decimal('value_0_30_days', { precision: 14, scale: 2 }).default('0'),
    value31_60Days: decimal('value_31_60_days', { precision: 14, scale: 2 }).default('0'),
    value61_90Days: decimal('value_61_90_days', { precision: 14, scale: 2 }).default('0'),
    value91_180Days: decimal('value_91_180_days', { precision: 14, scale: 2 }).default('0'),
    value181_365Days: decimal('value_181_365_days', { precision: 14, scale: 2 }).default('0'),
    valueOver365Days: decimal('value_over_365_days', { precision: 14, scale: 2 }).default('0'),

    // Totals
    totalItems: integer('total_items'),
    totalValue: decimal('total_value', { precision: 14, scale: 2 }),
    avgAgeDays: decimal('avg_age_days', { precision: 8, scale: 2 }),

    // Dead stock threshold used
    deadStockThresholdDays: integer('dead_stock_threshold_days').default(180),
    deadStockCount: integer('dead_stock_count').default(0),
    deadStockValue: decimal('dead_stock_value', { precision: 14, scale: 2 }).default('0'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    storeDateIdx: index('stock_aging_store_date_idx').on(table.storeId, table.snapshotDate),
  })
);

// Valuation Relations
export const inventoryValuationsRelations = relations(inventoryValuations, ({ one }) => ({
  store: one(stores, {
    fields: [inventoryValuations.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [inventoryValuations.createdBy],
    references: [users.id],
  }),
}));

export const stockAgingSnapshotsRelations = relations(stockAgingSnapshots, ({ one }) => ({
  store: one(stores, {
    fields: [stockAgingSnapshots.storeId],
    references: [stores.id],
  }),
}));

// ============================================================================
// PHASE 5: ROI & MARGIN ANALYSIS
// ============================================================================

// Report Snapshots (aggregated reports)
export const reportSnapshots = pgTable(
  'report_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    reportType: varchar('report_type', { length: 50 }).notNull(), // daily_sales, weekly_sales, monthly_sales, etc.
    reportDate: timestamp('report_date').notNull(),
    periodStart: timestamp('period_start'),
    periodEnd: timestamp('period_end'),

    // Metrics (JSON for flexibility)
    metrics: jsonb('metrics').notNull(),

    // Drill-down data
    breakdownByCategory: jsonb('breakdown_by_category'),
    breakdownBySalesperson: jsonb('breakdown_by_salesperson'),
    breakdownByMetalType: jsonb('breakdown_by_metal_type'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    storeTypeIdx: index('report_snapshots_store_type_idx').on(table.storeId, table.reportType),
    dateIdx: index('report_snapshots_date_idx').on(table.reportDate),
    uniqueReport: unique().on(table.storeId, table.reportType, table.reportDate),
  })
);

// Category Performance tracking
export const categoryPerformance = pgTable(
  'category_performance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    categoryId: uuid('category_id').references(() => inventoryCategories.id),
    periodMonth: integer('period_month').notNull(),
    periodYear: integer('period_year').notNull(),

    // Sales metrics
    itemsSold: integer('items_sold').default(0),
    totalRevenue: decimal('total_revenue', { precision: 14, scale: 2 }).default('0'),
    totalCost: decimal('total_cost', { precision: 14, scale: 2 }).default('0'),
    grossProfit: decimal('gross_profit', { precision: 14, scale: 2 }).default('0'),
    grossMarginPercent: decimal('gross_margin_percent', { precision: 5, scale: 2 }).default('0'),

    // Weight metrics
    totalWeightSold: decimal('total_weight_sold', { precision: 12, scale: 3 }).default('0'),
    totalFineGoldSold: decimal('total_fine_gold_sold', { precision: 12, scale: 4 }).default('0'),
    metalProfitGrams: decimal('metal_profit_grams', { precision: 10, scale: 4 }).default('0'),

    // Inventory metrics
    avgHoldingDays: decimal('avg_holding_days', { precision: 8, scale: 2 }).default('0'),
    inventoryTurnover: decimal('inventory_turnover', { precision: 8, scale: 4 }).default('0'),

    // ROI metrics
    avgRoi: decimal('avg_roi', { precision: 8, scale: 4 }).default('0'),
    bestRoi: decimal('best_roi', { precision: 8, scale: 4 }).default('0'),
    worstRoi: decimal('worst_roi', { precision: 8, scale: 4 }).default('0'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    lookupIdx: index('category_performance_lookup_idx').on(table.storeId, table.periodYear, table.periodMonth),
    uniquePeriod: unique().on(table.storeId, table.categoryId, table.periodMonth, table.periodYear),
  })
);

// Metal Profit/Loss tracking
export const metalProfitLoss = pgTable(
  'metal_profit_loss',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    periodDate: timestamp('period_date').notNull(),
    periodType: varchar('period_type', { length: 20 }).notNull(), // daily, weekly, monthly

    // Gold metrics (in grams)
    goldPurchasedGrams: decimal('gold_purchased_grams', { precision: 12, scale: 4 }).default('0'),
    goldSoldGrams: decimal('gold_sold_grams', { precision: 12, scale: 4 }).default('0'),
    goldInManufacturing: decimal('gold_in_manufacturing', { precision: 12, scale: 4 }).default('0'),
    goldWastageGrams: decimal('gold_wastage_grams', { precision: 12, scale: 4 }).default('0'),
    goldNetPosition: decimal('gold_net_position', { precision: 12, scale: 4 }).default('0'),

    // Fine gold equivalents
    fineGoldPurchased: decimal('fine_gold_purchased', { precision: 12, scale: 4 }).default('0'),
    fineGoldSold: decimal('fine_gold_sold', { precision: 12, scale: 4 }).default('0'),
    fineGoldProfit: decimal('fine_gold_profit', { precision: 12, scale: 4 }).default('0'),

    // Currency metrics
    goldPurchaseValue: decimal('gold_purchase_value', { precision: 14, scale: 2 }).default('0'),
    goldSalesValue: decimal('gold_sales_value', { precision: 14, scale: 2 }).default('0'),
    currencyProfit: decimal('currency_profit', { precision: 14, scale: 2 }).default('0'),

    // Rates
    avgPurchaseRate: decimal('avg_purchase_rate', { precision: 10, scale: 2 }).default('0'),
    avgSaleRate: decimal('avg_sale_rate', { precision: 10, scale: 2 }).default('0'),
    rateSpread: decimal('rate_spread', { precision: 10, scale: 2 }).default('0'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    lookupIdx: index('metal_profit_loss_lookup_idx').on(table.storeId, table.periodDate, table.periodType),
    uniquePeriod: unique().on(table.storeId, table.periodDate, table.periodType),
  })
);

// Phase 5 Relations
export const reportSnapshotsRelations = relations(reportSnapshots, ({ one }) => ({
  store: one(stores, {
    fields: [reportSnapshots.storeId],
    references: [stores.id],
  }),
}));

export const categoryPerformanceRelations = relations(categoryPerformance, ({ one }) => ({
  store: one(stores, {
    fields: [categoryPerformance.storeId],
    references: [stores.id],
  }),
  category: one(inventoryCategories, {
    fields: [categoryPerformance.categoryId],
    references: [inventoryCategories.id],
  }),
}));

export const metalProfitLossRelations = relations(metalProfitLoss, ({ one }) => ({
  store: one(stores, {
    fields: [metalProfitLoss.storeId],
    references: [stores.id],
  }),
}));

// ============================================================================
// GOLD PAWNING / ENHANCED GOLD LOAN MODULE
// ============================================================================

// Interest Rate Configuration (per store / per amount slab)
export const loanInterestRates = pgTable(
  'loan_interest_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    rateName: varchar('rate_name', { length: 100 }).notNull(), // e.g. "Standard - Up to 2.5L", "Premium - Above 5L"
    minAmount: decimal('min_amount', { precision: 12, scale: 2 }).notNull(),
    maxAmount: decimal('max_amount', { precision: 12, scale: 2 }),
    annualRate: decimal('annual_rate', { precision: 5, scale: 2 }).notNull(),
    monthlyRate: decimal('monthly_rate', { precision: 5, scale: 4 }), // Convenience: annualRate / 12
    dailyRate: decimal('daily_rate', { precision: 8, scale: 6 }), // Convenience: annualRate / 365
    penaltyRate: decimal('penalty_rate', { precision: 5, scale: 2 }).default('2.00'), // Additional % per month on overdue
    maxLtv: decimal('max_ltv', { precision: 5, scale: 2 }).notNull(), // Max LTV for this slab (e.g. 75, 80, 85)
    maxTenureMonths: integer('max_tenure_months').default(12),
    effectiveFrom: timestamp('effective_from').notNull(),
    effectiveTo: timestamp('effective_to'),
    isActive: boolean('is_active').default(true).notNull(),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    storeIdx: index('loan_interest_rates_store_idx').on(table.storeId),
    activeIdx: index('loan_interest_rates_active_idx').on(table.storeId, table.isActive),
  })
);

// LTV Tracking History (snapshots of LTV over time)
export const loanLtvHistory = pgTable(
  'loan_ltv_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => goldLoans.id, { onDelete: 'cascade' }),
    calculationDate: timestamp('calculation_date').defaultNow().notNull(),
    goldRateUsed: decimal('gold_rate_used', { precision: 10, scale: 2 }).notNull(), // 22K rate per gram used
    totalGoldValue: decimal('total_gold_value', { precision: 12, scale: 2 }).notNull(), // Appraised gold value at this rate
    outstandingAmount: decimal('outstanding_amount', { precision: 12, scale: 2 }).notNull(),
    currentLtv: decimal('current_ltv', { precision: 5, scale: 2 }).notNull(),
    maxAllowedLtv: decimal('max_allowed_ltv', { precision: 5, scale: 2 }).notNull(),
    ltvStatus: varchar('ltv_status', { length: 20 }).notNull(), // 'safe', 'warning', 'breach'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    loanIdx: index('loan_ltv_history_loan_idx').on(table.loanId),
    dateIdx: index('loan_ltv_history_date_idx').on(table.calculationDate),
  })
);

// Customer KYC (Know Your Customer)
export const customerKyc = pgTable(
  'customer_kyc',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    // Identity Documents
    aadhaarNumber: varchar('aadhaar_number', { length: 12 }),
    aadhaarVerified: boolean('aadhaar_verified').default(false),
    aadhaarVerifiedAt: timestamp('aadhaar_verified_at'),
    panNumber: varchar('pan_number', { length: 10 }),
    panVerified: boolean('pan_verified').default(false),
    panVerifiedAt: timestamp('pan_verified_at'),
    voterId: varchar('voter_id', { length: 20 }),
    passportNumber: varchar('passport_number', { length: 20 }),
    drivingLicense: varchar('driving_license', { length: 20 }),
    // Document Uploads (URLs)
    aadhaarFrontUrl: text('aadhaar_front_url'),
    aadhaarBackUrl: text('aadhaar_back_url'),
    panUrl: text('pan_url'),
    photoUrl: text('photo_url'),
    signatureUrl: text('signature_url'),
    addressProofUrl: text('address_proof_url'),
    addressProofType: varchar('address_proof_type', { length: 50 }), // 'utility_bill', 'bank_statement', 'rental_agreement'
    // Verification Status
    kycStatus: varchar('kyc_status', { length: 20 }).default('pending').notNull(), // 'pending', 'partial', 'verified', 'rejected', 'expired'
    verificationLevel: varchar('verification_level', { length: 20 }).default('basic'), // 'basic', 'enhanced', 'full'
    lastVerifiedAt: timestamp('last_verified_at'),
    verifiedBy: uuid('verified_by').references(() => users.id),
    rejectionReason: text('rejection_reason'),
    expiresAt: timestamp('expires_at'), // KYC validity period
    // Audit
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: unique().on(table.customerId),
    storeIdx: index('customer_kyc_store_idx').on(table.storeId),
    statusIdx: index('customer_kyc_status_idx').on(table.kycStatus),
  })
);

// Loan Documents (receipts, vouchers, notices)
export const loanDocuments = pgTable(
  'loan_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => goldLoans.id, { onDelete: 'cascade' }),
    documentType: varchar('document_type', { length: 50 }).notNull(), // 'pledge_receipt', 'release_voucher', 'interest_receipt', 'auction_notice', 'margin_call_notice', 'renewal_receipt'
    documentNumber: varchar('document_number', { length: 100 }).notNull(),
    generatedAt: timestamp('generated_at').defaultNow().notNull(),
    documentUrl: text('document_url'), // URL to stored PDF
    documentData: jsonb('document_data'), // Snapshot data for regeneration
    generatedBy: uuid('generated_by').references(() => users.id),
    printedCount: integer('printed_count').default(0),
    lastPrintedAt: timestamp('last_printed_at'),
    emailSentAt: timestamp('email_sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    loanIdx: index('loan_documents_loan_idx').on(table.loanId),
    typeIdx: index('loan_documents_type_idx').on(table.documentType),
    documentNumberIdx: unique().on(table.documentNumber),
  })
);

// Loan Renewals (track loan extension/rollover chain)
export const loanRenewals = pgTable(
  'loan_renewals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    originalLoanId: uuid('original_loan_id')
      .notNull()
      .references(() => goldLoans.id),
    newLoanId: uuid('new_loan_id')
      .references(() => goldLoans.id),
    renewalDate: timestamp('renewal_date').defaultNow().notNull(),
    outstandingAtRenewal: decimal('outstanding_at_renewal', { precision: 12, scale: 2 }).notNull(),
    interestPaidAtRenewal: decimal('interest_paid_at_renewal', { precision: 12, scale: 2 }).notNull(),
    newLoanAmount: decimal('new_loan_amount', { precision: 12, scale: 2 }).notNull(),
    newInterestRate: decimal('new_interest_rate', { precision: 5, scale: 2 }).notNull(),
    newTenureMonths: integer('new_tenure_months').notNull(),
    goldRevaluationDone: boolean('gold_revaluation_done').default(false),
    newGoldValue: decimal('new_gold_value', { precision: 12, scale: 2 }),
    newLtv: decimal('new_ltv', { precision: 5, scale: 2 }),
    renewalReason: text('renewal_reason'),
    processedBy: uuid('processed_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    originalLoanIdx: index('loan_renewals_original_idx').on(table.originalLoanId),
    newLoanIdx: index('loan_renewals_new_idx').on(table.newLoanId),
  })
);

// Margin Calls (triggered when LTV exceeds threshold)
export const marginCalls = pgTable(
  'margin_calls',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => goldLoans.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    callDate: timestamp('call_date').defaultNow().notNull(),
    triggerReason: varchar('trigger_reason', { length: 50 }).notNull(), // 'ltv_breach', 'scheduled_check', 'manual', 'gold_price_drop'
    goldRateAtCall: decimal('gold_rate_at_call', { precision: 10, scale: 2 }).notNull(),
    ltvAtCall: decimal('ltv_at_call', { precision: 5, scale: 2 }).notNull(),
    requiredPayment: decimal('required_payment', { precision: 12, scale: 2 }).notNull(), // Amount needed to restore LTV
    deadline: timestamp('deadline').notNull(), // Compliance deadline
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'complied', 'escalated', 'waived', 'defaulted'
    paymentReceived: decimal('payment_received', { precision: 12, scale: 2 }).default('0'),
    complianceDate: timestamp('compliance_date'),
    escalatedToAuction: boolean('escalated_to_auction').default(false),
    notificationSent: boolean('notification_sent').default(false),
    notificationSentAt: timestamp('notification_sent_at'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    loanIdx: index('margin_calls_loan_idx').on(table.loanId),
    storeIdx: index('margin_calls_store_idx').on(table.storeId),
    statusIdx: index('margin_calls_status_idx').on(table.status),
    deadlineIdx: index('margin_calls_deadline_idx').on(table.deadline),
  })
);

// Loan Auctions (for foreclosed/defaulted loans)
export const loanAuctions = pgTable(
  'loan_auctions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => goldLoans.id),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    // Auction lifecycle
    auctionStatus: varchar('auction_status', { length: 20 }).default('initiated').notNull(), // 'initiated', 'notice_sent', 'scheduled', 'completed', 'cancelled'
    initiationDate: timestamp('initiation_date').defaultNow().notNull(),
    noticeSentDate: timestamp('notice_sent_date'),
    noticeType: varchar('notice_type', { length: 50 }), // 'first_notice', 'final_notice', 'auction_notice'
    // 7-day release rule per Sri Lankan regulations
    releaseDeadline: timestamp('release_deadline'), // 7 days from initiation
    dailyPenaltyRate: decimal('daily_penalty_rate', { precision: 8, scale: 2 }).default('5000'), // Rs 5000/day per Sri Lankan regulations
    totalPenaltyAccrued: decimal('total_penalty_accrued', { precision: 12, scale: 2 }).default('0'),
    // Auction execution
    scheduledDate: timestamp('scheduled_date'),
    auctionLocation: text('auction_location'),
    reservePrice: decimal('reserve_price', { precision: 12, scale: 2 }),
    finalSalePrice: decimal('final_sale_price', { precision: 12, scale: 2 }),
    buyerName: varchar('buyer_name', { length: 255 }),
    buyerContact: varchar('buyer_contact', { length: 20 }),
    buyerIdNumber: varchar('buyer_id_number', { length: 50 }),
    // Settlement
    amountRecovered: decimal('amount_recovered', { precision: 12, scale: 2 }),
    surplusAmount: decimal('surplus_amount', { precision: 12, scale: 2 }), // To be returned to borrower
    deficitAmount: decimal('deficit_amount', { precision: 12, scale: 2 }), // To be collected from borrower
    settlementDate: timestamp('settlement_date'),
    settledBy: uuid('settled_by').references(() => users.id),
    // Audit
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    loanIdx: index('loan_auctions_loan_idx').on(table.loanId),
    storeIdx: index('loan_auctions_store_idx').on(table.storeId),
    statusIdx: index('loan_auctions_status_idx').on(table.auctionStatus),
    deadlineIdx: index('loan_auctions_deadline_idx').on(table.releaseDeadline),
  })
);

// Notification Templates (for loan-specific messaging)
export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').references(() => stores.id), // null = system-wide
    templateCode: varchar('template_code', { length: 50 }).notNull(), // e.g. 'loan_disbursement', 'payment_reminder'
    templateName: varchar('template_name', { length: 100 }).notNull(),
    channel: varchar('channel', { length: 20 }).notNull(), // 'whatsapp', 'sms', 'email'
    subject: text('subject'), // For email
    bodyTemplate: text('body_template').notNull(), // Template with {{variables}}
    variables: jsonb('variables'), // List of expected variables
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    codeChannelIdx: unique().on(table.templateCode, table.channel, table.storeId),
  })
);

// Loan Notifications Log (tracks all messages sent for loans)
export const loanNotifications = pgTable(
  'loan_notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => goldLoans.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    notificationType: varchar('notification_type', { length: 50 }).notNull(), // 'disbursement', 'payment_reminder', 'ltv_alert', 'maturity_warning', 'overdue_notice', 'auction_notice', 'release_confirmation', 'renewal'
    channel: varchar('channel', { length: 20 }).notNull(), // 'whatsapp', 'sms', 'email'
    templateId: uuid('template_id').references(() => notificationTemplates.id),
    recipientPhone: varchar('recipient_phone', { length: 20 }),
    recipientEmail: varchar('recipient_email', { length: 255 }),
    content: text('content').notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // 'pending', 'sent', 'delivered', 'failed', 'read'
    sentAt: timestamp('sent_at'),
    deliveredAt: timestamp('delivered_at'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    loanIdx: index('loan_notifications_loan_idx').on(table.loanId),
    customerIdx: index('loan_notifications_customer_idx').on(table.customerId),
    typeIdx: index('loan_notifications_type_idx').on(table.notificationType),
    statusIdx: index('loan_notifications_status_idx').on(table.status),
  })
);

// ============================================================================
// GOLD PAWNING RELATIONS
// ============================================================================

export const loanInterestRatesRelations = relations(loanInterestRates, ({ one }) => ({
  store: one(stores, {
    fields: [loanInterestRates.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [loanInterestRates.createdBy],
    references: [users.id],
  }),
}));

export const loanLtvHistoryRelations = relations(loanLtvHistory, ({ one }) => ({
  loan: one(goldLoans, {
    fields: [loanLtvHistory.loanId],
    references: [goldLoans.id],
  }),
}));

export const customerKycRelations = relations(customerKyc, ({ one }) => ({
  customer: one(customers, {
    fields: [customerKyc.customerId],
    references: [customers.id],
  }),
  store: one(stores, {
    fields: [customerKyc.storeId],
    references: [stores.id],
  }),
  verifiedByUser: one(users, {
    fields: [customerKyc.verifiedBy],
    references: [users.id],
  }),
}));

export const loanDocumentsRelations = relations(loanDocuments, ({ one }) => ({
  loan: one(goldLoans, {
    fields: [loanDocuments.loanId],
    references: [goldLoans.id],
  }),
  generatedByUser: one(users, {
    fields: [loanDocuments.generatedBy],
    references: [users.id],
  }),
}));

export const loanRenewalsRelations = relations(loanRenewals, ({ one }) => ({
  originalLoan: one(goldLoans, {
    fields: [loanRenewals.originalLoanId],
    references: [goldLoans.id],
    relationName: 'originalLoan',
  }),
  newLoan: one(goldLoans, {
    fields: [loanRenewals.newLoanId],
    references: [goldLoans.id],
    relationName: 'newLoan',
  }),
  processedByUser: one(users, {
    fields: [loanRenewals.processedBy],
    references: [users.id],
  }),
}));

export const marginCallsRelations = relations(marginCalls, ({ one }) => ({
  loan: one(goldLoans, {
    fields: [marginCalls.loanId],
    references: [goldLoans.id],
  }),
  store: one(stores, {
    fields: [marginCalls.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [marginCalls.createdBy],
    references: [users.id],
  }),
}));

export const loanAuctionsRelations = relations(loanAuctions, ({ one }) => ({
  loan: one(goldLoans, {
    fields: [loanAuctions.loanId],
    references: [goldLoans.id],
  }),
  store: one(stores, {
    fields: [loanAuctions.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [loanAuctions.createdBy],
    references: [users.id],
  }),
  settledByUser: one(users, {
    fields: [loanAuctions.settledBy],
    references: [users.id],
  }),
}));

export const notificationTemplatesRelations = relations(notificationTemplates, ({ one }) => ({
  store: one(stores, {
    fields: [notificationTemplates.storeId],
    references: [stores.id],
  }),
}));

export const loanNotificationsRelations = relations(loanNotifications, ({ one }) => ({
  loan: one(goldLoans, {
    fields: [loanNotifications.loanId],
    references: [goldLoans.id],
  }),
  customer: one(customers, {
    fields: [loanNotifications.customerId],
    references: [customers.id],
  }),
  template: one(notificationTemplates, {
    fields: [loanNotifications.templateId],
    references: [notificationTemplates.id],
  }),
}));

export const salesReturnsRelations = relations(salesReturns, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [salesReturns.invoiceId],
    references: [invoices.id],
  }),
  customer: one(customers, {
    fields: [salesReturns.customerId],
    references: [customers.id],
  }),
  store: one(stores, {
    fields: [salesReturns.storeId],
    references: [stores.id],
  }),
  createdByUser: one(users, {
    fields: [salesReturns.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [salesReturns.approvedBy],
    references: [users.id],
  }),
  items: many(salesReturnItems),
}));

export const salesReturnItemsRelations = relations(salesReturnItems, ({ one }) => ({
  return: one(salesReturns, {
    fields: [salesReturnItems.returnId],
    references: [salesReturns.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [salesReturnItems.inventoryItemId],
    references: [inventoryItems.id],
  }),
  invoiceItem: one(invoiceItems, {
    fields: [salesReturnItems.invoiceItemId],
    references: [invoiceItems.id],
  }),
}));

// Store Access Requests table
export const storeAccessRequests = pgTable(
  'store_access_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    requesterStoreId: uuid('requester_store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    requestedStoreId: uuid('requested_store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    requestedAt: timestamp('requested_at').defaultNow().notNull(),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    requesterIdx: index('store_access_requests_requester_idx').on(table.requesterId),
    statusIdx: index('store_access_requests_status_idx').on(table.status),
    requestedStoreIdx: index('store_access_requests_requested_store_idx').on(table.requestedStoreId),
    validityIdx: index('store_access_requests_validity_idx').on(table.validFrom, table.validUntil),
  })
);

export const storeAccessRequestsRelations = relations(storeAccessRequests, ({ one }) => ({
  requester: one(users, {
    fields: [storeAccessRequests.requesterId],
    references: [users.id],
  }),
  requesterStore: one(stores, {
    fields: [storeAccessRequests.requesterStoreId],
    references: [stores.id],
  }),
  requestedStore: one(stores, {
    fields: [storeAccessRequests.requestedStoreId],
    references: [stores.id],
  }),
  approver: one(users, {
    fields: [storeAccessRequests.approvedBy],
    references: [users.id],
  }),
}));

// Inventory Permission Requests table
export const inventoryPermissionRequests = pgTable(
  'inventory_permission_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    requestedAt: timestamp('requested_at').defaultNow().notNull(),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    requesterIdx: index('inventory_permission_requests_requester_idx').on(table.requesterId),
    statusIdx: index('inventory_permission_requests_status_idx').on(table.status),
    storeIdx: index('inventory_permission_requests_store_idx').on(table.storeId),
  })
);

export const inventoryPermissionRequestsRelations = relations(inventoryPermissionRequests, ({ one }) => ({
  requester: one(users, {
    fields: [inventoryPermissionRequests.requesterId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [inventoryPermissionRequests.storeId],
    references: [stores.id],
  }),
  reviewer: one(users, {
    fields: [inventoryPermissionRequests.reviewedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// MARKET DATA SCHEMA - Gold Price & Exchange Rate Tracking
// ============================================================================

export const marketData = pgTable(
  'market_data',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    date: timestamp('date').notNull(), // One entry per day
    // World Gold Price (from Kitco / GoldPrice.org)
    worldGoldPriceUsd: decimal('world_gold_price_usd', { precision: 12, scale: 2 }), // USD per Troy Ounce
    // Sea Street (local market) Price
    seaStreetPriceLkr: decimal('sea_street_price_lkr', { precision: 12, scale: 2 }), // LKR per Gram (22K)
    // Exchange Rate
    lkrUsdtRate: decimal('lkr_usdt_rate', { precision: 12, scale: 4 }), // 1 USDT = X LKR
    // Computed/derived fields stored for convenience
    worldGoldPriceLkrGram: decimal('world_gold_price_lkr_gram', { precision: 12, scale: 2 }), // World price converted to LKR/gram
    spreadPercentage: decimal('spread_percentage', { precision: 8, scale: 4 }), // % difference between Sea Street and World price in LKR
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    dateUnique: unique('market_data_date_unique').on(table.date),
    dateIdx: index('market_data_date_idx').on(table.date),
  })
);

export const marketDataRelations = relations(marketData, ({ one }) => ({
  createdByUser: one(users, {
    fields: [marketData.createdBy],
    references: [users.id],
  }),
}));
