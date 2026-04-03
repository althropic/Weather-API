/**
 * Rate Limiting Middleware
 * Protects the API from abuse using express-rate-limit
 */
const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Create a standard rate limiter for general API endpoints
 * Limits the number of requests per IP within a time window
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 minutes by default
  max: config.rateLimit.max, // max requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Custom key generator (can be customized for your needs)
  keyGenerator: (req) => {
    // Use IP address by default
    // Can be modified to use user ID, API key, etc.
    return req.ip;
  },
  
  // Handler when rate limit is exceeded
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },
  
  // Skip rate limiting in certain conditions
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    return req.path === '/health' || req.path === '/api/health';
  },
});

/**
 * Create a strict rate limiter for expensive operations
 * Lower limits for endpoints that consume more resources
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded for this operation. Please try again later.',
        retryAfter: 3600, // seconds
      },
    });
  },
});

/**
 * Create a custom rate limiter with configurable options
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Custom error message
 * @returns {Function} Express middleware function
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || config.rateLimit.windowMs;
  const max = options.max || config.rateLimit.max;
  const message = options.message || 'Too many requests, please try again later.';
  
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfter: Math.ceil(windowMs / 1000),
        },
      });
    },
  });
}

/**
 * IP-based rate limiter with longer window for suspicious IPs
 * Useful for blocking bad actors
 */
const ipBlockLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1000, // Maximum requests per day per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`IP ${req.ip} exceeded daily rate limit`);
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Daily request limit exceeded. Please try again tomorrow.',
      },
    });
  },
});

module.exports = {
  apiLimiter,
  strictLimiter,
  createRateLimiter,
  ipBlockLimiter,
};