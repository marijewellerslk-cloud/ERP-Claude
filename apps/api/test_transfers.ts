import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./src/db/schema";
import { and, eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(queryClient, { schema });

async function getStockTransfers() {
    console.log("Checking all inventoryTransfers in the database using exact service logic...");
    try {
        const allStores = await db.query.stores.findMany();

        for (const store of allStores) {
            console.log(`\n\n=== Store: ${store.name} (${store.id}) ===`);

            // Simulate inbound logic
            const inbound = await db.query.inventoryTransfers.findMany({
                where: and(eq(schema.inventoryTransfers.destinationStoreId, store.id)),
                with: { sourceStore: true, destinationStore: true }
            });

            console.log(`Inbound count: ${inbound.length}`);
            if (inbound.length > 0) inbound.forEach(t => console.log(`  <- ${t.transferNumber} [From: ${t.sourceStore.name}]`));

            // Simulate outbound logic
            const outbound = await db.query.inventoryTransfers.findMany({
                where: and(eq(schema.inventoryTransfers.sourceStoreId, store.id)),
                with: { sourceStore: true, destinationStore: true }
            });

            console.log(`Outbound count: ${outbound.length}`);
            if (outbound.length > 0) outbound.forEach(t => console.log(`  -> ${t.transferNumber} [To: ${t.destinationStore.name}]`));

        }

    } catch (err) {
        console.error("Database query failed:", err);
    } finally {
        queryClient.end();
    }
}

getStockTransfers();
