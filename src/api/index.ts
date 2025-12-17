/**
 * API barrel export
 */
export * from './client';
export * from './weather';
// weatherService has duplicate exports with weather.ts, export selectively
export { 
  getWindFromMetar,
  getWindFromTafAtTime,
  getVisibilityCategory,
  isWeatherSuitable,
  clearWeatherCache
} from './weatherService';
export * from './icao';

// New AviationWeather.gov API (recommended)
export { 
  fetchMetar as fetchAwcMetar,
  fetchTaf as fetchAwcTaf,
  fetchAirportWeather as fetchAwcAirportWeather,
  fetchMultipleAirportWeather as fetchAwcMultipleAirportWeather,
  getFlightCategoryColor
} from './aviationWeather';
