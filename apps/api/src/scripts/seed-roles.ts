
import { db } from '../config/database.js';
import { roles, permissions, rolePermissions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { fileURLToPath } from 'url';

const REQUIRED_ROLES = [
    {
        name: 'superadmin',
        description: 'System Administrator with full access',
        permissions: ['*:*'],
    },
    {
        name: 'owner',
        description: 'Business Owner (Read-Only)',
        permissions: [
            // Stores
            'stores:read',
            // Employees (HRM)
            'employees:read', 'attendance:read', 'leave:read', 'payroll:read',
            // Inventory
            'inventory:read',
            // Sales
            'sales:read',
            // Customers & Leads
            'customers:read',
            // Suppliers
            'suppliers:read',
            // Accounting
            'accounting:read',
            // Reports
            'reports:read',
            // Settings
            'settings:read', // Assuming settings:read exists or we might need to add it if it doesn't
        ],
    },
    {
        name: 'general_manager',
        description: 'General Manager overseeing all operations',
        permissions: [
            // Stores
            'stores:read', 'stores:create', 'stores:update', 'stores:delete',
            // Employees (HRM)
            'employees:read', 'employees:create', 'employees:update', 'employees:delete',
            'attendance:read', 'attendance:create',
            'leave:read', 'leave:create', 'leave:approve',
            'payroll:read', 'payroll:create', 'payroll:update', 'payroll:approve', 'payroll:pay',
            // Inventory
            'inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete',
            // Sales
            'sales:read', 'sales:create', 'sales:update', 'sales:delete',
            // Customers & Leads
            'customers:read', 'customers:create', 'customers:update', 'customers:delete',
            // Suppliers
            'suppliers:read', 'suppliers:create', 'suppliers:update', 'suppliers:delete',
            // Accounting
            'accounting:read', 'accounting:create', 'accounting:update', 'accounting:delete',
            // Reports
            'reports:read',
        ],
    },
    {
        name: 'store_manager', // Changed from shop_manager to match DB
        description: 'Manager of a specific store',
        permissions: [
            'stores:read',
            // HRM (Partial)
            'employees:read', 'employees:create', 'employees:update',
            'attendance:read', 'attendance:create',
            'leave:read', 'leave:create', 'leave:approve',
            // Inventory
            'inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete',
            // Sales
            'sales:read', 'sales:create', 'sales:update', 'sales:delete',
            // Customers
            'customers:read', 'customers:create', 'customers:update',
            // Reports
            'reports:read',
        ],
    },
    {
        name: 'accountant',
        description: 'Financial Accountant',
        permissions: [
            'accounting:read', 'accounting:create', 'accounting:update', 'accounting:delete',
            'sales:read',
            'inventory:read',
            'payroll:read', 'payroll:create', 'payroll:update',
            'reports:read',
        ],
    },
    {
        name: 'sales_agent',
        description: 'Sales Representative',
        permissions: [
            'sales:create', 'sales:read',
            'inventory:read',
            'customers:create', 'customers:read',
            // Loans (if using separate resource, but assuming basic sales include customer interactions)
        ],
    },
    {
        name: 'stock_controller',
        description: 'Inventory and Stock Controller',
        permissions: [
            'inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete',
            'suppliers:read', 'suppliers:create', 'suppliers:update',
        ],
    },
];

async function seedRoles() {
    logger.info('Seeding roles and permissions...');

    for (const roleData of REQUIRED_ROLES) {
        // 1. Create or Update Role
        let roleId: string;
        const existingRole = await db.query.roles.findFirst({
            where: eq(roles.name, roleData.name),
        });

        if (existingRole) {
            roleId = existingRole.id;
            logger.info(`Role ${roleData.name} already exists.`);
        } else {
            const [newRole] = await db.insert(roles).values({
                name: roleData.name,
                description: roleData.description,
            }).returning();
            roleId = newRole.id;
            logger.info(`Created role ${roleData.name}.`);
        }

        // 2. Ensure Permissions Exist and Assign to Role
        for (const permString of roleData.permissions) {
            let resource = permString;
            let action = '*';

            if (permString.includes(':')) {
                const parts = permString.split(':');
                resource = parts[0];
                action = parts[1];
            }

            // Check if permission exists
            let permissionId: string;
            const existingPerm = await db.query.permissions.findFirst({
                where: (permissions, { and, eq }) => and(
                    eq(permissions.resource, resource),
                    eq(permissions.action, action)
                ),
            });

            if (existingPerm) {
                permissionId = existingPerm.id;
                // logger.info(`Permission ${permString} already exists.`);
            } else {
                const [newPerm] = await db.insert(permissions).values({
                    resource,
                    action,
                    description: `Permission to ${action} ${resource}`,
                }).returning();
                permissionId = newPerm.id;
                logger.info(`Created permission ${permString}.`);
            }

            // 3. Link Role to Permission (idempotent)
            const existingLink = await db.query.rolePermissions.findFirst({
                where: (rolePermissions, { and, eq }) => and(
                    eq(rolePermissions.roleId, roleId),
                    eq(rolePermissions.permissionId, permissionId)
                ),
            });

            if (!existingLink) {
                await db.insert(rolePermissions).values({
                    roleId,
                    permissionId,
                });
                logger.info(`Assigned ${permString} to ${roleData.name}`);
            }
        }
    }

    logger.info('Roles and permissions seeded successfully.');
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    seedRoles()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

export { seedRoles };
