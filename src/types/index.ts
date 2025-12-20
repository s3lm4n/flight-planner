/**
 * Flight Planner Type Definitions
 * 
 * This file contains all TypeScript interfaces and types for the flight planning system.
 * These types follow real aviation standards and naming conventions.
 */

import { Feature, FeatureCollection, LineString, Point } from 'geojson';

// Re-export runway types from dedicated module
export * from './runway';

// ============================================================================
// GEOGRAPHIC TYPES
// ============================================================================

/** Geographic coordinate in decimal degrees */
export interface Coordinate {
  lat: number;  // Latitude (-90 to 90)
  lon: number;  // Longitude (-180 to 180)
}

/** Position with optional altitude */
export interface Position extends Coordinate {
  altitude?: number;  // Feet MSL
}

// ============================================================================
// AIRPORT TYPES
// ============================================================================

/** Runway surface types */
export type RunwaySurface = 'ASPH' | 'CONC' | 'GRAS' | 'GRVL' | 'WATE';

/** Single runway end */
export interface RunwayEnd {
  designator: string;      // e.g., "09L", "27R"
  heading: number;         // Magnetic heading (degrees)
  threshold: Coordinate;   // Threshold position
  elevation: number;       // Feet MSL
  displacedThreshold?: number; // Feet
  tora: number;            // Take-off run available (feet)
  toda: number;            // Take-off distance available (feet)
  asda: number;            // Accelerate-stop distance available (feet)
  lda: number;             // Landing distance available (feet)
  ils?: {
    frequency: number;     // MHz
    course: number;        // Magnetic course
    glideslope: number;    // Degrees
    categoryType: 'I' | 'II' | 'III';
  };
}

/** Complete runway (both ends) */
export interface Runway {
  id: string;              // e.g., "09L/27R"
  length: number;          // Feet
  width: number;           // Feet
  surface: RunwaySurface;
  ends: [RunwayEnd, RunwayEnd];
  lighting: boolean;
}

/** Parking/Gate position */
export interface ParkingPosition {
  name: string;
  position: Coordinate;
  heading: number;
  type: 'GATE' | 'RAMP' | 'HANGAR' | 'TIE_DOWN';
  size: 'S' | 'M' | 'L' | 'H';  // Small, Medium, Large, Heavy
}

/** Taxiway segment */
export interface TaxiwaySegment {
  name: string;
  path: Coordinate[];
  width: number;           // Feet
  surface: RunwaySurface;
}

/** Complete airport data */
export interface Airport {
  icao: string;            // ICAO code (e.g., "KJFK")
  iata?: string;           // IATA code (e.g., "JFK")
  name: string;            // Full name
  city: string;
  country: string;
  position: Coordinate;
  elevation: number;       // Feet MSL
  magneticVariation: number; // Degrees (positive = East)
  timezone: string;        // IANA timezone
  runways: Runway[];
  parking: ParkingPosition[];
  taxiways: TaxiwaySegment[];
  frequencies: {
    atis?: number;
    ground?: number;
    tower?: number;
    approach?: number;
    departure?: number;
    center?: number;
  };
}

// ============================================================================
// PROCEDURE TYPES (SID, STAR, APPROACH)
// ============================================================================

/** Waypoint type */
export type WaypointType = 
  | 'FIX'           // Named intersection
  | 'VOR'           // VOR navaid
  | 'NDB'           // NDB navaid
  | 'DME'           // DME navaid
  | 'AIRPORT'       // Airport reference point
  | 'RUNWAY'        // Runway threshold
  | 'LATLON';       // Lat/Lon coordinate

/** Altitude constraint type */
export type AltitudeConstraint = 
  | { type: 'at'; altitude: number }
  | { type: 'above'; altitude: number }
  | { type: 'below'; altitude: number }
  | { type: 'between'; min: number; max: number };

/** Speed constraint type */
export type SpeedConstraint = 
  | { type: 'at'; speed: number }
  | { type: 'max'; speed: number }
  | { type: 'min'; speed: number };

/** Simple waypoint for flight legs */
export interface Waypoint {
  id: string;              // Waypoint identifier
  name?: string;           // Display name
  position: Coordinate;
}

/** Waypoint in a procedure */
export interface ProcedureWaypoint extends Waypoint {
  type: WaypointType;
  altitudeConstraint?: AltitudeConstraint;
  speedConstraint?: SpeedConstraint;
  flyOver: boolean;        // Must fly over (vs fly-by)
  holdingPattern?: {
    inboundCourse: number;
    turnDirection: 'L' | 'R';
    legTime?: number;      // Minutes
    legDistance?: number;  // Nautical miles
  };
}

/** Transition type */
export interface Transition {
  name: string;            // Transition name
  waypoints: ProcedureWaypoint[];
}

/** Standard Instrument Departure */
export interface SID {
  id: string;              // Procedure identifier (e.g., "RNAV1")
  name: string;            // Full name
  airportIcao: string;
  runways: string[];       // Applicable runways
  commonRoute: ProcedureWaypoint[];
  transitions: Transition[];
  remarks?: string;
}

/** Standard Terminal Arrival Route */
export interface STAR {
  id: string;
  name: string;
  airportIcao: string;
  runways: string[];
  transitions: Transition[];
  commonRoute: ProcedureWaypoint[];
  remarks?: string;
}

/** Approach type */
export type ApproachType = 
  | 'ILS' | 'RNAV' | 'VOR' | 'NDB' | 'LOC' | 'LDA' | 'GPS' | 'VISUAL';

/** Instrument Approach Procedure */
export interface Approach {
  id: string;              // e.g., "ILS09L"
  name: string;
  type: ApproachType;
  airportIcao: string;
  runway: string;
  finalApproachCourse: number;
  minimums: {
    da?: number;           // Decision altitude (feet)
    mda?: number;          // Minimum descent altitude (feet)
    visibility: number;    // Statute miles or RVR
  };
  transitions: Transition[];
  finalApproach: ProcedureWaypoint[];
  missedApproach: ProcedureWaypoint[];
  remarks?: string;        // Optional notes
}

// ============================================================================
// AIRWAY TYPES
// ============================================================================

/** Airway type */
export type AirwayType = 'J' | 'V' | 'T' | 'Q' | 'L' | 'M';  // Jet, Victor, RNAV, etc.

/** Airway fix */
export interface AirwayFix {
  id: string;
  position: Coordinate;
  minAltitude?: number;
  maxAltitude?: number;
}

/** Airway definition */
export interface Airway {
  id: string;              // e.g., "J60", "V1"
  type: AirwayType;
  fixes: AirwayFix[];
  minAltitude: number;
  maxAltitude: number;
  direction?: 'ONE_WAY' | 'TWO_WAY';
}

// ============================================================================
// AIRCRAFT TYPES
// ============================================================================

/** Aircraft category */
export type AircraftCategory = 'A' | 'B' | 'C' | 'D' | 'E';

/** Wake turbulence category */
export type WakeCategory = 'L' | 'M' | 'H' | 'J';  // Light, Medium, Heavy, Super

/** Aircraft performance data */
export interface AircraftPerformance {
  // Speeds (knots)
  v1: number;              // Decision speed
  vR: number;              // Rotation speed
  v2: number;              // Takeoff safety speed
  vRef: number;            // Reference landing speed
  cruiseSpeed: number;     // True airspeed
  maxSpeed: number;        // VMO/MMO
  stallSpeed: number;      // Clean configuration
  
  // Climb/Descent
  climbRate: number;       // Feet per minute
  descentRate: number;     // Feet per minute
  climbSpeed: number;      // Knots IAS
  descentSpeed: number;    // Knots IAS
  
  // Altitude
  serviceCeiling: number;  // Feet
  optimalAltitude: number; // Feet
  
  // Fuel
  fuelBurn: number;        // Gallons/hour or kg/hour
  fuelCapacity: number;    // Total fuel capacity
  
  // Range
  maxRange: number;        // Nautical miles
}

/** Complete aircraft type definition */
export interface Aircraft {
  icaoType: string;        // e.g., "B738", "A320"
  name: string;            // e.g., "Boeing 737-800"
  manufacturer: string;
  category: AircraftCategory;
  wakeCategory: WakeCategory;
  engineType: 'JET' | 'TURBOPROP' | 'PISTON';
  engineCount: number;
  performance: AircraftPerformance;
  dimensions: {
    wingspan: number;      // Feet
    length: number;        // Feet
    height: number;        // Feet
  };
}

// ============================================================================
// WEATHER TYPES
// ============================================================================

/** Wind data */
export interface Wind {
  direction: number;       // Degrees true (0-360), 0 = variable
  speed: number;           // Knots
  gust?: number;           // Knots
  variable?: {
    from: number;
    to: number;
  };
}

/** Visibility */
export interface Visibility {
  value: number;           // Statute miles
  qualifier?: 'M' | 'P';   // Minus (less than) or Plus (greater than)
}

/** Cloud layer */
export interface CloudLayer {
  coverage: 'SKC' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV';
  altitude: number;        // Hundreds of feet AGL
  type?: 'CB' | 'TCU';     // Cumulonimbus or Towering Cumulus
}

/** Weather phenomena */
export type WeatherPhenomena = 
  | 'RA' | 'SN' | 'DZ' | 'FG' | 'BR' | 'HZ' | 'TS' | 'SH' 
  | 'GR' | 'GS' | 'FZ' | 'BL' | 'MI' | 'PR' | 'BC' | 'DR';

/** Decoded METAR */
export interface Metar {
  raw: string;
  icao: string;
  observationTime: Date;
  wind: Wind;
  visibility: Visibility;
  weather: WeatherPhenomena[];
  clouds: CloudLayer[];
  temperature: number;     // Celsius
  dewpoint: number;        // Celsius
  altimeter: number;       // Inches of mercury (inHg)
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
  remarks?: string;
}

/** TAF forecast period */
export interface TafPeriod {
  type: 'FM' | 'TEMPO' | 'BECMG' | 'PROB';
  probability?: number;    // For PROB (30 or 40)
  from: Date;
  to: Date;
  wind: Wind;
  visibility: Visibility;
  weather: WeatherPhenomena[];
  clouds: CloudLayer[];
}

/** Decoded TAF */
export interface Taf {
  raw: string;
  icao: string;
  issueTime: Date;
  validFrom: Date;
  validTo: Date;
  periods: TafPeriod[];
}

/** Combined weather data for an airport */
export interface AirportWeather {
  icao: string;
  metar?: Metar;
  taf?: Taf;
  fetchedAt: Date;
}

// ============================================================================
// FLIGHT PLAN TYPES
// ============================================================================

/** Route segment type */
export type RouteSegmentType = 'TAXI_OUT' | 'SID' | 'ENROUTE' | 'STAR' | 'APPROACH' | 'TAXI_IN';

/** Single leg of the flight */
export interface FlightLeg {
  id: string;
  from: Waypoint;
  to: Waypoint;
  segmentType: RouteSegmentType;
  distance: number;        // Nautical miles
  course: number;          // Degrees true
  altitude: number;        // Feet
  groundSpeed: number;     // Knots (after wind correction)
  ete: number;             // Estimated time enroute (minutes)
  fuelRequired: number;    // kg
}

/** Complete flight plan */
export interface FlightPlan {
  id: string;
  departure: Airport;
  arrival: Airport;
  alternate?: Airport;
  aircraft: Aircraft | null;
  
  // Procedures
  departureRunway: string;
  arrivalRunway: string;
  sid?: SID;
  sidTransition?: string;
  star?: STAR;
  starTransition?: string;
  approach?: Approach;
  approachTransition?: string;
  
  // Route
  legs: FlightLeg[];
  
  // Summary
  summary: {
    distance: number;      // Nautical miles
    totalTime: number;     // Minutes
    cruiseAltitude: number; // Feet
    estimatedFuel: number;  // kg
  };
  
  // Weather
  departureWeather?: AirportWeather;
  arrivalWeather?: AirportWeather;
  
  // Timing
  createdAt: Date;
  departureTime?: Date;    // Planned
  arrivalTime?: Date;      // Estimated
}

// ============================================================================
// GEOJSON TYPES FOR MAP DISPLAY
// ============================================================================

/** Properties for route GeoJSON features */
export interface RouteFeatureProperties {
  segmentType?: RouteSegmentType;
  legId?: string;
  waypointId?: string;
  waypointName?: string;
  altitude?: number;
  speed?: number;
  distance?: number;
  bearing?: number;
}

/** Route as GeoJSON */
export type RouteGeoJSON = FeatureCollection<LineString | Point, RouteFeatureProperties>;

/** Single route feature */
export type RouteFeature = Feature<LineString | Point, RouteFeatureProperties>;

// ============================================================================
// ANIMATION TYPES
// ============================================================================

/** Animation state for UI */
export interface AnimationState {
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;        // 0-1 for entire flight
  currentLegIndex: number;
  speed: number;           // Playback speed multiplier (1 = realtime, 10 = 10x faster)
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/** Application error */
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/** Raw METAR API response */
export interface MetarApiResponse {
  results: number;
  data: Array<{
    icao: string;
    name: string;
    observed: string;
    raw_text: string;
    barometer?: { hg: number; mb: number };
    clouds?: Array<{ code: string; base_feet_agl?: number; text?: string }>;
    conditions?: Array<{ code: string }>;
    dewpoint?: { celsius: number; fahrenheit: number };
    elevation?: { feet: number; meters: number };
    flight_category?: string;
    humidity?: { percent: number };
    temperature?: { celsius: number; fahrenheit: number };
    visibility?: { miles: string; meters: string };
    wind?: {
      degrees: number;
      speed_kts: number;
      gust_kts?: number;
    };
  }>;
}

/** Raw TAF API response */
export interface TafApiResponse {
  results: number;
  data: Array<{
    icao: string;
    name: string;
    raw_text: string;
    forecast: Array<{
      timestamp: {
        from: string;
        to: string;
      };
      change?: {
        indicator?: { code: string };
        probability?: number;
      };
      wind?: {
        degrees: number;
        speed_kts: number;
        gust_kts?: number;
      };
      visibility?: { miles: string };
      clouds?: Array<{ code: string; base_feet_agl?: number }>;
      conditions?: Array<{ code: string }>;
    }>;
  }>;
}

// Re-export enhanced types from separate modules
// Note: RunwaySurfaceType is defined in both runway.ts and airport.ts
// We use the runway.ts version as authoritative, so selectively export from airport.ts
export { 
  type EnhancedAirport,
  type EnhancedRunway,
  type RunwayStatus,
  type AirportType,
  type NotamType,
  type NotamSeverity,
  type Notam,
  type IcaoAirportResponse,
  type IcaoRunwayResponse,
  type IcaoNotamResponse,
  type AirportCacheEntry,
  type NotamCacheEntry,
  type AirportSearchFilters,
  type AirportSearchResult,
} from './airport';

export * from './aircraft';
