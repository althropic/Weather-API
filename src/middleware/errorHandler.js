/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, message, code = 'API_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 */
class BadRequestError extends ApiError {
  constructor(message = 'Bad Request') {
    super(400, message, 'BAD_REQUEST');
  }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

/**
 * Internal Server Error (500)
 */
class InternalServerError extends ApiError {
  constructor(message = 'Internal Server Error') {
    super(500, message, 'INTERNAL_ERROR');
  }
}

/**
 * Service Unavailable Error (503)
 */
class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service temporarily unavailable') {
    super(503, message, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Too Many Requests Error (429)
 */
class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests, please try again later') {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Not configured with required settings error (503)
 */
class ConfigurationError extends ApiError {
  constructor(message = 'Service not properly configured') {
    super(503, message, 'CONFIGURATION_ERROR');
  }
}

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Log error for debugging
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  
  // Handle custom API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
      },
    });
  }
  
  // Handle Axios/Network errors
  if (err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'External weather service is currently unavailable. Please try again later.',
      },
    });
  }
  
  // Handle Redis errors
  if (err.code === 'ECONNREFUSED' && err.message.includes('ECONNREFUSED')) {
    return res.status(503).json({
      error: {
        code: 'CACHE_UNAVAILABLE',
        message: 'Cache service is temporarily unavailable. Some features may be limited.',
      },
    });
  }
  
  // Generic internal server error
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV !== 'production' 
        ? err.message 
        : 'An unexpected error occurred. Please try again later.',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

/**
 * 404 Not Found handler
 * @param {express.Request} req - Express request object
 * @param {express.Response} res - Express response object
 * @param {express.NextFunction} next - Express next function
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} not found`);
  next(error);
}

/**
 * Async handler wrapper
 * Catches errors in async route handlers and passes to error middleware
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped middleware function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  ApiError,
  BadRequestError,
  NotFoundError,
  InternalServerError,
  ServiceUnavailableError,
  TooManyRequestsError,
  ConfigurationError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};