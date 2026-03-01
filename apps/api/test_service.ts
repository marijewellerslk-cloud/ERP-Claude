import * as fs from 'fs';
import * as path from 'path';

// Let's create a small script that fetches the transfers using a mock fetch or axios
// First we need to get a token. We can peek into local storage or auth store.
// Alternatively, since we have DB access, we can mint a token or just call the service directly with mock req object.

import { inventoryService } from './src/modules/inventory/inventory.service';
import { stores } from './src/db/schema';
import { db } from './src/db';
import { eq } from 'drizzle-orm';

async function testServiceCall() {
    console.log("Testing inventoryService.getTransfers directly...");
    try {
        // 1. Get all stores
        const allStores = await db.select().from(stores);
        console.log(`Found ${allStores.length} stores.`);

        // 2. For each store, test inbound and outbound
        for (const store of allStores) {
            console.log(`\n--- Store: ${store.name} (${store.id}) ---`);

            const inbound = await inventoryService.getTransfers(store.id, { type: 'inbound' });
            console.log(`Inbound transfers: ${inbound.length}`);
            if (inbound.length > 0) {
                console.log(inbound.map(t => `${t.transferNumber} (From: ${t.sourceStore.name})`));
            }

            const outbound = await inventoryService.getTransfers(store.id, { type: 'outbound' });
            console.log(`Outbound transfers: ${outbound.length}`);
            if (outbound.length > 0) {
                console.log(outbound.map(t => `${t.transferNumber} (To: ${t.destinationStore.name})`));
            }
        }
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

testServiceCall();
