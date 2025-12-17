/**
 * Enhanced Airport and Runway Types
 * 
 * Comprehensive type definitions for airports, runways, and related data
 * loaded from ICAO-compatible aviation data services.
 */

import { Coordinate } from './index';

// ============================================================================
// RUNWAY TYPES
// ============================================================================

/** Runway surface types following ICAO standards */
export type RunwaySurfaceType = 
  | 'ASP'   // Asphalt
  | 'CON'   // Concrete
  | 'GRS'   // Grass
  | 'GRV'   // Gravel
  | 'PEM'   // Partially concrete
  | 'WATER' // Water (seaplane bases)
  | 'ICE'   // Ice
  | 'SAND'  // Sand
  | 'CLAY'  // Clay
  | 'DIRT'  // Dirt
  | 'COP'   // Composite
  | 'BIT'   // Bitumen
  | 'UNKNOWN';

/** Runway status */
export type RunwayStatus = 'OPEN' | 'CLOSED' | 'MAINTENANCE' | 'RESTRICTED';

/** Enhanced runway data */
export interface EnhancedRunway {
  id: string;                    // e.g., "09/27" or "09L/27R"
  designator: string;            // Primary designator
  reciprocalDesignator: string;  // Opposite end designator
  
  // Dimensions (meters)
  lengthMeters: number;
  widthMeters: number;
  
  // Surface
  surface: RunwaySurfaceType;
  surfaceCondition?: 'DRY' | 'WET' | 'CONTAMINATED' | 'ICY';
  
  // Headings (magnetic degrees)
  headingTrue: number;
  headingMagnetic: number;
  reciprocalHeadingTrue: number;
  reciprocalHeadingMagnetic: number;
  
  // Elevations (feet MSL)
  thresholdElevation: number;
  reciprocalThresholdElevation: number;
  
  // Coordinates
  thresholdPosition: Coordinate;
  reciprocalThresholdPosition: Coordinate;
  
  // Status
  status: RunwayStatus;
  
  // Additional info
  lighting: boolean;
  ils: boolean;
  ilsCategory?: 'I' | 'II' | 'IIIA' | 'IIIB' | 'IIIC';
  
  // Operational data
  displacedThresholdMeters?: number;
  stopwayMeters?: number;
  clearwayMeters?: number;
  
  // Declared distances (meters)
  tora: number;  // Take-off Run Available
  toda: number;  // Take-off Distance Available
  asda: number;  // Accelerate-Stop Distance Available
  lda: number;   // Landing Distance Available
}

// ============================================================================
// AIRPORT TYPES
// ============================================================================

/** Airport type classification */
export type AirportType = 
  | 'LARGE_AIRPORT'
  | 'MEDIUM_AIRPORT'
  | 'SMALL_AIRPORT'
  | 'HELIPORT'
  | 'SEAPLANE_BASE'
  | 'CLOSED';

/** Enhanced airport data from ICAO API */
export interface EnhancedAirport {
  // Identifiers
  icao: string;
  iata?: string;
  name: string;
  
  // Location
  city: string;
  region?: string;
  country: string;
  countryCode: string;
  position: Coordinate;
  
  // Elevation (feet MSL)
  elevation: number;
  
  // Magnetic variation
  magneticVariation: number;
  
  // Classification
  type: AirportType;
  
  // Timezone
  timezone: string;
  
  // Runways
  runways: EnhancedRunway[];
  
  // Communications (MHz)
  frequencies?: {
    atis?: number;
    ground?: number;
    tower?: number;
    approach?: number;
    departure?: number;
    clearance?: number;
  };
  
  // Operational info
  operatingHours?: string;  // e.g., "H24" or "HJ" (daylight)
  fuelAvailable?: string[];
  services?: string[];
  
  // Last update timestamp
  lastUpdated?: Date;
}

// ============================================================================
// NOTAM TYPES
// ============================================================================

/** NOTAM type */
export type NotamType = 
  | 'RUNWAY'
  | 'TAXIWAY'
  | 'APRON'
  | 'LIGHTING'
  | 'NAVIGATION'
  | 'AIRSPACE'
  | 'OBSTACLE'
  | 'PROCEDURE'
  | 'OTHER';

/** NOTAM severity */
export type NotamSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/** NOTAM data */
export interface Notam {
  id: string;
  icao: string;
  type: NotamType;
  severity: NotamSeverity;
  
  // Content
  text: string;
  rawText: string;
  
  // Validity
  effectiveFrom: Date;
  effectiveTo: Date;
  isPermanent: boolean;
  
  // Location (if applicable)
  affectedRunway?: string;
  affectedArea?: string;
  
  // Impact on operations
  impactsRunway: boolean;
  impactsTakeoff: boolean;
  impactsLanding: boolean;
  reducedRunwayLength?: number;  // Meters
  
  // Timestamps
  created: Date;
  lastModified: Date;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/** ICAO API airport response */
export interface IcaoAirportResponse {
  id: string;
  icao: string;
  iata?: string;
  name: string;
  city: string;
  region?: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  elevation_ft: number;
  magnetic_variation: number;
  type: string;
  timezone: string;
  runways?: IcaoRunwayResponse[];
}

/** ICAO API runway response */
export interface IcaoRunwayResponse {
  id: string;
  runway_id: string;
  length_ft: number;
  width_ft: number;
  surface: string;
  le_ident: string;
  le_heading_deg_true: number;
  le_heading_deg_mag?: number;
  le_latitude: number;
  le_longitude: number;
  le_elevation_ft: number;
  he_ident: string;
  he_heading_deg_true: number;
  he_heading_deg_mag?: number;
  he_latitude: number;
  he_longitude: number;
  he_elevation_ft: number;
  lighted: boolean;
  closed?: boolean;
}

/** ICAO API NOTAM response */
export interface IcaoNotamResponse {
  id: string;
  icao: string;
  notam_text: string;
  notam_raw: string;
  type: string;
  effective_start: string;
  effective_end: string;
  is_permanent: boolean;
  created: string;
  modified: string;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

/** Airport cache entry */
export interface AirportCacheEntry {
  airport: EnhancedAirport;
  fetchedAt: Date;
  expiresAt: Date;
}

/** NOTAM cache entry */
export interface NotamCacheEntry {
  notams: Notam[];
  fetchedAt: Date;
  expiresAt: Date;
}

// ============================================================================
// FILTER/SEARCH TYPES
// ============================================================================

/** Airport search filters */
export interface AirportSearchFilters {
  query?: string;
  country?: string;
  type?: AirportType[];
  minRunwayLength?: number;
  maxResults?: number;
  region?: 'europe' | 'turkey' | 'all';
}

/** Airport search result */
export interface AirportSearchResult {
  airport: EnhancedAirport;
  matchScore: number;
  matchReason: string;
}
