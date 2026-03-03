import { Queue } from 'bullmq';

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

const redisConnection = {
  host: (() => {
    try {
      const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
      return url.hostname;
    } catch { return 'localhost'; }
  })(),
  port: (() => {
    try {
      const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
      return parseInt(url.port || '6379', 10);
    } catch { return 6379; }
  })(),
  password: (() => {
    try {
      const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
      return url.password || undefined;
    } catch { return undefined; }
  })(),
  tls: (process.env.REDIS_URL || '').startsWith('rediss://') ? {} : undefined,
};

export const ticketQueue = new Queue('ticket-classification', { connection: redisConnection });
export const escalationQueue = new Queue('auto-escalation', { connection: redisConnection });
export const emailQueue = new Queue('email-notifications', { connection: redisConnection });
export const cleanupQueue = new Queue('cleanup-archive', { connection: redisConnection });

export { redisConnection };
export { connection as queueConnection };
