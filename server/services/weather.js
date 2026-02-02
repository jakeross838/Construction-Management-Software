/**
 * Weather Service
 * Fetches weather data from OpenWeatherMap API
 *
 * Uses OPENWEATHER_API_KEY env var if available
 * Falls back to Open-Meteo free API if no key is configured
 */

const logger = require('../utils/logger');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

/**
 * Map Open-Meteo weather codes to condition strings
 */
function mapOpenMeteoCode(code) {
  // WMO Weather interpretation codes (Open-Meteo)
  if (code === 0) return 'clear';
  if (code >= 1 && code <= 3) return 'partly_cloudy';
  if (code >= 45 && code <= 48) return 'foggy';
  if (code >= 51 && code <= 55) return 'drizzle';
  if (code >= 56 && code <= 57) return 'freezing_drizzle';
  if (code >= 61 && code <= 65) return 'rainy';
  if (code >= 66 && code <= 67) return 'freezing_rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain_showers';
  if (code >= 85 && code <= 86) return 'snow_showers';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return 'unknown';
}

/**
 * Map OpenWeatherMap condition codes to our standard conditions
 */
function mapOpenWeatherCondition(weatherMain) {
  const mapping = {
    'Clear': 'clear',
    'Clouds': 'cloudy',
    'Rain': 'rainy',
    'Drizzle': 'drizzle',
    'Thunderstorm': 'thunderstorm',
    'Snow': 'snow',
    'Mist': 'foggy',
    'Fog': 'foggy',
    'Haze': 'hazy',
    'Dust': 'dusty',
    'Sand': 'dusty',
    'Ash': 'dusty',
    'Squall': 'windy',
    'Tornado': 'severe'
  };
  return mapping[weatherMain] || 'unknown';
}

/**
 * Fetch weather using OpenWeatherMap API (requires API key)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} date - Optional date (defaults to today)
 * @returns {Promise<Object|null>} Weather data or null if failed
 */
async function fetchWeatherOpenWeatherMap(lat, lng, date = null) {
  if (!OPENWEATHER_API_KEY) {
    logger.debug('No OpenWeatherMap API key configured', { component: 'Weather' });
    return null;
  }

  try {
    // Current weather endpoint
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=imperial`;

    const response = await fetch(url);
    if (!response.ok) {
      logger.error('OpenWeatherMap API error', {
        component: 'Weather',
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const data = await response.json();

    return {
      temp_high: Math.round(data.main.temp_max),
      temp_low: Math.round(data.main.temp_min),
      temp_current: Math.round(data.main.temp),
      conditions: mapOpenWeatherCondition(data.weather?.[0]?.main),
      conditions_description: data.weather?.[0]?.description,
      precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
      wind_speed: Math.round(data.wind?.speed || 0),
      wind_direction: data.wind?.deg,
      humidity: data.main?.humidity,
      visibility: data.visibility ? Math.round(data.visibility / 1609.34) : null, // Convert meters to miles
      cloud_cover: data.clouds?.all,
      sunrise: data.sys?.sunrise ? new Date(data.sys.sunrise * 1000).toISOString() : null,
      sunset: data.sys?.sunset ? new Date(data.sys.sunset * 1000).toISOString() : null,
      fetched_at: new Date().toISOString(),
      source: 'openweathermap'
    };
  } catch (err) {
    logger.error('OpenWeatherMap fetch error', { component: 'Weather', error: err.message });
    return null;
  }
}

/**
 * Fetch weather using Open-Meteo free API (no API key required)
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} date - Optional date (defaults to today)
 * @returns {Promise<Object|null>} Weather data or null if failed
 */
async function fetchWeatherOpenMeteo(lat, lng, date = null) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`;

    const response = await fetch(url);
    if (!response.ok) {
      logger.error('Open-Meteo API error', {
        component: 'Weather',
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const data = await response.json();

    if (!data.current || !data.daily) {
      logger.warn('Open-Meteo returned incomplete data', { component: 'Weather', data });
      return null;
    }

    return {
      temp_high: Math.round(data.daily.temperature_2m_max[0]),
      temp_low: Math.round(data.daily.temperature_2m_min[0]),
      temp_current: Math.round(data.current.temperature_2m),
      conditions: mapOpenMeteoCode(data.current.weather_code),
      conditions_code: data.current.weather_code,
      precipitation: data.current.precipitation || 0,
      precipitation_daily: data.daily.precipitation_sum?.[0] || 0,
      wind_speed: Math.round(data.current.wind_speed_10m || 0),
      wind_direction: data.current.wind_direction_10m,
      humidity: data.current.relative_humidity_2m,
      sunrise: data.daily.sunrise?.[0],
      sunset: data.daily.sunset?.[0],
      fetched_at: new Date().toISOString(),
      source: 'open-meteo'
    };
  } catch (err) {
    logger.error('Open-Meteo fetch error', { component: 'Weather', error: err.message });
    return null;
  }
}

/**
 * Fetch weather for a location
 * Tries OpenWeatherMap first if API key is available, falls back to Open-Meteo
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} date - Optional date (defaults to today, format: YYYY-MM-DD)
 * @returns {Promise<Object>} Weather data object
 */
async function fetchWeather(lat, lng, date = null) {
  // Validate coordinates
  if (typeof lat !== 'number' || typeof lng !== 'number' ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    logger.warn('Invalid coordinates provided', { component: 'Weather', lat, lng });
    return {
      error: 'Invalid coordinates',
      temp_high: null,
      temp_low: null,
      conditions: null,
      precipitation: null,
      wind_speed: null,
      fetched_at: new Date().toISOString()
    };
  }

  // Try OpenWeatherMap first if API key is available
  if (OPENWEATHER_API_KEY) {
    const owmData = await fetchWeatherOpenWeatherMap(lat, lng, date);
    if (owmData) {
      logger.debug('Weather fetched from OpenWeatherMap', { component: 'Weather', lat, lng });
      return owmData;
    }
  }

  // Fall back to Open-Meteo
  const meteoData = await fetchWeatherOpenMeteo(lat, lng, date);
  if (meteoData) {
    logger.debug('Weather fetched from Open-Meteo', { component: 'Weather', lat, lng });
    return meteoData;
  }

  // Both failed
  logger.error('All weather APIs failed', { component: 'Weather', lat, lng });
  return {
    error: 'Failed to fetch weather from all sources',
    temp_high: null,
    temp_low: null,
    conditions: null,
    precipitation: null,
    wind_speed: null,
    fetched_at: new Date().toISOString()
  };
}

/**
 * Geocode an address to get lat/lng
 * Uses Open-Meteo free geocoding API
 *
 * @param {string} address - Address to geocode
 * @returns {Promise<Object|null>} { lat, lng, name } or null
 */
async function geocodeAddress(address) {
  if (!address) return null;

  try {
    // Try the address directly
    let encoded = encodeURIComponent(address);
    let response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=1&language=en&format=json`);
    let data = await response.json();

    if (data.results && data.results.length > 0) {
      return {
        lat: data.results[0].latitude,
        lng: data.results[0].longitude,
        name: data.results[0].name,
        country: data.results[0].country,
        admin1: data.results[0].admin1
      };
    }

    // Try with Florida context (Ross Built is FL-based)
    encoded = encodeURIComponent(address + ', Florida, USA');
    response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=1&language=en&format=json`);
    data = await response.json();

    if (data.results && data.results.length > 0) {
      return {
        lat: data.results[0].latitude,
        lng: data.results[0].longitude,
        name: data.results[0].name,
        country: data.results[0].country,
        admin1: data.results[0].admin1
      };
    }

    return null;
  } catch (err) {
    logger.error('Geocoding error', { component: 'Weather', address, error: err.message });
    return null;
  }
}

/**
 * Get weather for a job site by address
 * Combines geocoding and weather fetch
 *
 * @param {string} address - Job site address
 * @param {string} date - Optional date (defaults to today)
 * @returns {Promise<Object>} Weather data with location info
 */
async function getWeatherForAddress(address, date = null) {
  const location = await geocodeAddress(address);

  if (!location) {
    logger.warn('Could not geocode address for weather', { component: 'Weather', address });
    return {
      error: 'Could not geocode address',
      address,
      weather: null
    };
  }

  const weather = await fetchWeather(location.lat, location.lng, date);

  return {
    address,
    location: {
      lat: location.lat,
      lng: location.lng,
      name: location.name,
      region: location.admin1,
      country: location.country
    },
    weather
  };
}

/**
 * Check if weather conditions are workable
 * Used to determine if work should proceed
 *
 * @param {Object} weather - Weather data object
 * @returns {Object} { workable: boolean, warnings: string[], advisory: string }
 */
function assessWorkability(weather) {
  const warnings = [];
  let workable = true;

  if (!weather || weather.error) {
    return {
      workable: true,
      warnings: ['Weather data unavailable'],
      advisory: 'Proceed with caution - weather conditions unknown'
    };
  }

  // Temperature checks
  if (weather.temp_current > 95) {
    warnings.push('Extreme heat - heat safety protocols required');
  } else if (weather.temp_current > 85) {
    warnings.push('Hot conditions - ensure hydration');
  }

  if (weather.temp_current < 32) {
    warnings.push('Freezing conditions - concrete/paint work may be affected');
  }

  // Rain/precipitation checks
  if (weather.precipitation > 0.5) {
    warnings.push('Heavy precipitation - outdoor work may be limited');
    if (weather.conditions === 'thunderstorm') {
      workable = false;
      warnings.push('LIGHTNING RISK - outdoor work should stop');
    }
  } else if (weather.precipitation > 0.1) {
    warnings.push('Light precipitation - cover materials');
  }

  // Wind checks
  if (weather.wind_speed > 25) {
    warnings.push('High winds - roofing and crane work should stop');
    workable = false;
  } else if (weather.wind_speed > 15) {
    warnings.push('Windy conditions - secure loose materials');
  }

  // Severe conditions
  const severeConditions = ['severe', 'thunderstorm', 'tornado'];
  if (severeConditions.includes(weather.conditions)) {
    workable = false;
    warnings.push(`Severe weather (${weather.conditions}) - work should stop`);
  }

  // Generate advisory
  let advisory = 'Good working conditions';
  if (!workable) {
    advisory = 'Work should be suspended due to unsafe conditions';
  } else if (warnings.length > 2) {
    advisory = 'Multiple weather concerns - proceed with caution';
  } else if (warnings.length > 0) {
    advisory = 'Some weather concerns - monitor conditions';
  }

  return { workable, warnings, advisory };
}

module.exports = {
  fetchWeather,
  geocodeAddress,
  getWeatherForAddress,
  assessWorkability
};
