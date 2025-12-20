/**
 * Runway-Based Dispatcher Service
 * 
 * Professional flight dispatch logic that:
 * 1. Requires runway selection before dispatch
 * 2. Calculates wind components using actual runway heading
 * 3. Determines RTOW based on selected runway length
 * 4. Makes GO/NO-GO decision based on real parameters
 * 
 * This is how a real airline dispatcher works.
 */

import { CSVAirport } from '@/services/airports/airportParser';
import { SelectedRunway, calculateRunwayWindComponents, selectBestRunway } from '@/types/runway';
import { getAirportRunways } from '@/data/runwayDatabase';
import { DecodedMetar, fetchMetar } from '@/api/aviationWeather';

// ============================================================================
// TYPES
// ============================================================================

export interface AircraftPerformance {
  icaoCode: string;
  name: string;
  
  // Weights (kg)
  mtow: number;               // Max Takeoff Weight
  mlw: number;                // Max Landing Weight
  mzfw: number;               // Max Zero Fuel Weight
  oew: number;                // Operating Empty Weight
  maxFuelCapacity: number;    // Max fuel (kg)
  
  // Performance
  maxRangeNm: number;
  cruiseSpeedKts: number;
  cruiseAltitudeFt: number;
  
  // Fuel burn (kg/hr)
  fuelBurnClimb: number;
  fuelBurnCruise: number;
  fuelBurnDescent: number;
  fuelBurnHolding: number;
  fuelBurnTaxi: number;
  
  // Runway requirements (feet at sea level, ISA, MTOW)
  takeoffDistanceFt: number;
  landingDistanceFt: number;
  
  // Wind limits (knots)
  maxCrosswindKts: number;
  maxTailwindKts: number;
  
  // Speeds (knots)
  v1: number;
  vr: number;
  v2: number;
  vref: number;
}

export interface WeatherData {
  windDirection: number | 'VRB';
  windSpeed: number;
  windGust?: number;
  visibility: number;         // statute miles
  ceiling?: number;           // feet AGL
  temperature: number;        // Celsius
  dewpoint: number;
  altimeter: number;          // inHg
  category: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
  raw: string;
  isLive: boolean;
}

export interface FuelPlan {
  taxiFuel: number;           // kg
  tripFuel: number;           // kg
  contingencyFuel: number;    // 5% of trip
  alternateFuel: number;      // Fuel to alternate
  holdingFuel: number;        // 30 min holding
  finalReserveFuel: number;   // 30-45 min reserve
  totalFuelRequired: number;  // Sum
  blockFuel: number;          // Total to load
  
  payloadKg: number;
  zfwKg: number;              // Zero fuel weight
  towKg: number;              // Takeoff weight
  ldwKg: number;              // Landing weight
  
  isValid: boolean;
  issues: string[];
}

export interface RTOWAnalysis {
  structuralMTOW: number;         // Aircraft limit
  runwayLimitedTOW: number;       // Based on selected runway
  climbLimitedTOW: number;        // Obstacle clearance
  actualRTOW: number;             // Minimum of all
  
  isAcceptable: boolean;
  limitingFactor: string;
}

export interface DispatchDecision {
  // Final decision
  decision: 'GO' | 'NO-GO' | 'CONDITIONAL';
  canDispatch: boolean;
  
  // Departure
  departureAirport: CSVAirport;
  departureRunway: SelectedRunway | null;
  departureWeather: WeatherData | null;
  
  // Arrival
  arrivalAirport: CSVAirport;
  arrivalRunway: SelectedRunway | null;
  arrivalWeather: WeatherData | null;
  
  // Analysis
  aircraft: AircraftPerformance;
  fuelPlan: FuelPlan;
  rtow: RTOWAnalysis;
  
  // Route
  distanceNm: number;
  flightTimeMin: number;
  
  // Issues
  criticalIssues: string[];   // Any = NO-GO
  warnings: string[];         // Caution items
  info: string[];             // Informational
  
  timestamp: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EARTH_RADIUS_NM = 3440.065;
const DEG_TO_RAD = Math.PI / 180;

// Fuel planning (ICAO/JAR-OPS)
const CONTINGENCY_FACTOR = 0.05;      // 5% of trip
const HOLDING_TIME_MIN = 30;
const FINAL_RESERVE_MIN = 30;
const TAXI_TIME_MIN = 10;
const ALTERNATE_DISTANCE_NM = 100;

// Weather minimums (IFR)
const MIN_VISIBILITY_TAKEOFF_SM = 0.5;
const MIN_VISIBILITY_LANDING_SM = 0.5;
const MIN_CEILING_LANDING_FT = 200;

// ============================================================================
// AIRCRAFT DATABASE
// ============================================================================

export const AIRCRAFT_DATABASE: AircraftPerformance[] = [
  {
    icaoCode: 'B738',
    name: 'Boeing 737-800',
    mtow: 79010,
    mlw: 66360,
    mzfw: 62730,
    oew: 41410,
    maxFuelCapacity: 20894,
    maxRangeNm: 2935,
    cruiseSpeedKts: 453,
    cruiseAltitudeFt: 35000,
    fuelBurnClimb: 2800,
    fuelBurnCruise: 2400,
    fuelBurnDescent: 1200,
    fuelBurnHolding: 2000,
    fuelBurnTaxi: 200,
    takeoffDistanceFt: 7400,
    landingDistanceFt: 5200,
    maxCrosswindKts: 33,
    maxTailwindKts: 10,
    v1: 140,
    vr: 145,
    v2: 155,
    vref: 137,
  },
  {
    icaoCode: 'A320',
    name: 'Airbus A320-200',
    mtow: 78000,
    mlw: 66000,
    mzfw: 62500,
    oew: 42600,
    maxFuelCapacity: 18730,
    maxRangeNm: 3300,
    cruiseSpeedKts: 450,
    cruiseAltitudeFt: 37000,
    fuelBurnClimb: 2700,
    fuelBurnCruise: 2300,
    fuelBurnDescent: 1100,
    fuelBurnHolding: 1900,
    fuelBurnTaxi: 180,
    takeoffDistanceFt: 7200,
    landingDistanceFt: 4700,
    maxCrosswindKts: 33,
    maxTailwindKts: 10,
    v1: 138,
    vr: 143,
    v2: 152,
    vref: 135,
  },
  {
    icaoCode: 'A321',
    name: 'Airbus A321-200',
    mtow: 93500,
    mlw: 77800,
    mzfw: 73800,
    oew: 48500,
    maxFuelCapacity: 23700,
    maxRangeNm: 3200,
    cruiseSpeedKts: 450,
    cruiseAltitudeFt: 37000,
    fuelBurnClimb: 2900,
    fuelBurnCruise: 2600,
    fuelBurnDescent: 1200,
    fuelBurnHolding: 2100,
    fuelBurnTaxi: 200,
    takeoffDistanceFt: 8100,
    landingDistanceFt: 5500,
    maxCrosswindKts: 33,
    maxTailwindKts: 10,
    v1: 145,
    vr: 150,
    v2: 160,
    vref: 140,
  },
  {
    icaoCode: 'B772',
    name: 'Boeing 777-200ER',
    mtow: 297550,
    mlw: 213180,
    mzfw: 192770,
    oew: 138100,
    maxFuelCapacity: 117340,
    maxRangeNm: 7725,
    cruiseSpeedKts: 490,
    cruiseAltitudeFt: 39000,
    fuelBurnClimb: 7500,
    fuelBurnCruise: 6200,
    fuelBurnDescent: 3000,
    fuelBurnHolding: 5000,
    fuelBurnTaxi: 400,
    takeoffDistanceFt: 11100,
    landingDistanceFt: 6200,
    maxCrosswindKts: 35,
    maxTailwindKts: 15,
    v1: 155,
    vr: 165,
    v2: 175,
    vref: 145,
  },
  {
    icaoCode: 'A359',
    name: 'Airbus A350-900',
    mtow: 280000,
    mlw: 205000,
    mzfw: 192000,
    oew: 115700,
    maxFuelCapacity: 141000,
    maxRangeNm: 8100,
    cruiseSpeedKts: 488,
    cruiseAltitudeFt: 41000,
    fuelBurnClimb: 6800,
    fuelBurnCruise: 5800,
    fuelBurnDescent: 2800,
    fuelBurnHolding: 4500,
    fuelBurnTaxi: 380,
    takeoffDistanceFt: 9000,
    landingDistanceFt: 6200,
    maxCrosswindKts: 38,
    maxTailwindKts: 15,
    v1: 152,
    vr: 160,
    v2: 170,
    vref: 142,
  },
  {
    icaoCode: 'E190',
    name: 'Embraer E190',
    mtow: 51800,
    mlw: 44000,
    mzfw: 40800,
    oew: 28080,
    maxFuelCapacity: 12970,
    maxRangeNm: 2450,
    cruiseSpeedKts: 470,
    cruiseAltitudeFt: 39000,
    fuelBurnClimb: 1800,
    fuelBurnCruise: 1600,
    fuelBurnDescent: 800,
    fuelBurnHolding: 1200,
    fuelBurnTaxi: 120,
    takeoffDistanceFt: 6600,
    landingDistanceFt: 4500,
    maxCrosswindKts: 30,
    maxTailwindKts: 10,
    v1: 125,
    vr: 130,
    v2: 138,
    vref: 125,
  },
];

export function getAircraft(icaoCode: string): AircraftPerformance | null {
  return AIRCRAFT_DATABASE.find(a => a.icaoCode === icaoCode) || null;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate great circle distance
 */
export function calculateDistanceNm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const φ1 = lat1 * DEG_TO_RAD;
  const φ2 = lat2 * DEG_TO_RAD;
  const Δφ = (lat2 - lat1) * DEG_TO_RAD;
  const Δλ = (lon2 - lon1) * DEG_TO_RAD;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

/**
 * Calculate fuel plan
 */
function calculateFuelPlan(
  distanceNm: number,
  aircraft: AircraftPerformance,
  payloadKg: number = 15000
): FuelPlan {
  const issues: string[] = [];
  
  // Estimate flight time
  const cruiseTime = distanceNm / aircraft.cruiseSpeedKts; // hours
  const climbTime = 0.35;  // ~20 min climb
  const descentTime = 0.3; // ~18 min descent
  // Total flight time = climbTime + cruiseTime + descentTime (used for fuel calc)
  
  // Calculate component fuels
  const taxiFuel = (TAXI_TIME_MIN / 60) * aircraft.fuelBurnTaxi;
  const climbFuel = climbTime * aircraft.fuelBurnClimb;
  const cruiseFuel = cruiseTime * aircraft.fuelBurnCruise;
  const descentFuel = descentTime * aircraft.fuelBurnDescent;
  const tripFuel = climbFuel + cruiseFuel + descentFuel;
  
  const contingencyFuel = tripFuel * CONTINGENCY_FACTOR;
  const alternateTime = ALTERNATE_DISTANCE_NM / aircraft.cruiseSpeedKts;
  const alternateFuel = alternateTime * aircraft.fuelBurnCruise;
  const holdingFuel = (HOLDING_TIME_MIN / 60) * aircraft.fuelBurnHolding;
  const finalReserveFuel = (FINAL_RESERVE_MIN / 60) * aircraft.fuelBurnHolding;
  
  const totalFuelRequired = taxiFuel + tripFuel + contingencyFuel + 
    alternateFuel + holdingFuel + finalReserveFuel;
  
  // Use min of required + 10% or max capacity
  const blockFuel = Math.min(aircraft.maxFuelCapacity, totalFuelRequired * 1.1);
  
  // Weight calculations
  const zfwKg = aircraft.oew + payloadKg;
  const towKg = zfwKg + blockFuel;
  const ldwKg = towKg - tripFuel;
  
  // Validate
  let isValid = true;
  
  if (blockFuel < totalFuelRequired) {
    issues.push(`Insufficient fuel capacity: need ${Math.round(totalFuelRequired)} kg, max ${Math.round(aircraft.maxFuelCapacity)} kg`);
    isValid = false;
  }
  
  if (towKg > aircraft.mtow) {
    issues.push(`TOW ${Math.round(towKg)} kg exceeds MTOW ${aircraft.mtow} kg`);
    isValid = false;
  }
  
  if (ldwKg > aircraft.mlw) {
    issues.push(`LDW ${Math.round(ldwKg)} kg exceeds MLW ${aircraft.mlw} kg`);
    isValid = false;
  }
  
  if (zfwKg > aircraft.mzfw) {
    issues.push(`ZFW ${Math.round(zfwKg)} kg exceeds MZFW ${aircraft.mzfw} kg`);
    isValid = false;
  }
  
  return {
    taxiFuel: Math.round(taxiFuel),
    tripFuel: Math.round(tripFuel),
    contingencyFuel: Math.round(contingencyFuel),
    alternateFuel: Math.round(alternateFuel),
    holdingFuel: Math.round(holdingFuel),
    finalReserveFuel: Math.round(finalReserveFuel),
    totalFuelRequired: Math.round(totalFuelRequired),
    blockFuel: Math.round(blockFuel),
    payloadKg,
    zfwKg: Math.round(zfwKg),
    towKg: Math.round(towKg),
    ldwKg: Math.round(ldwKg),
    isValid,
    issues,
  };
}

/**
 * Calculate RTOW based on runway
 */
function calculateRTOW(
  runway: SelectedRunway | null,
  aircraft: AircraftPerformance,
  elevation: number,
  temperature: number
): RTOWAnalysis {
  const structuralMTOW = aircraft.mtow;
  
  if (!runway) {
    return {
      structuralMTOW,
      runwayLimitedTOW: structuralMTOW,
      climbLimitedTOW: structuralMTOW,
      actualRTOW: structuralMTOW,
      isAcceptable: true,
      limitingFactor: 'No runway selected - using structural MTOW',
    };
  }
  
  // Runway length available (use TORA)
  const toraFt = runway.runway.length;
  const requiredFt = aircraft.takeoffDistanceFt;
  
  // Elevation correction: +7% per 1000ft
  const elevationFactor = 1 + (elevation / 1000) * 0.07;
  
  // Temperature correction: +1% per °C above ISA (15°C at sea level)
  const isaTemp = 15 - (elevation / 1000) * 2;
  const tempDiff = Math.max(0, temperature - isaTemp);
  const tempFactor = 1 + tempDiff * 0.01;
  
  // Adjusted required distance
  const adjustedRequired = requiredFt * elevationFactor * tempFactor;
  
  // Calculate runway-limited TOW
  // Simplification: if runway is shorter than required, reduce TOW proportionally
  let runwayLimitedTOW = structuralMTOW;
  if (toraFt < adjustedRequired) {
    const ratio = toraFt / adjustedRequired;
    runwayLimitedTOW = Math.round(structuralMTOW * ratio);
  }
  
  // Climb limited (simplified - would need obstacle data)
  const climbLimitedTOW = structuralMTOW * 0.98; // 2% margin
  
  // Actual RTOW is minimum of all limits
  const actualRTOW = Math.min(structuralMTOW, runwayLimitedTOW, climbLimitedTOW);
  
  // Determine limiting factor
  let limitingFactor = 'Structural';
  if (actualRTOW === runwayLimitedTOW && runwayLimitedTOW < structuralMTOW) {
    limitingFactor = `Runway ${runway.designator} (${toraFt}ft)`;
  } else if (actualRTOW === climbLimitedTOW) {
    limitingFactor = 'Climb performance';
  }
  
  return {
    structuralMTOW,
    runwayLimitedTOW,
    climbLimitedTOW,
    actualRTOW: Math.round(actualRTOW),
    isAcceptable: actualRTOW >= structuralMTOW * 0.8, // At least 80% of MTOW
    limitingFactor,
  };
}

/**
 * Convert METAR to WeatherData
 */
function metarToWeatherData(metar: DecodedMetar | null, _icao: string): WeatherData | null {
  if (!metar) return null;
  
  let ceiling: number | undefined;
  for (const cloud of metar.clouds) {
    if ((cloud.coverage === 'BKN' || cloud.coverage === 'OVC') && cloud.base !== null) {
      ceiling = cloud.base;
      break;
    }
  }
  
  return {
    windDirection: metar.wind.direction,
    windSpeed: metar.wind.speed,
    windGust: metar.wind.gust,
    visibility: metar.visibility.value,
    ceiling,
    temperature: metar.temperature,
    dewpoint: metar.dewpoint,
    altimeter: metar.altimeter,
    category: metar.flightCategory || 'VFR',
    raw: metar.raw,
    isLive: true,
  };
}

/**
 * Generate simulated weather when METAR unavailable
 */
function generateSimulatedWeather(icao: string): WeatherData {
  // Generate reasonable default weather
  const windDir = Math.round(Math.random() * 36) * 10;
  const windSpeed = 5 + Math.round(Math.random() * 15);
  
  return {
    windDirection: windDir,
    windSpeed,
    windGust: Math.random() > 0.7 ? windSpeed + 10 : undefined,
    visibility: 10,
    ceiling: 5000 + Math.round(Math.random() * 10000),
    temperature: 15 + Math.round((Math.random() - 0.5) * 20),
    dewpoint: 10 + Math.round((Math.random() - 0.5) * 10),
    altimeter: 29.92,
    category: 'VFR',
    raw: `${icao} SIMULATED`,
    isLive: false,
  };
}

// ============================================================================
// MAIN DISPATCH FUNCTION
// ============================================================================

/**
 * Evaluate flight and make dispatch decision
 * 
 * REQUIRES:
 * - Departure airport with ICAO
 * - Arrival airport with ICAO
 * - Aircraft selection
 * - Runway selections (or will auto-select based on wind)
 */
export async function evaluateDispatch(
  departureAirport: CSVAirport,
  arrivalAirport: CSVAirport,
  aircraft: AircraftPerformance,
  payloadKg: number = 15000,
  departureRunwayDesignator?: string,
  arrivalRunwayDesignator?: string
): Promise<DispatchDecision> {
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  
  // =========================================================================
  // 1. FETCH WEATHER
  // =========================================================================
  let departureWeather: WeatherData | null = null;
  let arrivalWeather: WeatherData | null = null;
  
  try {
    const [depMetars, arrMetars] = await Promise.all([
      fetchMetar(departureAirport.icao).catch(() => []),
      fetchMetar(arrivalAirport.icao).catch(() => []),
    ]);
    
    departureWeather = metarToWeatherData(depMetars[0] || null, departureAirport.icao);
    arrivalWeather = metarToWeatherData(arrMetars[0] || null, arrivalAirport.icao);
  } catch (error) {
    console.warn('Weather fetch failed, using simulated weather');
  }
  
  // Use simulated weather if METAR unavailable
  if (!departureWeather) {
    departureWeather = generateSimulatedWeather(departureAirport.icao);
    info.push(`No METAR for ${departureAirport.icao} - using simulated weather`);
  }
  if (!arrivalWeather) {
    arrivalWeather = generateSimulatedWeather(arrivalAirport.icao);
    info.push(`No METAR for ${arrivalAirport.icao} - using simulated weather`);
  }
  
  // =========================================================================
  // 2. GET RUNWAYS AND SELECT BEST
  // =========================================================================
  const departureRunways = getAirportRunways(departureAirport.icao);
  const arrivalRunways = getAirportRunways(arrivalAirport.icao);
  
  let departureRunway: SelectedRunway | null = null;
  let arrivalRunway: SelectedRunway | null = null;
  
  // Departure runway
  if (departureRunways.length > 0) {
    if (departureRunwayDesignator) {
      // Use specified runway
      const rwy = departureRunways.find(r => r.ends.some(e => e.designator === departureRunwayDesignator));
      if (rwy) {
        const end = rwy.ends.find(e => e.designator === departureRunwayDesignator)!;
        const windComponents = calculateRunwayWindComponents(
          end.heading,
          departureWeather.windDirection,
          departureWeather.windSpeed
        );
        
        const issues: string[] = [];
        let isSuitable = true;
        
        if (rwy.length < aircraft.takeoffDistanceFt) {
          issues.push(`Runway ${rwy.length}ft < required ${aircraft.takeoffDistanceFt}ft`);
          isSuitable = false;
        }
        if (windComponents.crosswind > aircraft.maxCrosswindKts) {
          issues.push(`Crosswind ${windComponents.crosswind}kt > limit ${aircraft.maxCrosswindKts}kt`);
          isSuitable = false;
        }
        if (windComponents.tailwind > aircraft.maxTailwindKts) {
          issues.push(`Tailwind ${windComponents.tailwind}kt > limit ${aircraft.maxTailwindKts}kt`);
          isSuitable = false;
        }
        
        departureRunway = {
          designator: departureRunwayDesignator,
          runway: rwy,
          end,
          windComponents,
          isSuitable,
          issues,
          isPreferred: true,
        };
      }
    } else {
      // Auto-select best runway
      departureRunway = selectBestRunway(
        departureRunways,
        departureWeather.windDirection,
        departureWeather.windSpeed,
        aircraft.takeoffDistanceFt,
        aircraft.maxCrosswindKts,
        aircraft.maxTailwindKts
      );
    }
  } else {
    warnings.push(`No runway data for ${departureAirport.icao} - using airport data`);
  }
  
  // Arrival runway
  if (arrivalRunways.length > 0) {
    if (arrivalRunwayDesignator) {
      const rwy = arrivalRunways.find(r => r.ends.some(e => e.designator === arrivalRunwayDesignator));
      if (rwy) {
        const end = rwy.ends.find(e => e.designator === arrivalRunwayDesignator)!;
        const windComponents = calculateRunwayWindComponents(
          end.heading,
          arrivalWeather.windDirection,
          arrivalWeather.windSpeed
        );
        
        const issues: string[] = [];
        let isSuitable = true;
        
        if (rwy.length < aircraft.landingDistanceFt) {
          issues.push(`Runway ${rwy.length}ft < required ${aircraft.landingDistanceFt}ft`);
          isSuitable = false;
        }
        if (windComponents.crosswind > aircraft.maxCrosswindKts) {
          issues.push(`Crosswind ${windComponents.crosswind}kt > limit ${aircraft.maxCrosswindKts}kt`);
          isSuitable = false;
        }
        if (windComponents.tailwind > aircraft.maxTailwindKts) {
          issues.push(`Tailwind ${windComponents.tailwind}kt > limit ${aircraft.maxTailwindKts}kt`);
          isSuitable = false;
        }
        
        arrivalRunway = {
          designator: arrivalRunwayDesignator,
          runway: rwy,
          end,
          windComponents,
          isSuitable,
          issues,
          isPreferred: true,
        };
      }
    } else {
      arrivalRunway = selectBestRunway(
        arrivalRunways,
        arrivalWeather.windDirection,
        arrivalWeather.windSpeed,
        aircraft.landingDistanceFt,
        aircraft.maxCrosswindKts,
        aircraft.maxTailwindKts
      );
    }
  } else {
    warnings.push(`No runway data for ${arrivalAirport.icao} - using airport data`);
  }
  
  // =========================================================================
  // 3. CHECK RUNWAY SUITABILITY
  // =========================================================================
  if (departureRunway && !departureRunway.isSuitable) {
    criticalIssues.push(`Departure runway ${departureRunway.designator} unsuitable: ${departureRunway.issues.join(', ')}`);
  }
  
  if (arrivalRunway && !arrivalRunway.isSuitable) {
    criticalIssues.push(`Arrival runway ${arrivalRunway.designator} unsuitable: ${arrivalRunway.issues.join(', ')}`);
  }
  
  // =========================================================================
  // 4. CALCULATE DISTANCE AND FUEL
  // =========================================================================
  const distanceNm = calculateDistanceNm(
    departureAirport.latitude, departureAirport.longitude,
    arrivalAirport.latitude, arrivalAirport.longitude
  );
  
  // Check range
  if (distanceNm > aircraft.maxRangeNm * 0.95) {
    criticalIssues.push(`Route ${Math.round(distanceNm)}nm exceeds aircraft max range ${aircraft.maxRangeNm}nm`);
  }
  
  const fuelPlan = calculateFuelPlan(distanceNm, aircraft, payloadKg);
  
  if (!fuelPlan.isValid) {
    fuelPlan.issues.forEach(issue => criticalIssues.push(issue));
  }
  
  const flightTimeMin = Math.round((distanceNm / aircraft.cruiseSpeedKts) * 60 + 40); // +40 min for climb/descent
  
  // =========================================================================
  // 5. CALCULATE RTOW
  // =========================================================================
  const rtow = calculateRTOW(
    departureRunway,
    aircraft,
    departureAirport.elevation,
    departureWeather.temperature
  );
  
  if (fuelPlan.towKg > rtow.actualRTOW) {
    criticalIssues.push(
      `Planned TOW ${fuelPlan.towKg}kg exceeds RTOW ${rtow.actualRTOW}kg (limited by ${rtow.limitingFactor})`
    );
  }
  
  // =========================================================================
  // 6. CHECK WEATHER MINIMUMS
  // =========================================================================
  if (departureWeather.visibility < MIN_VISIBILITY_TAKEOFF_SM) {
    criticalIssues.push(
      `Departure visibility ${departureWeather.visibility}SM below minimum ${MIN_VISIBILITY_TAKEOFF_SM}SM`
    );
  }
  
  if (arrivalWeather.visibility < MIN_VISIBILITY_LANDING_SM) {
    criticalIssues.push(
      `Arrival visibility ${arrivalWeather.visibility}SM below minimum ${MIN_VISIBILITY_LANDING_SM}SM`
    );
  }
  
  if (arrivalWeather.ceiling !== undefined && arrivalWeather.ceiling < MIN_CEILING_LANDING_FT) {
    criticalIssues.push(
      `Arrival ceiling ${arrivalWeather.ceiling}ft below minimum ${MIN_CEILING_LANDING_FT}ft`
    );
  }
  
  // Check wind warnings (not critical but noted)
  if (departureRunway && departureRunway.windComponents.crosswind > aircraft.maxCrosswindKts * 0.8) {
    warnings.push(
      `Departure crosswind ${departureRunway.windComponents.crosswind}kt approaching limit ${aircraft.maxCrosswindKts}kt`
    );
  }
  
  if (arrivalRunway && arrivalRunway.windComponents.crosswind > aircraft.maxCrosswindKts * 0.8) {
    warnings.push(
      `Arrival crosswind ${arrivalRunway.windComponents.crosswind}kt approaching limit ${aircraft.maxCrosswindKts}kt`
    );
  }
  
  // =========================================================================
  // 7. FINAL DECISION
  // =========================================================================
  let decision: 'GO' | 'NO-GO' | 'CONDITIONAL';
  let canDispatch: boolean;
  
  if (criticalIssues.length > 0) {
    decision = 'NO-GO';
    canDispatch = false;
  } else if (warnings.length > 0) {
    decision = 'CONDITIONAL';
    canDispatch = true;
  } else {
    decision = 'GO';
    canDispatch = true;
  }
  
  return {
    decision,
    canDispatch,
    departureAirport,
    departureRunway,
    departureWeather,
    arrivalAirport,
    arrivalRunway,
    arrivalWeather,
    aircraft,
    fuelPlan,
    rtow,
    distanceNm: Math.round(distanceNm),
    flightTimeMin,
    criticalIssues,
    warnings,
    info,
    timestamp: new Date(),
  };
}
