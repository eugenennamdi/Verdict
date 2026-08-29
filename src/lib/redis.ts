import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis };

const dummyRedis = {
  get: async () => null,
  set: async () => 'OK',
  incr: async () => 1,
  ttl: async () => -2,
  expire: async () => 1,
} as any;

export const redis =
  globalForRedis.redis ||
  (process.env.REDIS_URL 
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null }) 
    : dummyRedis);

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
