import { config } from 'dotenv';
import { z } from 'zod';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the root of the monorepo
config({ path: resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.string().default('4000'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string(),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Security
  BCRYPT_SALT_ROUNDS: z.string().default('12'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = {
  ...parsed.data,
  API_PORT: parseInt(parsed.data.API_PORT),
  BCRYPT_SALT_ROUNDS: parseInt(parsed.data.BCRYPT_SALT_ROUNDS),
};

// SAFETY OVERRIDE: If running in test mode, force the database to be the test database
// This prevents accidental connection to production/dev database during tests
if (env.NODE_ENV === 'test') {
  const dbUrl = new URL(env.DATABASE_URL);
  // If the path doesn't end with _test, replace it
  if (!dbUrl.pathname.endsWith('_test') && !dbUrl.pathname.endsWith('test')) {
    // Check if we are already using a test-specific name
    const pathParts = dbUrl.pathname.split('/');
    const currentDbName = pathParts[pathParts.length - 1];

    if (currentDbName && !currentDbName.includes('test')) {
      pathParts[pathParts.length - 1] = 'mari_erp_test';
      dbUrl.pathname = pathParts.join('/');
      env.DATABASE_URL = dbUrl.toString();

      // Also update DATABASE_NAME if it's set in the parsed data (it's not in the schema currently but good for consistency)
      // Note: env object is what's exported and used by the app
      console.log(`🔒 TEST MODE: Switched database connection to ${env.DATABASE_URL}`);
    }
  }
}
