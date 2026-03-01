import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../../apps/api/src/config/env";
import * as schema from "../../apps/api/src/db/schema";
import { and, eq } from "drizzle-orm";

const queryClient = postgres(env.DATABASE_URL);
const db = drizzle(queryClient, { schema });

async function getStockTransfers() {
    console.log("Checking all inventoryTransfers in the database...");
    try {
        const results = await db.query.inventoryTransfers.findMany({
            with: {
                sourceStore: true,
                destinationStore: true,
                items: true
            }
        });

        console.log(`Found ${results.length} transfers in DB.`);
        results.forEach(t => {
            console.log(`> ID: ${t.id}`);
            console.log(`> Transfer Number: ${t.transferNumber}`);
            console.log(`> Status: ${t.status}`);
            console.log(`> Source Store ID: ${t.sourceStoreId} (${t.sourceStore?.name})`);
            console.log(`> Destination Store ID: ${t.destinationStoreId} (${t.destinationStore?.name})`);
            console.log(`> Items Count: ${t.items.length}`);
            console.log('---');
        });

    } catch (err) {
        console.error("Database query failed:", err);
    } finally {
        queryClient.end();
    }
}

getStockTransfers();
