/**
 * Runway-Based GSAP Flight Simulation
 * 
 * THIS IS THE CORRECT SIMULATION that:
 * 1. Starts aircraft at departure runway threshold (NOT airport center)
 * 2. Uses runway heading for initial orientation
 * 3. Animates realistic takeoff sequence:
 *    - Idle at threshold
 *    - Ground roll along runway centerline
 *    - Rotation at realistic speed
 *    - Initial climb
 * 4. Ends at arrival runway threshold
 * 
 * CRITICAL: Do NOT use airport center coordinates anywhere.
 */

import { gsap } from 'gsap';
import { FlightRoute, getPositionOnRoute } from '@/services/route/runwayBasedRouteCalculator';
import { Coordinate } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type FlightPhase =
  | 'PREFLIGHT'       // At gate/stand
  | 'PUSHBACK'        // Pushing back
  | 'TAXI_OUT'        // Taxiing to runway
  | 'LINEUP'          // Lined up on runway, awaiting takeoff clearance
  | 'TAKEOFF_ROLL'    // Rolling down runway
  | 'ROTATION'        // Rotating (nose up)
  | 'INITIAL_CLIMB'   // Climbing to safe altitude
  | 'CLIMB'           // Climbing to cruise
  | 'CRUISE'          // At cruise altitude
  | 'DESCENT'         // Descending
  | 'APPROACH'        // On approach
  | 'FINAL'           // On final approach
  | 'LANDING'         // Touchdown and rollout
  | 'TAXI_IN'         // Taxiing to gate
  | 'PARKED';         // At gate

export interface SimulationState {
  // Current flight phase
  phase: FlightPhase;
  
  // Progress (0-1)
  progress: number;
  phaseProgress: number;  // Progress within current phase
  
  // Position - ACTUAL POSITION
  position: Coordinate;
  altitude: number;       // feet MSL
  heading: number;        // degrees true
  
  // Performance
  groundSpeed: number;    // knots
  indicatedAirspeed: number;  // knots IAS
  verticalSpeed: number;  // feet per minute
  
  // Flight info
  distanceFlown: number;      // nm
  distanceRemaining: number;  // nm
  timeElapsed: number;        // minutes
  timeRemaining: number;      // minutes
  
  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  playbackSpeed: number;
}

export interface SimulationCallbacks {
  onStateChange: (state: SimulationState) => void;
  onPhaseChange: (phase: FlightPhase, previousPhase: FlightPhase) => void;
  onComplete: () => void;
}

// ============================================================================
// PHASE CONFIGURATION
// ============================================================================

// Phase timing as fraction of total simulation
// These represent a realistic airline flight
const PHASE_CONFIG: Record<FlightPhase, { start: number; duration: number }> = {
  PREFLIGHT: { start: 0, duration: 0 },           // Instant
  PUSHBACK: { start: 0, duration: 0.005 },        // 0.5%
  TAXI_OUT: { start: 0.005, duration: 0.015 },    // 1.5%
  LINEUP: { start: 0.02, duration: 0.005 },       // 0.5%
  TAKEOFF_ROLL: { start: 0.025, duration: 0.015 },// 1.5% - CRITICAL: runway roll
  ROTATION: { start: 0.04, duration: 0.005 },     // 0.5% - CRITICAL: liftoff
  INITIAL_CLIMB: { start: 0.045, duration: 0.025 }, // 2.5%
  CLIMB: { start: 0.07, duration: 0.1 },          // 10%
  CRUISE: { start: 0.17, duration: 0.55 },        // 55%
  DESCENT: { start: 0.72, duration: 0.12 },       // 12%
  APPROACH: { start: 0.84, duration: 0.06 },      // 6%
  FINAL: { start: 0.90, duration: 0.05 },         // 5%
  LANDING: { start: 0.95, duration: 0.02 },       // 2%
  TAXI_IN: { start: 0.97, duration: 0.025 },      // 2.5%
  PARKED: { start: 0.995, duration: 0.005 },      // 0.5%
};

// Default simulation duration (seconds)
const DEFAULT_DURATION_SECONDS = 120; // 2 minutes for a typical 1hr flight

// ============================================================================
// SIMULATION CLASS
// ============================================================================

export class RunwayBasedSimulation {
  private route: FlightRoute;
  private timeline: gsap.core.Timeline | null = null;
  private callbacks: SimulationCallbacks;
  private duration: number;
  
  private state: SimulationState = {
    phase: 'PREFLIGHT',
    progress: 0,
    phaseProgress: 0,
    position: { lat: 0, lon: 0 },
    altitude: 0,
    heading: 0,
    groundSpeed: 0,
    indicatedAirspeed: 0,
    verticalSpeed: 0,
    distanceFlown: 0,
    distanceRemaining: 0,
    timeElapsed: 0,
    timeRemaining: 0,
    isPlaying: false,
    isPaused: false,
    playbackSpeed: 1,
  };

  constructor(
    route: FlightRoute,
    callbacks: Partial<SimulationCallbacks> = {},
    durationSeconds: number = DEFAULT_DURATION_SECONDS
  ) {
    this.route = route;
    this.duration = durationSeconds;
    this.callbacks = {
      onStateChange: callbacks.onStateChange || (() => {}),
      onPhaseChange: callbacks.onPhaseChange || (() => {}),
      onComplete: callbacks.onComplete || (() => {}),
    };

    this.initializeState();
    this.createTimeline();
  }

  /**
   * Initialize state at departure runway threshold
   */
  private initializeState(): void {
    const depRunway = this.route.departureRunway;
    
    // CRITICAL: Start at runway threshold, not airport center
    this.state = {
      phase: 'PREFLIGHT',
      progress: 0,
      phaseProgress: 0,
      position: { ...depRunway.end.threshold },
      altitude: depRunway.end.elevation,
      heading: depRunway.end.heading, // Runway heading
      groundSpeed: 0,
      indicatedAirspeed: 0,
      verticalSpeed: 0,
      distanceFlown: 0,
      distanceRemaining: this.route.totalDistance,
      timeElapsed: 0,
      timeRemaining: this.route.totalTime,
      isPlaying: false,
      isPaused: false,
      playbackSpeed: 1,
    };
  }

  /**
   * Create GSAP animation timeline
   */
  private createTimeline(): void {
    if (this.timeline) {
      this.timeline.kill();
    }

    const progressObj = { value: 0 };

    this.timeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        this.updateState(progressObj.value);
      },
      onComplete: () => {
        this.state.isPlaying = false;
        this.state.phase = 'PARKED';
        this.callbacks.onComplete();
      },
    });

    // Single tween from 0 to 1
    this.timeline.to(progressObj, {
      value: 1,
      duration: this.duration,
      ease: 'none',
    });
  }

  /**
   * Update simulation state based on progress
   */
  private updateState(progress: number): void {
    const previousPhase = this.state.phase;

    // Determine current phase
    let currentPhase: FlightPhase = 'PREFLIGHT';
    let phaseProgress = 0;

    for (const [phase, config] of Object.entries(PHASE_CONFIG)) {
      if (progress >= config.start && progress < config.start + config.duration) {
        currentPhase = phase as FlightPhase;
        phaseProgress = config.duration > 0
          ? (progress - config.start) / config.duration
          : 1;
        break;
      }
    }

    // Handle last phase
    if (progress >= 0.995) {
      currentPhase = 'PARKED';
      phaseProgress = 1;
    }

    // Calculate position based on phase
    let position: Coordinate;
    let altitude: number;
    let heading: number;
    let groundSpeed: number;
    let indicatedAirspeed: number;
    let verticalSpeed: number;
    let distanceFlown: number;
    let timeElapsed: number;

    if (this.isGroundPhase(currentPhase)) {
      // Ground operations - use special positioning
      const groundData = this.getGroundPhaseData(currentPhase, phaseProgress);
      position = groundData.position;
      altitude = groundData.altitude;
      heading = groundData.heading;
      groundSpeed = groundData.groundSpeed;
      indicatedAirspeed = groundData.indicatedAirspeed;
      verticalSpeed = groundData.verticalSpeed;
      distanceFlown = groundData.distanceFlown;
      timeElapsed = groundData.timeElapsed;
    } else {
      // Airborne - use route interpolation
      const routeProgress = this.mapToRouteProgress(progress);
      const routeData = getPositionOnRoute(this.route, routeProgress);
      
      position = routeData.position;
      altitude = routeData.altitude;
      heading = routeData.heading;
      groundSpeed = this.calculateGroundSpeed(currentPhase, routeData.speed);
      indicatedAirspeed = routeData.speed;
      verticalSpeed = this.calculateVerticalSpeed(currentPhase);
      distanceFlown = routeData.distanceFlown;
      timeElapsed = routeData.timeElapsed;
    }

    // Update state
    this.state = {
      phase: currentPhase,
      progress,
      phaseProgress,
      position,
      altitude: Math.round(altitude),
      heading: Math.round(heading),
      groundSpeed: Math.round(groundSpeed),
      indicatedAirspeed: Math.round(indicatedAirspeed),
      verticalSpeed: Math.round(verticalSpeed),
      distanceFlown: Math.round(distanceFlown * 10) / 10,
      distanceRemaining: Math.round((this.route.totalDistance - distanceFlown) * 10) / 10,
      timeElapsed: Math.round(timeElapsed),
      timeRemaining: Math.round(this.route.totalTime - timeElapsed),
      isPlaying: this.state.isPlaying,
      isPaused: this.state.isPaused,
      playbackSpeed: this.state.playbackSpeed,
    };

    // Notify
    this.callbacks.onStateChange({ ...this.state });

    if (currentPhase !== previousPhase) {
      this.callbacks.onPhaseChange(currentPhase, previousPhase);
    }
  }

  /**
   * Check if phase is ground-based
   */
  private isGroundPhase(phase: FlightPhase): boolean {
    return [
      'PREFLIGHT',
      'PUSHBACK',
      'TAXI_OUT',
      'LINEUP',
      'TAKEOFF_ROLL',
      'ROTATION',
      'LANDING',
      'TAXI_IN',
      'PARKED',
    ].includes(phase);
  }

  /**
   * Get position and data for ground phases
   * CRITICAL: Uses runway threshold and heading
   */
  private getGroundPhaseData(phase: FlightPhase, phaseProgress: number): {
    position: Coordinate;
    altitude: number;
    heading: number;
    groundSpeed: number;
    indicatedAirspeed: number;
    verticalSpeed: number;
    distanceFlown: number;
    timeElapsed: number;
  } {
    const depRunway = this.route.departureRunway;
    const arrRunway = this.route.arrivalRunway;
    const depThreshold = depRunway.end.threshold;
    const arrThreshold = arrRunway.end.threshold;
    const depHeading = depRunway.end.heading;
    const arrHeading = arrRunway.end.heading;
    const depElevation = depRunway.end.elevation;
    const arrElevation = arrRunway.end.elevation;

    switch (phase) {
      case 'PREFLIGHT':
      case 'PUSHBACK':
      case 'TAXI_OUT':
        // At/near departure - slight offset from threshold
        return {
          position: depThreshold,
          altitude: depElevation,
          heading: depHeading,
          groundSpeed: phase === 'PUSHBACK' ? 3 : phase === 'TAXI_OUT' ? 15 : 0,
          indicatedAirspeed: 0,
          verticalSpeed: 0,
          distanceFlown: 0,
          timeElapsed: phaseProgress * 5, // ~5 min for ground ops
        };

      case 'LINEUP':
        // Lined up on runway, stationary
        return {
          position: depThreshold,
          altitude: depElevation,
          heading: depHeading,
          groundSpeed: 0,
          indicatedAirspeed: 0,
          verticalSpeed: 0,
          distanceFlown: 0,
          timeElapsed: 5 + phaseProgress * 0.5,
        };

      case 'TAKEOFF_ROLL':
        // CRITICAL: Rolling down runway from threshold
        // Calculate position along runway centerline
        const rollDistance = phaseProgress * 0.5; // ~0.5nm runway roll
        const rollPosition = this.destinationPoint(
          depThreshold,
          depHeading,
          rollDistance
        );
        const rollSpeed = 10 + phaseProgress * 140; // 10 to 150 kts

        return {
          position: rollPosition,
          altitude: depElevation,
          heading: depHeading,
          groundSpeed: rollSpeed,
          indicatedAirspeed: rollSpeed,
          verticalSpeed: 0,
          distanceFlown: rollDistance,
          timeElapsed: 5.5 + phaseProgress * 0.5,
        };

      case 'ROTATION':
        // Rotating - nose up, leaving runway
        const rotationPosition = this.destinationPoint(
          depThreshold,
          depHeading,
          0.5 + phaseProgress * 0.2
        );

        return {
          position: rotationPosition,
          altitude: depElevation + phaseProgress * 100, // Lifting off
          heading: depHeading,
          groundSpeed: 155,
          indicatedAirspeed: 155,
          verticalSpeed: 2000,
          distanceFlown: 0.5 + phaseProgress * 0.2,
          timeElapsed: 6 + phaseProgress * 0.2,
        };

      case 'LANDING':
        // Touchdown and rollout on arrival runway
        const landingPosition = this.destinationPoint(
          arrThreshold,
          (arrHeading + 180) % 360, // Opposite of landing direction
          (1 - phaseProgress) * 0.5
        );

        return {
          position: landingPosition,
          altitude: arrElevation,
          heading: (arrHeading + 180) % 360,
          groundSpeed: 140 - phaseProgress * 90, // Decelerating
          indicatedAirspeed: 140 - phaseProgress * 90,
          verticalSpeed: -200,
          distanceFlown: this.route.totalDistance - (1 - phaseProgress) * 0.5,
          timeElapsed: this.route.totalTime - 5 + phaseProgress * 2,
        };

      case 'TAXI_IN':
      case 'PARKED':
        // At arrival
        return {
          position: arrThreshold,
          altitude: arrElevation,
          heading: 0,
          groundSpeed: phase === 'TAXI_IN' ? 15 : 0,
          indicatedAirspeed: 0,
          verticalSpeed: 0,
          distanceFlown: this.route.totalDistance,
          timeElapsed: this.route.totalTime,
        };

      default:
        return {
          position: depThreshold,
          altitude: depElevation,
          heading: depHeading,
          groundSpeed: 0,
          indicatedAirspeed: 0,
          verticalSpeed: 0,
          distanceFlown: 0,
          timeElapsed: 0,
        };
    }
  }

  /**
   * Calculate destination point from start, bearing, distance
   */
  private destinationPoint(
    start: Coordinate,
    bearingDeg: number,
    distanceNm: number
  ): Coordinate {
    const R = 3440.065; // Earth radius in nm
    const d = distanceNm / R;
    const bearing = (bearingDeg * Math.PI) / 180;
    const lat1 = (start.lat * Math.PI) / 180;
    const lon1 = (start.lon * Math.PI) / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
    );

    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
      lat: (lat2 * 180) / Math.PI,
      lon: (((lon2 * 180) / Math.PI) + 540) % 360 - 180,
    };
  }

  /**
   * Map overall progress to route progress (airborne portion only)
   */
  private mapToRouteProgress(progress: number): number {
    // Airborne starts after rotation, ends at landing
    const airborneStart = PHASE_CONFIG.INITIAL_CLIMB.start;
    const airborneEnd = PHASE_CONFIG.FINAL.start + PHASE_CONFIG.FINAL.duration;
    const airborneDuration = airborneEnd - airborneStart;

    if (progress < airborneStart) return 0;
    if (progress > airborneEnd) return 1;

    return (progress - airborneStart) / airborneDuration;
  }

  /**
   * Calculate ground speed based on phase
   */
  private calculateGroundSpeed(phase: FlightPhase, airspeed: number): number {
    // Simplified - in reality would account for wind
    switch (phase) {
      case 'INITIAL_CLIMB':
        return 200;
      case 'CLIMB':
        return 320;
      case 'CRUISE':
        return Math.max(airspeed, 450);
      case 'DESCENT':
        return 350;
      case 'APPROACH':
        return 200;
      case 'FINAL':
        return 160;
      default:
        return airspeed;
    }
  }

  /**
   * Calculate vertical speed based on phase
   */
  private calculateVerticalSpeed(phase: FlightPhase): number {
    switch (phase) {
      case 'INITIAL_CLIMB':
        return 2500;
      case 'CLIMB':
        return 2000;
      case 'CRUISE':
        return 0;
      case 'DESCENT':
        return -1500;
      case 'APPROACH':
        return -800;
      case 'FINAL':
        return -700;
      default:
        return 0;
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  play(): void {
    if (this.timeline) {
      this.timeline.play();
      this.state.isPlaying = true;
      this.state.isPaused = false;
    }
  }

  pause(): void {
    if (this.timeline) {
      this.timeline.pause();
      this.state.isPlaying = false;
      this.state.isPaused = true;
    }
  }

  stop(): void {
    if (this.timeline) {
      this.timeline.pause();
      this.timeline.progress(0);
      this.initializeState();
      this.callbacks.onStateChange({ ...this.state });
    }
  }

  seek(progress: number): void {
    if (this.timeline) {
      this.timeline.progress(Math.max(0, Math.min(1, progress)));
    }
  }

  setSpeed(speed: number): void {
    if (this.timeline) {
      this.timeline.timeScale(speed);
      this.state.playbackSpeed = speed;
    }
  }

  getState(): SimulationState {
    return { ...this.state };
  }

  destroy(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
  }
}

// ============================================================================
// REACT HOOK
// ============================================================================

export interface UseRunwaySimulationOptions {
  route: FlightRoute | null;
  duration?: number;
  autoPlay?: boolean;
}

export interface UseRunwaySimulationReturn {
  state: SimulationState;
  isReady: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (progress: number) => void;
  setSpeed: (speed: number) => void;
}

const defaultState: SimulationState = {
  phase: 'PREFLIGHT',
  progress: 0,
  phaseProgress: 0,
  position: { lat: 0, lon: 0 },
  altitude: 0,
  heading: 0,
  groundSpeed: 0,
  indicatedAirspeed: 0,
  verticalSpeed: 0,
  distanceFlown: 0,
  distanceRemaining: 0,
  timeElapsed: 0,
  timeRemaining: 0,
  isPlaying: false,
  isPaused: false,
  playbackSpeed: 1,
};

export function useRunwaySimulation(
  options: UseRunwaySimulationOptions
): UseRunwaySimulationReturn {
  const { route, duration = DEFAULT_DURATION_SECONDS, autoPlay = false } = options;
  
  const simulationRef = useRef<RunwayBasedSimulation | null>(null);
  const [state, setState] = useState<SimulationState>(defaultState);
  const [isReady, setIsReady] = useState(false);

  // Initialize simulation when route changes
  useEffect(() => {
    if (simulationRef.current) {
      simulationRef.current.destroy();
      simulationRef.current = null;
    }

    if (!route) {
      setIsReady(false);
      setState(defaultState);
      return;
    }

    simulationRef.current = new RunwayBasedSimulation(
      route,
      {
        onStateChange: (newState) => setState(newState),
        onPhaseChange: (phase, prev) => {
          console.log(`Flight phase: ${prev} -> ${phase}`);
        },
        onComplete: () => {
          console.log('Flight complete');
        },
      },
      duration
    );

    setIsReady(true);
    setState(simulationRef.current.getState());

    if (autoPlay) {
      simulationRef.current.play();
    }

    return () => {
      if (simulationRef.current) {
        simulationRef.current.destroy();
      }
    };
  }, [route, duration, autoPlay]);

  // Control functions
  const play = useCallback(() => {
    simulationRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    simulationRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    simulationRef.current?.stop();
  }, []);

  const seek = useCallback((progress: number) => {
    simulationRef.current?.seek(progress);
  }, []);

  const setSpeed = useCallback((speed: number) => {
    simulationRef.current?.setSpeed(speed);
  }, []);

  return {
    state,
    isReady,
    play,
    pause,
    stop,
    seek,
    setSpeed,
  };
}
