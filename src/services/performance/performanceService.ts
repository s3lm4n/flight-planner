/**
 * Aircraft Performance Service Stubs
 * 
 * Service interfaces for aircraft performance calculations.
 * These are STUBS that will be implemented when performance data becomes available.
 * 
 * Architecture is designed for easy integration with:
 * - RTOW (Regulated Takeoff Weight) calculations
 * - Landing distance calculations
 * - Runway compatibility validation
 */

import { EnhancedAircraft } from '@/types/aircraft';
import { EnhancedAirport, EnhancedRunway } from '@/types/airport';
import { Wind } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

/** Weather conditions affecting performance */
export interface PerformanceConditions {
  temperature: number;           // Celsius
  pressure: number;              // hPa or inHg
  wind: Wind;
  runwayCondition: 'DRY' | 'WET' | 'CONTAMINATED';
  slope?: number;                // Runway slope in %
}

/** Takeoff performance result */
export interface TakeoffPerformance {
  isValid: boolean;
  maxTakeoffWeight: number;      // kg
  regulatedTOW: number;          // kg (RTOW)
  limitingFactor: string;        // What limits RTOW
  
  // Distances
  takeoffRun: number;            // meters
  takeoffDistance: number;       // meters (TODA)
  accelerateStopDistance: number; // meters (ASDA)
  
  // V-speeds
  v1: number;                    // Decision speed
  vR: number;                    // Rotation speed
  v2: number;                    // Safety speed
  
  // Warnings
  warnings: string[];
  errors: string[];
}

/** Landing performance result */
export interface LandingPerformance {
  isValid: boolean;
  maxLandingWeight: number;      // kg
  
  // Distances
  landingDistance: number;       // meters
  actualLandingDistance: number; // meters (with factors)
  goAroundAltitude: number;      // feet
  
  // Speeds
  vRef: number;                  // Reference speed
  vApp: number;                  // Approach speed
  
  // Warnings
  warnings: string[];
  errors: string[];
}

/** Runway compatibility result */
export interface RunwayCompatibility {
  isCompatible: boolean;
  runway: EnhancedRunway;
  
  // Takeoff
  takeoffPossible: boolean;
  takeoffLimitingFactor?: string;
  takeoffMargin: number;         // Remaining runway in meters
  
  // Landing
  landingPossible: boolean;
  landingLimitingFactor?: string;
  landingMargin: number;         // Remaining runway in meters
  
  // Issues
  warnings: string[];
  errors: string[];
}

// ============================================================================
// PERFORMANCE SERVICE INTERFACE
// ============================================================================

export interface IAircraftPerformanceService {
  /**
   * Check if performance data is loaded for aircraft
   */
  isDataLoaded(aircraftType: string): boolean;
  
  /**
   * Calculate takeoff performance
   */
  calculateTakeoffPerformance(
    aircraft: EnhancedAircraft,
    runway: EnhancedRunway,
    conditions: PerformanceConditions,
    weight: number
  ): TakeoffPerformance;
  
  /**
   * Calculate landing performance
   */
  calculateLandingPerformance(
    aircraft: EnhancedAircraft,
    runway: EnhancedRunway,
    conditions: PerformanceConditions,
    weight: number
  ): LandingPerformance;
  
  /**
   * Get RTOW (Regulated Takeoff Weight)
   */
  calculateRTOW(
    aircraft: EnhancedAircraft,
    runway: EnhancedRunway,
    conditions: PerformanceConditions
  ): number;
  
  /**
   * Validate runway compatibility
   */
  validateRunwayCompatibility(
    aircraft: EnhancedAircraft,
    runway: EnhancedRunway,
    conditions: PerformanceConditions
  ): RunwayCompatibility;
}

// ============================================================================
// STUB IMPLEMENTATION
// ============================================================================

/**
 * Stub implementation of Aircraft Performance Service
 * 
 * Returns placeholder values until real performance data is integrated.
 * All methods indicate that performance data is not yet loaded.
 */
export class AircraftPerformanceServiceStub implements IAircraftPerformanceService {
  private static instance: AircraftPerformanceServiceStub;
  
  static getInstance(): AircraftPerformanceServiceStub {
    if (!AircraftPerformanceServiceStub.instance) {
      AircraftPerformanceServiceStub.instance = new AircraftPerformanceServiceStub();
    }
    return AircraftPerformanceServiceStub.instance;
  }
  
  /**
   * Performance data is never loaded in stub
   */
  isDataLoaded(_aircraftType: string): boolean {
    return false;
  }
  
  /**
   * Stub takeoff performance - returns placeholder
   */
  calculateTakeoffPerformance(
    aircraft: EnhancedAircraft,
    runway: EnhancedRunway,
    _conditions: PerformanceConditions,
    _weight: number
  ): TakeoffPerformance {
    // Return stub values based on basic runway length check
    const basicCheck = runway.lengthMeters >= (aircraft.runwayRequirements?.minTakeoffRunway || 1500);
    
    return {
      isValid: false, // Always false - data not loaded
      maxTakeoffWeight: aircraft.weights?.mtow || 0,
      regulatedTOW: 0,
      limitingFactor: 'PERFORMANCE DATA NOT LOADED',
      
      takeoffRun: 0,
      takeoffDistance: 0,
      accelerateStopDistance: 0,
      
      v1: aircraft.speeds?.v1 || 0,
      vR: aircraft.speeds?.vR || 0,
      v2: aircraft.speeds?.v2 || 0,
      
      warnings: basicCheck ? [] : [`Runway ${runway.id} may be too short`],
      errors: ['Performance data not yet loaded. Calculations are estimates only.'],
    };
  }
  
  /**
   * Stub landing performance - returns placeholder
   */
  calculateLandingPerformance(
    aircraft: EnhancedAircraft,
    runway: EnhancedRunway,
    _conditions: PerformanceConditions,
    _weight: number
  ): LandingPerformance {
    const basicCheck = runway.lengthMeters >= (aircraft.runwayRequirements?.minLandingRunway || 1200);
    
    return {
      isValid: false,
      maxLandingWeight: aircraft.weights?.mlw || 0,
      
      landingDistance: 0,
      actualLandingDistance: 0,
      goAroundAltitude: 0,
      
      vRef: aircraft.speeds?.vRef || 0,
      vApp: aircraft.speeds?.vApp || 0,
      
      warnings: basicCheck ? [] : [`Runway ${runway.id} may be too short for landing`],
      errors: ['Performance data not yet loaded. Calculations are estimates only.'],
    };
  }
  
  /**
   * Stub RTOW calculation
   */
  calculateRTOW(
    _aircraft: EnhancedAircraft,
    _runway: EnhancedRunway,
    _conditions: PerformanceConditions
  ): number {
    // Return 0 to indicate no calculation available
    console.warn('RTOW calculation requested but performance data not loaded');
    return 0;
  }
  
  /**
   * Stub runway compatibility check
   */
  validateRunwayCompatibility(
    aircraft: EnhancedAircraft,
    runway: EnhancedRunway,
    _conditions: PerformanceConditions
  ): RunwayCompatibility {
    // Basic compatibility check based on runway length only
    const minTakeoff = aircraft.runwayRequirements?.minTakeoffRunway || 1500;
    const minLanding = aircraft.runwayRequirements?.minLandingRunway || 1200;
    
    const takeoffPossible = runway.lengthMeters >= minTakeoff;
    const landingPossible = runway.lengthMeters >= minLanding;
    
    const warnings: string[] = [];
    const errors: string[] = ['Performance data not loaded - using basic runway length check only'];
    
    if (!takeoffPossible) {
      warnings.push(`Runway may be too short for takeoff (${runway.lengthMeters}m < ${minTakeoff}m required)`);
    }
    if (!landingPossible) {
      warnings.push(`Runway may be too short for landing (${runway.lengthMeters}m < ${minLanding}m required)`);
    }
    
    // Check surface compatibility
    const allowedSurfaces = aircraft.runwayRequirements?.allowedSurfaces || ['ASP', 'CON'];
    if (!allowedSurfaces.includes(runway.surface)) {
      warnings.push(`Runway surface ${runway.surface} may not be suitable for this aircraft`);
    }
    
    return {
      isCompatible: takeoffPossible && landingPossible,
      runway,
      takeoffPossible,
      takeoffLimitingFactor: takeoffPossible ? undefined : 'Runway length',
      takeoffMargin: runway.lengthMeters - minTakeoff,
      landingPossible,
      landingLimitingFactor: landingPossible ? undefined : 'Runway length',
      landingMargin: runway.lengthMeters - minLanding,
      warnings,
      errors,
    };
  }
}

// ============================================================================
// RTOW SERVICE STUB
// ============================================================================

export interface IRTOWService {
  /**
   * Calculate RTOW considering all limitations
   */
  calculate(
    aircraft: EnhancedAircraft,
    airport: EnhancedAirport,
    runway: string,
    conditions: PerformanceConditions
  ): {
    rtow: number;
    limitingFactor: 'STRUCTURAL' | 'CLIMB' | 'OBSTACLE' | 'TIRE_SPEED' | 'BRAKE_ENERGY' | 'UNKNOWN';
    breakdown: Record<string, number>;
    isCalculated: boolean;
  };
}

export class RTOWServiceStub implements IRTOWService {
  private static instance: RTOWServiceStub;
  
  static getInstance(): RTOWServiceStub {
    if (!RTOWServiceStub.instance) {
      RTOWServiceStub.instance = new RTOWServiceStub();
    }
    return RTOWServiceStub.instance;
  }
  
  calculate(
    aircraft: EnhancedAircraft,
    _airport: EnhancedAirport,
    _runway: string,
    _conditions: PerformanceConditions
  ) {
    return {
      rtow: 0,
      limitingFactor: 'UNKNOWN' as const,
      breakdown: {
        structural: aircraft.weights?.mtow || 0,
        climb: 0,
        obstacle: 0,
        tireSpeed: 0,
        brakeEnergy: 0,
      },
      isCalculated: false,
    };
  }
}

// ============================================================================
// LANDING VALIDATION SERVICE STUB
// ============================================================================

export interface ILandingValidationService {
  /**
   * Validate landing capability at airport
   */
  validate(
    aircraft: EnhancedAircraft,
    airport: EnhancedAirport,
    runway: string,
    conditions: PerformanceConditions,
    landingWeight: number
  ): {
    isValid: boolean;
    landingDistanceRequired: number;
    landingDistanceAvailable: number;
    margin: number;
    warnings: string[];
    restrictions: string[];
  };
}

export class LandingValidationServiceStub implements ILandingValidationService {
  private static instance: LandingValidationServiceStub;
  
  static getInstance(): LandingValidationServiceStub {
    if (!LandingValidationServiceStub.instance) {
      LandingValidationServiceStub.instance = new LandingValidationServiceStub();
    }
    return LandingValidationServiceStub.instance;
  }
  
  validate(
    _aircraft: EnhancedAircraft,
    airport: EnhancedAirport,
    runwayId: string,
    _conditions: PerformanceConditions,
    _landingWeight: number
  ) {
    const runway = airport.runways.find(r => r.id === runwayId || r.designator === runwayId);
    const lda = runway?.lda || 0;
    
    return {
      isValid: false, // Cannot validate without performance data
      landingDistanceRequired: 0,
      landingDistanceAvailable: lda,
      margin: lda,
      warnings: ['Landing validation requires performance data'],
      restrictions: ['Performance data not loaded'],
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Get the performance service instance
 * Returns stub until real implementation is available
 */
export function getPerformanceService(): IAircraftPerformanceService {
  return AircraftPerformanceServiceStub.getInstance();
}

export function getRTOWService(): IRTOWService {
  return RTOWServiceStub.getInstance();
}

export function getLandingValidationService(): ILandingValidationService {
  return LandingValidationServiceStub.getInstance();
}
