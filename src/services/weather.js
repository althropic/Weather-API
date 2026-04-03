/**
 * Weather Service
 * Fetches weather data from Visual Crossing Weather API with Redis caching
 */
const axios = require('axios');
const cache = require('./cache');
const config = require('../config');

/**
 * Generate cache key for a location
 * @param {string} location - City name or coordinates
 * @returns {string} Normalized cache key
 */
function generateCacheKey(location) {
  return `weather:${location.toLowerCase().trim().replace(/\s+/g, '_')}`;
}

/**
 * Validate location format
 * @param {string} location - Location string to validate
 * @returns {boolean} Whether location is valid
 */
function isValidLocation(location) {
  if (!location || typeof location !== 'string') {
    return false;
  }
  
  // Accept city names, coordinates, or address-like strings
  // Visual Crossing accepts many formats
  const trimmed = location.trim();
  if (trimmed.length < 2 || trimmed.length > 200) {
    return false;
  }
  
  return true;
}

/**
 * Fetch weather data from Visual Crossing API
 * @param {string} location - City name or coordinates
 * @param {Object} options - Additional options (unitGroup, include, etc.)
 * @returns {Promise<Object>} Weather data
 */
async function fetchFromApi(location, options = {}) {
  if (!config.weatherApi.key) {
    throw new Error('Weather API key is not configured. Set WEATHER_API_KEY environment variable.');
  }
  
  if (!isValidLocation(location)) {
    throw new Error('Invalid location format. Please provide a valid city name or coordinates.');
  }
  
  const params = {
    key: config.weatherApi.key,
    contentType: 'json',
    ...(options.unitGroup && { unitGroup: options.unitGroup }),
    ...(options.include && { include: options.include }),
    ...(options.lang && { lang: options.lang }),
  };
  
  try {
    const response = await axios.get(`${config.weatherApi.baseUrl}/${encodeURIComponent(location)}`, {
      params,
      timeout: 10000, // 10 second timeout
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      // API returned an error response
      const status = error.response.status;
      const message = error.response.data?.message || error.message;
      
      if (status === 400) {
        throw new Error(`Bad request: ${message}`);
      } else if (status === 401 || status === 403) {
        throw new Error('Invalid or expired API key');
      } else if (status === 404) {
        throw new Error(`Location not found: ${location}`);
      } else if (status >= 500) {
        throw new Error('Weather API service is currently unavailable. Please try again later.');
      } else {
        throw new Error(`Weather API error: ${message}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Weather API request timed out. Please try again.');
    } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      throw new Error('Unable to connect to Weather API. Network error.');
    } else {
      throw new Error(`Failed to fetch weather data: ${error.message}`);
    }
  }
}

/**
 * Get weather data with caching support
 * First checks cache, falls back to API if not found or expired
 * @param {string} location - City name or coordinates
 * @param {Object} options - Additional options
 * @param {boolean} options.forceRefresh - Skip cache and fetch fresh data
 * @param {string} options.unitGroup - Unit system (us, metric, uk, base)
 * @param {string} options.include - Data to include (days, hours, current, etc.)
 * @returns {Promise<Object>} Weather data with cache metadata
 */
async function getWeather(location, options = {}) {
  const cacheKey = generateCacheKey(location);
  const { forceRefresh = false, ...apiOptions } = options;
  
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return {
        ...cachedData,
        fromCache: true,
        cachedAt: cachedData.cachedAt,
      };
    }
  }
  
  // Fetch from API
  const weatherData = await fetchFromApi(location, apiOptions);
  const now = new Date().toISOString();
  
  // Prepare data for caching
  const dataToCache = {
    ...weatherData,
    cachedAt: now,
  };
  
  // Store in cache with expiration
  await cache.set(cacheKey, dataToCache);
  
  return {
    ...weatherData,
    fromCache: false,
    cachedAt: now,
  };
}

/**
 * Clear cached weather data for a specific location
 * @param {string} location - Location to clear from cache
 * @returns {Promise<boolean>} Success status
 */
async function clearWeatherCache(location) {
  const cacheKey = generateCacheKey(location);
  return await cache.del(cacheKey);
}

/**
 * Get hardcoded weather response (for testing/initial setup)
 * @param {string} location - Location name
 * @returns {Object} Hardcoded weather response
 */
function getHardcodedWeather(location = 'London') {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  return {
    queryCost: 1,
    latitude: 51.5074,
    longitude: -0.1278,
    resolvedAddress: `${location}, United Kingdom`,
    address: location,
    timezone: 'Europe/London',
    tzoffset: 0,
    description: 'Hardcoded weather data for testing purposes',
    days: [
      {
        datetime: today,
        datetimeEpoch: Math.floor(now.getTime() / 1000),
        tempmax: 18.0,
        tempmin: 12.0,
        temp: 15.0,
        feelslikemax: 17.0,
        feelslikemin: 11.0,
        feelslike: 14.0,
        humidity: 70.0,
        precip: 0.0,
        precipprob: 10,
        precipcover: 0.0,
        snow: 0.0,
        snowdepth: 0.0,
        windgust: 20.0,
        windspeed: 15.0,
        winddir: 230.0,
        pressure: 1015.0,
        cloudcover: 50.0,
        visibility: 10.0,
        solarradiation: 150.0,
        solarenergy: 13.0,
        uvindex: 4,
        conditions: 'Partly cloudy',
        description: 'Partly cloudy throughout the day.',
        icon: 'partly-cloudy-day',
        stations: [],
        source: 'hardcoded',
      },
    ],
    stations: {},
    currentConditions: {
      datetime: now.toTimeString().split(' ')[0],
      datetimeEpoch: Math.floor(now.getTime() / 1000),
      temp: 15.0,
      feelslike: 14.0,
      humidity: 70.0,
      precip: 0.0,
      precipprob: 10,
      precipcover: null,
      snow: 0.0,
      snowdepth: 0.0,
      windgust: 20.0,
      windspeed: 15.0,
      winddir: 230.0,
      pressure: 1015.0,
      cloudcover: 50.0,
      visibility: 10.0,
      solarradiation: 150.0,
      solarenergy: 13.0,
      uvindex: 4,
      conditions: 'Partly cloudy',
      icon: 'partly-cloudy-day',
      source: 'hardcoded',
    },
    fromCache: false,
    fromHardcoded: true,
  };
}

module.exports = {
  getWeather,
  fetchFromApi,
  clearWeatherCache,
  getHardcodedWeather,
  isValidLocation,
  generateCacheKey,
};