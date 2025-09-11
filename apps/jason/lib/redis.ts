import Redis from 'ioredis';

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  return 'redis://localhost:6379';
};

let redis: Redis | null = null;

try {
  redis = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
  });

  redis.on('error', (error) => {
    console.warn('Redis connection error (non-fatal):', error.message);
  });

  redis.on('connect', () => {
    console.log('Redis connected successfully');
  });
} catch (error) {
  console.warn('Redis initialization failed (non-fatal):', error);
}

export { redis };