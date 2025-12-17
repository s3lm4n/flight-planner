/**
 * Enhanced Aircraft Types
 * 
 * Comprehensive aircraft type definitions with realistic performance data
 * for flight planning validation.
 */

// ============================================================================
// AIRCRAFT CLASSIFICATION
// ============================================================================

/** ICAO wake turbulence category */
export type WakeTurbulenceCategory = 'L' | 'M' | 'H' | 'J';  // Light, Medium, Heavy, Super (J380)

/** Approach category (based on Vref speed) */
export type ApproachCategory = 'A' | 'B' | 'C' | 'D' | 'E';

/** Engine type */
export type EngineType = 'JET' | 'TURBOPROP' | 'PISTON';

/** Aircraft weight class */
export type WeightClass = 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'SUPER';

// ============================================================================
// PERFORMANCE REQUIREMENTS
// ============================================================================

/** Runway requirements */
export interface RunwayRequirements {
  // Takeoff (meters)
  minTakeoffRunway: number;        // Minimum runway length for takeoff
  takeoffDistance: number;         // Takeoff distance at MTOW, ISA, sea level
  takeoffDistanceFactorPerC: number;  // Increase per degree C above ISA (%)
  takeoffDistanceFactorPer1000ft: number; // Increase per 1000ft elevation (%)
  
  // Landing (meters)
  minLandingRunway: number;        // Minimum runway length for landing
  landingDistance: number;         // Landing distance at MLW, dry runway
  landingDistanceWet: number;      // Landing distance on wet runway
  
  // Surface requirements
  minRunwayWidth: number;          // Minimum runway width (meters)
  allowedSurfaces: string[];       // Allowed surface types
  requiresPavedRunway: boolean;    // Whether paved runway is required
}

/** Wind limitations */
export interface WindLimitations {
  maxCrosswind: number;            // Maximum crosswind component (knots)
  maxCrosswindWet: number;         // Max crosswind on wet runway (knots)
  maxTailwind: number;             // Maximum tailwind component (knots)
  maxHeadwind: number;             // Maximum headwind (rarely limiting)
  gustFactor: number;              // Factor to add gusts to limits
}

/** Performance speeds (knots) */
export interface PerformanceSpeeds {
  // Takeoff
  v1: number;                      // Decision speed
  vR: number;                      // Rotation speed
  v2: number;                      // Takeoff safety speed
  
  // Climb/Cruise/Descent
  climbSpeed: number;              // Initial climb IAS
  cruiseSpeed: number;             // Normal cruise TAS
  cruiseMach?: number;             // Cruise mach number
  descentSpeed: number;            // Descent IAS
  
  // Approach/Landing
  vRef: number;                    // Reference landing speed
  vApp: number;                    // Approach speed
  
  // Limits
  vmo: number;                     // Maximum operating speed
  mmo?: number;                    // Maximum operating mach
  stallSpeedClean: number;         // Stall speed (clean config)
  stallSpeedLanding: number;       // Stall speed (landing config)
}

/** Climb/descent performance */
export interface ClimbDescentPerformance {
  // Climb
  initialClimbRate: number;        // ft/min at sea level
  cruiseClimbRate: number;         // ft/min at cruise altitude
  climbGradient: number;           // % gradient
  timeToFL350: number;             // Minutes to FL350
  
  // Descent
  normalDescentRate: number;       // ft/min normal
  maxDescentRate: number;          // ft/min maximum
  descentGradient: number;         // Normal descent gradient
  
  // Top of descent calculation factors
  descentDistanceFactor: number;   // NM per 1000ft to lose
}

/** Altitude capabilities */
export interface AltitudeCapabilities {
  serviceCeiling: number;          // Maximum altitude (feet)
  optimalCruiseAltitude: number;   // Best fuel efficiency altitude
  maxTakeoffAltitude: number;      // Maximum airport elevation for takeoff
  maxLandingAltitude: number;      // Maximum airport elevation for landing
  pressurizedCabin: boolean;       // Has pressurized cabin
}

/** Fuel data */
export interface FuelData {
  capacity: number;                // Total fuel capacity (kg)
  maxRange: number;                // Maximum range (nm)
  cruiseFuelBurn: number;          // Fuel burn at cruise (kg/hr)
  climbFuelBurn: number;           // Fuel burn during climb (kg/hr)
  descentFuelBurn: number;         // Fuel burn during descent (kg/hr)
  taxiFuelBurn: number;            // Fuel burn during taxi (kg/hr)
  reserveMinutes: number;          // Required reserve fuel (minutes)
  alternateMinutes: number;        // Fuel for alternate (minutes)
}

/** Weight data */
export interface WeightData {
  oew: number;                     // Operating empty weight (kg)
  mtow: number;                    // Maximum takeoff weight (kg)
  mlw: number;                     // Maximum landing weight (kg)
  mzfw: number;                    // Maximum zero fuel weight (kg)
  maxPayload: number;              // Maximum payload (kg)
}

// ============================================================================
// COMPLETE AIRCRAFT TYPE
// ============================================================================

/** Complete aircraft definition */
export interface EnhancedAircraft {
  // Identification
  icaoCode: string;                // ICAO type designator (e.g., "B738")
  iataCode?: string;               // IATA type code
  name: string;                    // Full name (e.g., "Boeing 737-800")
  manufacturer: string;            // Manufacturer name
  model: string;                   // Model designation
  variant?: string;                // Variant (e.g., "ER", "NGX")
  
  // Classification
  wakeTurbulenceCategory: WakeTurbulenceCategory;
  approachCategory: ApproachCategory;
  engineType: EngineType;
  engineCount: number;
  weightClass: WeightClass;
  
  // Performance
  speeds: PerformanceSpeeds;
  runwayRequirements: RunwayRequirements;
  windLimitations: WindLimitations;
  climbDescent: ClimbDescentPerformance;
  altitude: AltitudeCapabilities;
  fuel: FuelData;
  weights: WeightData;
  
  // Dimensions (meters)
  dimensions: {
    wingspan: number;
    length: number;
    height: number;
    wheelbase: number;
  };
  
  // Operational
  crewRequired: number;
  maxPassengers: number;
  
  // Validation flags
  isValidated: boolean;
  dataSource: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/** Validation result severity */
export type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING';

/** Single validation issue */
export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: 'RUNWAY' | 'WIND' | 'WEATHER' | 'NOTAM' | 'PERFORMANCE' | 'FUEL';
  title: string;
  message: string;
  details?: string;
  affectedAirport?: string;
  affectedRunway?: string;
  currentValue?: number | string;
  requiredValue?: number | string;
  recommendation?: string;
}

/** Complete validation result */
export interface FlightValidationResult {
  isValid: boolean;
  canProceed: boolean;
  issues: ValidationIssue[];
  departureValidation: AirportValidation;
  arrivalValidation: AirportValidation;
  timestamp: Date;
}

/** Airport-specific validation */
export interface AirportValidation {
  icao: string;
  isValid: boolean;
  issues: ValidationIssue[];
  
  // Runway analysis
  suitableRunways: RunwayAnalysis[];
  recommendedRunway?: string;
  
  // Weather impact
  weatherValid: boolean;
  windComponents?: WindComponents;
  
  // NOTAMs
  relevantNotams: string[];
  hasBlockingNotam: boolean;
}

/** Runway suitability analysis */
export interface RunwayAnalysis {
  runwayId: string;
  designator: string;
  isSuitable: boolean;
  issues: ValidationIssue[];
  
  // Length analysis
  availableLength: number;
  requiredLength: number;
  lengthMargin: number;
  
  // Surface analysis
  surfaceCompatible: boolean;
  
  // Wind analysis
  headwindComponent: number;
  crosswindComponent: number;
  tailwindComponent: number;
  windValid: boolean;
  
  // Overall score (higher is better)
  suitabilityScore: number;
}

/** Wind components for a runway */
export interface WindComponents {
  windDirection: number;
  windSpeed: number;
  gustSpeed?: number;
  runwayHeading: number;
  headwind: number;
  crosswind: number;
  tailwind: number;
}
