import { db, connection } from '../config/database.js';
import { users, userRoles, roles, stores } from '../db/schema.js';
import { hashPassword } from '../utils/password.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

async function seedTestUsers() {
  try {
    logger.info('Creating test users for each role...\n');

    // Get main store
    const mainStore = await db.query.stores.findFirst({
      where: eq(stores.code, 'MAIN-001'),
    });
    if (!mainStore) {
      throw new Error('Main store not found. Run db:seed first.');
    }

    // Get all roles
    const allRoles = await db.select().from(roles);
    const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));

    // Hash a common password for all test users
    const password = await hashPassword('Test@123');

    const testUsers = [
      {
        email: 'manager@marijewellers.com',
        fullName: 'Test Store Manager',
        phone: '+1234567001',
        roleName: 'store_manager',
        canManipulateInventory: false, // needs permission
      },
      {
        email: 'salesperson@marijewellers.com',
        fullName: 'Test Salesperson',
        phone: '+1234567002',
        roleName: 'sales_agent',
        canManipulateInventory: false,
      },
      {
        email: 'accountant@marijewellers.com',
        fullName: 'Test Accountant',
        phone: '+1234567003',
        roleName: 'accountant',
        canManipulateInventory: false,
      },
      {
        email: 'cashier@marijewellers.com',
        fullName: 'Test Cashier',
        phone: '+1234567004',
        roleName: 'sales_agent',
        canManipulateInventory: false,
      },
    ];

    for (const testUser of testUsers) {
      // Check if user already exists
      const existing = await db.query.users.findFirst({
        where: eq(users.email, testUser.email),
      });

      if (existing) {
        logger.info(`  Skipped (exists): ${testUser.email}`);
        continue;
      }

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: testUser.email,
          passwordHash: password,
          fullName: testUser.fullName,
          phone: testUser.phone,
          isActive: true,
        })
        .returning();

      // Assign role
      const roleId = roleMap[testUser.roleName];
      if (!roleId) {
        logger.warn(`  Role not found: ${testUser.roleName}`);
        continue;
      }

      await db.insert(userRoles).values({
        userId: newUser.id,
        roleId,
        storeId: mainStore.id,
        canManipulateInventory: testUser.canManipulateInventory,
      });

      logger.info(`  Created: ${testUser.email} (${testUser.roleName})`);
    }

    logger.info('\n=== Test users created ===\n');
    logger.info('All test accounts use password: Test@123\n');
    logger.info('Accounts:');
    logger.info('  admin@marijewellers.com       (super_admin)    password: Admin@123');
    logger.info('  manager@marijewellers.com     (store_manager)  password: Test@123');
    logger.info('  salesperson@marijewellers.com (salesperson)    password: Test@123');
    logger.info('  accountant@marijewellers.com  (accountant)     password: Test@123');
    logger.info('  cashier@marijewellers.com     (cashier)        password: Test@123');

    await connection.end();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to create test users:', error);
    await connection.end();
    process.exit(1);
  }
}

seedTestUsers();
