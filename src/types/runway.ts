/**
 * Runway Type Definitions
 * 
 * This is the AUTHORITATIVE type definition for runway data.
 * All runway-related code must use these types.
 */

import { Coordinate } from './index';

/**
 * Runway surface types (ICAO standard codes)
 */
export type RunwaySurfaceType = 
  | 'ASP'   // Asphalt
  | 'CON'   // Concrete
  | 'GRS'   // Grass
  | 'GRV'   // Gravel
  | 'WATER' // Water (seaplane)
  | 'DIRT'  // Dirt/Earth
  | 'SAND'  // Sand
  | 'COMP'  // Composite
  | 'UNKN'; // Unknown

/**
 * Single runway end (threshold)
 * Each physical runway has TWO ends (e.g., 09L and 27R)
 */
export interface RunwayEnd {
  /** Runway designator (e.g., "09L", "27R", "36") */
  designator: string;
  
  /** Magnetic heading in degrees (0-360) */
  heading: number;
  
  /** True heading in degrees (0-360) */
  trueHeading: number;
  
  /** Threshold position (where aircraft touches down) */
  threshold: Coordinate;
  
  /** Threshold elevation in feet MSL */
  elevation: number;
  
  /** Displaced threshold distance in feet (if any) */
  displacedThreshold?: number;
  
  /** Take-Off Run Available in feet */
  tora: number;
  
  /** Take-Off Distance Available in feet */
  toda: number;
  
  /** Accelerate-Stop Distance Available in feet */
  asda: number;
  
  /** Landing Distance Available in feet */
  lda: number;
  
  /** ILS information (if equipped) */
  ils?: {
    frequency: number;      // MHz
    course: number;         // Magnetic course
    glideslope: number;     // Degrees (typically 3.0)
    category: 'I' | 'II' | 'IIIA' | 'IIIB' | 'IIIC';
  };
  
  /** PAPI/VASI available */
  visualAids?: boolean;
  
  /** Approach lighting system type */
  approachLighting?: string;
}

/**
 * Complete runway (both ends)
 */
export interface Runway {
  /** Runway identifier (e.g., "09L/27R") */
  id: string;
  
  /** Runway length in feet */
  length: number;
  
  /** Runway width in feet */
  width: number;
  
  /** Surface type */
  surface: RunwaySurfaceType;
  
  /** Has lighting */
  lighted: boolean;
  
  /** Runway status */
  status: 'OPEN' | 'CLOSED' | 'RESTRICTED';
  
  /** Both runway ends */
  ends: [RunwayEnd, RunwayEnd];
}

/**
 * Selected runway for dispatch
 */
export interface SelectedRunway {
  /** The runway designator (e.g., "25R") */
  designator: string;
  
  /** The full runway data */
  runway: Runway;
  
  /** The specific end being used */
  end: RunwayEnd;
  
  /** Wind components calculated for this runway */
  windComponents: {
    headwind: number;    // Positive = headwind, negative = tailwind
    crosswind: number;   // Absolute value
    tailwind: number;    // Positive = tailwind (problematic)
  };
  
  /** Whether this runway is suitable */
  isSuitable: boolean;
  
  /** Reasons for unsuitability (if any) */
  issues: string[];
  
  /** Whether this is the preferred/recommended runway */
  isPreferred: boolean;
}

/**
 * Calculate runway heading from designator
 * E.g., "25R" -> 250, "09L" -> 90, "36" -> 360
 */
export function getHeadingFromDesignator(designator: string): number {
  // Extract numeric part (removes L/R/C suffix)
  const numeric = parseInt(designator.replace(/[LRC]/g, ''), 10);
  
  if (isNaN(numeric)) return 0;
  
  // Runway designators are heading / 10
  return numeric * 10;
}

/**
 * Get reciprocal runway designator
 * E.g., "25R" -> "07L", "09" -> "27"
 */
export function getReciprocalDesignator(designator: string): string {
  const numeric = parseInt(designator.replace(/[LRC]/g, ''), 10);
  const suffix = designator.replace(/[0-9]/g, '');
  
  if (isNaN(numeric)) return designator;
  
  // Calculate reciprocal (180 degrees opposite)
  let reciprocal = numeric + 18;
  if (reciprocal > 36) reciprocal -= 36;
  
  // Swap L/R suffix
  let reciprocalSuffix = suffix;
  if (suffix === 'L') reciprocalSuffix = 'R';
  else if (suffix === 'R') reciprocalSuffix = 'L';
  // C stays C
  
  return String(reciprocal).padStart(2, '0') + reciprocalSuffix;
}

/**
 * Calculate wind components for a runway
 */
export function calculateRunwayWindComponents(
  runwayHeading: number,
  windDirection: number | 'VRB',
  windSpeed: number
): { headwind: number; crosswind: number; tailwind: number } {
  // Variable wind - no specific component
  if (windDirection === 'VRB' || windSpeed === 0) {
    return { headwind: 0, crosswind: 0, tailwind: 0 };
  }
  
  // Calculate angle between wind and runway
  // Wind FROM direction, runway TO direction
  const angleDiff = ((windDirection - runwayHeading + 360) % 360);
  const angleRad = (angleDiff * Math.PI) / 180;
  
  // Headwind component (positive = headwind, negative = tailwind)
  const headwindComponent = windSpeed * Math.cos(angleRad);
  
  // Crosswind component (absolute value)
  const crosswindComponent = Math.abs(windSpeed * Math.sin(angleRad));
  
  return {
    headwind: Math.round(headwindComponent),
    crosswind: Math.round(crosswindComponent),
    tailwind: headwindComponent < 0 ? Math.round(Math.abs(headwindComponent)) : 0,
  };
}

/**
 * Find the best runway based on wind
 */
export function selectBestRunway(
  runways: Runway[],
  windDirection: number | 'VRB',
  windSpeed: number,
  requiredLengthFt: number,
  maxCrosswindKts: number,
  maxTailwindKts: number
): SelectedRunway | null {
  const candidates: SelectedRunway[] = [];
  
  for (const runway of runways) {
    // Skip closed runways
    if (runway.status === 'CLOSED') continue;
    
    // Check both ends
    for (const end of runway.ends) {
      const windComponents = calculateRunwayWindComponents(
        end.heading,
        windDirection,
        windSpeed
      );
      
      const issues: string[] = [];
      let isSuitable = true;
      
      // Check runway length
      if (runway.length < requiredLengthFt) {
        issues.push(`Runway too short: ${runway.length}ft < ${requiredLengthFt}ft required`);
        isSuitable = false;
      }
      
      // Check crosswind
      if (windComponents.crosswind > maxCrosswindKts) {
        issues.push(`Crosswind ${windComponents.crosswind}kt exceeds limit ${maxCrosswindKts}kt`);
        isSuitable = false;
      }
      
      // Check tailwind
      if (windComponents.tailwind > maxTailwindKts) {
        issues.push(`Tailwind ${windComponents.tailwind}kt exceeds limit ${maxTailwindKts}kt`);
        isSuitable = false;
      }
      
      candidates.push({
        designator: end.designator,
        runway,
        end,
        windComponents,
        isSuitable,
        issues,
        isPreferred: false,
      });
    }
  }
  
  // Sort by preference: suitable first, then by headwind (more is better)
  candidates.sort((a, b) => {
    // Suitable runways first
    if (a.isSuitable && !b.isSuitable) return -1;
    if (!a.isSuitable && b.isSuitable) return 1;
    
    // More headwind is better
    return b.windComponents.headwind - a.windComponents.headwind;
  });
  
  if (candidates.length === 0) return null;
  
  // Mark best as preferred
  candidates[0].isPreferred = true;
  
  return candidates[0];
}
