import { createClient } from 'redis';
import { env } from './env.js';

export const redis = createClient({
  url: env.REDIS_URL,
});

redis.on('error', (err) => console.error('Redis Client Error:', err));
redis.on('connect', () => console.log('✅ Redis connected successfully'));

export async function connectRedis() {
  try {
    await redis.connect();
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    return false;
  }
}

export async function disconnectRedis() {
  await redis.quit();
}
