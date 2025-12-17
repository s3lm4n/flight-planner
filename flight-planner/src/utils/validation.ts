/**
 * Flight Validation System
 * 
 * Comprehensive validation of aircraft and airport compatibility.
 * Checks runway length, wind limits, NOTAMs, and weather conditions.
 */

import {
  EnhancedAircraft,
  ValidationIssue,
  FlightValidationResult,
  AirportValidation,
  RunwayAnalysis,
  WindComponents,
} from '@/types/aircraft';
import {
  EnhancedAirport,
  EnhancedRunway,
  Notam,
} from '@/types/airport';
import { AirportWeather, Wind } from '@/types';

// ============================================================================
// WIND CALCULATIONS
// ============================================================================

/**
 * Calculate wind components for a runway
 */
export function calculateWindComponents(
  windDirection: number,
  windSpeed: number,
  runwayHeading: number,
  gustSpeed?: number
): WindComponents {
  // Angle between wind and runway (use the most favorable runway end)
  const angleDeg = Math.abs(windDirection - runwayHeading);
  const angleRad = (Math.min(angleDeg, 360 - angleDeg) * Math.PI) / 180;
  
  // Calculate components
  const headwindComponent = windSpeed * Math.cos(angleRad);
  const crosswindComponent = Math.abs(windSpeed * Math.sin(angleRad));
  
  // Determine headwind or tailwind
  const relativeAngle = ((windDirection - runwayHeading + 360) % 360);
  const isTailwind = relativeAngle > 90 && relativeAngle < 270;
  
  return {
    windDirection,
    windSpeed,
    gustSpeed,
    runwayHeading,
    headwind: isTailwind ? 0 : headwindComponent,
    crosswind: crosswindComponent,
    tailwind: isTailwind ? Math.abs(headwindComponent) : 0,
  };
}

/**
 * Calculate adjusted runway requirement based on conditions
 */
export function calculateAdjustedRunwayLength(
  baseLength: number,
  elevation: number,
  temperature: number,
  aircraft: EnhancedAircraft,
  isLanding: boolean
): number {
  let adjustedLength = baseLength;
  
  // ISA temperature at sea level = 15°C
  const isaTemp = 15 - (elevation / 1000) * 2;  // -2°C per 1000ft
  const tempDeviation = temperature - isaTemp;
  
  // Temperature adjustment
  if (tempDeviation > 0) {
    const tempFactor = isLanding ? 1.0 : aircraft.runwayRequirements.takeoffDistanceFactorPerC;
    adjustedLength *= 1 + (tempDeviation * tempFactor / 100);
  }
  
  // Elevation adjustment (per 1000ft)
  const elevationFactor = aircraft.runwayRequirements.takeoffDistanceFactorPer1000ft;
  adjustedLength *= 1 + ((elevation / 1000) * elevationFactor / 100);
  
  return Math.round(adjustedLength);
}

// ============================================================================
// RUNWAY VALIDATION
// ============================================================================

/**
 * Analyze runway suitability for an aircraft
 */
export function analyzeRunway(
  runway: EnhancedRunway,
  aircraft: EnhancedAircraft,
  wind: Wind | null,
  temperature: number,
  elevation: number,
  isWetRunway: boolean,
  isArrival: boolean
): RunwayAnalysis {
  const issues: ValidationIssue[] = [];
  let isSuitable = true;
  let suitabilityScore = 100;
  
  // Calculate required runway length
  const baseRequired = isArrival 
    ? (isWetRunway ? aircraft.runwayRequirements.landingDistanceWet : aircraft.runwayRequirements.landingDistance)
    : aircraft.runwayRequirements.takeoffDistance;
  
  const requiredLength = calculateAdjustedRunwayLength(
    baseRequired,
    elevation,
    temperature,
    aircraft,
    isArrival
  );
  
  const availableLength = runway.lengthMeters;
  const lengthMargin = availableLength - requiredLength;
  
  // Check runway length
  if (lengthMargin < 0) {
    issues.push({
      id: `runway-length-${runway.id}`,
      severity: 'BLOCKING',
      category: 'RUNWAY',
      title: 'Insufficient runway length',
      message: `Runway ${runway.designator} is ${Math.abs(lengthMargin)}m too short`,
      details: `Required: ${requiredLength}m, Available: ${availableLength}m`,
      affectedRunway: runway.designator,
      currentValue: availableLength,
      requiredValue: requiredLength,
      recommendation: 'Select a different runway or airport with longer runways',
    });
    isSuitable = false;
    suitabilityScore = 0;
  } else if (lengthMargin < 300) {
    issues.push({
      id: `runway-margin-${runway.id}`,
      severity: 'WARNING',
      category: 'RUNWAY',
      title: 'Low runway length margin',
      message: `Only ${lengthMargin}m margin on runway ${runway.designator}`,
      affectedRunway: runway.designator,
      currentValue: lengthMargin,
      requiredValue: 300,
      recommendation: 'Consider reduced payload or favorable conditions',
    });
    suitabilityScore -= 30;
  }
  
  // Check runway width
  if (runway.widthMeters < aircraft.runwayRequirements.minRunwayWidth) {
    issues.push({
      id: `runway-width-${runway.id}`,
      severity: 'WARNING',
      category: 'RUNWAY',
      title: 'Narrow runway',
      message: `Runway ${runway.designator} is ${runway.widthMeters}m wide, aircraft requires ${aircraft.runwayRequirements.minRunwayWidth}m`,
      affectedRunway: runway.designator,
      currentValue: runway.widthMeters,
      requiredValue: aircraft.runwayRequirements.minRunwayWidth,
    });
    suitabilityScore -= 20;
  }
  
  // Check surface compatibility
  const surfaceType = runway.surface;
  if (aircraft.runwayRequirements.requiresPavedRunway) {
    const pavedSurfaces = ['ASP', 'CON', 'PEM', 'BIT', 'COP'];
    if (!pavedSurfaces.includes(surfaceType)) {
      issues.push({
        id: `runway-surface-${runway.id}`,
        severity: 'BLOCKING',
        category: 'RUNWAY',
        title: 'Unsuitable runway surface',
        message: `Aircraft requires paved runway, ${runway.designator} has ${surfaceType} surface`,
        affectedRunway: runway.designator,
        currentValue: surfaceType,
        requiredValue: 'ASP/CON',
      });
      isSuitable = false;
      suitabilityScore = 0;
    }
  } else if (!aircraft.runwayRequirements.allowedSurfaces.includes(surfaceType)) {
    issues.push({
      id: `runway-surface-${runway.id}`,
      severity: 'WARNING',
      category: 'RUNWAY',
      title: 'Runway surface caution',
      message: `Surface ${surfaceType} not in recommended surfaces for this aircraft`,
      affectedRunway: runway.designator,
    });
    suitabilityScore -= 15;
  }
  
  // Check runway status
  if (runway.status !== 'OPEN') {
    issues.push({
      id: `runway-status-${runway.id}`,
      severity: 'BLOCKING',
      category: 'RUNWAY',
      title: 'Runway not available',
      message: `Runway ${runway.designator} is ${runway.status}`,
      affectedRunway: runway.designator,
    });
    isSuitable = false;
    suitabilityScore = 0;
  }
  
  // Wind analysis
  let windComponents: WindComponents | undefined;
  let windValid = true;
  
  if (wind && wind.speed > 0) {
    // Analyze both runway ends
    const primaryWind = calculateWindComponents(
      wind.direction,
      wind.speed,
      runway.headingMagnetic,
      wind.gust
    );
    const reciprocalWind = calculateWindComponents(
      wind.direction,
      wind.speed,
      runway.reciprocalHeadingMagnetic,
      wind.gust
    );
    
    // Use the runway end with better wind (more headwind/less tailwind)
    windComponents = primaryWind.headwind >= reciprocalWind.headwind ? primaryWind : reciprocalWind;
    
    // Check crosswind
    const maxCrosswind = isWetRunway 
      ? aircraft.windLimitations.maxCrosswindWet 
      : aircraft.windLimitations.maxCrosswind;
    
    if (windComponents.crosswind > maxCrosswind) {
      issues.push({
        id: `wind-crosswind-${runway.id}`,
        severity: 'BLOCKING',
        category: 'WIND',
        title: 'Crosswind limit exceeded',
        message: `Crosswind ${Math.round(windComponents.crosswind)}kt exceeds limit of ${maxCrosswind}kt`,
        affectedRunway: runway.designator,
        currentValue: Math.round(windComponents.crosswind),
        requiredValue: maxCrosswind,
        recommendation: 'Select different runway or wait for wind change',
      });
      windValid = false;
      isSuitable = false;
      suitabilityScore = 0;
    } else if (windComponents.crosswind > maxCrosswind * 0.8) {
      issues.push({
        id: `wind-crosswind-warning-${runway.id}`,
        severity: 'WARNING',
        category: 'WIND',
        title: 'High crosswind',
        message: `Crosswind ${Math.round(windComponents.crosswind)}kt approaching limit of ${maxCrosswind}kt`,
        affectedRunway: runway.designator,
      });
      suitabilityScore -= 25;
    }
    
    // Check tailwind
    if (windComponents.tailwind > aircraft.windLimitations.maxTailwind) {
      issues.push({
        id: `wind-tailwind-${runway.id}`,
        severity: 'BLOCKING',
        category: 'WIND',
        title: 'Tailwind limit exceeded',
        message: `Tailwind ${Math.round(windComponents.tailwind)}kt exceeds limit of ${aircraft.windLimitations.maxTailwind}kt`,
        affectedRunway: runway.designator,
        currentValue: Math.round(windComponents.tailwind),
        requiredValue: aircraft.windLimitations.maxTailwind,
        recommendation: 'Use opposite runway direction',
      });
      windValid = false;
      isSuitable = false;
      suitabilityScore = 0;
    }
    
    // Check gusts
    if (wind.gust) {
      const gustCrosswind = windComponents.crosswind * (wind.gust / wind.speed);
      if (gustCrosswind > maxCrosswind) {
        issues.push({
          id: `wind-gust-${runway.id}`,
          severity: 'WARNING',
          category: 'WIND',
          title: 'Gusty crosswind',
          message: `Crosswind gusts may reach ${Math.round(gustCrosswind)}kt`,
          affectedRunway: runway.designator,
        });
        suitabilityScore -= 15;
      }
    }
    
    // Bonus for headwind
    if (windComponents.headwind > 10) {
      suitabilityScore += 10;
    }
  }
  
  return {
    runwayId: runway.id,
    designator: runway.designator,
    isSuitable,
    issues,
    availableLength,
    requiredLength,
    lengthMargin,
    surfaceCompatible: !aircraft.runwayRequirements.requiresPavedRunway || 
                       ['ASP', 'CON', 'PEM', 'BIT', 'COP'].includes(runway.surface),
    headwindComponent: windComponents?.headwind || 0,
    crosswindComponent: windComponents?.crosswind || 0,
    tailwindComponent: windComponents?.tailwind || 0,
    windValid,
    suitabilityScore: Math.max(0, Math.min(100, suitabilityScore)),
  };
}

// ============================================================================
// NOTAM VALIDATION
// ============================================================================

/**
 * Check NOTAMs for issues affecting flight
 */
export function validateNotams(
  notams: Notam[],
  isArrival: boolean
): { issues: ValidationIssue[]; hasBlocking: boolean; relevantIds: string[] } {
  const issues: ValidationIssue[] = [];
  const relevantIds: string[] = [];
  let hasBlocking = false;
  
  for (const notam of notams) {
    // Check if NOTAM is currently active
    const now = new Date();
    if (notam.effectiveFrom > now || notam.effectiveTo < now) {
      continue;
    }
    
    relevantIds.push(notam.id);
    
    // Check for runway closures
    if (notam.type === 'RUNWAY' && notam.severity === 'CRITICAL') {
      if (notam.text.toLowerCase().includes('clsd') || 
          notam.text.toLowerCase().includes('closed')) {
        issues.push({
          id: `notam-${notam.id}`,
          severity: 'ERROR',
          category: 'NOTAM',
          title: `Runway ${notam.affectedRunway || ''} closed`,
          message: notam.text.substring(0, 100),
          details: notam.rawText,
          affectedRunway: notam.affectedRunway,
        });
        if (notam.impactsTakeoff && !isArrival) hasBlocking = true;
        if (notam.impactsLanding && isArrival) hasBlocking = true;
      }
    }
    
    // Check for airport restrictions
    if (notam.severity === 'CRITICAL') {
      issues.push({
        id: `notam-critical-${notam.id}`,
        severity: 'WARNING',
        category: 'NOTAM',
        title: 'Critical NOTAM',
        message: notam.text.substring(0, 100),
        details: notam.rawText,
      });
    }
    
    // Check for navigation/approach restrictions
    if (notam.type === 'NAVIGATION' || notam.type === 'PROCEDURE') {
      issues.push({
        id: `notam-nav-${notam.id}`,
        severity: 'INFO',
        category: 'NOTAM',
        title: 'Navigation/Procedure NOTAM',
        message: notam.text.substring(0, 100),
      });
    }
  }
  
  return { issues, hasBlocking, relevantIds };
}

// ============================================================================
// WEATHER VALIDATION
// ============================================================================

/**
 * Validate weather conditions for flight
 */
export function validateWeather(
  weather: AirportWeather | null,
  _aircraft: EnhancedAircraft,
  _isArrival: boolean
): { issues: ValidationIssue[]; isValid: boolean; wind: Wind | null } {
  const issues: ValidationIssue[] = [];
  let isValid = true;
  
  if (!weather || !weather.metar) {
    issues.push({
      id: 'weather-unavailable',
      severity: 'WARNING',
      category: 'WEATHER',
      title: 'Weather data unavailable',
      message: 'Unable to fetch current weather. Proceed with caution.',
      recommendation: 'Obtain weather from alternate source',
    });
    return { issues, isValid: true, wind: null };
  }
  
  const metar = weather.metar;
  
  // Check flight category
  if (metar.flightCategory === 'LIFR') {
    issues.push({
      id: 'weather-lifr',
      severity: 'ERROR',
      category: 'WEATHER',
      title: 'Low IFR conditions',
      message: `Current conditions: ${metar.flightCategory}`,
      details: `Visibility: ${metar.visibility.value} SM`,
      recommendation: 'Flight not recommended without proper IFR equipment and crew',
    });
  } else if (metar.flightCategory === 'IFR') {
    issues.push({
      id: 'weather-ifr',
      severity: 'WARNING',
      category: 'WEATHER',
      title: 'IFR conditions',
      message: `Current conditions: ${metar.flightCategory}`,
      details: `Visibility: ${metar.visibility.value} SM`,
    });
  }
  
  // Check visibility
  if (metar.visibility.value < 0.5) {
    issues.push({
      id: 'weather-visibility',
      severity: 'BLOCKING',
      category: 'WEATHER',
      title: 'Visibility below minimums',
      message: `Visibility ${metar.visibility.value} SM`,
      currentValue: metar.visibility.value,
      requiredValue: 0.5,
    });
    isValid = false;
  }
  
  // Check for significant weather
  if (metar.weather.includes('TS')) {
    issues.push({
      id: 'weather-thunderstorm',
      severity: 'ERROR',
      category: 'WEATHER',
      title: 'Thunderstorm activity',
      message: 'Active thunderstorms reported at airport',
      recommendation: 'Delay departure/arrival until thunderstorm passes',
    });
  }
  
  if (metar.weather.some(w => w === 'FZ')) {
    issues.push({
      id: 'weather-freezing',
      severity: 'ERROR',
      category: 'WEATHER',
      title: 'Freezing precipitation',
      message: 'Freezing precipitation reported',
      recommendation: 'Ensure aircraft de-icing is available',
    });
  }
  
  // Check ceiling
  const ceiling = metar.clouds.find(c => c.coverage === 'BKN' || c.coverage === 'OVC');
  if (ceiling && ceiling.altitude < 2) {
    issues.push({
      id: 'weather-ceiling',
      severity: 'WARNING',
      category: 'WEATHER',
      title: 'Low ceiling',
      message: `Ceiling at ${ceiling.altitude * 100} ft AGL`,
    });
  }
  
  // Check wind
  if (metar.wind.speed > 40) {
    issues.push({
      id: 'weather-strong-wind',
      severity: 'WARNING',
      category: 'WEATHER',
      title: 'Strong winds',
      message: `Wind ${metar.wind.speed} kt from ${metar.wind.direction}°`,
    });
  }
  
  return { issues, isValid, wind: metar.wind };
}

// ============================================================================
// PERFORMANCE VALIDATION
// ============================================================================

/**
 * Validate aircraft performance for the route
 */
export function validatePerformance(
  aircraft: EnhancedAircraft,
  departureElevation: number,
  arrivalElevation: number,
  routeDistance: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Check airport elevation
  if (departureElevation > aircraft.altitude.maxTakeoffAltitude) {
    issues.push({
      id: 'perf-dep-elevation',
      severity: 'ERROR',
      category: 'PERFORMANCE',
      title: 'Departure airport too high',
      message: `Airport elevation ${departureElevation} ft exceeds aircraft max takeoff altitude ${aircraft.altitude.maxTakeoffAltitude} ft`,
      currentValue: departureElevation,
      requiredValue: aircraft.altitude.maxTakeoffAltitude,
    });
  }
  
  if (arrivalElevation > aircraft.altitude.maxLandingAltitude) {
    issues.push({
      id: 'perf-arr-elevation',
      severity: 'ERROR',
      category: 'PERFORMANCE',
      title: 'Arrival airport too high',
      message: `Airport elevation ${arrivalElevation} ft exceeds aircraft max landing altitude ${aircraft.altitude.maxLandingAltitude} ft`,
      currentValue: arrivalElevation,
      requiredValue: aircraft.altitude.maxLandingAltitude,
    });
  }
  
  // Check range
  if (routeDistance > aircraft.fuel.maxRange * 0.95) {
    issues.push({
      id: 'perf-range-critical',
      severity: 'ERROR',
      category: 'FUEL',
      title: 'Route at range limit',
      message: `Route distance ${Math.round(routeDistance)} nm is very close to max range ${aircraft.fuel.maxRange} nm`,
      currentValue: Math.round(routeDistance),
      requiredValue: aircraft.fuel.maxRange,
      recommendation: 'Consider fuel stop or different aircraft',
    });
  } else if (routeDistance > aircraft.fuel.maxRange * 0.85) {
    issues.push({
      id: 'perf-range-warning',
      severity: 'WARNING',
      category: 'FUEL',
      title: 'Long range flight',
      message: `Route distance ${Math.round(routeDistance)} nm is ${Math.round(routeDistance / aircraft.fuel.maxRange * 100)}% of max range`,
      recommendation: 'Verify fuel planning carefully',
    });
  } else if (routeDistance > aircraft.fuel.maxRange) {
    issues.push({
      id: 'perf-range-exceeded',
      severity: 'BLOCKING',
      category: 'FUEL',
      title: 'Route exceeds aircraft range',
      message: `Route distance ${Math.round(routeDistance)} nm exceeds max range ${aircraft.fuel.maxRange} nm`,
      currentValue: Math.round(routeDistance),
      requiredValue: aircraft.fuel.maxRange,
    });
  }
  
  return issues;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Complete flight validation
 */
export function validateFlight(
  aircraft: EnhancedAircraft,
  departureAirport: EnhancedAirport,
  arrivalAirport: EnhancedAirport,
  departureWeather: AirportWeather | null,
  arrivalWeather: AirportWeather | null,
  departureNotams: Notam[],
  arrivalNotams: Notam[],
  routeDistance: number
): FlightValidationResult {
  const allIssues: ValidationIssue[] = [];
  
  // Get temperature from weather
  const depTemp = departureWeather?.metar?.temperature || 15;
  const arrTemp = arrivalWeather?.metar?.temperature || 15;
  
  // Validate weather
  const depWeatherResult = validateWeather(departureWeather, aircraft, false);
  const arrWeatherResult = validateWeather(arrivalWeather, aircraft, true);
  
  allIssues.push(...depWeatherResult.issues.map(i => ({ ...i, affectedAirport: departureAirport.icao })));
  allIssues.push(...arrWeatherResult.issues.map(i => ({ ...i, affectedAirport: arrivalAirport.icao })));
  
  // Determine if runways are wet
  const isDepWet = departureWeather?.metar?.weather.some(w => ['RA', 'SN', 'DZ'].includes(w)) || false;
  const isArrWet = arrivalWeather?.metar?.weather.some(w => ['RA', 'SN', 'DZ'].includes(w)) || false;
  
  // Analyze departure runways
  const depRunwayAnalyses: RunwayAnalysis[] = departureAirport.runways.map(runway =>
    analyzeRunway(runway, aircraft, depWeatherResult.wind, depTemp, departureAirport.elevation, isDepWet, false)
  );
  
  // Analyze arrival runways
  const arrRunwayAnalyses: RunwayAnalysis[] = arrivalAirport.runways.map(runway =>
    analyzeRunway(runway, aircraft, arrWeatherResult.wind, arrTemp, arrivalAirport.elevation, isArrWet, true)
  );
  
  // Get runway issues
  depRunwayAnalyses.forEach(analysis => {
    allIssues.push(...analysis.issues.map(i => ({ ...i, affectedAirport: departureAirport.icao })));
  });
  arrRunwayAnalyses.forEach(analysis => {
    allIssues.push(...analysis.issues.map(i => ({ ...i, affectedAirport: arrivalAirport.icao })));
  });
  
  // Validate NOTAMs
  const depNotamResult = validateNotams(departureNotams, false);
  const arrNotamResult = validateNotams(arrivalNotams, true);
  
  allIssues.push(...depNotamResult.issues.map(i => ({ ...i, affectedAirport: departureAirport.icao })));
  allIssues.push(...arrNotamResult.issues.map(i => ({ ...i, affectedAirport: arrivalAirport.icao })));
  
  // Validate performance
  const perfIssues = validatePerformance(
    aircraft,
    departureAirport.elevation,
    arrivalAirport.elevation,
    routeDistance
  );
  allIssues.push(...perfIssues);
  
  // Find suitable runways
  const suitableDepRunways = depRunwayAnalyses.filter(r => r.isSuitable);
  const suitableArrRunways = arrRunwayAnalyses.filter(r => r.isSuitable);
  
  // Check if flight is possible
  const hasBlockingIssues = allIssues.some(i => i.severity === 'BLOCKING');
  const hasSuitableDepRunway = suitableDepRunways.length > 0;
  const hasSuitableArrRunway = suitableArrRunways.length > 0;
  
  // Add no-suitable-runway errors
  if (!hasSuitableDepRunway) {
    allIssues.push({
      id: 'no-dep-runway',
      severity: 'BLOCKING',
      category: 'RUNWAY',
      title: 'No suitable departure runway',
      message: `No runway at ${departureAirport.icao} meets aircraft requirements`,
      affectedAirport: departureAirport.icao,
      recommendation: 'Select different departure airport',
    });
  }
  
  if (!hasSuitableArrRunway) {
    allIssues.push({
      id: 'no-arr-runway',
      severity: 'BLOCKING',
      category: 'RUNWAY',
      title: 'No suitable arrival runway',
      message: `No runway at ${arrivalAirport.icao} meets aircraft requirements`,
      affectedAirport: arrivalAirport.icao,
      recommendation: 'Select different arrival airport',
    });
  }
  
  // Determine recommended runways
  const recommendedDepRunway = suitableDepRunways.sort((a, b) => b.suitabilityScore - a.suitabilityScore)[0]?.designator;
  const recommendedArrRunway = suitableArrRunways.sort((a, b) => b.suitabilityScore - a.suitabilityScore)[0]?.designator;
  
  // Build departure validation
  const departureValidation: AirportValidation = {
    icao: departureAirport.icao,
    isValid: hasSuitableDepRunway && !hasBlockingIssues && depWeatherResult.isValid,
    issues: allIssues.filter(i => i.affectedAirport === departureAirport.icao),
    suitableRunways: depRunwayAnalyses,
    recommendedRunway: recommendedDepRunway,
    weatherValid: depWeatherResult.isValid,
    windComponents: depWeatherResult.wind ? calculateWindComponents(
      depWeatherResult.wind.direction,
      depWeatherResult.wind.speed,
      departureAirport.runways[0]?.headingMagnetic || 0,
      depWeatherResult.wind.gust
    ) : undefined,
    relevantNotams: depNotamResult.relevantIds,
    hasBlockingNotam: depNotamResult.hasBlocking,
  };
  
  // Build arrival validation
  const arrivalValidation: AirportValidation = {
    icao: arrivalAirport.icao,
    isValid: hasSuitableArrRunway && !hasBlockingIssues && arrWeatherResult.isValid,
    issues: allIssues.filter(i => i.affectedAirport === arrivalAirport.icao),
    suitableRunways: arrRunwayAnalyses,
    recommendedRunway: recommendedArrRunway,
    weatherValid: arrWeatherResult.isValid,
    windComponents: arrWeatherResult.wind ? calculateWindComponents(
      arrWeatherResult.wind.direction,
      arrWeatherResult.wind.speed,
      arrivalAirport.runways[0]?.headingMagnetic || 0,
      arrWeatherResult.wind.gust
    ) : undefined,
    relevantNotams: arrNotamResult.relevantIds,
    hasBlockingNotam: arrNotamResult.hasBlocking,
  };
  
  // Final result
  const isValid = departureValidation.isValid && arrivalValidation.isValid && !hasBlockingIssues;
  const canProceed = !hasBlockingIssues && hasSuitableDepRunway && hasSuitableArrRunway;
  
  return {
    isValid,
    canProceed,
    issues: allIssues,
    departureValidation,
    arrivalValidation,
    timestamp: new Date(),
  };
}

/**
 * Get validation summary for UI display
 */
export function getValidationSummary(result: FlightValidationResult): {
  status: 'valid' | 'warning' | 'error' | 'blocked';
  message: string;
  blockingCount: number;
  warningCount: number;
  infoCount: number;
} {
  const blockingCount = result.issues.filter(i => i.severity === 'BLOCKING').length;
  const errorCount = result.issues.filter(i => i.severity === 'ERROR').length;
  const warningCount = result.issues.filter(i => i.severity === 'WARNING').length;
  const infoCount = result.issues.filter(i => i.severity === 'INFO').length;
  
  let status: 'valid' | 'warning' | 'error' | 'blocked';
  let message: string;
  
  if (blockingCount > 0) {
    status = 'blocked';
    message = `Flight cannot proceed: ${blockingCount} blocking issue${blockingCount > 1 ? 's' : ''}`;
  } else if (errorCount > 0) {
    status = 'error';
    message = `${errorCount} issue${errorCount > 1 ? 's' : ''} require${errorCount === 1 ? 's' : ''} attention`;
  } else if (warningCount > 0) {
    status = 'warning';
    message = `${warningCount} warning${warningCount > 1 ? 's' : ''} - proceed with caution`;
  } else {
    status = 'valid';
    message = 'All checks passed';
  }
  
  return { status, message, blockingCount, warningCount, infoCount };
}
