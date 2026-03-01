
import { db, connection } from '../config/database.js';
import { users, stores, roles, userRoles } from '../db/schema.js';
import { hashPassword } from '../utils/password.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

async function repairAdminAccess() {
    try {
        logger.info('Starting Admin Access Repair...');

        // 1. Ensure Main Store
        let store = await db.query.stores.findFirst({
            where: eq(stores.code, 'MAIN-001'),
        });

        if (!store) {
            logger.info('Creating missing MAIN-001 store...');
            [store] = await db.insert(stores).values({
                name: 'MARI Jewellers - Main Store',
                code: 'MAIN-001',
                isActive: true,
            }).returning();
        }
        logger.info(`✅ Store: ${store.id}`);

        // 2. Ensure Super Admin Role
        let role = await db.query.roles.findFirst({
            where: eq(roles.name, 'super_admin'),
        });

        if (!role) {
            logger.info('Creating missing super_admin role...');
            [role] = await db.insert(roles).values({
                name: 'super_admin',
                description: 'Full system access',
            }).returning();
        }
        logger.info(`✅ Role: ${role.id}`);

        // 3. Ensure Admin User
        const email = 'admin@marijewellers.com';
        const password = 'password123';
        const hashedPassword = await hashPassword(password);

        let user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (user) {
            logger.info('Updating existing admin password...');
            await db.update(users)
                .set({ passwordHash: hashedPassword, isActive: true })
                .where(eq(users.email, email));
            // Refetch to get latest state
            user = await db.query.users.findFirst({ where: eq(users.email, email) });
        } else {
            logger.info('Creating missing admin user...');
            [user] = await db.insert(users).values({
                email,
                passwordHash: hashedPassword,
                fullName: 'System Administrator',
                isActive: true,
            }).returning();
        }
        logger.info(`✅ User: ${user.id}`);

        // 4. Ensure Role Assignment
        const userRole = await db.query.userRoles.findFirst({
            where: and(
                eq(userRoles.userId, user!.id),
                eq(userRoles.roleId, role!.id),
                eq(userRoles.storeId, store!.id)
            ),
        });

        if (!userRole) {
            logger.info('Assigning super_admin role to user...');
            await db.insert(userRoles).values({
                userId: user!.id,
                roleId: role!.id,
                storeId: store!.id,
            });
        }
        logger.info('✅ Role assigned.');

        logger.info('=== Repair Complete ===');
        logger.info(`Email: ${email}`);
        logger.info(`Password: ${password}`);

    } catch (error) {
        logger.error('Error repairing admin access:', error);
    } finally {
        await connection.end();
    }
}

repairAdminAccess();
