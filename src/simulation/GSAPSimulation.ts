/**
 * GSAP-Based Flight Simulation Controller
 * 
 * This module controls flight simulation using GSAP timelines.
 * NO setInterval, NO requestAnimationFrame blocking loops.
 * 
 * GSAP ensures smooth, non-blocking animation that:
 * - Never freezes the UI
 * - Can be paused/resumed/scrubbed
 * - Handles frame-timing automatically
 */

import { gsap } from 'gsap';
import { FlightRoute, getPositionOnRoute } from '@/services/route/routeCalculator';
import { AircraftState } from '@/components/3D/FlightScene';

// ============================================================================
// TYPES
// ============================================================================

export type FlightPhase = 
  | 'PREFLIGHT'
  | 'PUSHBACK'
  | 'TAXI_OUT'
  | 'LINEUP'
  | 'TAKEOFF_ROLL'
  | 'ROTATION'
  | 'INITIAL_CLIMB'
  | 'CLIMB'
  | 'CRUISE'
  | 'DESCENT'
  | 'APPROACH'
  | 'LANDING'
  | 'TAXI_IN'
  | 'PARKED';

export interface SimulationState {
  phase: FlightPhase;
  progress: number;           // 0-1 overall progress
  phaseProgress: number;      // 0-1 progress within current phase
  
  // Position data
  latitude: number;
  longitude: number;
  altitude: number;           // feet
  heading: number;            // degrees true
  
  // Performance data
  groundSpeed: number;        // knots
  airspeed: number;           // knots IAS
  verticalSpeed: number;      // feet per minute
  
  // Flight info
  distanceFlown: number;      // nm
  distanceRemaining: number;  // nm
  timeElapsed: number;        // minutes
  timeRemaining: number;      // minutes
  
  // Status
  isPlaying: boolean;
  isPaused: boolean;
  playbackSpeed: number;      // 1 = realtime, 2 = 2x, etc.
}

export interface SimulationCallbacks {
  onStateChange: (state: SimulationState) => void;
  onPhaseChange: (phase: FlightPhase, previousPhase: FlightPhase) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Phase durations (as fraction of total simulation)
const PHASE_CONFIG = {
  PREFLIGHT: { start: 0, duration: 0 },      // Instant
  PUSHBACK: { start: 0, duration: 0.005 },   // 0.5% - pushback
  TAXI_OUT: { start: 0.005, duration: 0.02 },// 2% - taxi to runway
  LINEUP: { start: 0.025, duration: 0.005 }, // 0.5% - line up
  TAKEOFF_ROLL: { start: 0.03, duration: 0.01 }, // 1% - takeoff roll
  ROTATION: { start: 0.04, duration: 0.005 }, // 0.5% - rotation
  INITIAL_CLIMB: { start: 0.045, duration: 0.03 }, // 3% - initial climb
  CLIMB: { start: 0.075, duration: 0.1 },    // 10% - climb to cruise
  CRUISE: { start: 0.175, duration: 0.55 },  // 55% - cruise
  DESCENT: { start: 0.725, duration: 0.12 }, // 12% - descent
  APPROACH: { start: 0.845, duration: 0.1 }, // 10% - approach
  LANDING: { start: 0.945, duration: 0.02 }, // 2% - landing roll
  TAXI_IN: { start: 0.965, duration: 0.03 }, // 3% - taxi to gate
  PARKED: { start: 0.995, duration: 0.005 }, // 0.5% - parked
};

// Default simulation duration (seconds) for a typical 1-hour flight
const DEFAULT_SIM_DURATION = 120; // 2 minutes realtime for 1-hour flight

// ============================================================================
// SIMULATION CONTROLLER CLASS
// ============================================================================

export class FlightSimulationController {
  private route: FlightRoute | null = null;
  private callbacks: SimulationCallbacks;
  private timeline: gsap.core.Timeline | null = null;
  
  private state: SimulationState = {
    phase: 'PREFLIGHT',
    progress: 0,
    phaseProgress: 0,
    latitude: 0,
    longitude: 0,
    altitude: 0,
    heading: 0,
    groundSpeed: 0,
    airspeed: 0,
    verticalSpeed: 0,
    distanceFlown: 0,
    distanceRemaining: 0,
    timeElapsed: 0,
    timeRemaining: 0,
    isPlaying: false,
    isPaused: false,
    playbackSpeed: 1,
  };

  private duration: number = DEFAULT_SIM_DURATION;
  private centerLat: number = 0;
  private centerLon: number = 0;

  constructor(callbacks: Partial<SimulationCallbacks> = {}) {
    this.callbacks = {
      onStateChange: callbacks.onStateChange || (() => {}),
      onPhaseChange: callbacks.onPhaseChange || (() => {}),
      onComplete: callbacks.onComplete || (() => {}),
      onError: callbacks.onError || (() => {}),
    };
  }

  /**
   * Initialize simulation with a flight route
   */
  initialize(route: FlightRoute, durationSeconds: number = DEFAULT_SIM_DURATION): void {
    this.route = route;
    this.duration = durationSeconds;
    
    // Calculate center point for coordinate conversion
    this.centerLat = (route.departure.latitude + route.arrival.latitude) / 2;
    this.centerLon = (route.departure.longitude + route.arrival.longitude) / 2;

    // Initialize state at departure
    this.state = {
      phase: 'PREFLIGHT',
      progress: 0,
      phaseProgress: 0,
      latitude: route.departure.latitude,
      longitude: route.departure.longitude,
      altitude: route.departure.elevation,
      heading: route.waypoints[1]?.heading || 0,
      groundSpeed: 0,
      airspeed: 0,
      verticalSpeed: 0,
      distanceFlown: 0,
      distanceRemaining: route.totalDistance,
      timeElapsed: 0,
      timeRemaining: route.totalTime,
      isPlaying: false,
      isPaused: false,
      playbackSpeed: 1,
    };

    // Create GSAP timeline
    this.createTimeline();
    
    // Notify initial state
    this.callbacks.onStateChange({ ...this.state });
  }

  /**
   * Create the GSAP animation timeline
   */
  private createTimeline(): void {
    if (this.timeline) {
      this.timeline.kill();
    }

    // Proxy object for GSAP to animate
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
      ease: 'none', // Linear progress
    });
  }

  /**
   * Update simulation state based on progress
   */
  private updateState(progress: number): void {
    if (!this.route) return;

    const previousPhase = this.state.phase;
    
    // Determine current phase
    let currentPhase: FlightPhase = 'PREFLIGHT';
    let phaseProgress = 0;

    for (const [phase, config] of Object.entries(PHASE_CONFIG) as [FlightPhase, { start: number; duration: number }][]) {
      if (progress >= config.start && progress < config.start + config.duration) {
        currentPhase = phase;
        phaseProgress = config.duration > 0 
          ? (progress - config.start) / config.duration 
          : 1;
        break;
      }
    }

    // Map ground phases to route progress
    const routeProgress = this.mapToRouteProgress(progress);
    
    // Get position on route (for airborne phases)
    let position;
    if (this.isAirbornePhase(currentPhase)) {
      position = getPositionOnRoute(this.route, routeProgress);
    } else {
      // Ground phases - stay at departure/arrival
      position = this.getGroundPosition(currentPhase, phaseProgress);
    }

    // Calculate speeds
    const { groundSpeed, airspeed, verticalSpeed } = this.calculateSpeeds(
      currentPhase,
      phaseProgress,
      position
    );

    // Update state
    this.state = {
      phase: currentPhase,
      progress,
      phaseProgress,
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude,
      heading: position.heading,
      groundSpeed,
      airspeed,
      verticalSpeed,
      distanceFlown: position.distanceFlown,
      distanceRemaining: this.route.totalDistance - position.distanceFlown,
      timeElapsed: position.timeElapsed,
      timeRemaining: this.route.totalTime - position.timeElapsed,
      isPlaying: this.state.isPlaying,
      isPaused: this.state.isPaused,
      playbackSpeed: this.state.playbackSpeed,
    };

    // Notify state change
    this.callbacks.onStateChange({ ...this.state });

    // Notify phase change
    if (currentPhase !== previousPhase) {
      this.callbacks.onPhaseChange(currentPhase, previousPhase);
    }
  }

  /**
   * Map overall progress to route progress (excluding ground operations)
   */
  private mapToRouteProgress(progress: number): number {
    // Airborne portion is from ROTATION start to LANDING end
    const airborneStart = PHASE_CONFIG.ROTATION.start;
    const airborneEnd = PHASE_CONFIG.LANDING.start + PHASE_CONFIG.LANDING.duration;
    const airborneDuration = airborneEnd - airborneStart;

    if (progress < airborneStart) return 0;
    if (progress > airborneEnd) return 1;

    return (progress - airborneStart) / airborneDuration;
  }

  /**
   * Check if phase is airborne
   */
  private isAirbornePhase(phase: FlightPhase): boolean {
    return ['INITIAL_CLIMB', 'CLIMB', 'CRUISE', 'DESCENT', 'APPROACH'].includes(phase);
  }

  /**
   * Get position during ground phases
   */
  private getGroundPosition(
    phase: FlightPhase,
    phaseProgress: number
  ): {
    latitude: number;
    longitude: number;
    altitude: number;
    heading: number;
    distanceFlown: number;
    timeElapsed: number;
  } {
    if (!this.route) {
      return {
        latitude: 0,
        longitude: 0,
        altitude: 0,
        heading: 0,
        distanceFlown: 0,
        timeElapsed: 0,
      };
    }

    const dep = this.route.departure;
    const arr = this.route.arrival;

    switch (phase) {
      case 'PREFLIGHT':
      case 'PUSHBACK':
      case 'TAXI_OUT':
      case 'LINEUP':
        return {
          latitude: dep.latitude,
          longitude: dep.longitude,
          altitude: dep.elevation,
          heading: this.route.waypoints[1]?.heading || 0,
          distanceFlown: 0,
          timeElapsed: phaseProgress * 5, // ~5 min for ground ops
        };

      case 'TAKEOFF_ROLL':
        // Accelerating down runway
        return {
          latitude: dep.latitude,
          longitude: dep.longitude,
          altitude: dep.elevation,
          heading: this.route.waypoints[1]?.heading || 0,
          distanceFlown: phaseProgress * 0.5, // ~0.5nm runway roll
          timeElapsed: 5 + phaseProgress * 0.5,
        };

      case 'ROTATION':
        return {
          latitude: dep.latitude,
          longitude: dep.longitude,
          altitude: dep.elevation + phaseProgress * 100, // Lifting off
          heading: this.route.waypoints[1]?.heading || 0,
          distanceFlown: 0.5 + phaseProgress * 0.2,
          timeElapsed: 5.5 + phaseProgress * 0.2,
        };

      case 'LANDING':
        // Decelerating on runway
        return {
          latitude: arr.latitude,
          longitude: arr.longitude,
          altitude: arr.elevation,
          heading: this.route.waypoints[this.route.waypoints.length - 2]?.heading || 0,
          distanceFlown: this.route.totalDistance - (1 - phaseProgress) * 0.5,
          timeElapsed: this.route.totalTime - 5 + phaseProgress * 1,
        };

      case 'TAXI_IN':
      case 'PARKED':
        return {
          latitude: arr.latitude,
          longitude: arr.longitude,
          altitude: arr.elevation,
          heading: 0,
          distanceFlown: this.route.totalDistance,
          timeElapsed: this.route.totalTime,
        };

      default:
        return {
          latitude: dep.latitude,
          longitude: dep.longitude,
          altitude: dep.elevation,
          heading: 0,
          distanceFlown: 0,
          timeElapsed: 0,
        };
    }
  }

  /**
   * Calculate speeds based on flight phase
   */
  private calculateSpeeds(
    phase: FlightPhase,
    _phaseProgress: number,
    position: { altitude: number; speed?: number }
  ): {
    groundSpeed: number;
    airspeed: number;
    verticalSpeed: number;
  } {
    switch (phase) {
      case 'PREFLIGHT':
      case 'PARKED':
        return { groundSpeed: 0, airspeed: 0, verticalSpeed: 0 };

      case 'PUSHBACK':
        return { groundSpeed: 3, airspeed: 0, verticalSpeed: 0 };

      case 'TAXI_OUT':
      case 'TAXI_IN':
        return { groundSpeed: 15, airspeed: 0, verticalSpeed: 0 };

      case 'LINEUP':
        return { groundSpeed: 5, airspeed: 0, verticalSpeed: 0 };

      case 'TAKEOFF_ROLL':
        return { groundSpeed: 80 + _phaseProgress * 70, airspeed: 80 + _phaseProgress * 70, verticalSpeed: 0 };

      case 'ROTATION':
        return { groundSpeed: 155, airspeed: 155, verticalSpeed: 2000 };

      case 'INITIAL_CLIMB':
        return { groundSpeed: 200, airspeed: 200, verticalSpeed: 2500 };

      case 'CLIMB':
        return { groundSpeed: 300, airspeed: 280, verticalSpeed: 2000 };

      case 'CRUISE':
        return { groundSpeed: position.speed || 450, airspeed: 280, verticalSpeed: 0 };

      case 'DESCENT':
        return { groundSpeed: 350, airspeed: 280, verticalSpeed: -1500 };

      case 'APPROACH':
        return { groundSpeed: 180, airspeed: 180, verticalSpeed: -800 };

      case 'LANDING':
        return { groundSpeed: 140 - _phaseProgress * 100, airspeed: 140 - _phaseProgress * 100, verticalSpeed: -500 };

      default:
        return { groundSpeed: 0, airspeed: 0, verticalSpeed: 0 };
    }
  }

  // ========================================
  // PUBLIC CONTROL METHODS
  // ========================================

  /**
   * Start or resume simulation
   */
  play(): void {
    if (!this.timeline) {
      this.callbacks.onError(new Error('Simulation not initialized'));
      return;
    }

    this.state.isPlaying = true;
    this.state.isPaused = false;
    this.timeline.play();
  }

  /**
   * Pause simulation
   */
  pause(): void {
    if (!this.timeline) return;

    this.state.isPlaying = false;
    this.state.isPaused = true;
    this.timeline.pause();
  }

  /**
   * Stop and reset simulation
   */
  stop(): void {
    if (!this.timeline) return;

    this.state.isPlaying = false;
    this.state.isPaused = false;
    this.timeline.pause();
    this.timeline.progress(0);
    this.updateState(0);
  }

  /**
   * Seek to specific progress (0-1)
   */
  seek(progress: number): void {
    if (!this.timeline) return;

    const clampedProgress = Math.max(0, Math.min(1, progress));
    this.timeline.progress(clampedProgress);
    this.updateState(clampedProgress);
  }

  /**
   * Set playback speed multiplier
   */
  setSpeed(speed: number): void {
    if (!this.timeline) return;

    this.state.playbackSpeed = speed;
    this.timeline.timeScale(speed);
  }

  /**
   * Get current state (read-only copy)
   */
  getState(): Readonly<SimulationState> {
    return { ...this.state };
  }

  /**
   * Check if simulation is initialized
   */
  isInitialized(): boolean {
    return this.route !== null && this.timeline !== null;
  }

  /**
   * Destroy simulation and cleanup
   */
  destroy(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
    this.route = null;
  }

  /**
   * Get center coordinates for scene positioning
   */
  getSceneCenter(): { lat: number; lon: number } {
    return { lat: this.centerLat, lon: this.centerLon };
  }

  /**
   * Convert current state to AircraftState for 3D scene
   */
  toAircraftState(): AircraftState {
    const phase = this.mapPhaseToAircraftPhase(this.state.phase);
    
    // Convert heading to yaw (rotation)
    const yaw = -(this.state.heading - 90) * (Math.PI / 180);
    
    // Calculate pitch based on vertical speed
    let pitch = 0;
    if (this.state.verticalSpeed > 500) {
      pitch = -0.15; // Climbing
    } else if (this.state.verticalSpeed < -500) {
      pitch = 0.08; // Descending
    }

    return {
      position: [0, 0, 0], // Will be set by scene based on lat/lon
      rotation: [pitch, yaw, 0],
      speed: this.state.groundSpeed,
      altitude: this.state.altitude,
      heading: this.state.heading,
      phase,
    };
  }

  /**
   * Map simulation phase to simplified aircraft phase
   */
  private mapPhaseToAircraftPhase(
    phase: FlightPhase
  ): AircraftState['phase'] {
    switch (phase) {
      case 'PREFLIGHT':
      case 'PARKED':
        return 'PARKED';
      case 'PUSHBACK':
      case 'TAXI_OUT':
      case 'TAXI_IN':
      case 'LINEUP':
        return 'TAXI';
      case 'TAKEOFF_ROLL':
      case 'ROTATION':
        return 'TAKEOFF';
      case 'INITIAL_CLIMB':
      case 'CLIMB':
        return 'CLIMB';
      case 'CRUISE':
        return 'CRUISE';
      case 'DESCENT':
        return 'DESCENT';
      case 'APPROACH':
        return 'APPROACH';
      case 'LANDING':
        return 'LANDING';
      default:
        return 'PARKED';
    }
  }
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseFlightSimulationOptions {
  route: FlightRoute | null;
  duration?: number;
  autoPlay?: boolean;
}

export interface UseFlightSimulationReturn {
  state: SimulationState;
  aircraftState: AircraftState;
  isReady: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (progress: number) => void;
  setSpeed: (speed: number) => void;
  sceneCenter: { lat: number; lon: number };
}

export function useFlightSimulation(
  options: UseFlightSimulationOptions
): UseFlightSimulationReturn {
  const { route, duration = DEFAULT_SIM_DURATION, autoPlay = false } = options;
  
  const controllerRef = useRef<FlightSimulationController | null>(null);
  
  const [state, setState] = useState<SimulationState>({
    phase: 'PREFLIGHT',
    progress: 0,
    phaseProgress: 0,
    latitude: 0,
    longitude: 0,
    altitude: 0,
    heading: 0,
    groundSpeed: 0,
    airspeed: 0,
    verticalSpeed: 0,
    distanceFlown: 0,
    distanceRemaining: 0,
    timeElapsed: 0,
    timeRemaining: 0,
    isPlaying: false,
    isPaused: false,
    playbackSpeed: 1,
  });

  const [aircraftState, setAircraftState] = useState<AircraftState>({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    speed: 0,
    altitude: 0,
    heading: 0,
    phase: 'PARKED',
  });

  const [isReady, setIsReady] = useState(false);
  const [sceneCenter, setSceneCenter] = useState({ lat: 0, lon: 0 });

  // Initialize controller
  useEffect(() => {
    if (!route) {
      setIsReady(false);
      return;
    }

    // Create controller with callbacks
    const controller = new FlightSimulationController({
      onStateChange: (newState) => {
        setState(newState);
        // Update aircraft state
        if (controllerRef.current) {
          setAircraftState(controllerRef.current.toAircraftState());
        }
      },
      onPhaseChange: (phase, _prev) => {
        console.log(`Flight phase: ${phase}`);
      },
      onComplete: () => {
        console.log('Flight complete');
      },
      onError: (error) => {
        console.error('Simulation error:', error);
      },
    });

    // Initialize with route
    controller.initialize(route, duration);
    controllerRef.current = controller;

    // Set scene center
    setSceneCenter(controller.getSceneCenter());
    setIsReady(true);

    // Auto-play if requested
    if (autoPlay) {
      controller.play();
    }

    // Cleanup
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [route, duration, autoPlay]);

  // Control methods
  const play = useCallback(() => {
    controllerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const seek = useCallback((progress: number) => {
    controllerRef.current?.seek(progress);
  }, []);

  const setSpeed = useCallback((speed: number) => {
    controllerRef.current?.setSpeed(speed);
  }, []);

  return {
    state,
    aircraftState,
    isReady,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    sceneCenter,
  };
}
