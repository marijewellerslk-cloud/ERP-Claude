import { db, connection } from '../config/database.js';
import { stores } from '../db/schema.js';

async function getStoreId() {
  try {
    const [store] = await db.select().from(stores).limit(1);

    if (store) {
      console.log('\n📦 Store Information:');
      console.log(`   ID: ${store.id}`);
      console.log(`   Name: ${store.name}`);
      console.log(`   Code: ${store.code}`);
      console.log('');
    } else {
      console.log('No stores found');
    }

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await connection.end();
    process.exit(1);
  }
}

getStoreId();
