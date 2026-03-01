import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, connection } from '../config/database.js';
import { logger } from '../utils/logger.js';

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    await migrate(db, {
      migrationsFolder: './src/db/migrations',
    });

    logger.info('✅ Migrations completed successfully');

    await connection.end();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    await connection.end();
    process.exit(1);
  }
}

runMigrations();
