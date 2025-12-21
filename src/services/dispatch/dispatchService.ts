/**
 * Dispatch Service
 * 
 * Professional dispatch-level flight planning with:
 * - Fuel calculations (taxi, trip, contingency, alternate, holding, reserve)
 * - Aircraft performance validation
 * - Weather impact assessment
 * - Final GO/NO-GO decision
 * 
 * Follows ICAO/FAR fuel requirements for commercial operations.
 */

import { FlightPlan, Aircraft } from '@/types';
import { EnhancedAircraft, ValidationIssue } from '@/types/aircraft';
import { EnhancedAirport, EnhancedRunway } from '@/types/airport';
import { DecodedMetar } from '@/api/aviationWeather';
import { calculateDistance } from '@/utils/aviation';

// ============================================================================
// TYPES
// ============================================================================

export interface FuelPlan {
  // Component fuels (kg)
  taxiFuel: number;
  tripFuel: number;
  contingencyFuel: number;      // 5% of trip fuel (JAR-OPS) or 10% (FAR)
  alternateFuel: number;        // Fuel to alternate airport
  holdingFuel: number;          // 30 minutes holding at 1500ft
  finalReserveFuel: number;     // 30-45 minutes final reserve
  
  // Totals
  totalFuelRequired: number;
  extraFuel: number;            // Discretionary extra fuel
  totalFuelOnBoard: number;
  
  // Weight
  estimatedLandingWeight: number;
  
  // Time
  totalFlightTime: number;      // minutes
  
  // Feasibility
  isFuelSufficient: boolean;
  fuelMessage: string;
}

export interface DispatchDecision {
  isFeasible: boolean;
  canDispatch: boolean;
  overallStatus: 'GO' | 'NO-GO' | 'CONDITIONAL';
  
  // Component checks
  fuelCheck: {
    passed: boolean;
    message: string;
    fuelPlan: FuelPlan;
  };
  
  rangeCheck: {
    passed: boolean;
    message: string;
    distance: number;
    maxRange: number;
  };
  
  weightCheck: {
    passed: boolean;
    message: string;
    estimatedTakeoffWeight: number;
    mtow: number;
    estimatedLandingWeight: number;
    mlw: number;
  };
  
  runwayCheck: {
    departure: {
      passed: boolean;
      message: string;
      availableRunways: string[];
      requiredLength: number;
    };
    arrival: {
      passed: boolean;
      message: string;
      availableRunways: string[];
      requiredLength: number;
    };
  };
  
  weatherCheck: {
    departure: {
      passed: boolean;
      message: string;
      crosswind: number;
      maxCrosswind: number;
      visibility: number;
      minVisibility: number;
    };
    arrival: {
      passed: boolean;
      message: string;
      crosswind: number;
      maxCrosswind: number;
      visibility: number;
      minVisibility: number;
    };
  };
  
  // All issues
  issues: ValidationIssue[];
  
  // Summary
  summary: string[];
}

export interface DispatchInput {
  flightPlan: FlightPlan;
  aircraft: Aircraft | EnhancedAircraft;
  departureAirport: EnhancedAirport;
  arrivalAirport: EnhancedAirport;
  alternateAirport?: EnhancedAirport;
  departureWeather?: DecodedMetar | null;
  arrivalWeather?: DecodedMetar | null;
  payloadKg?: number;           // Passengers + cargo
  plannedFuelKg?: number;       // If specified, use this instead of calculating
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Fuel planning constants (ICAO/JAR-OPS)
const CONTINGENCY_FACTOR = 0.05;      // 5% of trip fuel
const HOLDING_TIME_MIN = 30;           // 30 minutes holding
const FINAL_RESERVE_TIME_MIN = 30;     // 30 minutes final reserve
const ALTERNATE_DISTANCE_NM = 100;     // Assume 100nm to alternate if not specified

// Minimum weather requirements (IFR)
const MIN_VISIBILITY_TAKEOFF_SM = 0.5;
const MIN_VISIBILITY_LANDING_SM = 0.5;
// Note: Ceiling limits (200ft) are handled in checkWeatherMinimums dynamically

// Default crosswind limits
const DEFAULT_MAX_CROSSWIND_KT = 33;
const DEFAULT_MAX_TAILWIND_KT = 10;

// ============================================================================
// MAIN DISPATCH FUNCTION
// ============================================================================

/**
 * Generate complete dispatch decision
 * Returns GO/NO-GO with detailed breakdown
 */
export function generateDispatchDecision(input: DispatchInput): DispatchDecision {
  const issues: ValidationIssue[] = [];
  const summary: string[] = [];
  
  // Get aircraft performance data
  const aircraftPerf = getAircraftPerformance(input.aircraft);
  
  // -------------------------------------------------------------------------
  // 1. RANGE CHECK
  // -------------------------------------------------------------------------
  const distance = calculateDistance(
    input.departureAirport.position,
    input.arrivalAirport.position
  );
  const maxRange = aircraftPerf.maxRange;
  const rangeCheck = {
    passed: distance <= maxRange * 0.95, // 5% safety margin
    message: '',
    distance: Math.round(distance),
    maxRange: Math.round(maxRange),
  };
  
  if (!rangeCheck.passed) {
    rangeCheck.message = `Route distance ${Math.round(distance)} NM exceeds aircraft max range ${Math.round(maxRange)} NM`;
    issues.push({
      id: 'RANGE_EXCEEDED',
      severity: 'BLOCKING',
      category: 'PERFORMANCE',
      title: 'Range Exceeded',
      message: rangeCheck.message,
      currentValue: distance,
      requiredValue: maxRange,
    });
  } else {
    rangeCheck.message = `Route ${Math.round(distance)} NM is within range (max ${Math.round(maxRange)} NM)`;
  }
  
  // -------------------------------------------------------------------------
  // 2. FUEL PLANNING
  // -------------------------------------------------------------------------
  const fuelPlan = calculateFuelPlan(input, aircraftPerf);
  const fuelCheck = {
    passed: fuelPlan.isFuelSufficient,
    message: fuelPlan.fuelMessage,
    fuelPlan,
  };
  
  if (!fuelCheck.passed) {
    issues.push({
      id: 'FUEL_INSUFFICIENT',
      severity: 'BLOCKING',
      category: 'FUEL',
      title: 'Insufficient Fuel',
      message: fuelPlan.fuelMessage,
      currentValue: fuelPlan.totalFuelOnBoard,
      requiredValue: fuelPlan.totalFuelRequired,
    });
  }
  
  // -------------------------------------------------------------------------
  // 3. WEIGHT CHECK
  // -------------------------------------------------------------------------
  const weightCheck = calculateWeightCheck(input, aircraftPerf, fuelPlan);
  
  if (!weightCheck.passed) {
    issues.push({
      id: 'WEIGHT_EXCEEDED',
      severity: 'BLOCKING',
      category: 'PERFORMANCE',
      title: 'Weight Limit Exceeded',
      message: weightCheck.message,
    });
  }
  
  // -------------------------------------------------------------------------
  // 4. RUNWAY CHECK
  // -------------------------------------------------------------------------
  const runwayCheck = {
    departure: checkRunwaySuitability(
      input.departureAirport,
      aircraftPerf,
      input.departureWeather,
      'TAKEOFF'
    ),
    arrival: checkRunwaySuitability(
      input.arrivalAirport,
      aircraftPerf,
      input.arrivalWeather,
      'LANDING'
    ),
  };
  
  if (!runwayCheck.departure.passed) {
    issues.push({
      id: 'DEPARTURE_RUNWAY',
      severity: 'BLOCKING',
      category: 'RUNWAY',
      title: 'No Suitable Departure Runway',
      message: runwayCheck.departure.message,
      affectedAirport: input.departureAirport.icao,
    });
  }
  
  if (!runwayCheck.arrival.passed) {
    issues.push({
      id: 'ARRIVAL_RUNWAY',
      severity: 'BLOCKING',
      category: 'RUNWAY',
      title: 'No Suitable Arrival Runway',
      message: runwayCheck.arrival.message,
      affectedAirport: input.arrivalAirport.icao,
    });
  }
  
  // -------------------------------------------------------------------------
  // 5. WEATHER CHECK
  // -------------------------------------------------------------------------
  const weatherCheck = {
    departure: checkWeatherMinimums(
      input.departureAirport,
      input.departureWeather,
      aircraftPerf,
      'TAKEOFF'
    ),
    arrival: checkWeatherMinimums(
      input.arrivalAirport,
      input.arrivalWeather,
      aircraftPerf,
      'LANDING'
    ),
  };
  
  if (!weatherCheck.departure.passed) {
    issues.push({
      id: 'DEPARTURE_WEATHER',
      severity: 'BLOCKING',
      category: 'WEATHER',
      title: 'Departure Weather Below Minimums',
      message: weatherCheck.departure.message,
      affectedAirport: input.departureAirport.icao,
    });
  }
  
  if (!weatherCheck.arrival.passed) {
    issues.push({
      id: 'ARRIVAL_WEATHER',
      severity: weatherCheck.arrival.visibility < MIN_VISIBILITY_LANDING_SM ? 'BLOCKING' : 'WARNING',
      category: 'WEATHER',
      title: 'Arrival Weather Concerns',
      message: weatherCheck.arrival.message,
      affectedAirport: input.arrivalAirport.icao,
    });
  }
  
  // -------------------------------------------------------------------------
  // FINAL DECISION
  // -------------------------------------------------------------------------
  const blockingIssues = issues.filter(i => i.severity === 'BLOCKING');
  const warningIssues = issues.filter(i => i.severity === 'WARNING');
  
  const isFeasible = blockingIssues.length === 0;
  const canDispatch = isFeasible;
  
  let overallStatus: 'GO' | 'NO-GO' | 'CONDITIONAL';
  if (blockingIssues.length > 0) {
    overallStatus = 'NO-GO';
    summary.push('❌ FLIGHT IS NOT FEASIBLE');
    summary.push('');
    summary.push('Blocking Issues:');
    blockingIssues.forEach(issue => {
      summary.push(`  • ${issue.title}: ${issue.message}`);
    });
  } else if (warningIssues.length > 0) {
    overallStatus = 'CONDITIONAL';
    summary.push('⚠️ FLIGHT IS CONDITIONALLY FEASIBLE');
    summary.push('');
    summary.push('Warnings:');
    warningIssues.forEach(issue => {
      summary.push(`  • ${issue.title}: ${issue.message}`);
    });
  } else {
    overallStatus = 'GO';
    summary.push('✅ FLIGHT IS FEASIBLE');
  }
  
  // Add key metrics to summary
  summary.push('');
  summary.push('Flight Summary:');
  summary.push(`  Distance: ${Math.round(distance)} NM`);
  summary.push(`  Flight Time: ${Math.round(fuelPlan.totalFlightTime)} min`);
  summary.push(`  Fuel Required: ${Math.round(fuelPlan.totalFuelRequired)} kg`);
  summary.push(`  Est. Landing Weight: ${Math.round(fuelPlan.estimatedLandingWeight)} kg`);
  
  return {
    isFeasible,
    canDispatch,
    overallStatus,
    fuelCheck,
    rangeCheck,
    weightCheck,
    runwayCheck,
    weatherCheck,
    issues,
    summary,
  };
}

// ============================================================================
// FUEL PLANNING
// ============================================================================

interface AircraftPerformanceData {
  maxRange: number;
  cruiseSpeed: number;
  fuelCapacity: number;
  cruiseFuelBurn: number;
  climbFuelBurn: number;
  descentFuelBurn: number;
  taxiFuelBurn: number;
  oew: number;
  mtow: number;
  mlw: number;
  mzfw: number;
  maxCrosswind: number;
  maxTailwind: number;
  takeoffRunwayRequired: number;
  landingRunwayRequired: number;
}

function getAircraftPerformance(aircraft: Aircraft | EnhancedAircraft): AircraftPerformanceData {
  // Handle EnhancedAircraft type
  if ('fuel' in aircraft && 'weights' in aircraft) {
    const enhanced = aircraft as EnhancedAircraft;
    return {
      maxRange: enhanced.fuel.maxRange,
      cruiseSpeed: enhanced.speeds.cruiseSpeed,
      fuelCapacity: enhanced.fuel.capacity,
      cruiseFuelBurn: enhanced.fuel.cruiseFuelBurn,
      climbFuelBurn: enhanced.fuel.climbFuelBurn || enhanced.fuel.cruiseFuelBurn * 1.5,
      descentFuelBurn: enhanced.fuel.descentFuelBurn || enhanced.fuel.cruiseFuelBurn * 0.5,
      taxiFuelBurn: enhanced.fuel.taxiFuelBurn || 50,
      oew: enhanced.weights.oew,
      mtow: enhanced.weights.mtow,
      mlw: enhanced.weights.mlw,
      mzfw: enhanced.weights.mzfw,
      maxCrosswind: enhanced.windLimitations?.maxCrosswind || DEFAULT_MAX_CROSSWIND_KT,
      maxTailwind: enhanced.windLimitations?.maxTailwind || DEFAULT_MAX_TAILWIND_KT,
      takeoffRunwayRequired: enhanced.runwayRequirements?.minTakeoffRunway || 2000,
      landingRunwayRequired: enhanced.runwayRequirements?.minLandingRunway || 1800,
    };
  }
  
  // Handle basic Aircraft type
  const basic = aircraft as Aircraft;
  const fuelBurnRate = basic.performance?.fuelBurn || 850;
  
  return {
    maxRange: basic.performance?.maxRange || 3000,
    cruiseSpeed: basic.performance?.cruiseSpeed || 450,
    fuelCapacity: basic.performance?.fuelCapacity || 20000,
    cruiseFuelBurn: fuelBurnRate,
    climbFuelBurn: fuelBurnRate * 1.5,
    descentFuelBurn: fuelBurnRate * 0.5,
    taxiFuelBurn: 50,
    oew: 40000,
    mtow: 79000,
    mlw: 66000,
    mzfw: 62000,
    maxCrosswind: DEFAULT_MAX_CROSSWIND_KT,
    maxTailwind: DEFAULT_MAX_TAILWIND_KT,
    takeoffRunwayRequired: 2000,
    landingRunwayRequired: 1800,
  };
}

function calculateFuelPlan(input: DispatchInput, perf: AircraftPerformanceData): FuelPlan {
  // Calculate route distance
  const distance = input.flightPlan?.summary?.distance ||
    calculateDistance(input.departureAirport.position, input.arrivalAirport.position);
  
  // Estimate flight time (hours)
  const cruiseTime = distance / perf.cruiseSpeed;
  const climbTime = 0.3; // ~18 minutes climb
  const descentTime = 0.25; // ~15 minutes descent
  const totalFlightTimeHrs = climbTime + cruiseTime + descentTime;
  const totalFlightTimeMin = totalFlightTimeHrs * 60;
  
  // Calculate taxi fuel
  // Fixed taxi fuel per dispatch requirement
  const taxiFuel = 400; // kg
  
  // Calculate trip fuel
  const climbFuel = climbTime * perf.climbFuelBurn;
  const cruiseFuel = cruiseTime * perf.cruiseFuelBurn;
  const descentFuel = descentTime * perf.descentFuelBurn;
  const tripFuel = climbFuel + cruiseFuel + descentFuel;
  
  // Calculate contingency (5% of trip)
  const contingencyFuel = tripFuel * CONTINGENCY_FACTOR;
  
  // Calculate alternate fuel (assume 100nm at cruise)
  const alternateTime = ALTERNATE_DISTANCE_NM / perf.cruiseSpeed;
  const alternateFuel = alternateTime * perf.cruiseFuelBurn;
  
  // Calculate holding fuel (30 min at reduced power)
  const holdingFuel = (HOLDING_TIME_MIN / 60) * perf.cruiseFuelBurn * 0.7;
  
  // Calculate final reserve (30 min)
  const finalReserveFuel = (FINAL_RESERVE_TIME_MIN / 60) * perf.cruiseFuelBurn * 0.7;
  
  // Total required fuel
  const totalFuelRequired = taxiFuel + tripFuel + contingencyFuel + alternateFuel + holdingFuel + finalReserveFuel;
  
  // Use planned fuel or max capacity
  const totalFuelOnBoard = input.plannedFuelKg || Math.min(perf.fuelCapacity, totalFuelRequired * 1.1);
  
  // Extra fuel
  const extraFuel = Math.max(0, totalFuelOnBoard - totalFuelRequired);
  
  // Estimated landing weight
  const payload = input.payloadKg || 15000; // Default payload
  const takeoffWeight = perf.oew + payload + totalFuelOnBoard;
  const estimatedLandingWeight = takeoffWeight - tripFuel;
  
  // Check fuel sufficiency
  const isFuelSufficient = totalFuelOnBoard >= totalFuelRequired && totalFuelOnBoard <= perf.fuelCapacity;
  
  let fuelMessage = '';
  if (totalFuelOnBoard < totalFuelRequired) {
    fuelMessage = `Insufficient fuel: need ${Math.round(totalFuelRequired)} kg, have ${Math.round(totalFuelOnBoard)} kg`;
  } else if (totalFuelOnBoard > perf.fuelCapacity) {
    fuelMessage = `Fuel exceeds capacity: ${Math.round(totalFuelOnBoard)} kg > ${Math.round(perf.fuelCapacity)} kg`;
  } else {
    fuelMessage = `Fuel OK: ${Math.round(totalFuelOnBoard)} kg (required: ${Math.round(totalFuelRequired)} kg)`;
  }
  
  return {
    taxiFuel: Math.round(taxiFuel),
    tripFuel: Math.round(tripFuel),
    contingencyFuel: Math.round(contingencyFuel),
    alternateFuel: Math.round(alternateFuel),
    holdingFuel: Math.round(holdingFuel),
    finalReserveFuel: Math.round(finalReserveFuel),
    totalFuelRequired: Math.round(totalFuelRequired),
    extraFuel: Math.round(extraFuel),
    totalFuelOnBoard: Math.round(totalFuelOnBoard),
    estimatedLandingWeight: Math.round(estimatedLandingWeight),
    totalFlightTime: Math.round(totalFlightTimeMin),
    isFuelSufficient,
    fuelMessage,
  };
}

// ============================================================================
// WEIGHT CHECK
// ============================================================================

interface WeightCheckResult {
  passed: boolean;
  message: string;
  estimatedTakeoffWeight: number;
  mtow: number;
  estimatedLandingWeight: number;
  mlw: number;
}

function calculateWeightCheck(
  input: DispatchInput,
  perf: AircraftPerformanceData,
  fuelPlan: FuelPlan
): WeightCheckResult {
  const payload = input.payloadKg || 15000;
  const estimatedTakeoffWeight = perf.oew + payload + fuelPlan.totalFuelOnBoard;
  const estimatedLandingWeight = fuelPlan.estimatedLandingWeight;
  
  const mtowExceeded = estimatedTakeoffWeight > perf.mtow;
  const mlwExceeded = estimatedLandingWeight > perf.mlw;
  
  let message = '';
  if (mtowExceeded) {
    message = `MTOW exceeded: ${Math.round(estimatedTakeoffWeight)} kg > ${Math.round(perf.mtow)} kg`;
  } else if (mlwExceeded) {
    message = `MLW exceeded: ${Math.round(estimatedLandingWeight)} kg > ${Math.round(perf.mlw)} kg`;
  } else {
    message = `Weight OK - TOW: ${Math.round(estimatedTakeoffWeight)} kg, LW: ${Math.round(estimatedLandingWeight)} kg`;
  }
  
  return {
    passed: !mtowExceeded && !mlwExceeded,
    message,
    estimatedTakeoffWeight: Math.round(estimatedTakeoffWeight),
    mtow: Math.round(perf.mtow),
    estimatedLandingWeight: Math.round(estimatedLandingWeight),
    mlw: Math.round(perf.mlw),
  };
}

// ============================================================================
// RUNWAY CHECK
// ============================================================================

interface RunwayCheckResult {
  passed: boolean;
  message: string;
  availableRunways: string[];
  requiredLength: number;
}

function checkRunwaySuitability(
  airport: EnhancedAirport,
  perf: AircraftPerformanceData,
  weather: DecodedMetar | null | undefined,
  operation: 'TAKEOFF' | 'LANDING'
): RunwayCheckResult {
  const requiredLength = operation === 'TAKEOFF' ? perf.takeoffRunwayRequired : perf.landingRunwayRequired;
  
  if (!airport.runways || airport.runways.length === 0) {
    return {
      passed: false,
      message: `No runway data available for ${airport.icao}`,
      availableRunways: [],
      requiredLength,
    };
  }
  
  // Find suitable runways
  const suitableRunways = airport.runways.filter(rwy => {
    // Check length
    if (rwy.lengthMeters < requiredLength) return false;
    
    // Check surface (jets need paved)
    const pavedSurfaces: EnhancedRunway['surface'][] = ['ASP', 'CON', 'BIT', 'COP'];
    if (!pavedSurfaces.includes(rwy.surface)) return false;
    
    // Check wind if available
    if (weather?.wind) {
      const windDir = weather.wind.direction === 'VRB' ? 0 : weather.wind.direction;
      const windSpeed = weather.wind.speed;
      
      // Check both runway directions
      const headwind1 = calculateHeadwindComponent(windDir, windSpeed, rwy.headingTrue);
      const crosswind1 = calculateCrosswindComponent(windDir, windSpeed, rwy.headingTrue);
      const headwind2 = calculateHeadwindComponent(windDir, windSpeed, rwy.reciprocalHeadingTrue);
      const crosswind2 = calculateCrosswindComponent(windDir, windSpeed, rwy.reciprocalHeadingTrue);
      
      // At least one direction must be within limits
      const dir1Ok = headwind1 >= -perf.maxTailwind && Math.abs(crosswind1) <= perf.maxCrosswind;
      const dir2Ok = headwind2 >= -perf.maxTailwind && Math.abs(crosswind2) <= perf.maxCrosswind;
      
      if (!dir1Ok && !dir2Ok) return false;
    }
    
    return true;
  });
  
  if (suitableRunways.length === 0) {
    return {
      passed: false,
      message: `No suitable runway at ${airport.icao} (need ${requiredLength}m, paved surface, acceptable wind)`,
      availableRunways: [],
      requiredLength,
    };
  }
  
  return {
    passed: true,
    message: `${suitableRunways.length} suitable runway(s) available`,
    availableRunways: suitableRunways.map(r => r.designator),
    requiredLength,
  };
}

// ============================================================================
// WEATHER CHECK
// ============================================================================

interface WeatherCheckResult {
  passed: boolean;
  message: string;
  crosswind: number;
  maxCrosswind: number;
  visibility: number;
  minVisibility: number;
}

function checkWeatherMinimums(
  airport: EnhancedAirport,
  weather: DecodedMetar | null | undefined,
  perf: AircraftPerformanceData,
  operation: 'TAKEOFF' | 'LANDING'
): WeatherCheckResult {
  const minVisibility = operation === 'TAKEOFF' ? MIN_VISIBILITY_TAKEOFF_SM : MIN_VISIBILITY_LANDING_SM;
  
  // If no weather data, generate simulated weather and pass with warning
  if (!weather) {
    return {
      passed: true,
      message: 'No weather data available - using standard conditions',
      crosswind: 0,
      maxCrosswind: perf.maxCrosswind,
      visibility: 10,
      minVisibility,
    };
  }
  
  const visibility = weather.visibility.value;
  const crosswind = calculateMaxCrosswind(weather, airport.runways);
  
  const visibilityOk = visibility >= minVisibility;
  const crosswindOk = crosswind <= perf.maxCrosswind;
  
  let message = '';
  if (!visibilityOk) {
    message = `Visibility ${visibility} SM below minimum ${minVisibility} SM`;
  } else if (!crosswindOk) {
    message = `Crosswind ${crosswind} kt exceeds limit ${perf.maxCrosswind} kt`;
  } else {
    const category = weather.flightCategory || 'UNKNOWN';
    message = `${category} - Vis: ${visibility} SM, XWind: ${crosswind} kt`;
  }
  
  return {
    passed: visibilityOk && crosswindOk,
    message,
    crosswind,
    maxCrosswind: perf.maxCrosswind,
    visibility,
    minVisibility,
  };
}

// ============================================================================
// WIND COMPONENT CALCULATIONS
// ============================================================================

function calculateHeadwindComponent(windDir: number, windSpeed: number, runwayHeading: number): number {
  const angle = ((windDir - runwayHeading + 180) % 360 - 180) * Math.PI / 180;
  return windSpeed * Math.cos(angle);
}

function calculateCrosswindComponent(windDir: number, windSpeed: number, runwayHeading: number): number {
  const angle = ((windDir - runwayHeading + 180) % 360 - 180) * Math.PI / 180;
  return windSpeed * Math.sin(angle);
}

function calculateMaxCrosswind(weather: DecodedMetar, runways: EnhancedRunway[]): number {
  if (!weather.wind || weather.wind.direction === 'VRB') return 0;
  if (runways.length === 0) return 0;
  
  let minCrosswind = Infinity;
  
  for (const rwy of runways) {
    const xw1 = Math.abs(calculateCrosswindComponent(weather.wind.direction, weather.wind.speed, rwy.headingTrue));
    const xw2 = Math.abs(calculateCrosswindComponent(weather.wind.direction, weather.wind.speed, rwy.reciprocalHeadingTrue));
    minCrosswind = Math.min(minCrosswind, xw1, xw2);
  }
  
  return Math.round(minCrosswind === Infinity ? 0 : minCrosswind);
}

// ============================================================================
// SIMULATED WEATHER GENERATOR
// ============================================================================

export interface SimulatedWeather {
  wind: {
    direction: number;
    speed: number;
    gust?: number;
  };
  visibility: number;
  clouds: {
    coverage: string;
    base: number;
  }[];
  temperature: number;
  dewpoint: number;
  altimeter: number;
  isSimulated: boolean;
}

/**
 * Generate realistic simulated weather when METAR is unavailable
 */
export function generateSimulatedWeather(airport: EnhancedAirport): SimulatedWeather {
  // Use seasonal/regional defaults
  const lat = airport.position.lat;
  
  // Temperature based on latitude and season (simplified)
  const month = new Date().getMonth();
  const isSummer = month >= 4 && month <= 9;
  const baseTemp = Math.abs(lat) < 30 ? 28 : Math.abs(lat) < 50 ? 18 : 8;
  const temperature = isSummer ? baseTemp + 5 : baseTemp - 5;
  
  // Random but realistic wind
  const windDirection = Math.round(Math.random() * 360);
  const windSpeed = Math.round(5 + Math.random() * 15);
  
  // Good visibility most of the time
  const visibility = Math.random() > 0.2 ? 10 : 5 + Math.random() * 5;
  
  return {
    wind: {
      direction: windDirection,
      speed: windSpeed,
      gust: Math.random() > 0.7 ? windSpeed + 5 + Math.round(Math.random() * 10) : undefined,
    },
    visibility,
    clouds: [
      {
        coverage: visibility < 6 ? 'BKN' : 'FEW',
        base: 3000 + Math.round(Math.random() * 5000),
      },
    ],
    temperature,
    dewpoint: temperature - 5 - Math.round(Math.random() * 5),
    altimeter: 29.92 + (Math.random() - 0.5) * 0.3,
    isSimulated: true,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  calculateFuelPlan,
  calculateWeightCheck,
  checkRunwaySuitability,
  checkWeatherMinimums,
  calculateHeadwindComponent,
  calculateCrosswindComponent,
};
