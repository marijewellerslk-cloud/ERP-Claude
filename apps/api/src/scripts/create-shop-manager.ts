import { db } from '../config/database.js';
import { users, employees, stores, roles, userRoles } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../utils/password.js';

async function createShopManager() {
    try {
        console.log('Creating Shop Manager employee...\\n');

        // Get first store
        const allStores = await db.select().from(stores).limit(1);
        const store = allStores[0];
        console.log(`Using store: ${store.name} (${store.code})`);

        // Get store_manager role
        const shopManagerRole = await db.query.roles.findFirst({
            where: eq(roles.name, 'store_manager'),
        });

        if (!shopManagerRole) {
            console.error('Store Manager role not found. Please run the seed-roles script first.');
            process.exit(1);
        }

        // Check if user exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, 'john.smith@marijewellers.com'),
        });

        let user;
        if (existingUser) {
            console.log(`\\nUser already exists: ${existingUser.email}`);
            user = existingUser;
        } else {
            console.log('\\nCreating user account...');
            const hashedPassword = await hashPassword('Manager@123');

            const [newUser] = await db.insert(users).values({
                email: 'john.smith@marijewellers.com',
                passwordHash: hashedPassword,
                fullName: 'John Smith',
                phone: '+91 9876543210',
                isActive: true,
            }).returning();

            console.log(`Created user: ${newUser.email}`);
            user = newUser;
        }

        // Assign shop_manager role
        const existingUserRole = await db.query.userRoles.findFirst({
            where: (userRoles, { and, eq }) => and(
                eq(userRoles.userId, user.id),
                eq(userRoles.storeId, store.id),
                eq(userRoles.roleId, shopManagerRole.id)
            ),
        });

        if (!existingUserRole) {
            console.log('Assigning shop_manager role to user...');
            await db.insert(userRoles).values({
                userId: user.id,
                roleId: shopManagerRole.id,
                storeId: store.id,
            });
            console.log('Role assigned successfully!');
        } else {
            console.log('User already has shop_manager role for this store.');
        }

        // Create employee record
        const existingEmployee = await db.query.employees.findFirst({
            where: eq(employees.email, 'john.smith@marijewellers.com'),
        });

        if (!existingEmployee) {
            console.log('\\nCreating employee record...');
            const [newEmployee] = await db.insert(employees).values({
                storeId: store.id,
                employeeCode: 'EMP002',
                fullName: 'John Smith',
                email: 'john.smith@marijewellers.com',
                phone: '+91 9876543210',
                dateOfBirth: new Date('1990-01-15'),
                dateOfJoining: new Date('2024-01-01'),
                department: 'Operations',
                position: 'Store Manager',
                employmentType: 'Full Time',
                salary: '50000',
                userId: user.id,
            }).returning();

            console.log(`Created employee: ${newEmployee.fullName} (${newEmployee.employeeCode})`);
        } else {
            console.log('Employee record already exists.');
        }

        console.log('\\n✅ Shop Manager created successfully!');
        console.log('\\nLogin credentials:');
        console.log('Email: john.smith@marijewellers.com');
        console.log('Password: Manager@123');
        console.log(`Store: ${store.name}`);
        console.log(`Role: Shop Manager`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createShopManager();
