/**
 * Safe Database Initialization Script
 * 
 * This script safely initializes the database for production deployments.
 * It runs migrations and ensures an admin user exists WITHOUT wiping data.
 * 
 * SAFE FOR PRODUCTION - Does not drop tables or delete data.
 * 
 * Usage:
 *   npm run db:init    # Safe initialization (migrations + admin check)
 */

import { db, connection } from '../config/database.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { users, stores, roles, userRoles } from './schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

async function initializeDatabase() {
  try {
    logger.info('=== Safe Database Initialization ===\n');

    // Step 1: Run migrations (safe, additive only)
    logger.info('Step 1: Running database migrations...');
    await migrate(db, {
      migrationsFolder: './src/db/migrations',
    });
    logger.info('✅ Migrations completed successfully\n');

    // Step 2: Check if database has data
    logger.info('Step 2: Checking existing data...');
    
    const storeCount = await db.query.stores.findMany();
    const userCount = await db.query.users.findMany();
    const roleCount = await db.query.roles.findMany();

    logger.info(`   Stores: ${storeCount.length}`);
    logger.info(`   Users: ${userCount.length}`);
    logger.info(`   Roles: ${roleCount.length}\n`);

    // Step 3: Ensure admin user exists
    logger.info('Step 3: Ensuring admin user exists...');
    
    let adminUser = await db.query.users.findFirst({
      where: eq(users.email, 'admin@marijewellers.com'),
    });

    if (adminUser) {
      logger.info(`✅ Admin user exists: ${adminUser.email}`);
    } else {
      logger.info('📝 Creating admin user...');
      
      // Ensure store exists
      let mainStore = await db.query.stores.findFirst({
        where: (stores, { eq }) => eq(stores.code, 'MAIN-001'),
      });

      if (!mainStore) {
        logger.warn('   Main store not found, creating...');
        const [newStore] = await db
          .insert(stores)
          .values({
            name: 'MARI Jewellers - Main Store',
            code: 'MAIN-001',
            address: '123 Jewelry Street, City, Country',
            phone: '+1234567890',
            email: 'main@marijewellers.com',
            gstin: 'GSTIN123456789',
            isActive: true,
          })
          .returning();
        mainStore = newStore;
        logger.info('   ✅ Created store');
      }

      // Ensure super_admin role exists
      let superAdminRole = await db.query.roles.findFirst({
        where: eq(roles.name, 'super_admin'),
      });

      if (!superAdminRole) {
        logger.error('   ❌ super_admin role not found!');
        logger.error('   Please ensure roles are seeded before running this script.');
        await connection.end();
        process.exit(1);
      }

      // Create admin user
      const hashedPassword = await hashPassword('Admin@123');
      const [newUser] = await db
        .insert(users)
        .values({
          email: 'admin@marijewellers.com',
          passwordHash: hashedPassword,
          fullName: 'System Administrator',
          phone: '+1234567890',
        })
        .returning();
      
      adminUser = newUser;
      logger.info('   ✅ Created admin user');

      // Assign super_admin role
      await db.insert(userRoles).values({
        userId: adminUser.id,
        roleId: superAdminRole.id,
        storeId: mainStore.id,
      });
      logger.info('   ✅ Assigned super_admin role');
    }

    logger.info('\n=== Database Initialization Complete ===\n');
    logger.info('✅ Database is ready for use');
    logger.info('✅ Admin user: admin@marijewellers.com');
    logger.info('✅ Default password: Admin@123');
    logger.info('\n⚠️  IMPORTANT: Change the admin password after first login!\n');

    await connection.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Initialization failed:', error);
    await connection.end();
    process.exit(1);
  }
}

initializeDatabase();
