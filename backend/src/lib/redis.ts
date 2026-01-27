import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn('REDIS_URL not set, Redis features will be disabled');
}

export const redis = redisUrl ? new Redis(redisUrl) : null;

// Session TTL: 16 hours (student data is temporary)
export const SESSION_TTL = 16 * 60 * 60;

// Redis requirement helper for live session operations
export class RedisUnavailableError extends Error {
  constructor() {
    super('Redis is required for live session operations');
    this.name = 'RedisUnavailableError';
  }
}

export function requireRedis() {
  if (!redis) throw new RedisUnavailableError();
  return redis;
}

// Helper functions for session data
export const sessionKeys = {
  meta: (sessionId: string) => `session:${sessionId}:meta`,
  students: (sessionId: string) => `session:${sessionId}:students`,
  submission: (sessionId: string, studentId: string) => `session:${sessionId}:submissions:${studentId}`,
};

export default redis;
