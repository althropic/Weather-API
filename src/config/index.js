/**
 * Application configuration module
 * Loads environment variables and provides default values
 */
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  
  // Visual Crossing Weather API configuration
  weatherApi: {
    key: process.env.WEATHER_API_KEY || '',
    baseUrl: process.env.WEATHER_API_BASE_URL || 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline',
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  // Cache configuration
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 43200, // Default: 12 hours
  },
  
  // Rate limiting configuration
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // requests per windowMs
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
};