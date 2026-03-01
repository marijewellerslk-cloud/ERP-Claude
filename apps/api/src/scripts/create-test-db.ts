import postgres from 'postgres';
import { env } from 'process';
import dotenv from 'dotenv';

dotenv.config();

async function createTestDb() {
    const adminUrl = process.env.DATABASE_URL;
    if (!adminUrl) {
        throw new Error('DATABASE_URL not set');
    }

    console.log('Connecting to admin DB...');
    // Connect to postgres or the dev db to create new db
    const sql = postgres(adminUrl, { max: 1 });

    try {
        console.log('Dropping mari_erp_test if exists...');
        // We need to terminate connections first usually, but let's try force drop if postgres supports it or just drop
        // Actually, we might need to kick users off.
        await sql`DROP DATABASE IF EXISTS mari_erp_test WITH (FORCE)`;

        console.log('Creating mari_erp_test...');
        await sql`CREATE DATABASE mari_erp_test`;
        console.log('Database created.');
    } catch (e) {
        console.error('Error creating DB:', e);
        // Fallback if FORCE not supported
        try {
            await sql`DROP DATABASE IF EXISTS mari_erp_test`;
            await sql`CREATE DATABASE mari_erp_test`;
            console.log('Database created (fallback).');
        } catch (e2) {
            console.error('Error creating DB (fallback):', e2);
            process.exit(1);
        }
    } finally {
        await sql.end();
    }
}

createTestDb();
