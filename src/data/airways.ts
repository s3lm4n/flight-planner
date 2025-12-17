/**
 * Airways Database
 * 
 * MOCK DATA NOTICE:
 * This file contains SIMULATED airway data that follows real aviation conventions.
 * Fix positions are realistic but may not match actual published airways exactly.
 * 
 * TO REPLACE WITH REAL DATA:
 * 1. Subscribe to AIRAC data provider
 * 2. Parse ATS route data from ARINC 424
 * 3. Import from national AIPs (Aeronautical Information Publications)
 */

import { Airway, AirwayFix, Coordinate } from '@/types';

function createFix(id: string, position: Coordinate, options?: { minAltitude?: number; maxAltitude?: number }): AirwayFix {
  return {
    id,
    position,
    ...options
  };
}

// ============================================================================
// HIGH-ALTITUDE JET ROUTES (J-Routes) - US
// ============================================================================

export const J60: Airway = {
  id: 'J60',
  type: 'J',
  minAltitude: 18000,
  maxAltitude: 45000,
  direction: 'TWO_WAY',
  fixes: [
    createFix('WAVEY', { lat: 40.2833, lon: -73.4500 }),
    createFix('BETTE', { lat: 40.5833, lon: -73.5000 }),
    createFix('MERIT', { lat: 40.4917, lon: -73.6833 }),
    createFix('SAX', { lat: 41.0667, lon: -74.5333 }), // VOR
    createFix('ELIOT', { lat: 41.2833, lon: -75.0167 }),
    createFix('ETG', { lat: 41.5167, lon: -75.5833 }), // VOR
  ]
};

export const J64: Airway = {
  id: 'J64',
  type: 'J',
  minAltitude: 18000,
  maxAltitude: 45000,
  direction: 'TWO_WAY',
  fixes: [
    createFix('JFK', { lat: 40.6413, lon: -73.7781 }), // VOR
    createFix('COATE', { lat: 40.6000, lon: -73.3333 }),
    createFix('HAAYS', { lat: 40.6833, lon: -72.7500 }),
    createFix('HTO', { lat: 40.9333, lon: -72.2500 }), // VOR
    createFix('WITCH', { lat: 41.2167, lon: -71.5000 }),
    createFix('PVD', { lat: 41.7167, lon: -71.4333 }), // VOR
  ]
};

export const J75: Airway = {
  id: 'J75',
  type: 'J',
  minAltitude: 18000,
  maxAltitude: 45000,
  direction: 'TWO_WAY',
  fixes: [
    createFix('EWR', { lat: 40.6895, lon: -74.1745 }), // VOR
    createFix('COATE', { lat: 40.6000, lon: -73.3333 }),
    createFix('NEION', { lat: 40.5000, lon: -73.5000 }),
    createFix('JFK', { lat: 40.6413, lon: -73.7781 }), // VOR
    createFix('BAYYS', { lat: 40.4167, lon: -73.9333 }),
    createFix('DIXIE', { lat: 39.9000, lon: -74.2667 }),
  ]
};

// ============================================================================
// LOW-ALTITUDE VICTOR AIRWAYS (V-Routes) - US
// ============================================================================

export const V1: Airway = {
  id: 'V1',
  type: 'V',
  minAltitude: 1200,
  maxAltitude: 17999,
  direction: 'TWO_WAY',
  fixes: [
    createFix('JFK', { lat: 40.6413, lon: -73.7781 }),
    createFix('DPK', { lat: 40.8000, lon: -73.6333 }), // VOR
    createFix('BDR', { lat: 41.1667, lon: -73.1333 }), // VOR
    createFix('MAD', { lat: 41.4500, lon: -72.8333 }), // VOR
    createFix('HFD', { lat: 41.7667, lon: -72.6833 }), // VOR
  ]
};

export const V16: Airway = {
  id: 'V16',
  type: 'V',
  minAltitude: 1200,
  maxAltitude: 17999,
  direction: 'TWO_WAY',
  fixes: [
    createFix('LAX', { lat: 33.9425, lon: -118.4081 }),
    createFix('SLI', { lat: 33.7833, lon: -118.0500 }), // VOR
    createFix('PDZ', { lat: 33.9333, lon: -117.7833 }), // VOR
    createFix('OCN', { lat: 33.3667, lon: -117.4167 }), // VOR
  ]
};

// ============================================================================
// RNAV ROUTES (T/Q Routes) - US
// ============================================================================

export const T233: Airway = {
  id: 'T233',
  type: 'T',
  minAltitude: 2000,
  maxAltitude: 17999,
  direction: 'TWO_WAY',
  fixes: [
    createFix('WAVEY', { lat: 40.2833, lon: -73.4500 }),
    createFix('SHIPP', { lat: 40.3667, lon: -73.5500 }),
    createFix('GREKO', { lat: 40.4333, lon: -73.6333 }),
    createFix('HAPIE', { lat: 40.5450, lon: -73.7200 }),
  ]
};

export const Q64: Airway = {
  id: 'Q64',
  type: 'Q',
  minAltitude: 18000,
  maxAltitude: 45000,
  direction: 'TWO_WAY',
  fixes: [
    createFix('MERIT', { lat: 40.4917, lon: -73.6833 }),
    createFix('CANDR', { lat: 40.3500, lon: -73.8500 }),
    createFix('MINKS', { lat: 40.2000, lon: -74.0500 }),
    createFix('DIXIE', { lat: 39.9000, lon: -74.2667 }),
  ]
};

// ============================================================================
// EUROPEAN AIRWAYS
// ============================================================================

export const L9: Airway = {
  id: 'L9',
  type: 'L',
  minAltitude: 5000,
  maxAltitude: 46000,
  direction: 'TWO_WAY',
  fixes: [
    createFix('LAM', { lat: 51.6558, lon: 0.1536 }), // VOR
    createFix('BRAIN', { lat: 51.6200, lon: 0.0500 }),
    createFix('LOGAN', { lat: 51.5800, lon: -0.1000 }),
    createFix('BPK', { lat: 51.7500, lon: -0.9000 }), // VOR
    createFix('WOBUN', { lat: 51.5800, lon: -0.7000 }),
  ]
};

export const UN57: Airway = {
  id: 'UN57',
  type: 'L',
  minAltitude: 24500,
  maxAltitude: 46000,
  direction: 'TWO_WAY',
  fixes: [
    createFix('CPT', { lat: 51.0789, lon: 1.1500 }), // VOR
    createFix('DVR', { lat: 51.1500, lon: 1.3500 }), // VOR
    createFix('KONAN', { lat: 51.2500, lon: 1.8000 }),
    createFix('RINTI', { lat: 51.3000, lon: 2.2500 }),
  ]
};

export const UL607: Airway = {
  id: 'UL607',
  type: 'L',
  minAltitude: 24500,
  maxAltitude: 46000,
  direction: 'TWO_WAY',
  fixes: [
    createFix('EGLL', { lat: 51.4700, lon: -0.4543 }),
    createFix('WOBUN', { lat: 51.5800, lon: -0.7000 }),
    createFix('DAVRY', { lat: 51.7000, lon: -1.0000 }),
    createFix('EXMOR', { lat: 51.9500, lon: -1.7000 }),
    createFix('BADIM', { lat: 52.2000, lon: -2.4000 }),
  ]
};

// ============================================================================
// MIDDLE EAST / TURKEY AIRWAYS
// ============================================================================

export const UM688: Airway = {
  id: 'UM688',
  type: 'M',
  minAltitude: 24500,
  maxAltitude: 46000,
  direction: 'TWO_WAY',
  fixes: [
    createFix('TURAL', { lat: 41.0500, lon: 28.6500 }),
    createFix('GOKEL', { lat: 40.9000, lon: 28.5000 }),
    createFix('ELBAL', { lat: 40.7500, lon: 28.3500 }),
    createFix('VAYDA', { lat: 40.6000, lon: 28.9500 }),
  ]
};

export const UB3: Airway = {
  id: 'UB3',
  type: 'L',
  minAltitude: 24500,
  maxAltitude: 46000,
  direction: 'TWO_WAY',
  fixes: [
    createFix('LTFM', { lat: 41.2753, lon: 28.7519 }),
    createFix('TEBRA', { lat: 41.5000, lon: 29.0000 }),
    createFix('BEKPA', { lat: 41.6500, lon: 29.2000 }),
    createFix('OLKUM', { lat: 41.8000, lon: 29.5000 }),
  ]
};

// ============================================================================
// TRANSATLANTIC TRACKS (North Atlantic Organized Track System - NAT OTS)
// Note: These change daily; these are example positions
// ============================================================================

export const NAT_A: Airway = {
  id: 'NAT_A',
  type: 'J',
  minAltitude: 29000,
  maxAltitude: 45000,
  direction: 'ONE_WAY', // Westbound typically
  fixes: [
    createFix('SUNOT', { lat: 55.0000, lon: -15.0000 }),
    createFix('55/20', { lat: 55.0000, lon: -20.0000 }),
    createFix('55/30', { lat: 55.0000, lon: -30.0000 }),
    createFix('55/40', { lat: 55.0000, lon: -40.0000 }),
    createFix('55/50', { lat: 55.0000, lon: -50.0000 }),
    createFix('CARPE', { lat: 54.5000, lon: -55.0000 }),
  ]
};

// ============================================================================
// AIRWAY DATABASE
// ============================================================================

export const airways: Record<string, Airway> = {
  // US Jet Routes
  J60,
  J64,
  J75,
  
  // US Victor Airways
  V1,
  V16,
  
  // US RNAV Routes
  T233,
  Q64,
  
  // European Airways
  L9,
  UN57,
  UL607,
  
  // Middle East / Turkey
  UM688,
  UB3,
  
  // NAT Tracks
  NAT_A
};

/**
 * Get airway by identifier
 */
export function getAirway(id: string): Airway | undefined {
  return airways[id.toUpperCase()];
}

/**
 * Get all airways
 */
export function getAllAirways(): Airway[] {
  return Object.values(airways);
}

/**
 * Find airways that pass through a specific fix
 */
export function findAirwaysByFix(fixId: string): Airway[] {
  const upperFixId = fixId.toUpperCase();
  return Object.values(airways).filter(airway =>
    airway.fixes.some(fix => fix.id.toUpperCase() === upperFixId)
  );
}

/**
 * Find airway segment between two fixes
 */
export function findAirwaySegment(
  airwayId: string,
  fromFix: string,
  toFix: string
): AirwayFix[] | null {
  const airway = getAirway(airwayId);
  if (!airway) return null;
  
  const fromIndex = airway.fixes.findIndex(f => f.id.toUpperCase() === fromFix.toUpperCase());
  const toIndex = airway.fixes.findIndex(f => f.id.toUpperCase() === toFix.toUpperCase());
  
  if (fromIndex === -1 || toIndex === -1) return null;
  
  if (fromIndex < toIndex) {
    return airway.fixes.slice(fromIndex, toIndex + 1);
  } else {
    return airway.fixes.slice(toIndex, fromIndex + 1).reverse();
  }
}

/**
 * Get fixes along an airway
 */
export function getAirwayFixes(airwayId: string): AirwayFix[] {
  const airway = getAirway(airwayId);
  return airway ? airway.fixes : [];
}
