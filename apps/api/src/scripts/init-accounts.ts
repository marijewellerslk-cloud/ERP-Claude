import { db } from '../config/database.js';
import { stores } from '../db/schema.js';
import { accountingService } from '../modules/accounting/accounting.service.js';
import { logger } from '../utils/logger.js';

async function initAccounts() {
    const allStores = await db.select().from(stores);

    for (const store of allStores) {
        logger.info(`Checking store: ${store.name}`);
        try {
            await accountingService.initializeChartOfAccounts(store.id);
            logger.info(`✅ Successfully initialized accounts for ${store.name}`);
        } catch (err: any) {
            if (err.message?.includes('already initialized')) {
                logger.info(`ℹ️ Accounts already exist for ${store.name}`);
            } else {
                logger.error(`❌ Error initializing accounts for ${store.name}:`, err);
            }
        }
    }

    process.exit(0);
}

initAccounts();
