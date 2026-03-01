import { db } from '../config/database.js';
import { stores, inventoryItems } from '../db/schema.js';
import { metalAccountingService } from '../services/metal-accounting.service.js';
import { eq, sql } from 'drizzle-orm';

async function main() {
    console.log('Starting Metal Position Reproduction...');

    try {
        // 1. Get all active stores
        const activeStores = await db.select().from(stores).where(eq(stores.isActive, true));
        console.log(`Found ${activeStores.length} active stores.`);

        if (activeStores.length === 0) {
            console.log('No active stores found. Cannot proceed.');
            return;
        }

        // 2. Check raw inventory data for the first store
        const store = activeStores[0];
        console.log(`Checking store: ${store.name} (${store.id})`);

        const rawInventory = await db
            .select({
                count: sql<number>`count(*)`,
                totalNetWeight: sql<number>`sum(${inventoryItems.netWeight})`,
                totalFineGold: sql<number>`sum(${inventoryItems.fineGoldEquivalent})`,
                nullFineGoldCount: sql<number>`sum(case when ${inventoryItems.fineGoldEquivalent} is null then 1 else 0 end)`,
                itemsWithGoldMetalType: sql<number>`sum(case when ${inventoryItems.metalType} = 'gold' then 1 else 0 end)`,
                itemsWithGoldMetalTypeParams: sql<number>`sum(case when lower(${inventoryItems.metalType}) = 'gold' then 1 else 0 end)`,
            })
            .from(inventoryItems)
            .where(eq(inventoryItems.storeId, store.id));

        console.log('Raw Inventory Data Check:', rawInventory[0]);

        // 3. Call the service method
        console.log('Calling metalAccountingService.getMetalPosition...');
        const result = await metalAccountingService.getMetalPosition(store.id);

        console.log('Service Result Summary:');
        console.log(JSON.stringify(result, null, 2));

        // 4. Validate
        if (result.stores.length === 0) {
            console.error('ERROR: No store positions returned.');
        } else {
            const position = result.stores[0];
            console.log('Inventory Gold Total Fine Gold:', position.inventoryGold.totalFineGold);

            const rawFineGold = parseFloat(rawInventory[0].totalFineGold?.toString() || '0');

            if (Math.abs(position.inventoryGold.totalFineGold - rawFineGold) > 0.01) {
                console.warn('WARNING: Service calculation differs from raw DB sum (might be due to filtering active/available items vs all items)');
            } else {
                console.log('SUCCESS: Service matches raw DB sum (approx).');
            }
        }

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        process.exit(0);
    }
}

main();
