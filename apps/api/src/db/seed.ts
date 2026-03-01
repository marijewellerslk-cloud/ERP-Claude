import { db, connection } from '../config/database.js';
import { users, stores, roles, permissions, rolePermissions, userRoles } from './schema.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

// Constants defined locally to avoid import issues
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  STORE_MANAGER: 'store_manager',
  SALESPERSON: 'salesperson',
  ACCOUNTANT: 'accountant',
  CASHIER: 'cashier',
} as const;

const RESOURCES = {
  INVENTORY: 'inventory',
  SALES: 'sales',
  CUSTOMERS: 'customers',
  ACCOUNTING: 'accounting',
  SUPPLIERS: 'suppliers',
  GOLD_LOANS: 'gold_loans',
  CUSTOM_ORDERS: 'custom_orders',
  REPAIRS: 'repairs',
  REPORTS: 'reports',
  USERS: 'users',
  STORES: 'stores',
  SETTINGS: 'settings',
  // HRM Module
  EMPLOYEES: 'employees',
  ATTENDANCE: 'attendance',
  LEAVE: 'leave',
  PAYROLL: 'payroll',
  // Multi-branch Command Center
  COMMAND_CENTER: 'command_center',
  BRANCHES: 'branches',
  // Karigar & Manufacturing Module
  KARIGARS: 'karigars',
  JOB_CARDS: 'job_cards',
  SCRAP: 'scrap',
  MELTING: 'melting',
} as const;

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT: 'export',
} as const;

async function seed() {
  try {
    // CRITICAL SAFETY: Never run seed in production
    if (process.env.NODE_ENV === 'production') {
      logger.error('❌ CRITICAL SAFETY: Seed script cannot run in production!');
      logger.error('   If you need to seed production, explicitly set NODE_ENV=staging');
      logger.error('   or run with: ALLOW_PRODUCTION_SEED=true npm run db:seed');
      await connection.end();
      process.exit(1);
    }

    // Double safety check: explicit production seed block
    if (process.env.ALLOW_PRODUCTION_SEED !== 'true' && process.env.NODE_ENV !== 'staging') {
      // Check for production database indicators
      const dbUrl = process.env.DATABASE_URL || '';
      if (dbUrl.includes('production') || dbUrl.includes('prod')) {
        logger.error('❌ CRITICAL SAFETY: Production database URL detected!');
        logger.error('   Set ALLOW_PRODUCTION_SEED=true to override');
        await connection.end();
        process.exit(1);
      }
    }

    logger.info('Starting database seeding...');

    // Check if already seeded by looking for the main store
    const existingStore = await db.query.stores.findFirst({
      where: (stores, { eq }) => eq(stores.code, 'MAIN-001'),
    });

    if (existingStore) {
      logger.info('✅ Database already seeded. Skipping...');
      logger.info(`   Store: ${existingStore.name}`);
      logger.info(`   Store ID: ${existingStore.id}`);
      logger.info(`   Store Code: ${existingStore.code}`);
      await connection.end();
      process.exit(0);
    }

    // FINAL SAFETY: Count existing users before proceeding
    const existingUsers = await db.query.users.findMany();
    if (existingUsers.length > 0) {
      logger.warn(`⚠️  WARNING: Found ${existingUsers.length} existing users!`);
      logger.warn('   Seed script will NOT wipe existing data, but proceeding may cause issues.');
      logger.warn('   If you see this in production, ABORT IMMEDIATELY.');
      // Still skip if we have users AND a store
      if (existingStore) {
        await connection.end();
        process.exit(0);
      }
    }

    // Create main store
    logger.info('Creating default store...');
    const [mainStore] = await db
      .insert(stores)
      .values({
        name: 'MARI Jewellers - Main Store',
        code: 'MAIN-001',
        address: '123 Jewelry Street, City, Country',
        phone: '+1234567890',
        email: 'main@marijewellers.com',
        gstin: 'GSTIN123456789',
        parentStoreId: null,
        isActive: true,
      })
      .returning();

    logger.info(`✅ Created store: ${mainStore.name}`);

    // Create roles
    logger.info('Creating roles...');
    const rolesData = [
      {
        name: ROLES.SUPER_ADMIN,
        description: 'Full system access across all stores',
      },
      {
        name: ROLES.STORE_MANAGER,
        description: 'Full access within assigned store',
      },
      {
        name: ROLES.SALESPERSON,
        description: 'Inventory read, sales operations, customer management',
      },
      {
        name: ROLES.ACCOUNTANT,
        description: 'Accounting operations, financial reports',
      },
      {
        name: ROLES.CASHIER,
        description: 'POS operations, payment processing',
      },
    ];

    const createdRoles = await db.insert(roles).values(rolesData).returning();
    logger.info(`✅ Created ${createdRoles.length} roles`);

    // Create permissions
    logger.info('Creating permissions...');
    const permissionsData = [];

    // Generate permissions for each resource
    const resources = Object.values(RESOURCES);
    const actions = Object.values(ACTIONS);

    for (const resource of resources) {
      for (const action of actions) {
        permissionsData.push({
          resource,
          action,
          description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${resource}`,
        });
      }
    }

    const createdPermissions = await db.insert(permissions).values(permissionsData).returning();
    logger.info(`✅ Created ${createdPermissions.length} permissions`);

    // Assign permissions to roles
    logger.info('Assigning permissions to roles...');

    // Super Admin - all permissions
    const superAdminRole = createdRoles.find((r) => r.name === ROLES.SUPER_ADMIN)!;
    const superAdminPermissions = createdPermissions.map((p) => ({
      roleId: superAdminRole.id,
      permissionId: p.id,
    }));

    // Store Manager - most permissions except user/system management
    const storeManagerRole = createdRoles.find((r) => r.name === ROLES.STORE_MANAGER)!;
    const storeManagerPermissions = createdPermissions
      .filter((p) => {
        // Exclude certain resources for store managers
        const excludedResources = ['users', 'stores', 'settings'];
        
        // Include backup permissions for store managers
        if (p.resource === 'backups') {
          return true;
        }
        
        return !excludedResources.includes(p.resource);
      })
      .map((p) => ({
        roleId: storeManagerRole.id,
        permissionId: p.id,
      }));

    // Salesperson - inventory read, sales, customers
    const salespersonRole = createdRoles.find((r) => r.name === ROLES.SALESPERSON)!;
    const salespersonPermissions = createdPermissions
      .filter(
        (p) =>
          (p.resource === RESOURCES.INVENTORY && p.action === ACTIONS.READ) ||
          p.resource === RESOURCES.SALES ||
          p.resource === RESOURCES.CUSTOMERS ||
          (p.resource === RESOURCES.REPORTS && p.action === ACTIONS.READ)
      )
      .map((p) => ({
        roleId: salespersonRole.id,
        permissionId: p.id,
      }));

    // Accountant - accounting, reports
    const accountantRole = createdRoles.find((r) => r.name === ROLES.ACCOUNTANT)!;
    const accountantPermissions = createdPermissions
      .filter(
        (p) =>
          p.resource === RESOURCES.ACCOUNTING ||
          p.resource === RESOURCES.REPORTS ||
          p.resource === RESOURCES.BACKUPS || // Add backup permissions for accountants
          (p.resource === RESOURCES.SALES && p.action === ACTIONS.READ)
      )
      .map((p) => ({
        roleId: accountantRole.id,
        permissionId: p.id,
      }));

    // Cashier - POS operations
    const cashierRole = createdRoles.find((r) => r.name === ROLES.CASHIER)!;
    const cashierPermissions = createdPermissions
      .filter(
        (p) =>
          (p.resource === RESOURCES.SALES && [ACTIONS.CREATE, ACTIONS.READ].includes(p.action as any)) ||
          (p.resource === RESOURCES.INVENTORY && p.action === ACTIONS.READ) ||
          (p.resource === RESOURCES.CUSTOMERS && [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE].includes(p.action as any))
      )
      .map((p) => ({
        roleId: cashierRole.id,
        permissionId: p.id,
      }));

    const allRolePermissions = [
      ...superAdminPermissions,
      ...storeManagerPermissions,
      ...salespersonPermissions,
      ...accountantPermissions,
      ...cashierPermissions,
    ];

    await db.insert(rolePermissions).values(allRolePermissions);
    logger.info(`✅ Assigned permissions to roles`);

    // Create default admin user
    logger.info('Creating admin user...');
    const adminPassword = await hashPassword('Admin@123');
    const [adminUser] = await db
      .insert(users)
      .values({
        email: 'admin@marijewellers.com',
        passwordHash: adminPassword,
        fullName: 'System Administrator',
        phone: '+1234567890',
        isActive: true,
      })
      .returning();

    // Assign super admin role to admin user
    await db.insert(userRoles).values({
      userId: adminUser.id,
      roleId: superAdminRole.id,
      storeId: mainStore.id,
    });

    logger.info(`✅ Created admin user: ${adminUser.email}`);
    logger.info(`   Default password: Admin@123`);
    logger.info(`   ⚠️  IMPORTANT: Change this password after first login!`);

    logger.info('\n=== Seeding completed successfully ===\n');
    logger.info('Default credentials:');
    logger.info(`Email: ${adminUser.email}`);
    logger.info(`Password: Admin@123`);
    logger.info(`Store ID: ${mainStore.id}`);
    logger.info(`Store Code: ${mainStore.code}\n`);

    await connection.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    await connection.end();
    process.exit(1);
  }
}

seed();
