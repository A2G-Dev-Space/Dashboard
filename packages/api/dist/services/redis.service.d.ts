/**
 * Redis Service
 *
 * Handles Redis connection and caching operations
 */
import { Redis } from 'ioredis';
/**
 * Create Redis client with configuration
 */
export declare function createRedisClient(): Redis;
/**
 * Get active user count (users active in last 5 minutes)
 */
export declare function getActiveUserCount(redis: Redis): Promise<number>;
/**
 * Track active user (record user activity)
 */
export declare function trackActiveUser(redis: Redis, userId: string): Promise<void>;
/**
 * Get today's usage stats
 */
export declare function getTodayUsage(redis: Redis): Promise<{
    requests: number;
    inputTokens: number;
    outputTokens: number;
}>;
/**
 * Increment usage stats (per user/model and daily total)
 */
export declare function incrementUsage(redis: Redis, userId: string, modelId: string, inputTokens: number, outputTokens: number): Promise<void>;
/**
 * Increment today's usage stats (legacy function for compatibility)
 */
export declare function incrementTodayUsage(redis: Redis, inputTokens: number, outputTokens: number): Promise<void>;
//# sourceMappingURL=redis.service.d.ts.map