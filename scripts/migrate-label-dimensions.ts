import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { Client } from 'pg';

// For environments where we can't use dynamic imports
async function runMigration() {
  console.log('Starting label template schema migration...');
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    
    // Run the migration SQL directly
    await client.query(`
      ALTER TABLE label_templates 
      ALTER COLUMN label_width TYPE DECIMAL(5,2),
      ALTER COLUMN label_height TYPE DECIMAL(5,2),
      ALTER COLUMN page_width TYPE DECIMAL(5,2),
      ALTER COLUMN page_height TYPE DECIMAL(5,2),
      ALTER COLUMN margin_top TYPE DECIMAL(5,2),
      ALTER COLUMN margin_bottom TYPE DECIMAL(5,2),
      ALTER COLUMN margin_left TYPE DECIMAL(5,2),
      ALTER COLUMN margin_right TYPE DECIMAL(5,2),
      ALTER COLUMN horizontal_spacing TYPE DECIMAL(5,2),
      ALTER COLUMN vertical_spacing TYPE DECIMAL(5,2),
      ALTER COLUMN header_font_size TYPE DECIMAL(5,2),
      ALTER COLUMN border_width TYPE DECIMAL(5,2),
      ALTER COLUMN border_radius TYPE DECIMAL(5,2);
    `);
    
    console.log('Label template schema migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
runMigration().catch(console.error);