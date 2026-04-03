/**
 * Weather API Wrapper Service
 * Main application entry point
 */
require('dotenv').config();

const express = require('express');
const config = require('./config');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter, ipBlockLimiter } = require('./middleware/rateLimiter');
const cache = require('./services/cache');
const weatherRoutes = require('./routes/weather');

// Create Express application
const app = express();

// Trust proxy (useful for rate limiting behind proxies)
app.set('trust proxy', 1);

// Built-in middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (no rate limiting)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Detailed health check (includes Redis status)
app.get('/health/detailed', async (req, res) => {
  try {
    const cacheStats = await cache.getStats();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      cache: {
        connected: cacheStats.connected,
      },
      config: {
        port: config.port,
        redisHost: config.redis.host,
        redisPort: config.redis.port,
        cacheTtl: config.cache.ttl,
        rateLimitMax: config.rateLimit.max,
        weatherApiKeyConfigured: !!config.weatherApi.key,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: error.message,
    });
  }
});

// API root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Weather API Wrapper Service',
    version: '1.0.0',
    description: 'A weather API wrapper service that fetches and returns weather data with caching support',
    endpoints: {
      'GET /health': 'Health check endpoint',
      'GET /health/detailed': 'Detailed health check with service statuses',
      'GET /api/weather/:location': 'Get complete weather data for a location',
      'GET /api/weather/:location/current': 'Get current weather conditions',
      'GET /api/weather/:location/forecast': 'Get weather forecast',
      'DELETE /api/weather/cache/:location': 'Clear cached weather for a location',
    },
    documentation: 'https://github.com/your-username/weather-api-wrapper-service',
  });
});

// Welcome endpoint for API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the Weather API',
    endpoints: {
      weather: {
        'GET /api/weather/:location': 'Get complete weather data for a location',
        'GET /api/weather/:location/current': 'Get current weather conditions',
        'GET /api/weather/:location/forecast': 'Get weather forecast (use ?days=N for N days)',
        'DELETE /api/weather/cache/:location': 'Clear cached weather for a location',
      },
    },
    queryParameters: {
      unitGroup: 'Unit system: us, metric, uk, base',
      include: 'Data to include: days, hours, current, alerts, events, etc.',
      lang: 'Language code for responses',
      forceRefresh: 'Set to "true" to force refresh from API (skip cache)',
      hardcoded: 'Set to "true" to get hardcoded response (for testing)',
    },
  });
});

// Apply global rate limiting to all API routes
app.use('/api', ipBlockLimiter);
app.use('/api/weather', apiLimiter);

// Mount weather routes
app.use('/api/weather', weatherRoutes);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
let server = null;

/**
 * Gracefully shutdown the server
 * Handles active connections and closes Redis connection
 */
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    // Close HTTP server
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  
  // Close Redis connection
  try {
    await cache.disconnect();
    console.log('Redis connection closed');
  } catch (error) {
    console.error('Error closing Redis connection:', error.message);
  }
  
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * Start the server
 */
async function startServer() {
  try {
    // Initialize Redis connection
    console.log('Connecting to Redis...');
    
    server = app.listen(config.port, () => {
      console.log(`\n========================================`);
      console.log(`Weather API Service Started`);
      console.log(`========================================`);
      console.log(`Port: ${config.port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Redis Host: ${config.redis.host}:${config.redis.port}`);
      console.log(`Cache TTL: ${config.cache.ttl} seconds`);
      console.log(`Rate Limit: ${config.rateLimit.max} requests per 15 minutes`);
      console.log(`API Key Configured: ${config.weatherApi.key ? 'Yes' : 'No'}`);
      console.log(`========================================`);
      console.log(`\nAPI Documentation: http://localhost:${config.port}/api`);
      console.log(`Health Check: http://localhost:${config.port}/health`);
      console.log(`\nReady to accept requests!\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export app for testing
module.exports = { app };

// Start the server
startServer();