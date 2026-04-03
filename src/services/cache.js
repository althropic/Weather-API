/**
 * Redis Cache Service
 * Handles caching with automatic expiration using Redis
 */
const Redis = require('ioredis');
const config = require('../config');

let redisClient = null;

/**
 * Get Redis client instance (singleton pattern)
 * @returns {Redis} Redis client instance
 */
function getClient() {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('error', (error) => {
      console.error('Redis connection error:', error.message);
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });
  }
  return redisClient;
}

/**
 * Get cached value by key
 * @param {string} key - Cache key
 * @returns {Promise<Object|null>} Parsed cached value or null if not found
 */
async function get(key) {
  try {
    const client = getClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Cache get error:', error.message);
    return null;
  }
}

/**
 * Set cache value with expiration
 * Uses Redis EX flag for automatic expiration
 * @param {string} key - Cache key
 * @param {Object} value - Value to cache
 * @param {number} ttl - Time to live in seconds (defaults to config value)
 * @returns {Promise<boolean>} Success status
 */
async function set(key, value, ttl = config.cache.ttl) {
  try {
    const client = getClient();
    await client.set(key, JSON.stringify(value), 'EX', ttl);
    return true;
  } catch (error) {
    console.error('Cache set error:', error.message);
    return false;
  }
}

/**
 * Delete cached value by key
 * @param {string} key - Cache key to delete
 * @returns {Promise<boolean>} Success status
 */
async function del(key) {
  try {
    const client = getClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error.message);
    return false;
  }
}

/**
 * Check if key exists in cache
 * @param {string} key - Cache key to check
 * @returns {Promise<boolean>} Whether key exists
 */
async function exists(key) {
  try {
    const client = getClient();
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    console.error('Cache exists error:', error.message);
    return false;
  }
}

/**
 * Close Redis connection gracefully
 * @returns {Promise<void>}
 */
async function disconnect() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
async function getStats() {
  try {
    const client = getClient();
    const info = await client.info('stats');
    return { connected: client.status === 'ready', info };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

module.exports = {
  getClient,
  get,
  set,
  del,
  exists,
  disconnect,
  getStats,
};