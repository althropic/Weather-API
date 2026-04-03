# Weather API Wrapper Service

A Weather API wrapper service that fetches and returns weather data from the Visual Crossing Weather API with Redis caching support.

## Features

- **Weather Data API**: Fetch current weather and forecasts for any location
- **Redis Caching**: Cache API responses with configurable TTL (default: 12 hours)
- **Rate Limiting**: Protect your API from abuse with configurable rate limits
- **Error Handling**: Comprehensive error handling for API failures and invalid requests
- **Environment Variables**: Secure configuration through environment variables

## Requirements

- Node.js 18+
- Redis server (for caching)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd weather-api-wrapper-service
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your Visual Crossing API key:
   ```
   WEATHER_API_KEY=your_api_key_here
   ```

## Configuration

Create a `.env` file based on `.env.example`:

```env
# Weather API Configuration
PORT=3000

# Visual Crossing Weather API
# Get your free API key at: https://www.visualcrossing.com/weather-api
WEATHER_API_KEY=your_visual_crossing_api_key_here
WEATHER_API_BASE_URL=https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Cache Configuration (in seconds)
# Default: 12 hours = 43200 seconds
CACHE_TTL=43200

# Rate Limiting (requests per 15 minutes)
RATE_LIMIT_MAX=100
```

## Running the Service

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

## API Endpoints

### Root Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API information and available endpoints |
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed health check with service statuses |

### Weather Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/weather/:location` | Get complete weather data for a location |
| GET | `/api/weather/:location/current` | Get current weather conditions |
| GET | `/api/weather/:location/forecast` | Get weather forecast |
| DELETE | `/api/weather/cache/:location` | Clear cached weather data for a location |

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `unitGroup` | string | Unit system: `us`, `metric`, `uk`, `base` |
| `include` | string | Data to include: `days`, `hours`, `current`, `alerts`, `events`, etc. |
| `lang` | string | Language code for responses |
| `forceRefresh` | boolean | Set to `true` to force refresh from API (skip cache) |
| `hardcoded` | boolean | Set to `true` to get hardcoded response (for testing) |
| `days` | number | Number of forecast days (1-15, for `/forecast` endpoint) |

### Example Requests

```bash
# Get weather for a city
curl http://localhost:3000/api/weather/London

# Get current weather in metric units
curl http://localhost:3000/api/weather/Paris/current?unitGroup=metric

# Get 7-day forecast
curl http://localhost:3000/api/weather/Tokyo/forecast?days=7

# Force refresh from API
curl http://localhost:3000/api/weather/London?forceRefresh=true

# Get hardcoded response (for testing)
curl http://localhost:3000/api/weather/London?hardcoded=true
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    "queryCost": 1,
    "latitude": 51.5074,
    "longitude": -0.1278,
    "resolvedAddress": "London, Greater London, United Kingdom",
    "timezone": "Europe/London",
    "days": [...],
    "currentConditions": {...}
  },
  "meta": {
    "location": "London",
    "fromCache": false,
    "cachedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Please provide a valid city name or coordinates"
  }
}
```

## Architecture

```
src/
├── config/
│   └── index.js          # Configuration management
├── middleware/
│   ├── errorHandler.js   # Error handling middleware
│   └── rateLimiter.js    # Rate limiting middleware
├── routes/
│   └── weather.js        # Weather API routes
├── services/
│   ├── cache.js          # Redis caching service
│   └── weather.js        # Weather API service
└── index.js              # Application entry point
tests/
└── weather.test.js       # Test suites
```

## Caching Strategy

The service uses Redis for caching with the following strategy:

1. **Cache Key**: `weather:{normalized_location}`
2. **TTL**: Configurable (default: 12 hours)
3. **Cache First**: Always check cache before API
4. **Force Refresh**: Bypass cache with `forceRefresh=true`

## Rate Limiting

Default configuration:
- **Window**: 15 minutes
- **Max Requests**: 100 per IP per window
- **Skip Paths**: Health check endpoints

Rate limit headers are included in responses:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Remaining requests in the window
- `RateLimit-Reset`: Time when the window resets

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test -- --coverage
```

## Getting an API Key

1. Visit [Visual Crossing Weather API](https://www.visualcrossing.com/weather-api)
2. Sign up for a free account
3. Navigate to your account settings
4. Copy your API key to the `.env` file

The free tier includes:
- 1,000 requests per day
- Historical weather data
- 15-day forecast
- Various weather elements

## Error Handling

The API returns appropriate HTTP status codes:

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 404 | Not Found (location or endpoint) |
| 429 | Too Many Requests (rate limit exceeded) |
| 503 | Service Unavailable (API or cache issues) |

## Development

### Project Structure
The project follows a layered architecture:
- **Routes**: HTTP route definitions
- **Services**: Business logic and external integrations
- **Middleware**: Cross-cutting concerns (rate limiting, error handling)
- **Config**: Configuration management

### Adding New Features
1. Create or extend services in `src/services/`
2. Add routes in `src/routes/`
3. Update middleware if needed
4. Add tests in `tests/`

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Acknowledgments

- [Visual Crossing Weather API](https://www.visualcrossing.com/weather-api) for weather data
- [Roadmap.sh](https://roadway.sh/projects/weather-api-wrapper-service) for the project idea