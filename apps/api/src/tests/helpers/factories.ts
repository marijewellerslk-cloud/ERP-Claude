import { db } from '../../config/database';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_PASSWORD = 'password123';
const SALT_ROUNDS = 10;

import { hashPassword } from '../../utils/password';

export class TestFactory {
    static async createStore(overrides: Partial<typeof schema.stores.$inferInsert> = {}) {
        const [store] = await db.insert(schema.stores).values({
            name: 'Test Store',
            code: `TEST-${uuidv4().substring(0, 8)}`,
            isActive: true,
            ...overrides,
        }).returning();
        return store;
    }

    static async createRole(overrides: Partial<typeof schema.roles.$inferInsert> = {}) {
        // Check if role exists first to avoid duplicates if not cleaned
        if (overrides.name) {
            const existing = await db.query.roles.findFirst({
                where: eq(schema.roles.name, overrides.name)
            });
            if (existing) return existing;
        }

        const [role] = await db.insert(schema.roles).values({
            name: `test_role_${uuidv4()}`,
            description: 'Test Role',
            ...overrides,
        }).returning();
        return role;
    }

    static async createUser(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
        // Use the same rounds as defined in setup.ts for consistency
        const hashedPassword = await bcrypt.hash(overrides.passwordHash || DEFAULT_PASSWORD, 10);

        const [user] = await db.insert(schema.users).values({
            email: `test-${uuidv4()}@example.com`,
            fullName: 'Test User',
            isActive: true,
            ...overrides,
            passwordHash: hashedPassword, // Ensure this overwrites any value in overrides
        }).returning();

        return { ...user, plainPassword: overrides.passwordHash || DEFAULT_PASSWORD };
    }

    static async assignRole(userId: string, roleId: string, storeId: string, overrides: Partial<typeof schema.userRoles.$inferInsert> = {}) {
        const [userRole] = await db.insert(schema.userRoles).values({
            userId,
            roleId,
            storeId,
            ...overrides
        }).returning();
        return userRole;
    }

    static generateToken(user: typeof schema.users.$inferSelect) {
        return jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );
    }

    static async createSupplier(storeId: string, overrides: Partial<typeof schema.suppliers.$inferInsert> = {}) {
        const [supplier] = await db.insert(schema.suppliers).values({
            storeId,
            supplierCode: `SUP-${uuidv4().substring(0, 8)}`,
            businessName: 'Test Supplier',
            phone: '1234567890',
            isActive: true,
            ...overrides,
        }).returning();
        return supplier;
    }

    static async createCustomer(storeId: string, overrides: Partial<typeof schema.customers.$inferInsert> = {}) {
        const [customer] = await db.insert(schema.customers).values({
            storeId,
            customerCode: `CUST-${uuidv4().substring(0, 8)}`,
            firstName: 'Test',
            lastName: 'Customer',
            phone: '9876543210',
            isActive: true,
            ...overrides,
        }).returning();
        return customer;
    }
}
