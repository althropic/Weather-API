/**
 * Weather API Routes
 * Endpoints for fetching weather data
 */
const express = require('express');
const router = express.Router();
const weatherService = require('../services/weather');
const { BadRequestError, ConfigurationError } = require('../middleware/errorHandler');
const config = require('../config');

/**
 * GET /api/weather/:location
 * Fetches weather data for a specific location
 * 
 * Query parameters:
 * - unitGroup: Unit system (us, metric, uk, base)
 * - include: Data to include (days, hours, current, alerts, etc.)
 * - forceRefresh: Force refresh from API (skip cache)
 * - hardcoded: Return hardcoded data (for testing)
 * 
 * @param {string} location - City name or coordinates
 */
router.get('/:location', async (req, res, next) => {
  try {
    const { location } = req.params;
    
    // Validate location
    if (!location || !weatherService.isValidLocation(location)) {
      throw new BadRequestError('Please provide a valid city name or coordinates');
    }
    
    // Extract query parameters
    const { 
      unitGroup, 
      include, 
      lang, 
      forceRefresh, 
      hardcoded,
    } = req.query;
    
    // Build options object
    const options = {};
    if (unitGroup) options.unitGroup = unitGroup;
    if (include) options.include = include;
    if (lang) options.lang = lang;
    if (forceRefresh === 'true') options.forceRefresh = true;
    
    let weatherData;
    
    // Check if hardcoded response is requested (for testing)
    if (hardcoded === 'true') {
      weatherData = weatherService.getHardcodedWeather(location);
    } else {
      // Check if API key is configured
      if (!config.weatherApi.key) {
        throw new ConfigurationError(
          'Weather API key is not configured. Please set the WEATHER_API_KEY environment variable.'
        );
      }
      
      weatherData = await weatherService.getWeather(location, options);
    }
    
    // Send response
    res.json({
      success: true,
      data: weatherData,
      meta: {
        location,
        fromCache: weatherData.fromCache || false,
        fromHardcoded: weatherData.fromHardcoded || false,
        cachedAt: weatherData.cachedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/weather/:location/current
 * Fetches current weather conditions for a location
 */
router.get('/:location/current', async (req, res, next) => {
  try {
    const { location } = req.params;
    
    if (!location || !weatherService.isValidLocation(location)) {
      throw new BadRequestError('Please provide a valid city name or coordinates');
    }
    
    // Extract query parameters
    const { unitGroup, lang, forceRefresh, hardcoded } = req.query;
    
    // Build options
    const options = {
      include: 'current',
    };
    if (unitGroup) options.unitGroup = unitGroup;
    if (lang) options.lang = lang;
    if (forceRefresh === 'true') options.forceRefresh = true;
    
    let weatherData;
    
    if (hardcoded === 'true') {
      weatherData = weatherService.getHardcodedWeather(location);
    } else {
      if (!config.weatherApi.key) {
        throw new ConfigurationError(
          'Weather API key is not configured. Please set the WEATHER_API_KEY environment variable.'
        );
      }
      
      weatherData = await weatherService.getWeather(location, options);
    }
    
    // Extract current conditions from the response
    const currentConditions = weatherData.currentConditions || weatherData.days?.[0];
    
    res.json({
      success: true,
      data: currentConditions,
      meta: {
        location,
        resolvedAddress: weatherData.resolvedAddress,
        fromCache: weatherData.fromCache || false,
        cachedAt: weatherData.cachedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/weather/:location/forecast
 * Fetches weather forecast for a location
 * 
 * Query parameters:
 * - days: Number of forecast days (1-15)
 */
router.get('/:location/forecast', async (req, res, next) => {
  try {
    const { location } = req.params;
    const { days = '7', unitGroup, lang, forceRefresh, hardcoded } = req.query;
    
    if (!location || !weatherService.isValidLocation(location)) {
      throw new BadRequestError('Please provide a valid city name or coordinates');
    }
    
    // Validate days parameter
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays < 1 || numDays > 15) {
      throw new BadRequestError('Days parameter must be between 1 and 15');
    }
    
    // Build options
    const options = {
      include: 'days',
    };
    if (unitGroup) options.unitGroup = unitGroup;
    if (lang) options.lang = lang;
    if (forceRefresh === 'true') options.forceRefresh = true;
    
    let weatherData;
    
    if (hardcoded === 'true') {
      weatherData = weatherService.getHardcodedWeather(location);
    } else {
      if (!config.weatherApi.key) {
        throw new ConfigurationError(
          'Weather API key is not configured. Please set the WEATHER_API_KEY environment variable.'
        );
      }
      
      // Note: Visual Crossing API accepts a date range or next N days
      // For simplicity, we request the weather and then limit the days
      weatherData = await weatherService.getWeather(location, options);
    }
    
    // Limit forecast days
    if (weatherData.days && Array.isArray(weatherData.days)) {
      weatherData.days = weatherData.days.slice(0, numDays);
    }
    
    res.json({
      success: true,
      data: weatherData.days,
      meta: {
        location,
        resolvedAddress: weatherData.resolvedAddress,
        fromCache: weatherData.fromCache || false,
        cachedAt: weatherData.cachedAt || null,
        requestedDays: numDays,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/weather/cache/:location
 * Clears cached weather data for a location
 */
router.delete('/cache/:location', async (req, res, next) => {
  try {
    const { location } = req.params;
    
    if (!location) {
      throw new BadRequestError('Please provide a location to clear from cache');
    }
    
    const success = await weatherService.clearWeatherCache(location);
    
    res.json({
      success,
      message: success 
        ? `Cache cleared for location: ${location}` 
        : `Failed to clear cache for location: ${location}`,
      location,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;