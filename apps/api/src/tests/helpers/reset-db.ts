import { sql } from 'drizzle-orm';
import { db } from '../../config/database';

export async function resetDb() {
    // CRITICAL SAFETY CHECK
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('CRITICAL SAFETY: resetDb can only be called in test environment');
    }

    // EMERGENCY FIX: Check DATABASE_NAME to ensure we never wipe production
    // The previous check only checked NODE_ENV, which might be 'test' even when connected to prod DB via .env
    const dbName = process.env.DATABASE_NAME || '';
    const dbUrl = process.env.DATABASE_URL || '';

    // Strict check: DB name MUST contain "test" to be wiped
    const isTestDb = dbName.toLowerCase().includes('test') || dbUrl.toLowerCase().includes('test');

    if (!isTestDb) {
        console.error('🛑 EMERGENCY SAFETY STOP: Attempted to reset database that does not look like a test database.');
        console.error('   Current DATABASE_NAME:', dbName);
        console.error('   Current NODE_ENV:', process.env.NODE_ENV);
        throw new Error(`SAFETY ERROR: refuse to reset database "${dbName}" because it does not contain "test" in the name.`);
    }

    // Suppress NOTICE messages about cascading truncates
    await db.execute(sql`SET client_min_messages TO WARNING`);

    // Targeted truncate to avoid deadlocks. Add other tables here as needed for other modules.
    const tables = [
        'sessions',
        'user_roles',
        'role_permissions',
        'permissions',
        'users',
        'stock_movements',
        'inventory_transfer_items',
        'inventory_transfers',
        'stock_levels',
        'inventory_batch_items',
        'inventory_batches',
        'stones',
        'inventory_items',
        'inventory_categories',
        'suppliers',
        'customers',
        'roles',
        'stores'
    ];
    await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`));
}
