/**
 * Dispatch Engine - FS2024-Style Flight Feasibility Evaluation
 * 
 * This is the CORE dispatch logic that determines if a flight is feasible.
 * All checks are explicit, rule-driven, and aviation-realistic.
 * 
 * NO SHORTCUTS. Every check has clear pass/fail criteria.
 */

import { DecodedMetar } from '@/api/aviationWeather';

// ============================================================================
// TYPES
// ============================================================================

export interface AircraftProfile {
  icaoCode: string;
  name: string;
  
  // Weights (kg)
  mtow: number;                 // Max Takeoff Weight
  mlw: number;                  // Max Landing Weight
  mzfw: number;                 // Max Zero Fuel Weight
  oew: number;                  // Operating Empty Weight
  maxFuelCapacity: number;      // Max fuel (kg)
  
  // Performance
  maxRangeNm: number;           // Maximum range
  cruiseSpeedKts: number;       // Typical cruise TAS
  cruiseAltitudeFt: number;     // Optimal cruise FL
  
  // Fuel flow (kg/hr)
  taxiFuelFlowKgHr: number;
  climbFuelFlowKgHr: number;
  cruiseFuelFlowKgHr: number;
  descentFuelFlowKgHr: number;
  holdingFuelFlowKgHr: number;
  
  // Runway requirements
  takeoffDistanceFt: number;    // At MTOW, sea level, ISA
  landingDistanceFt: number;    // At MLW, sea level
  
  // Limits
  maxCrosswindKt: number;
  maxTailwindKt: number;
  
  // Approach minima (simplified)
  catIMinVisibilityM: number;   // CAT I minimum visibility
  catIMinCeilingFt: number;     // CAT I minimum ceiling
}

export interface DispatchInput {
  // Route
  routeDistanceNm: number;
  
  // Airports
  departureIcao: string;
  arrivalIcao: string;
  departureElevationFt: number;
  arrivalElevationFt: number;
  
  // Runways
  departureRunwayLengthFt: number;
  departureRunwaySurface: string;
  departureRunwayHeading: number;
  arrivalRunwayLengthFt: number;
  arrivalRunwaySurface: string;
  arrivalRunwayHeading: number;
  
  // Weather (optional - if not provided, assumes VMC)
  departureMetar?: DecodedMetar | null;
  arrivalMetar?: DecodedMetar | null;
  
  // Payload
  payloadKg: number;            // Passengers + cargo
  
  // Aircraft
  aircraft: AircraftProfile;
}

export interface FuelPlan {
  taxiOutFuelKg: number;        // 15 min taxi
  tripFuelKg: number;           // Climb + cruise + descent
  contingencyFuelKg: number;    // 5% of trip (JAR-OPS)
  alternateFuelKg: number;      // 30 min cruise
  finalReserveFuelKg: number;   // 30 min holding
  totalRequiredKg: number;      // Sum of above
  blockFuelKg: number;          // Rounded up for loading
}

export interface WeightSummary {
  oewKg: number;
  payloadKg: number;
  zfwKg: number;
  blockFuelKg: number;
  towKg: number;
  tripFuelKg: number;
  landingFuelKg: number;
  lwKg: number;
}

export interface DispatchResult {
  feasible: boolean;
  
  // Blocking issues (flight cannot proceed)
  reasons: string[];
  
  // Non-blocking concerns
  warnings: string[];
  
  // Computed values
  computed: {
    tripFuelKg: number;
    reserveFuelKg: number;
    blockFuelKg: number;
    towKg: number;
    lwKg: number;
    rangeMarginNm: number;
    flightTimeMin: number;
    fuelMarginKg: number;
  };
  
  // Detailed breakdowns
  fuelPlan: FuelPlan;
  weights: WeightSummary;
  
  // Individual check results
  checks: {
    range: CheckResult;
    fuel: CheckResult;
    towWeight: CheckResult;
    lwWeight: CheckResult;
    zfwWeight: CheckResult;
    departureRunway: CheckResult;
    arrivalRunway: CheckResult;
    departureWeather: CheckResult;
    arrivalWeather: CheckResult;
    crosswind: CheckResult;
  };
}

export interface CheckResult {
  passed: boolean;
  value: number | string;
  limit: number | string;
  message: string;
}

// ============================================================================
// AIRCRAFT DATABASE
// ============================================================================

/**
 * Simplified but realistic aircraft profiles.
 * Values are plausible and consistent - ~85% realism target.
 * NOT certification-level data.
 */
export const AIRCRAFT_PROFILES: Record<string, AircraftProfile> = {
  'B738': {
    icaoCode: 'B738',
    name: 'Boeing 737-800',
    mtow: 79016,
    mlw: 66361,
    mzfw: 62732,
    oew: 41413,
    maxFuelCapacity: 20894,
    maxRangeNm: 2935,
    cruiseSpeedKts: 450,
    cruiseAltitudeFt: 35000,
    taxiFuelFlowKgHr: 400,
    climbFuelFlowKgHr: 3200,
    cruiseFuelFlowKgHr: 2400,
    descentFuelFlowKgHr: 1000,
    holdingFuelFlowKgHr: 2000,
    takeoffDistanceFt: 7500,
    landingDistanceFt: 5500,
    maxCrosswindKt: 33,
    maxTailwindKt: 10,
    catIMinVisibilityM: 550,
    catIMinCeilingFt: 200,
  },
  'A320': {
    icaoCode: 'A320',
    name: 'Airbus A320-200',
    mtow: 78000,
    mlw: 66000,
    mzfw: 62500,
    oew: 42600,
    maxFuelCapacity: 19000,
    maxRangeNm: 3300,
    cruiseSpeedKts: 447,
    cruiseAltitudeFt: 37000,
    taxiFuelFlowKgHr: 350,
    climbFuelFlowKgHr: 3000,
    cruiseFuelFlowKgHr: 2200,
    descentFuelFlowKgHr: 900,
    holdingFuelFlowKgHr: 1800,
    takeoffDistanceFt: 7200,
    landingDistanceFt: 5100,
    maxCrosswindKt: 35,
    maxTailwindKt: 10,
    catIMinVisibilityM: 550,
    catIMinCeilingFt: 200,
  },
  'B77W': {
    icaoCode: 'B77W',
    name: 'Boeing 777-300ER',
    mtow: 351535,
    mlw: 251290,
    mzfw: 237680,
    oew: 167800,
    maxFuelCapacity: 145538,
    maxRangeNm: 7370,
    cruiseSpeedKts: 490,
    cruiseAltitudeFt: 39000,
    taxiFuelFlowKgHr: 1200,
    climbFuelFlowKgHr: 9000,
    cruiseFuelFlowKgHr: 6800,
    descentFuelFlowKgHr: 2500,
    holdingFuelFlowKgHr: 5500,
    takeoffDistanceFt: 10500,
    landingDistanceFt: 6500,
    maxCrosswindKt: 38,
    maxTailwindKt: 15,
    catIMinVisibilityM: 550,
    catIMinCeilingFt: 200,
  },
  'A359': {
    icaoCode: 'A359',
    name: 'Airbus A350-900',
    mtow: 280000,
    mlw: 205000,
    mzfw: 192000,
    oew: 142400,
    maxFuelCapacity: 110000,
    maxRangeNm: 8100,
    cruiseSpeedKts: 488,
    cruiseAltitudeFt: 41000,
    taxiFuelFlowKgHr: 900,
    climbFuelFlowKgHr: 7500,
    cruiseFuelFlowKgHr: 5500,
    descentFuelFlowKgHr: 2000,
    holdingFuelFlowKgHr: 4500,
    takeoffDistanceFt: 9000,
    landingDistanceFt: 6000,
    maxCrosswindKt: 38,
    maxTailwindKt: 15,
    catIMinVisibilityM: 550,
    catIMinCeilingFt: 200,
  },
  'E190': {
    icaoCode: 'E190',
    name: 'Embraer E190',
    mtow: 51800,
    mlw: 44000,
    mzfw: 40500,
    oew: 28080,
    maxFuelCapacity: 12971,
    maxRangeNm: 2450,
    cruiseSpeedKts: 430,
    cruiseAltitudeFt: 39000,
    taxiFuelFlowKgHr: 280,
    climbFuelFlowKgHr: 2100,
    cruiseFuelFlowKgHr: 1600,
    descentFuelFlowKgHr: 650,
    holdingFuelFlowKgHr: 1300,
    takeoffDistanceFt: 6200,
    landingDistanceFt: 4200,
    maxCrosswindKt: 30,
    maxTailwindKt: 10,
    catIMinVisibilityM: 550,
    catIMinCeilingFt: 200,
  },
  'CRJ9': {
    icaoCode: 'CRJ9',
    name: 'Bombardier CRJ-900',
    mtow: 38330,
    mlw: 34020,
    mzfw: 31751,
    oew: 21910,
    maxFuelCapacity: 8875,
    maxRangeNm: 1550,
    cruiseSpeedKts: 447,
    cruiseAltitudeFt: 35000,
    taxiFuelFlowKgHr: 220,
    climbFuelFlowKgHr: 1800,
    cruiseFuelFlowKgHr: 1400,
    descentFuelFlowKgHr: 550,
    holdingFuelFlowKgHr: 1100,
    takeoffDistanceFt: 5800,
    landingDistanceFt: 4800,
    maxCrosswindKt: 28,
    maxTailwindKt: 10,
    catIMinVisibilityM: 550,
    catIMinCeilingFt: 200,
  },
};

// ============================================================================
// FUEL CALCULATION
// ============================================================================

/**
 * Calculate fuel requirements based on route and aircraft.
 * Uses simplified but realistic phase-based fuel burn.
 */
export function calculateFuelPlan(
  routeDistanceNm: number,
  aircraft: AircraftProfile
): FuelPlan {
  // Flight profile assumptions
  const TAXI_TIME_HR = 0.25;                    // 15 min taxi out
  const CLIMB_DISTANCE_NM = 80;                 // Typical climb
  const CLIMB_TIME_HR = 0.35;                   // ~21 min climb
  const DESCENT_DISTANCE_NM = 100;              // Typical descent
  const DESCENT_TIME_HR = 0.4;                  // ~24 min descent
  
  // Calculate cruise phase
  const cruiseDistanceNm = Math.max(0, routeDistanceNm - CLIMB_DISTANCE_NM - DESCENT_DISTANCE_NM);
  const cruiseTimeHr = cruiseDistanceNm / aircraft.cruiseSpeedKts;
  
  // Fuel burns
  const taxiOutFuelKg = TAXI_TIME_HR * aircraft.taxiFuelFlowKgHr;
  const climbFuelKg = CLIMB_TIME_HR * aircraft.climbFuelFlowKgHr;
  const cruiseFuelKg = cruiseTimeHr * aircraft.cruiseFuelFlowKgHr;
  const descentFuelKg = DESCENT_TIME_HR * aircraft.descentFuelFlowKgHr;
  
  const tripFuelKg = climbFuelKg + cruiseFuelKg + descentFuelKg;
  const contingencyFuelKg = tripFuelKg * 0.05;  // 5% JAR-OPS
  const alternateFuelKg = 0.5 * aircraft.cruiseFuelFlowKgHr;  // 30 min cruise
  const finalReserveFuelKg = 0.5 * aircraft.holdingFuelFlowKgHr;  // 30 min holding
  
  const totalRequiredKg = taxiOutFuelKg + tripFuelKg + contingencyFuelKg + 
                          alternateFuelKg + finalReserveFuelKg;
  
  // Round up to nearest 100kg for practical loading
  const blockFuelKg = Math.ceil(totalRequiredKg / 100) * 100;
  
  return {
    taxiOutFuelKg: Math.round(taxiOutFuelKg),
    tripFuelKg: Math.round(tripFuelKg),
    contingencyFuelKg: Math.round(contingencyFuelKg),
    alternateFuelKg: Math.round(alternateFuelKg),
    finalReserveFuelKg: Math.round(finalReserveFuelKg),
    totalRequiredKg: Math.round(totalRequiredKg),
    blockFuelKg,
  };
}

// ============================================================================
// WEIGHT CALCULATION
// ============================================================================

export function calculateWeights(
  aircraft: AircraftProfile,
  payloadKg: number,
  fuelPlan: FuelPlan
): WeightSummary {
  const oewKg = aircraft.oew;
  const zfwKg = oewKg + payloadKg;
  const blockFuelKg = fuelPlan.blockFuelKg;
  const towKg = zfwKg + blockFuelKg;
  
  // Landing weight = TOW - taxi fuel - trip fuel
  const landingFuelKg = blockFuelKg - fuelPlan.taxiOutFuelKg - fuelPlan.tripFuelKg;
  const lwKg = towKg - fuelPlan.taxiOutFuelKg - fuelPlan.tripFuelKg;
  
  return {
    oewKg,
    payloadKg,
    zfwKg,
    blockFuelKg,
    towKg,
    tripFuelKg: fuelPlan.tripFuelKg,
    landingFuelKg,
    lwKg,
  };
}

// ============================================================================
// WIND COMPONENT CALCULATION
// ============================================================================

export function calculateWindComponents(
  runwayHeading: number,
  windDirection: number | 'VRB',
  windSpeed: number
): { headwind: number; crosswind: number } {
  if (windDirection === 'VRB' || windSpeed === 0) {
    return { headwind: 0, crosswind: 0 };
  }
  
  // Calculate relative wind angle
  const relativeAngle = ((windDirection - runwayHeading + 540) % 360) - 180;
  const angleRad = (relativeAngle * Math.PI) / 180;
  
  // Headwind is positive when wind is coming from ahead
  // Crosswind is always positive (absolute value)
  const headwind = Math.round(windSpeed * Math.cos(angleRad));
  const crosswind = Math.abs(Math.round(windSpeed * Math.sin(angleRad)));
  
  return { headwind, crosswind };
}

// ============================================================================
// DISPATCH CHECKS
// ============================================================================

function checkRange(
  routeDistanceNm: number,
  aircraft: AircraftProfile
): CheckResult {
  // Apply 8% margin for winds and routing
  const effectiveRange = aircraft.maxRangeNm * 0.92;
  const passed = routeDistanceNm <= effectiveRange;
  
  return {
    passed,
    value: routeDistanceNm,
    limit: effectiveRange,
    message: passed 
      ? `Route ${routeDistanceNm} nm within range (max ${Math.round(effectiveRange)} nm)`
      : `Route ${routeDistanceNm} nm EXCEEDS effective range of ${Math.round(effectiveRange)} nm`,
  };
}

function checkFuel(
  fuelPlan: FuelPlan,
  aircraft: AircraftProfile
): CheckResult {
  const passed = fuelPlan.blockFuelKg <= aircraft.maxFuelCapacity;
  
  return {
    passed,
    value: fuelPlan.blockFuelKg,
    limit: aircraft.maxFuelCapacity,
    message: passed
      ? `Fuel ${fuelPlan.blockFuelKg} kg within capacity (max ${aircraft.maxFuelCapacity} kg)`
      : `Fuel ${fuelPlan.blockFuelKg} kg EXCEEDS tank capacity of ${aircraft.maxFuelCapacity} kg`,
  };
}

function checkTOW(
  towKg: number,
  aircraft: AircraftProfile
): CheckResult {
  const passed = towKg <= aircraft.mtow;
  
  return {
    passed,
    value: towKg,
    limit: aircraft.mtow,
    message: passed
      ? `TOW ${towKg} kg within MTOW (max ${aircraft.mtow} kg)`
      : `TOW ${towKg} kg EXCEEDS MTOW of ${aircraft.mtow} kg`,
  };
}

function checkLW(
  lwKg: number,
  aircraft: AircraftProfile
): CheckResult {
  const passed = lwKg <= aircraft.mlw;
  
  return {
    passed,
    value: lwKg,
    limit: aircraft.mlw,
    message: passed
      ? `LW ${lwKg} kg within MLW (max ${aircraft.mlw} kg)`
      : `LW ${lwKg} kg EXCEEDS MLW of ${aircraft.mlw} kg`,
  };
}

function checkZFW(
  zfwKg: number,
  aircraft: AircraftProfile
): CheckResult {
  const passed = zfwKg <= aircraft.mzfw;
  
  return {
    passed,
    value: zfwKg,
    limit: aircraft.mzfw,
    message: passed
      ? `ZFW ${zfwKg} kg within MZFW (max ${aircraft.mzfw} kg)`
      : `ZFW ${zfwKg} kg EXCEEDS MZFW of ${aircraft.mzfw} kg`,
  };
}

function checkDepartureRunway(
  runwayLengthFt: number,
  runwaySurface: string,
  aircraft: AircraftProfile
): CheckResult {
  // Apply 15% safety factor for non-ideal conditions
  const requiredLength = aircraft.takeoffDistanceFt * 1.15;
  const surfaceOk = ['ASP', 'ASPH', 'CON', 'CONC', 'PEM'].includes(runwaySurface.toUpperCase());
  const lengthOk = runwayLengthFt >= requiredLength;
  const passed = lengthOk && surfaceOk;
  
  let message = '';
  if (!surfaceOk) {
    message = `Runway surface "${runwaySurface}" not suitable for ${aircraft.icaoCode}`;
  } else if (!lengthOk) {
    message = `Runway ${runwayLengthFt} ft too short (need ${Math.round(requiredLength)} ft)`;
  } else {
    message = `Runway ${runwayLengthFt} ft adequate for takeoff`;
  }
  
  return {
    passed,
    value: runwayLengthFt,
    limit: requiredLength,
    message,
  };
}

function checkArrivalRunway(
  runwayLengthFt: number,
  runwaySurface: string,
  aircraft: AircraftProfile
): CheckResult {
  // Apply 15% safety factor
  const requiredLength = aircraft.landingDistanceFt * 1.15;
  const surfaceOk = ['ASP', 'ASPH', 'CON', 'CONC', 'PEM'].includes(runwaySurface.toUpperCase());
  const lengthOk = runwayLengthFt >= requiredLength;
  const passed = lengthOk && surfaceOk;
  
  let message = '';
  if (!surfaceOk) {
    message = `Runway surface "${runwaySurface}" not suitable for ${aircraft.icaoCode}`;
  } else if (!lengthOk) {
    message = `Runway ${runwayLengthFt} ft too short for landing (need ${Math.round(requiredLength)} ft)`;
  } else {
    message = `Runway ${runwayLengthFt} ft adequate for landing`;
  }
  
  return {
    passed,
    value: runwayLengthFt,
    limit: requiredLength,
    message,
  };
}

function checkDepartureWeather(
  metar: DecodedMetar | null | undefined,
  _aircraft: AircraftProfile
): CheckResult {
  if (!metar) {
    return {
      passed: true,
      value: 'N/A',
      limit: 'N/A',
      message: 'No METAR - assuming VMC',
    };
  }
  
  const visibility = metar.visibility.value;
  const visibilityM = metar.visibility.unit === 'SM' ? visibility * 1609 : visibility;
  
  // For departure, we need takeoff minima (lower than approach)
  const minVisibilityM = 400;  // Typical low-vis takeoff minimum
  const passed = visibilityM >= minVisibilityM;
  
  return {
    passed,
    value: `${visibility} ${metar.visibility.unit}`,
    limit: `${minVisibilityM}m`,
    message: passed
      ? `Departure visibility ${visibility} ${metar.visibility.unit} above minima`
      : `Departure visibility ${visibility} ${metar.visibility.unit} BELOW minima`,
  };
}

function checkArrivalWeather(
  metar: DecodedMetar | null | undefined,
  aircraft: AircraftProfile
): CheckResult {
  if (!metar) {
    return {
      passed: true,
      value: 'N/A',
      limit: 'N/A',
      message: 'No METAR - assuming VMC',
    };
  }
  
  const visibility = metar.visibility.value;
  const visibilityM = metar.visibility.unit === 'SM' ? visibility * 1609 : visibility;
  
  // Get ceiling from clouds
  let ceilingFt: number | null = null;
  for (const cloud of metar.clouds) {
    if (['BKN', 'OVC', 'VV'].includes(cloud.coverage) && cloud.base !== null) {
      ceilingFt = cloud.base;
      break;
    }
  }
  
  const visOk = visibilityM >= aircraft.catIMinVisibilityM;
  const ceilingOk = ceilingFt === null || ceilingFt >= aircraft.catIMinCeilingFt;
  const passed = visOk && ceilingOk;
  
  let message = '';
  if (!visOk) {
    message = `Arrival visibility ${visibility} ${metar.visibility.unit} BELOW CAT I minima`;
  } else if (!ceilingOk) {
    message = `Arrival ceiling ${ceilingFt} ft BELOW CAT I minima (${aircraft.catIMinCeilingFt} ft)`;
  } else {
    message = `Arrival weather above CAT I minima`;
  }
  
  return {
    passed,
    value: ceilingFt !== null ? `${ceilingFt}ft / ${visibility}${metar.visibility.unit}` : `${visibility}${metar.visibility.unit}`,
    limit: `${aircraft.catIMinCeilingFt}ft / ${aircraft.catIMinVisibilityM}m`,
    message,
  };
}

function checkCrosswind(
  departureRunwayHeading: number,
  arrivalRunwayHeading: number,
  departureMetar: DecodedMetar | null | undefined,
  arrivalMetar: DecodedMetar | null | undefined,
  aircraft: AircraftProfile
): CheckResult {
  let maxCrosswind = 0;
  let location = '';
  
  if (departureMetar) {
    const depWind = calculateWindComponents(
      departureRunwayHeading,
      departureMetar.wind.direction,
      departureMetar.wind.gust || departureMetar.wind.speed
    );
    if (depWind.crosswind > maxCrosswind) {
      maxCrosswind = depWind.crosswind;
      location = 'departure';
    }
  }
  
  if (arrivalMetar) {
    const arrWind = calculateWindComponents(
      arrivalRunwayHeading,
      arrivalMetar.wind.direction,
      arrivalMetar.wind.gust || arrivalMetar.wind.speed
    );
    if (arrWind.crosswind > maxCrosswind) {
      maxCrosswind = arrWind.crosswind;
      location = 'arrival';
    }
  }
  
  const passed = maxCrosswind <= aircraft.maxCrosswindKt;
  
  return {
    passed,
    value: maxCrosswind,
    limit: aircraft.maxCrosswindKt,
    message: passed
      ? `Crosswind ${maxCrosswind} kt within limits`
      : `Crosswind ${maxCrosswind} kt at ${location} EXCEEDS limit of ${aircraft.maxCrosswindKt} kt`,
  };
}

// ============================================================================
// MAIN DISPATCH FUNCTION
// ============================================================================

/**
 * Evaluate flight feasibility using FS2024-style dispatch logic.
 * Returns comprehensive result with all checks and computed values.
 */
export function evaluateDispatch(input: DispatchInput): DispatchResult {
  const { aircraft, routeDistanceNm, payloadKg } = input;
  
  // Calculate fuel plan
  const fuelPlan = calculateFuelPlan(routeDistanceNm, aircraft);
  
  // Calculate weights
  const weights = calculateWeights(aircraft, payloadKg, fuelPlan);
  
  // Run all checks
  const checks = {
    range: checkRange(routeDistanceNm, aircraft),
    fuel: checkFuel(fuelPlan, aircraft),
    towWeight: checkTOW(weights.towKg, aircraft),
    lwWeight: checkLW(weights.lwKg, aircraft),
    zfwWeight: checkZFW(weights.zfwKg, aircraft),
    departureRunway: checkDepartureRunway(
      input.departureRunwayLengthFt,
      input.departureRunwaySurface,
      aircraft
    ),
    arrivalRunway: checkArrivalRunway(
      input.arrivalRunwayLengthFt,
      input.arrivalRunwaySurface,
      aircraft
    ),
    departureWeather: checkDepartureWeather(input.departureMetar, aircraft),
    arrivalWeather: checkArrivalWeather(input.arrivalMetar, aircraft),
    crosswind: checkCrosswind(
      input.departureRunwayHeading,
      input.arrivalRunwayHeading,
      input.departureMetar,
      input.arrivalMetar,
      aircraft
    ),
  };
  
  // Collect reasons and warnings
  const reasons: string[] = [];
  const warnings: string[] = [];
  
  // Critical checks (blocking)
  if (!checks.range.passed) reasons.push(checks.range.message);
  if (!checks.fuel.passed) reasons.push(checks.fuel.message);
  if (!checks.towWeight.passed) reasons.push(checks.towWeight.message);
  if (!checks.lwWeight.passed) reasons.push(checks.lwWeight.message);
  if (!checks.zfwWeight.passed) reasons.push(checks.zfwWeight.message);
  if (!checks.departureRunway.passed) reasons.push(checks.departureRunway.message);
  if (!checks.arrivalRunway.passed) reasons.push(checks.arrivalRunway.message);
  
  // Weather checks (can be blocking or warning depending on severity)
  if (!checks.departureWeather.passed) reasons.push(checks.departureWeather.message);
  if (!checks.arrivalWeather.passed) reasons.push(checks.arrivalWeather.message);
  if (!checks.crosswind.passed) reasons.push(checks.crosswind.message);
  
  // Add warnings for marginal conditions
  const rangeMarginNm = (aircraft.maxRangeNm * 0.92) - routeDistanceNm;
  if (rangeMarginNm < 100 && checks.range.passed) {
    warnings.push(`Low range margin: only ${Math.round(rangeMarginNm)} nm reserve`);
  }
  
  const fuelMarginKg = aircraft.maxFuelCapacity - fuelPlan.blockFuelKg;
  if (fuelMarginKg < 500 && checks.fuel.passed) {
    warnings.push(`Low fuel margin: only ${fuelMarginKg} kg extra capacity`);
  }
  
  const towMarginKg = aircraft.mtow - weights.towKg;
  if (towMarginKg < 1000 && checks.towWeight.passed) {
    warnings.push(`TOW near MTOW limit: only ${towMarginKg} kg margin`);
  }
  
  // Calculate flight time
  const climbTimeMin = 21;
  const cruiseDistanceNm = Math.max(0, routeDistanceNm - 180);
  const cruiseTimeMin = (cruiseDistanceNm / aircraft.cruiseSpeedKts) * 60;
  const descentTimeMin = 24;
  const flightTimeMin = climbTimeMin + cruiseTimeMin + descentTimeMin;
  
  // Determine feasibility
  const feasible = reasons.length === 0;
  
  return {
    feasible,
    reasons,
    warnings,
    computed: {
      tripFuelKg: fuelPlan.tripFuelKg,
      reserveFuelKg: fuelPlan.contingencyFuelKg + fuelPlan.alternateFuelKg + fuelPlan.finalReserveFuelKg,
      blockFuelKg: fuelPlan.blockFuelKg,
      towKg: weights.towKg,
      lwKg: weights.lwKg,
      rangeMarginNm: Math.round(rangeMarginNm),
      flightTimeMin: Math.round(flightTimeMin),
      fuelMarginKg,
    },
    fuelPlan,
    weights,
    checks,
  };
}

// ============================================================================
// HELPER EXPORTS
// ============================================================================

export function getAircraftProfile(icaoCode: string): AircraftProfile | undefined {
  return AIRCRAFT_PROFILES[icaoCode];
}

export function getAllAircraftProfiles(): AircraftProfile[] {
  return Object.values(AIRCRAFT_PROFILES);
}
