
import { db } from '../config/database.js';
import { inventoryBatches } from '../db/schema.js';
import { desc } from 'drizzle-orm';

async function getLatestBatch() {
    try {
        const batch = await db.select().from(inventoryBatches).orderBy(desc(inventoryBatches.createdAt)).limit(1);
        if (batch.length > 0) {
            console.log(JSON.stringify(batch[0], null, 2));
        } else {
            console.log('No batches found');
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

getLatestBatch();
