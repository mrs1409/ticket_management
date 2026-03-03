import { createClient } from 'redis';

let client: ReturnType<typeof createClient>;

export async function connectRedis(): Promise<void> {
  client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  client.on('error', (err) => console.error('[Redis] Error:', err));
  client.on('connect', () => console.log('[Redis] Connected successfully'));
  client.on('reconnecting', () => console.log('[Redis] Reconnecting...'));

  await client.connect();
}

export function getRedisClient(): ReturnType<typeof createClient> {
  if (!client) throw new Error('Redis not initialized. Call connectRedis() first.');
  return client;
}
