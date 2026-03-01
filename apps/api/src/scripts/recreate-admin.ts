/**
 * Admin Recreation Script
 * 
 * Safely creates or resets the admin user WITHOUT affecting any other data.
 * This script is idempotent - safe to run multiple times.
 * 
 * Usage:
 *   npm run script:recreate-admin              # Reset to default password
 *   npm run script:recreate-admin -- --email custom@admin.com  # Custom email
 * 
 * SAFE FOR PRODUCTION: Does not wipe any existing data.
 */

import { db, connection } from '../config/database.js';
import { users, stores, roles, userRoles } from '../db/schema.js';
import { eq, or } from 'drizzle-orm';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

const DEFAULT_ADMIN_EMAIL = 'admin@marijewellers.com';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123';
const DEFAULT_ADMIN_NAME = 'System Administrator';

async function recreateAdmin() {
  try {
    logger.info('=== Admin Recreation Script ===\n');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const emailArg = args.find((arg, i) => args[i - 1] === '--email' || arg.startsWith('--email='));
    const customEmail = emailArg?.replace('--email=', '') || DEFAULT_ADMIN_EMAIL;

    const passwordArg = args.find((arg, i) => args[i - 1] === '--password' || arg.startsWith('--password='));
    const customPassword = passwordArg?.replace('--password=', '') || DEFAULT_ADMIN_PASSWORD;

    logger.info(`Target email: ${customEmail}`);
    logger.info(`Password will be: ${customPassword === DEFAULT_ADMIN_PASSWORD ? '(default)' : '(custom)'}`);
    logger.info('');

    // Find or create the main store
    let mainStore = await db.query.stores.findFirst({
      where: (stores, { eq }) => eq(stores.code, 'MAIN-001'),
    });

    if (!mainStore) {
      logger.warn('⚠️  Main store not found. Creating it...');
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
      logger.info(`✅ Created store: ${mainStore.name}`);
    } else {
      logger.info(`✅ Found store: ${mainStore.name}`);
    }

    // Find super_admin role
    let superAdminRole = await db.query.roles.findFirst({
      where: eq(roles.name, 'super_admin'),
    });

    if (!superAdminRole) {
      logger.error('❌ super_admin role not found!');
      logger.error('   Please run migrations first: npm run db:migrate');
      await connection.end();
      process.exit(1);
    }

    logger.info(`✅ Found role: ${superAdminRole.name}`);

    // Check if admin user exists
    const existingAdmin = await db.query.users.findFirst({
      where: eq(users.email, customEmail),
    });

    let adminUser;

    if (existingAdmin) {
      logger.info(`📝 Admin user exists: ${existingAdmin.email}`);
      
      // Update password
      const newHash = await hashPassword(customPassword);
      const [updatedUser] = await db
        .update(users)
        .set({ 
          passwordHash: newHash,
          fullName: DEFAULT_ADMIN_NAME,
        })
        .where(eq(users.id, existingAdmin.id))
        .returning();
      
      adminUser = updatedUser;
      logger.info(`✅ Password updated for: ${adminUser.email}`);

      // Ensure super_admin role is assigned
      const existingRole = await db.query.userRoles.findFirst({
        where: (ur, { and, eq }) => and(
          eq(ur.userId, existingAdmin.id),
          eq(ur.roleId, superAdminRole.id),
        ),
      });

      if (!existingRole) {
        await db.insert(userRoles).values({
          userId: existingAdmin.id,
          roleId: superAdminRole.id,
          storeId: mainStore.id,
        });
        logger.info(`✅ Super admin role assigned`);
      } else {
        logger.info(`✅ Super admin role already assigned`);
      }
    } else {
      // Create new admin user
      logger.info('📝 Creating new admin user...');
      const hashedPassword = await hashPassword(customPassword);
      
      const [newUser] = await db
        .insert(users)
        .values({
          email: customEmail,
          passwordHash: hashedPassword,
          fullName: DEFAULT_ADMIN_NAME,
          phone: '+1234567890',
        })
        .returning();
      
      adminUser = newUser;
      logger.info(`✅ Created user: ${adminUser.email}`);

      // Assign super_admin role
      await db.insert(userRoles).values({
        userId: adminUser.id,
        roleId: superAdminRole.id,
        storeId: mainStore.id,
      });
      logger.info(`✅ Super admin role assigned`);
    }

    logger.info('\n=== Admin User Ready ===\n');
    logger.info(`Email:    ${adminUser.email}`);
    logger.info(`Password: ${customPassword}`);
    logger.info(`Role:     super_admin`);
    logger.info(`Store:    ${mainStore.name} (${mainStore.code})`);
    logger.info(`Store ID: ${mainStore.id}`);
    logger.info('\n⚠️  IMPORTANT: Change this password after first login!\n');

    await connection.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Admin recreation failed:', error);
    await connection.end();
    process.exit(1);
  }
}

recreateAdmin();
