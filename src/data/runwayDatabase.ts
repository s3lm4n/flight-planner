/**
 * Runway Database
 * 
 * This file stores runway data for airports.
 * 
 * DATA STRUCTURE:
 * - Key: ICAO code (uppercase)
 * - Value: Array of runways with both ends
 * 
 * USAGE:
 * - Import getAirportRunways() to get runway data
 * - Import addAirportRunways() to add runway data programmatically
 * 
 * IMPORTANT:
 * - Coordinates are WGS84 decimal degrees
 * - Lengths/widths are in FEET
 * - Headings are MAGNETIC (unless noted)
 * - Elevations are feet MSL
 */

import { Runway, RunwaySurfaceType } from '@/types/runway';
import { Coordinate } from '@/types';

// ============================================================================
// RUNWAY DATABASE STORAGE
// ============================================================================

const runwayDatabase: Map<string, Runway[]> = new Map();

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

/**
 * Get runways for an airport
 * @param icao ICAO code (case-insensitive)
 * @returns Array of runways or empty array if not found
 */
export function getAirportRunways(icao: string): Runway[] {
  return runwayDatabase.get(icao.toUpperCase()) || [];
}

/**
 * Check if an airport has runway data
 */
export function hasRunwayData(icao: string): boolean {
  const runways = runwayDatabase.get(icao.toUpperCase());
  return runways !== undefined && runways.length > 0;
}

/**
 * Add runway data for an airport
 */
export function addAirportRunways(icao: string, runways: Runway[]): void {
  runwayDatabase.set(icao.toUpperCase(), runways);
}

/**
 * Get all airports with runway data
 */
export function getAirportsWithRunways(): string[] {
  return Array.from(runwayDatabase.keys());
}

/**
 * Clear all runway data
 */
export function clearRunwayDatabase(): void {
  runwayDatabase.clear();
}

// ============================================================================
// HELPER: CREATE RUNWAY FROM BASIC DATA
// ============================================================================

interface BasicRunwayInput {
  id: string;           // e.g., "09L/27R"
  length: number;       // feet
  width: number;        // feet
  surface: RunwaySurfaceType;
  lighted: boolean;
  
  // First end (lower number typically)
  end1: {
    designator: string;
    heading: number;
    threshold: Coordinate;
    elevation: number;
  };
  
  // Second end (higher number)
  end2: {
    designator: string;
    heading: number;
    threshold: Coordinate;
    elevation: number;
  };
  
  // Optional ILS info
  end1Ils?: { frequency: number; course: number; glideslope: number; category: 'I' | 'II' | 'IIIA' | 'IIIB' | 'IIIC' };
  end2Ils?: { frequency: number; course: number; glideslope: number; category: 'I' | 'II' | 'IIIA' | 'IIIB' | 'IIIC' };
}

/**
 * Create a complete Runway object from basic input
 */
export function createRunway(input: BasicRunwayInput): Runway {
  return {
    id: input.id,
    length: input.length,
    width: input.width,
    surface: input.surface,
    lighted: input.lighted,
    status: 'OPEN',
    ends: [
      {
        designator: input.end1.designator,
        heading: input.end1.heading,
        trueHeading: input.end1.heading, // Adjust for magnetic variation if needed
        threshold: input.end1.threshold,
        elevation: input.end1.elevation,
        tora: input.length,
        toda: input.length,
        asda: input.length,
        lda: input.length,
        ils: input.end1Ils,
        visualAids: true,
      },
      {
        designator: input.end2.designator,
        heading: input.end2.heading,
        trueHeading: input.end2.heading,
        threshold: input.end2.threshold,
        elevation: input.end2.elevation,
        tora: input.length,
        toda: input.length,
        asda: input.length,
        lda: input.length,
        ils: input.end2Ils,
        visualAids: true,
      },
    ],
  };
}

// ============================================================================
// SAMPLE RUNWAY DATA - MAJOR AIRPORTS
// ============================================================================

/**
 * Initialize database with sample data for major airports
 * Called automatically on first import
 */
function initializeDefaultRunways(): void {
  // KJFK - John F. Kennedy International Airport
  addAirportRunways('KJFK', [
    createRunway({
      id: '04L/22R',
      length: 11351,
      width: 150,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '04L',
        heading: 44,
        threshold: { lat: 40.6297, lon: -73.7889 },
        elevation: 12,
      },
      end2: {
        designator: '22R',
        heading: 224,
        threshold: { lat: 40.6524, lon: -73.7631 },
        elevation: 13,
      },
      end1Ils: { frequency: 110.9, course: 44, glideslope: 3.0, category: 'IIIA' },
      end2Ils: { frequency: 111.5, course: 224, glideslope: 3.0, category: 'I' },
    }),
    createRunway({
      id: '04R/22L',
      length: 8400,
      width: 150,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '04R',
        heading: 44,
        threshold: { lat: 40.6250, lon: -73.7756 },
        elevation: 11,
      },
      end2: {
        designator: '22L',
        heading: 224,
        threshold: { lat: 40.6430, lon: -73.7550 },
        elevation: 12,
      },
      end2Ils: { frequency: 108.9, course: 224, glideslope: 3.0, category: 'I' },
    }),
    createRunway({
      id: '13L/31R',
      length: 10000,
      width: 150,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '13L',
        heading: 134,
        threshold: { lat: 40.6561, lon: -73.7939 },
        elevation: 13,
      },
      end2: {
        designator: '31R',
        heading: 314,
        threshold: { lat: 40.6363, lon: -73.7661 },
        elevation: 12,
      },
      end1Ils: { frequency: 111.1, course: 134, glideslope: 3.0, category: 'I' },
      end2Ils: { frequency: 109.5, course: 314, glideslope: 3.0, category: 'I' },
    }),
    createRunway({
      id: '13R/31L',
      length: 14511,
      width: 150,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '13R',
        heading: 134,
        threshold: { lat: 40.6653, lon: -73.8025 },
        elevation: 13,
      },
      end2: {
        designator: '31L',
        heading: 314,
        threshold: { lat: 40.6325, lon: -73.7500 },
        elevation: 11,
      },
      end1Ils: { frequency: 109.1, course: 134, glideslope: 3.0, category: 'IIIA' },
      end2Ils: { frequency: 110.3, course: 314, glideslope: 3.0, category: 'I' },
    }),
  ]);

  // KLAX - Los Angeles International Airport
  addAirportRunways('KLAX', [
    createRunway({
      id: '06L/24R',
      length: 8926,
      width: 150,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '06L',
        heading: 69,
        threshold: { lat: 33.9465, lon: -118.4315 },
        elevation: 126,
      },
      end2: {
        designator: '24R',
        heading: 249,
        threshold: { lat: 33.9567, lon: -118.3989 },
        elevation: 125,
      },
      end1Ils: { frequency: 111.7, course: 69, glideslope: 3.0, category: 'I' },
      end2Ils: { frequency: 111.1, course: 249, glideslope: 3.0, category: 'IIIA' },
    }),
    createRunway({
      id: '06R/24L',
      length: 10285,
      width: 150,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '06R',
        heading: 69,
        threshold: { lat: 33.9433, lon: -118.4327 },
        elevation: 126,
      },
      end2: {
        designator: '24L',
        heading: 249,
        threshold: { lat: 33.9558, lon: -118.3950 },
        elevation: 122,
      },
      end2Ils: { frequency: 108.5, course: 249, glideslope: 3.0, category: 'I' },
    }),
    createRunway({
      id: '07L/25R',
      length: 12091,
      width: 150,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '07L',
        heading: 69,
        threshold: { lat: 33.9352, lon: -118.4228 },
        elevation: 127,
      },
      end2: {
        designator: '25R',
        heading: 249,
        threshold: { lat: 33.9492, lon: -118.3795 },
        elevation: 121,
      },
      end1Ils: { frequency: 110.7, course: 69, glideslope: 3.0, category: 'I' },
      end2Ils: { frequency: 109.9, course: 249, glideslope: 3.0, category: 'IIIB' },
    }),
    createRunway({
      id: '07R/25L',
      length: 11096,
      width: 200,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '07R',
        heading: 69,
        threshold: { lat: 33.9323, lon: -118.4216 },
        elevation: 128,
      },
      end2: {
        designator: '25L',
        heading: 249,
        threshold: { lat: 33.9453, lon: -118.3812 },
        elevation: 118,
      },
      end1Ils: { frequency: 109.5, course: 69, glideslope: 3.0, category: 'I' },
      end2Ils: { frequency: 110.9, course: 249, glideslope: 3.0, category: 'IIIA' },
    }),
  ]);

  // EGLL - London Heathrow
  addAirportRunways('EGLL', [
    createRunway({
      id: '09L/27R',
      length: 12802,
      width: 164,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '09L',
        heading: 92,
        threshold: { lat: 51.4648, lon: -0.4896 },
        elevation: 79,
      },
      end2: {
        designator: '27R',
        heading: 272,
        threshold: { lat: 51.4647, lon: -0.4338 },
        elevation: 79,
      },
      end1Ils: { frequency: 109.5, course: 92, glideslope: 3.0, category: 'IIIA' },
      end2Ils: { frequency: 110.3, course: 272, glideslope: 3.0, category: 'IIIB' },
    }),
    createRunway({
      id: '09R/27L',
      length: 12008,
      width: 164,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '09R',
        heading: 92,
        threshold: { lat: 51.4775, lon: -0.4867 },
        elevation: 79,
      },
      end2: {
        designator: '27L',
        heading: 272,
        threshold: { lat: 51.4773, lon: -0.4349 },
        elevation: 79,
      },
      end1Ils: { frequency: 110.9, course: 92, glideslope: 3.0, category: 'IIIB' },
      end2Ils: { frequency: 109.1, course: 272, glideslope: 3.0, category: 'IIIA' },
    }),
  ]);

  // KATL - Hartsfield-Jackson Atlanta
  addAirportRunways('KATL', [
    createRunway({
      id: '08L/26R',
      length: 9000,
      width: 150,
      surface: 'CON',
      lighted: true,
      end1: {
        designator: '08L',
        heading: 89,
        threshold: { lat: 33.6463, lon: -84.4474 },
        elevation: 1010,
      },
      end2: {
        designator: '26R',
        heading: 269,
        threshold: { lat: 33.6471, lon: -84.4148 },
        elevation: 1020,
      },
      end1Ils: { frequency: 108.7, course: 89, glideslope: 3.0, category: 'I' },
      end2Ils: { frequency: 109.9, course: 269, glideslope: 3.0, category: 'IIIA' },
    }),
    createRunway({
      id: '08R/26L',
      length: 9000,
      width: 150,
      surface: 'CON',
      lighted: true,
      end1: {
        designator: '08R',
        heading: 89,
        threshold: { lat: 33.6408, lon: -84.4473 },
        elevation: 1010,
      },
      end2: {
        designator: '26L',
        heading: 269,
        threshold: { lat: 33.6416, lon: -84.4148 },
        elevation: 1020,
      },
      end2Ils: { frequency: 111.3, course: 269, glideslope: 3.0, category: 'I' },
    }),
    createRunway({
      id: '09L/27R',
      length: 9000,
      width: 150,
      surface: 'CON',
      lighted: true,
      end1: {
        designator: '09L',
        heading: 89,
        threshold: { lat: 33.6352, lon: -84.4472 },
        elevation: 1010,
      },
      end2: {
        designator: '27R',
        heading: 269,
        threshold: { lat: 33.6359, lon: -84.4148 },
        elevation: 1020,
      },
      end1Ils: { frequency: 110.1, course: 89, glideslope: 3.0, category: 'IIIB' },
      end2Ils: { frequency: 108.5, course: 269, glideslope: 3.0, category: 'I' },
    }),
    createRunway({
      id: '09R/27L',
      length: 9000,
      width: 150,
      surface: 'CON',
      lighted: true,
      end1: {
        designator: '09R',
        heading: 89,
        threshold: { lat: 33.6296, lon: -84.4472 },
        elevation: 1010,
      },
      end2: {
        designator: '27L',
        heading: 269,
        threshold: { lat: 33.6304, lon: -84.4148 },
        elevation: 1020,
      },
      end2Ils: { frequency: 110.9, course: 269, glideslope: 3.0, category: 'IIIA' },
    }),
    createRunway({
      id: '10/28',
      length: 9000,
      width: 150,
      surface: 'CON',
      lighted: true,
      end1: {
        designator: '10',
        heading: 99,
        threshold: { lat: 33.6241, lon: -84.4472 },
        elevation: 1010,
      },
      end2: {
        designator: '28',
        heading: 279,
        threshold: { lat: 33.6239, lon: -84.4148 },
        elevation: 1020,
      },
      end1Ils: { frequency: 111.5, course: 99, glideslope: 3.0, category: 'IIIA' },
      end2Ils: { frequency: 109.7, course: 279, glideslope: 3.0, category: 'I' },
    }),
  ]);

  // LTFM - Istanbul Airport
  addAirportRunways('LTFM', [
    createRunway({
      id: '16L/34R',
      length: 13123,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '16L',
        heading: 163,
        threshold: { lat: 41.2855, lon: 28.7339 },
        elevation: 325,
      },
      end2: {
        designator: '34R',
        heading: 343,
        threshold: { lat: 41.2494, lon: 28.7464 },
        elevation: 310,
      },
      end1Ils: { frequency: 109.5, course: 163, glideslope: 3.0, category: 'IIIA' },
      end2Ils: { frequency: 110.3, course: 343, glideslope: 3.0, category: 'IIIA' },
    }),
    createRunway({
      id: '16R/34L',
      length: 13123,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '16R',
        heading: 163,
        threshold: { lat: 41.2855, lon: 28.7527 },
        elevation: 325,
      },
      end2: {
        designator: '34L',
        heading: 343,
        threshold: { lat: 41.2494, lon: 28.7652 },
        elevation: 310,
      },
      end1Ils: { frequency: 108.9, course: 163, glideslope: 3.0, category: 'IIIA' },
      end2Ils: { frequency: 111.1, course: 343, glideslope: 3.0, category: 'IIIA' },
    }),
    createRunway({
      id: '17L/35R',
      length: 14763,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '17L',
        heading: 173,
        threshold: { lat: 41.2823, lon: 28.7714 },
        elevation: 320,
      },
      end2: {
        designator: '35R',
        heading: 353,
        threshold: { lat: 41.2411, lon: 28.7777 },
        elevation: 305,
      },
      end1Ils: { frequency: 109.3, course: 173, glideslope: 3.0, category: 'IIIA' },
      end2Ils: { frequency: 110.7, course: 353, glideslope: 3.0, category: 'IIIA' },
    }),
  ]);

  // OMDB - Dubai International
  addAirportRunways('OMDB', [
    createRunway({
      id: '12L/30R',
      length: 13123,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '12L',
        heading: 119,
        threshold: { lat: 25.2677, lon: 55.3297 },
        elevation: 62,
      },
      end2: {
        designator: '30R',
        heading: 299,
        threshold: { lat: 25.2406, lon: 55.3794 },
        elevation: 34,
      },
      end1Ils: { frequency: 110.1, course: 119, glideslope: 3.0, category: 'IIIB' },
      end2Ils: { frequency: 111.7, course: 299, glideslope: 3.0, category: 'IIIB' },
    }),
    createRunway({
      id: '12R/30L',
      length: 14763,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '12R',
        heading: 119,
        threshold: { lat: 25.2538, lon: 55.3244 },
        elevation: 55,
      },
      end2: {
        designator: '30L',
        heading: 299,
        threshold: { lat: 25.2245, lon: 55.3789 },
        elevation: 25,
      },
      end1Ils: { frequency: 109.5, course: 119, glideslope: 3.0, category: 'IIIB' },
      end2Ils: { frequency: 110.9, course: 299, glideslope: 3.0, category: 'IIIB' },
    }),
  ]);

  // LFPG - Paris Charles de Gaulle
  addAirportRunways('LFPG', [
    createRunway({
      id: '08L/26R',
      length: 8858,
      width: 148,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '08L',
        heading: 85,
        threshold: { lat: 49.0186, lon: 2.5111 },
        elevation: 377,
      },
      end2: {
        designator: '26R',
        heading: 265,
        threshold: { lat: 49.0206, lon: 2.5492 },
        elevation: 387,
      },
      end1Ils: { frequency: 110.3, course: 85, glideslope: 3.0, category: 'I' },
      end2Ils: { frequency: 108.7, course: 265, glideslope: 3.0, category: 'IIIA' },
    }),
    createRunway({
      id: '08R/26L',
      length: 13829,
      width: 148,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '08R',
        heading: 85,
        threshold: { lat: 49.0078, lon: 2.5083 },
        elevation: 361,
      },
      end2: {
        designator: '26L',
        heading: 265,
        threshold: { lat: 49.0114, lon: 2.5692 },
        elevation: 380,
      },
      end1Ils: { frequency: 111.5, course: 85, glideslope: 3.0, category: 'IIIA' },
      end2Ils: { frequency: 109.1, course: 265, glideslope: 3.0, category: 'IIIB' },
    }),
    createRunway({
      id: '09L/27R',
      length: 8858,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '09L',
        heading: 92,
        threshold: { lat: 48.9986, lon: 2.5417 },
        elevation: 370,
      },
      end2: {
        designator: '27R',
        heading: 272,
        threshold: { lat: 48.9978, lon: 2.5800 },
        elevation: 380,
      },
      end1Ils: { frequency: 110.9, course: 92, glideslope: 3.0, category: 'I' },
      end2Ils: { frequency: 108.5, course: 272, glideslope: 3.0, category: 'IIIA' },
    }),
    createRunway({
      id: '09R/27L',
      length: 13829,
      width: 148,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '09R',
        heading: 92,
        threshold: { lat: 48.9878, lon: 2.5389 },
        elevation: 354,
      },
      end2: {
        designator: '27L',
        heading: 272,
        threshold: { lat: 48.9861, lon: 2.5997 },
        elevation: 370,
      },
      end1Ils: { frequency: 109.7, course: 92, glideslope: 3.0, category: 'IIIB' },
      end2Ils: { frequency: 111.9, course: 272, glideslope: 3.0, category: 'IIIA' },
    }),
  ]);

  // EDDF - Frankfurt
  addAirportRunways('EDDF', [
    createRunway({
      id: '07L/25R',
      length: 13123,
      width: 148,
      surface: 'CON',
      lighted: true,
      end1: {
        designator: '07L',
        heading: 73,
        threshold: { lat: 50.0239, lon: 8.4819 },
        elevation: 343,
      },
      end2: {
        designator: '25R',
        heading: 253,
        threshold: { lat: 50.0378, lon: 8.5378 },
        elevation: 325,
      },
      end1Ils: { frequency: 110.3, course: 73, glideslope: 3.0, category: 'IIIB' },
      end2Ils: { frequency: 109.7, course: 253, glideslope: 3.0, category: 'IIIB' },
    }),
    createRunway({
      id: '07R/25L',
      length: 13123,
      width: 148,
      surface: 'CON',
      lighted: true,
      end1: {
        designator: '07R',
        heading: 73,
        threshold: { lat: 50.0172, lon: 8.4853 },
        elevation: 348,
      },
      end2: {
        designator: '25L',
        heading: 253,
        threshold: { lat: 50.0311, lon: 8.5411 },
        elevation: 328,
      },
      end1Ils: { frequency: 111.1, course: 73, glideslope: 3.0, category: 'IIIB' },
      end2Ils: { frequency: 108.7, course: 253, glideslope: 3.0, category: 'IIIB' },
    }),
    createRunway({
      id: '18/36',
      length: 13123,
      width: 148,
      surface: 'CON',
      lighted: true,
      end1: {
        designator: '18',
        heading: 181,
        threshold: { lat: 50.0539, lon: 8.5719 },
        elevation: 343,
      },
      end2: {
        designator: '36',
        heading: 1,
        threshold: { lat: 50.0178, lon: 8.5700 },
        elevation: 328,
      },
      end1Ils: { frequency: 110.9, course: 181, glideslope: 3.0, category: 'I' },
      end2Ils: { frequency: 108.5, course: 1, glideslope: 3.0, category: 'I' },
    }),
  ]);

  // RJTT - Tokyo Haneda
  addAirportRunways('RJTT', [
    createRunway({
      id: '04/22',
      length: 9843,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '04',
        heading: 40,
        threshold: { lat: 35.5450, lon: 139.7658 },
        elevation: 35,
      },
      end2: {
        designator: '22',
        heading: 220,
        threshold: { lat: 35.5667, lon: 139.7875 },
        elevation: 21,
      },
      end1Ils: { frequency: 110.1, course: 40, glideslope: 3.0, category: 'IIIA' },
      end2Ils: { frequency: 108.5, course: 220, glideslope: 3.0, category: 'I' },
    }),
    createRunway({
      id: '05/23',
      length: 8202,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '05',
        heading: 40,
        threshold: { lat: 35.5528, lon: 139.7858 },
        elevation: 25,
      },
      end2: {
        designator: '23',
        heading: 220,
        threshold: { lat: 35.5714, lon: 139.8047 },
        elevation: 15,
      },
      end2Ils: { frequency: 109.3, course: 220, glideslope: 3.0, category: 'IIIA' },
    }),
    createRunway({
      id: '16L/34R',
      length: 9843,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '16L',
        heading: 160,
        threshold: { lat: 35.5714, lon: 139.7656 },
        elevation: 35,
      },
      end2: {
        designator: '34R',
        heading: 340,
        threshold: { lat: 35.5433, lon: 139.7758 },
        elevation: 12,
      },
      end1Ils: { frequency: 111.7, course: 160, glideslope: 3.0, category: 'I' },
      end2Ils: { frequency: 110.5, course: 340, glideslope: 3.0, category: 'IIIA' },
    }),
    createRunway({
      id: '16R/34L',
      length: 9843,
      width: 197,
      surface: 'ASP',
      lighted: true,
      end1: {
        designator: '16R',
        heading: 160,
        threshold: { lat: 35.5714, lon: 139.7844 },
        elevation: 20,
      },
      end2: {
        designator: '34L',
        heading: 340,
        threshold: { lat: 35.5433, lon: 139.7947 },
        elevation: 7,
      },
      end1Ils: { frequency: 109.9, course: 160, glideslope: 3.0, category: 'IIIB' },
      end2Ils: { frequency: 108.9, course: 340, glideslope: 3.0, category: 'I' },
    }),
  ]);
}

// Initialize on module load
initializeDefaultRunways();

// ============================================================================
// EXPORTS - Already exported inline, this block is for backwards compatibility
// ============================================================================

// Functions already exported inline with 'export function' syntax
// No additional exports needed
