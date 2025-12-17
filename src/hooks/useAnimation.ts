/**
 * Animation System Hook
 * 
 * Provides aircraft animation along the flight route using requestAnimationFrame.
 * Handles interpolation, wind effects, and smooth position updates.
 */

import { useRef, useCallback, useEffect } from 'react';
import { Coordinate, FlightPlan, AnimationState, Metar } from '@/types';
import { 
  interpolatePosition, 
  calculateBearing, 
  calculateWindCorrectionAngle,
} from '@/utils/aviation';
import { getFlightPlanWaypoints } from '@/utils/routeCalculator';

interface UseAnimationOptions {
  flightPlan: FlightPlan | null;
  animationState: AnimationState;
  wind?: { direction: number; speed: number } | null;
  onPositionUpdate: (position: Coordinate, heading: number, groundSpeed: number, altitude: number) => void;
  onProgressUpdate: (progress: number, legIndex: number) => void;
  onComplete: () => void;
}

interface AnimationData {
  waypoints: Coordinate[];
  totalDistance: number;
  legDistances: number[];
  legCumulativeDistances: number[];
}

export function useAnimation({
  flightPlan,
  animationState,
  wind,
  onPositionUpdate,
  onProgressUpdate,
  onComplete,
}: UseAnimationOptions) {
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const animationDataRef = useRef<AnimationData | null>(null);
  
  // Prepare animation data when flight plan changes
  useEffect(() => {
    if (!flightPlan) {
      animationDataRef.current = null;
      return;
    }
    
    const waypoints = getFlightPlanWaypoints(flightPlan);
    
    // Calculate leg distances
    const legDistances: number[] = [];
    let totalDistance = 0;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dist = flightPlan.legs[i]?.distance || 0;
      legDistances.push(dist);
      totalDistance += dist;
    }
    
    // Calculate cumulative distances
    const legCumulativeDistances: number[] = [];
    let cumulative = 0;
    for (const dist of legDistances) {
      cumulative += dist;
      legCumulativeDistances.push(cumulative);
    }
    
    animationDataRef.current = {
      waypoints,
      totalDistance,
      legDistances,
      legCumulativeDistances,
    };
  }, [flightPlan]);
  
  // Calculate position at given progress
  const getPositionAtProgress = useCallback((progress: number): {
    position: Coordinate;
    heading: number;
    groundSpeed: number;
    altitude: number;
    legIndex: number;
  } | null => {
    if (!animationDataRef.current || !flightPlan) return null;
    
    const { waypoints, totalDistance, legCumulativeDistances } = animationDataRef.current;
    
    if (waypoints.length < 2) return null;
    
    // Clamp progress
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const targetDistance = totalDistance * clampedProgress;
    
    // Find which leg we're on
    let legIndex = 0;
    for (let i = 0; i < legCumulativeDistances.length; i++) {
      if (targetDistance <= legCumulativeDistances[i]) {
        legIndex = i;
        break;
      }
      if (i === legCumulativeDistances.length - 1) {
        legIndex = i;
      }
    }
    
    // Get leg start and end points
    const from = waypoints[legIndex];
    const to = waypoints[Math.min(legIndex + 1, waypoints.length - 1)];
    
    // Calculate progress within this leg
    const legStart = legIndex > 0 ? legCumulativeDistances[legIndex - 1] : 0;
    const legEnd = legCumulativeDistances[legIndex];
    const legLength = legEnd - legStart;
    const legProgress = legLength > 0 ? (targetDistance - legStart) / legLength : 0;
    
    // Interpolate position
    const position = interpolatePosition(from, to, legProgress);
    
    // Calculate heading
    let heading = calculateBearing(from, to);
    
    // Apply wind correction if wind data available
    const leg = flightPlan.legs[legIndex];
    const tas = leg?.groundSpeed || 450; // True airspeed approximation
    
    if (wind && wind.speed > 0) {
      const wca = calculateWindCorrectionAngle(heading, tas, wind);
      heading = (heading + wca + 360) % 360;
    }
    
    // Get ground speed and altitude from leg
    const groundSpeed = leg?.groundSpeed || 450;
    const altitude = leg?.altitude || 35000;
    
    return {
      position,
      heading,
      groundSpeed,
      altitude,
      legIndex,
    };
  }, [flightPlan]);
  
  // Animation frame callback
  const animate = useCallback((timestamp: number) => {
    if (!animationState.isPlaying || animationState.isPaused) {
      frameRef.current = null;
      return;
    }
    
    // Calculate delta time
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    
    // Calculate progress increment based on speed
    // Base speed: complete the flight in ~60 seconds at 1x speed
    const baseProgressPerMs = 1 / (60 * 1000);
    const progressIncrement = baseProgressPerMs * deltaTime * animationState.speed;
    
    // Calculate new progress
    const newProgress = Math.min(1, animationState.progress + progressIncrement);
    
    // Get position at new progress
    const positionData = getPositionAtProgress(newProgress);
    
    if (positionData) {
      // Update position
      onPositionUpdate(
        positionData.position,
        positionData.heading,
        positionData.groundSpeed,
        positionData.altitude
      );
      
      // Update progress
      onProgressUpdate(newProgress, positionData.legIndex);
      
      // Check if complete
      if (newProgress >= 1) {
        onComplete();
        frameRef.current = null;
        return;
      }
    }
    
    // Continue animation
    frameRef.current = requestAnimationFrame(animate);
  }, [
    animationState.isPlaying,
    animationState.isPaused,
    animationState.progress,
    animationState.speed,
    getPositionAtProgress,
    onPositionUpdate,
    onProgressUpdate,
    onComplete,
  ]);
  
  // Start/stop animation based on state
  useEffect(() => {
    if (animationState.isPlaying && !animationState.isPaused) {
      lastTimeRef.current = 0;
      frameRef.current = requestAnimationFrame(animate);
    } else {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    }
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [animationState.isPlaying, animationState.isPaused, animate]);
  
  // Update position when progress changes manually (scrubbing)
  const updatePositionAtProgress = useCallback((progress: number) => {
    const positionData = getPositionAtProgress(progress);
    if (positionData) {
      onPositionUpdate(
        positionData.position,
        positionData.heading,
        positionData.groundSpeed,
        positionData.altitude
      );
      onProgressUpdate(progress, positionData.legIndex);
    }
  }, [getPositionAtProgress, onPositionUpdate, onProgressUpdate]);
  
  // Get initial position
  const getInitialPosition = useCallback((): Coordinate | null => {
    if (!flightPlan) return null;
    return {
      lat: flightPlan.departure.position.lat,
      lon: flightPlan.departure.position.lon,
    };
  }, [flightPlan]);
  
  return {
    updatePositionAtProgress,
    getInitialPosition,
    getPositionAtProgress,
  };
}

/**
 * Extract wind data from METAR
 */
export function extractWindFromMetar(metar: Metar | null): { direction: number; speed: number } | null {
  if (!metar || !metar.wind) return null;
  
  return {
    direction: metar.wind.direction,
    speed: metar.wind.speed,
  };
}
