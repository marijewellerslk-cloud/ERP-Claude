import { db, connection } from './src/config/database.js';
import { users, userRoles } from './src/db/schema.js';
import { eq } from 'drizzle-orm';
import { verifyPassword } from './src/utils/password.js';

async function checkUser() {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, 'admin@marijewellers.com'),
    });
    
    if (!user) {
      console.log('❌ User not found!');
      await connection.end();
      return;
    }
    
    console.log('✅ User found:');
    console.log('  Email:', user.email);
    console.log('  Full Name:', user.fullName);
    console.log('  Active:', user.isActive);
    console.log('  Password Hash:', user.passwordHash.substring(0, 30) + '...');
    
    // Check password
    const isValid = await verifyPassword('Admin@123', user.passwordHash);
    console.log('\n🔐 Password "Admin@123" is:', isValid ? '✅ VALID' : '❌ INVALID');
    
    // Check stores
    const roles = await db.query.userRoles.findMany({
      where: eq(userRoles.userId, user.id),
      with: { store: true, role: true }
    });
    
    console.log('\n🏪 Assigned Stores:');
    roles.forEach(r => {
      console.log(`  - ${r.store.name} (${r.role.name})`);
    });
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error);
    await connection.end();
  }
}

checkUser();
