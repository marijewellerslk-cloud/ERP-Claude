import { db } from '../config/database.js';
import { users, stores, roles, userRoles } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../utils/password.js';

async function createTestUser() {
    try {
        console.log('Checking existing data...\n');

        // Get first store
        const allStores = await db.select().from(stores).limit(1);
        if (allStores.length === 0) {
            console.log('No stores found. Creating a test store...');
            const [newStore] = await db.insert(stores).values({
                name: 'Main Store',
                code: 'MAIN-001',
                address: '123 Main Street',
                isActive: true,
            }).returning();
            console.log(`Created store: ${newStore.name} (${newStore.code})`);
            allStores.push(newStore);
        }

        const store = allStores[0];
        console.log(`Using store: ${store.name} (${store.code})`);

        // Get superadmin role
        const superadminRole = await db.query.roles.findFirst({
            where: eq(roles.name, 'superadmin'),
        });

        if (!superadminRole) {
            console.error('Superadmin role not found. Please run the seed-roles script first.');
            process.exit(1);
        }

        // Check if test user exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, 'admin@marijewellers.com'),
        });

        let user;
        if (existingUser) {
            console.log(`\nUser already exists: ${existingUser.email}`);
            user = existingUser;
        } else {
            console.log('\nCreating test user...');
            const hashedPassword = await hashPassword('Admin@123');

            const [newUser] = await db.insert(users).values({
                email: 'admin@marijewellers.com',
                passwordHash: hashedPassword,
                fullName: 'System Administrator',
                phone: '+91 9876543210',
                isActive: true,
            }).returning();

            console.log(`Created user: ${newUser.email}`);
            user = newUser;
        }

        // Check if user role exists
        const existingUserRole = await db.query.userRoles.findFirst({
            where: (userRoles, { and, eq }) => and(
                eq(userRoles.userId, user.id),
                eq(userRoles.storeId, store.id),
                eq(userRoles.roleId, superadminRole.id)
            ),
        });

        if (!existingUserRole) {
            console.log('Assigning superadmin role to user...');
            await db.insert(userRoles).values({
                userId: user.id,
                roleId: superadminRole.id,
                storeId: store.id,
            });
            console.log('Role assigned successfully!');
        } else {
            console.log('User already has superadmin role for this store.');
        }

        console.log('\n✅ Setup complete!');
        console.log('\nLogin credentials:');
        console.log('Email: admin@marijewellers.com');
        console.log('Password: Admin@123');
        console.log(`Store: ${store.name}`);
        console.log(`Store ID: ${store.id}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createTestUser();
