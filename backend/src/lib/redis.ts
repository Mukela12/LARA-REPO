import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn('REDIS_URL not set, Redis features will be disabled');
}

export const redis = redisUrl ? new Redis(redisUrl) : null;

// Session TTL: 48 hours
export const SESSION_TTL = 48 * 60 * 60;

// Helper functions for session data
export const sessionKeys = {
  meta: (sessionId: string) => `session:${sessionId}:meta`,
  students: (sessionId: string) => `session:${sessionId}:students`,
  submission: (sessionId: string, studentId: string) => `session:${sessionId}:submissions:${studentId}`,
};

export default redis;
