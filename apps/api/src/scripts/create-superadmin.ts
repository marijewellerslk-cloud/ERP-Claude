import { db, connection } from '../config/database.js';
import { users, stores, roles, userRoles, permissions, rolePermissions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../utils/password.js';

async function createSuperAdmin() {
  try {
    console.log('Creating Super Admin account...\n');

    // ── 1. Ensure superadmin role exists ────────────────────────────
    let superAdminRole = await db.query.roles.findFirst({
      where: eq(roles.name, 'super_admin'),
    });
    if (!superAdminRole) {
      superAdminRole = await db.query.roles.findFirst({
        where: eq(roles.name, 'superadmin'),
      });
    }
    if (!superAdminRole) {
      // Create the role if it doesn't exist at all
      console.log('Creating superadmin role...');
      const [created] = await db.insert(roles).values({
        name: 'superadmin',
        description: 'Full system access across all stores and system settings',
      }).returning();
      superAdminRole = created;
    }
    console.log(`Role: ${superAdminRole.name} (${superAdminRole.id})`);

    // ── 2. Ensure at least one store exists ─────────────────────────
    let allStores = await db.select().from(stores);
    if (allStores.length === 0) {
      console.log('No stores found — creating default store...');
      const [newStore] = await db.insert(stores).values({
        name: 'MARI Jewellers - Main Store',
        code: 'MAIN-001',
        address: '123 Jewelry Street, City, Country',
        phone: '+1234567890',
        email: 'main@marijewellers.com',
        isActive: true,
      }).returning();
      allStores = [newStore];
      console.log(`✅ Created store: ${newStore.name} (${newStore.code})`);
    }

    // ── 3. Create or find the superadmin user ───────────────────────
    const email = 'superadmin@marijewellers.com';
    const password = 'SuperAdmin@123';

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    let user;
    if (existingUser) {
      console.log(`User already exists: ${existingUser.email}`);
      // Reset password to ensure it matches
      const hashedPassword = await hashPassword(password);
      await db.update(users).set({ passwordHash: hashedPassword, isActive: true }).where(eq(users.id, existingUser.id));
      console.log('  Password has been reset to default.');
      user = existingUser;
    } else {
      console.log('Creating superadmin user account...');
      const hashedPassword = await hashPassword(password);

      const [newUser] = await db.insert(users).values({
        email,
        passwordHash: hashedPassword,
        fullName: 'Super Administrator',
        phone: '+1234567890',
        isActive: true,
      }).returning();

      console.log(`✅ Created user: ${newUser.email}`);
      user = newUser;
    }

    // ── 4. Assign superadmin role for ALL stores ────────────────────
    let rolesAssigned = 0;
    for (const store of allStores) {
      const existingUserRole = await db.query.userRoles.findFirst({
        where: (ur, { and, eq }) => and(
          eq(ur.userId, user.id),
          eq(ur.storeId, store.id),
          eq(ur.roleId, superAdminRole.id)
        ),
      });

      if (!existingUserRole) {
        await db.insert(userRoles).values({
          userId: user.id,
          roleId: superAdminRole.id,
          storeId: store.id,
          canManipulateInventory: true,
        });
        rolesAssigned++;
        console.log(`  ✅ Assigned superadmin role for store: ${store.name} (${store.code})`);
      } else {
        console.log(`  ℹ Already has superadmin role for store: ${store.name} (${store.code})`);
      }
    }

    console.log(`\n✅ Super Admin account ready!`);
    console.log(`   Roles assigned to ${rolesAssigned} store(s)\n`);
    console.log('╔═══════════════════════════════════════╗');
    console.log('║        LOGIN CREDENTIALS              ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log(`║  Email:    ${email}  `);
    console.log(`║  Password: ${password}            `);
    console.log('╚═══════════════════════════════════════╝');
    console.log('');

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating superadmin:', error);
    await connection.end();
    process.exit(1);
  }
}

createSuperAdmin();
