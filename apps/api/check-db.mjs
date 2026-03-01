import { db, connection } from './src/config/database.js';
import { users } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

const user = await db.query.users.findFirst({
  where: eq(users.email, 'admin@marijewellers.com')
});

if (user) {
  console.log('✅ User exists');
  console.log('  Email:', user.email);
  console.log('  Name:', user.fullName);
  console.log('  Active:', user.isActive);
} else {
  console.log('❌ User NOT found');
}

await connection.end();
