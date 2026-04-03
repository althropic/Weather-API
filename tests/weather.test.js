/**
 * Weather API Service Tests
 * Tests for the weather service, error handling, and configuration
 */

// Mock config before importing anything else
jest.mock('../src/config', () => ({
  port: 3000,
  weatherApi: {
    key: 'test-api-key',
    baseUrl: 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline',
  },
  redis: {
    host: 'localhost',
    port: 6379,
    password: undefined,
  },
  cache: {
    ttl: 43200,
  },
  rateLimit: {
    max: 100,
    windowMs: 900000,
  },
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    quit: jest.fn().mockResolvedValue('OK'),
    info: jest.fn().mockResolvedValue('stats info'),
    status: 'ready',
  }));
});

// Mock axios for weather service
jest.mock('axios');

describe('Weather Service', () => {
  const weatherService = require('../src/services/weather');

  describe('isValidLocation', () => {
    it('should return true for valid city names', () => {
      expect(weatherService.isValidLocation('London')).toBe(true);
      expect(weatherService.isValidLocation('New York')).toBe(true);
      expect(weatherService.isValidLocation('San Francisco, CA')).toBe(true);
      expect(weatherService.isValidLocation('Paris')).toBe(true);
    });

    it('should return false for invalid locations', () => {
      expect(weatherService.isValidLocation('')).toBe(false);
      expect(weatherService.isValidLocation(null)).toBe(false);
      expect(weatherService.isValidLocation(undefined)).toBe(false);
      expect(weatherService.isValidLocation('x')).toBe(false);
    });

    it('should reject locations that are too long', () => {
      const longLocation = 'a'.repeat(201);
      expect(weatherService.isValidLocation(longLocation)).toBe(false);
    });

    it('should accept locations with spaces', () => {
      expect(weatherService.isValidLocation('New York City')).toBe(true);
      expect(weatherService.isValidLocation('Los Angeles, California')).toBe(true);
    });

    it('should handle numeric strings', () => {
      // Coordinates like "40.7128,-74.0060"
      expect(weatherService.isValidLocation('40.7128,-74.0060')).toBe(true);
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys', () => {
      const key1 = weatherService.generateCacheKey('London');
      const key2 = weatherService.generateCacheKey('london');
      
      expect(key1).toBe('weather:london');
      expect(key1).toBe(key2);
    });

    it('should handle spaces in location names', () => {
      const key = weatherService.generateCacheKey('New York');
      expect(key).toBe('weather:new_york');
    });

    it('should trim whitespace', () => {
      const key = weatherService.generateCacheKey('  London  ');
      expect(key).toBe('weather:london');
    });

    it('should normalize multiple spaces', () => {
      const key = weatherService.generateCacheKey('New   York');
      expect(key).toBe('weather:new_york');
    });
  });

  describe('getHardcodedWeather', () => {
    it('should return weather data with expected structure', () => {
      const weather = weatherService.getHardcodedWeather('London');
      
      expect(weather).toHaveProperty('fromCache', false);
      expect(weather).toHaveProperty('fromHardcoded', true);
      expect(weather).toHaveProperty('days');
      expect(Array.isArray(weather.days)).toBe(true);
      expect(weather.days.length).toBeGreaterThan(0);
    });

    it('should include current conditions', () => {
      const weather = weatherService.getHardcodedWeather('London');
      
      expect(weather).toHaveProperty('currentConditions');
      expect(weather.currentConditions).toHaveProperty('temp');
      expect(weather.currentConditions).toHaveProperty('humidity');
      expect(weather.currentConditions).toHaveProperty('conditions');
    });

    it('should include basic weather elements', () => {
      const weather = weatherService.getHardcodedWeather('London');
      
      expect(weather).toHaveProperty('resolvedAddress');
      expect(weather).toHaveProperty('timezone');
      expect(weather).toHaveProperty('latitude');
      expect(weather).toHaveProperty('longitude');
    });

    it('should accept custom location name', () => {
      const weather = weatherService.getHardcodedWeather('Paris');
      expect(weather.resolvedAddress).toContain('Paris');
    });
  });
});

describe('Cache Service', () => {
  const cache = require('../src/services/cache');

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value successfully', async () => {
      const result = await cache.set('test-key', { data: 'test' });
      expect(result).toBe(true);
    });
  });

  describe('del', () => {
    it('should delete key successfully', async () => {
      const result = await cache.del('test-key');
      expect(result).toBe(true);
    });
  });

  describe('exists', () => {
    it('should check if key exists', async () => {
      const result = await cache.exists('test-key');
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('Error Handler Middleware', () => {
  const errorHandler = require('../src/middleware/errorHandler');

  describe('Error classes', () => {
    it('should create ApiError with correct properties', () => {
      const error = new errorHandler.ApiError(500, 'Test error', 'TEST_ERROR');
      
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error');
    });

    it('should create BadRequestError with correct properties', () => {
      const error = new errorHandler.BadRequestError('Invalid input');
      
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid input');
    });

    it('should create NotFoundError with correct properties', () => {
      const error = new errorHandler.NotFoundError('User not found');
      
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create InternalServerError with correct properties', () => {
      const error = new errorHandler.InternalServerError('Something went wrong');
      
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should create ServiceUnavailableError with correct properties', () => {
      const error = new errorHandler.ServiceUnavailableError('Service down');
      
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should create TooManyRequestsError with correct properties', () => {
      const error = new errorHandler.TooManyRequestsError('Rate limit exceeded');
      
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should create ConfigurationError with correct properties', () => {
      const error = new errorHandler.ConfigurationError('API key not set');
      
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });
  });

  describe('asyncHandler', () => {
    it('should pass errors to next middleware', async () => {
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();
      
      const asyncFn = async () => {
        throw new Error('Test error');
      };
      
      const handler = errorHandler.asyncHandler(asyncFn);
      await handler(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('Configuration', () => {
  it('should load configuration correctly', () => {
    const config = require('../src/config');
    
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('weatherApi');
    expect(config).toHaveProperty('redis');
    expect(config).toHaveProperty('cache');
    expect(config).toHaveProperty('rateLimit');
  });

  it('should have correct redis config structure', () => {
    const config = require('../src/config');
    
    expect(config.redis).toHaveProperty('host');
    expect(config.redis).toHaveProperty('port');
    expect(config.redis).toHaveProperty('password');
  });

  it('should have correct cache config structure', () => {
    const config = require('../src/config');
    
    expect(config.cache).toHaveProperty('ttl');
    expect(typeof config.cache.ttl).toBe('number');
  });

  it('should have correct rate limit config structure', () => {
    const config = require('../src/config');
    
    expect(config.rateLimit).toHaveProperty('max');
    expect(config.rateLimit).toHaveProperty('windowMs');
    expect(typeof config.rateLimit.max).toBe('number');
    expect(typeof config.rateLimit.windowMs).toBe('number');
  });
});