/**
 * Real-Time Flight Simulation Engine
 * 
 * CRITICAL: This is a dedicated simulation engine that runs INDEPENDENTLY of React renders.
 * 
 * Design principles:
 * 1. Uses requestAnimationFrame for smooth 60fps updates
 * 2. Computes delta time (elapsed time between frames) 
 * 3. Movement is distance-based: distance = groundspeed * deltaTime
 * 4. Stores all mutable state in refs to avoid React re-render dependency issues
 * 5. Handles browser tab inactivity gracefully (clamps deltaTime)
 * 6. Flight phases advance automatically based on position/time
 */

import { Coordinate, FlightPlan, FlightLeg } from '@/types';
import { interpolatePosition, calculateBearing } from '@/utils/aviation';

// ============================================================================
// TYPES
// ============================================================================

export type FlightPhase = 
  | 'PREFLIGHT'
  | 'TAXI_OUT' 
  | 'TAKEOFF' 
  | 'CLIMB' 
  | 'CRUISE' 
  | 'DESCENT' 
  | 'APPROACH' 
  | 'LANDING' 
  | 'TAXI_IN'
  | 'COMPLETED';

export interface SimulationState {
  // Position
  position: Coordinate;
  heading: number;
  altitude: number;        // feet
  groundSpeed: number;     // knots
  
  // Progress
  progress: number;        // 0-1 overall
  distanceCovered: number; // nautical miles
  distanceRemaining: number;
  
  // Leg tracking
  currentLegIndex: number;
  legProgress: number;     // 0-1 within current leg
  
  // Timing
  elapsedTime: number;     // seconds since start
  estimatedTimeRemaining: number; // seconds
  
  // Phase
  phase: FlightPhase;
  
  // Status
  isRunning: boolean;
  isPaused: boolean;
  isComplete: boolean;
}

export interface SimulationCallbacks {
  onStateUpdate: (state: SimulationState) => void;
  onPhaseChange: (phase: FlightPhase, prevPhase: FlightPhase) => void;
  onLegChange: (legIndex: number, leg: FlightLeg) => void;
  onComplete: () => void;
}

interface WaypointData {
  coordinate: Coordinate;
  cumulativeDistance: number;
  legIndex: number;
  groundSpeed: number;
  altitude: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Maximum delta time to prevent huge jumps when tab regains focus
// Increased to allow simulation to continue when tab is inactive
const MAX_DELTA_TIME_MS = 5000; // 5 seconds max - allows background progress

// Background timer interval when requestAnimationFrame is throttled
const BACKGROUND_INTERVAL_MS = 100; // 100ms interval for background updates

// Simulation time multiplier (1 = real-time, higher = faster)
const DEFAULT_TIME_SCALE = 1;

// Phase-based speeds (knots) - simplified model
const PHASE_SPEEDS: Record<FlightPhase, number> = {
  PREFLIGHT: 0,
  TAXI_OUT: 15,
  TAKEOFF: 150,
  CLIMB: 280,
  CRUISE: 450,
  DESCENT: 320,
  APPROACH: 180,
  LANDING: 140,
  TAXI_IN: 15,
  COMPLETED: 0,
};

// Phase-based altitudes (feet) - used for reference
// @ts-ignore - kept for documentation
const _PHASE_ALTITUDES: Record<FlightPhase, { min: number; max: number }> = {
  PREFLIGHT: { min: 0, max: 0 },
  TAXI_OUT: { min: 0, max: 0 },
  TAKEOFF: { min: 0, max: 1500 },
  CLIMB: { min: 1500, max: 35000 },
  CRUISE: { min: 30000, max: 41000 },
  DESCENT: { min: 10000, max: 35000 },
  APPROACH: { min: 2000, max: 10000 },
  LANDING: { min: 0, max: 2000 },
  TAXI_IN: { min: 0, max: 0 },
  COMPLETED: { min: 0, max: 0 },
};

// ============================================================================
// SIMULATION ENGINE CLASS
// ============================================================================

export class SimulationEngine {
  // Flight plan data (immutable during simulation)
  private flightPlan: FlightPlan | null = null;
  private waypoints: WaypointData[] = [];
  private totalDistance: number = 0;
  
  // Animation frame tracking
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private backgroundTimerId: ReturnType<typeof setInterval> | null = null;
  private isBackgroundMode: boolean = false;
  private visibilityHandlerBound: boolean = false;
  
  // Bound tick function (created once to avoid creating new functions each frame)
  private readonly boundTick: (timestamp: number) => void;
  
  // Simulation state (mutable)
  private state: SimulationState = this.createInitialState();
  
  // Time scale (speed multiplier)
  private timeScale: number = DEFAULT_TIME_SCALE;
  
  // Callbacks
  private callbacks: SimulationCallbacks | null = null;
  
  constructor() {
    // Bind tick once in constructor
    this.boundTick = this.tick.bind(this);
  }
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  private createInitialState(): SimulationState {
    return {
      position: { lat: 0, lon: 0 },
      heading: 0,
      altitude: 0,
      groundSpeed: 0,
      progress: 0,
      distanceCovered: 0,
      distanceRemaining: 0,
      currentLegIndex: 0,
      legProgress: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      phase: 'PREFLIGHT',
      isRunning: false,
      isPaused: false,
      isComplete: false,
    };
  }
  
  /**
   * Initialize the simulation with a flight plan
   */
  public initialize(flightPlan: FlightPlan, callbacks: SimulationCallbacks): void {
    this.stop();
    
    this.flightPlan = flightPlan;
    this.callbacks = callbacks;
    this.timeScale = DEFAULT_TIME_SCALE;
    
    // Build waypoint array with cumulative distances
    this.buildWaypointData();
    
    // Set initial state
    this.state = {
      ...this.createInitialState(),
      position: { ...flightPlan.departure.position },
      heading: flightPlan.legs[0]?.course || 0,
      altitude: flightPlan.departure.elevation,
      groundSpeed: 0,
      distanceRemaining: this.totalDistance,
      phase: 'PREFLIGHT',
    };
    
    // Notify initial state
    this.notifyStateUpdate();
  }
  
  /**
   * Build waypoint data with cumulative distances for efficient lookup
   */
  private buildWaypointData(): void {
    if (!this.flightPlan) return;
    
    this.waypoints = [];
    let cumulativeDistance = 0;
    
    // Add departure point
    this.waypoints.push({
      coordinate: { ...this.flightPlan.departure.position },
      cumulativeDistance: 0,
      legIndex: 0,
      groundSpeed: PHASE_SPEEDS.TAXI_OUT,
      altitude: this.flightPlan.departure.elevation,
    });
    
    // Add each leg's destination
    for (let i = 0; i < this.flightPlan.legs.length; i++) {
      const leg = this.flightPlan.legs[i];
      cumulativeDistance += leg.distance;
      
      this.waypoints.push({
        coordinate: { lat: leg.to.position.lat, lon: leg.to.position.lon },
        cumulativeDistance,
        legIndex: i,
        groundSpeed: leg.groundSpeed || PHASE_SPEEDS.CRUISE,
        altitude: leg.altitude || 35000,
      });
    }
    
    this.totalDistance = cumulativeDistance;
  }
  
  // ============================================================================
  // PLAYBACK CONTROL
  // ============================================================================
  
  /**
   * Start or resume the simulation
   */
  public play(): void {
    if (this.state.isComplete) return;
    if (this.state.isRunning && !this.state.isPaused) return;
    
    // Transition from PREFLIGHT to TAXI_OUT on first play
    if (this.state.phase === 'PREFLIGHT') {
      this.setPhase('TAXI_OUT');
    }
    
    this.state.isRunning = true;
    this.state.isPaused = false;
    
    // Reset frame time to avoid huge delta on resume
    this.lastFrameTime = 0;
    
    // Start the animation loop
    this.startAnimationLoop();
    
    this.notifyStateUpdate();
  }
  
  /**
   * Pause the simulation
   */
  public pause(): void {
    if (!this.state.isRunning || this.state.isPaused) return;
    
    this.state.isPaused = true;
    this.stopAnimationLoop();
    
    this.notifyStateUpdate();
  }
  
  /**
   * Stop and reset the simulation
   */
  public stop(): void {
    this.stopAnimationLoop();
    
    if (this.flightPlan) {
      this.state = {
        ...this.createInitialState(),
        position: { ...this.flightPlan.departure.position },
        heading: this.flightPlan.legs[0]?.course || 0,
        altitude: this.flightPlan.departure.elevation,
        distanceRemaining: this.totalDistance,
      };
    } else {
      this.state = this.createInitialState();
    }
    
    this.notifyStateUpdate();
  }
  
  /**
   * Reset to beginning without stopping
   */
  public reset(): void {
    const wasRunning = this.state.isRunning && !this.state.isPaused;
    this.stop();
    
    if (wasRunning) {
      this.play();
    }
  }
  
  /**
   * Set simulation speed (time scale)
   */
  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, Math.min(100, scale));
  }
  
  /**
   * Get current time scale
   */
  public getTimeScale(): number {
    return this.timeScale;
  }
  
  /**
   * Seek to a specific progress (0-1)
   */
  public seekToProgress(progress: number): void {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    // Calculate distance at this progress
    const targetDistance = this.totalDistance * clampedProgress;
    
    // Find position and update state
    const positionData = this.getPositionAtDistance(targetDistance);
    
    if (positionData) {
      this.state = {
        ...this.state,
        ...positionData,
        progress: clampedProgress,
        distanceCovered: targetDistance,
        distanceRemaining: this.totalDistance - targetDistance,
        isComplete: clampedProgress >= 1,
      };
      
      // Update phase based on progress
      this.updatePhaseFromProgress(clampedProgress);
      
      this.notifyStateUpdate();
    }
  }
  
  /**
   * Get current simulation state (read-only)
   */
  public getState(): Readonly<SimulationState> {
    return { ...this.state };
  }
  
  // ============================================================================
  // ANIMATION LOOP
  // ============================================================================
  
  private startAnimationLoop(): void {
    // Always stop any existing loops first
    this.stopAnimationLoop();
    
    // Start requestAnimationFrame for foreground
    this.animationFrameId = requestAnimationFrame(this.boundTick);
    
    // Also start background timer as fallback when tab is inactive
    this.startBackgroundTimer();
    
    // Listen for visibility changes
    this.setupVisibilityHandler();
  }
  
  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stopBackgroundTimer();
  }
  
  /**
   * Background timer - runs when tab is inactive
   * requestAnimationFrame is throttled in inactive tabs, so we use setInterval
   */
  private startBackgroundTimer(): void {
    // Clear any existing timer first
    this.stopBackgroundTimer();
    
    this.backgroundTimerId = setInterval(() => {
      if (this.isBackgroundMode && this.state.isRunning && !this.state.isPaused) {
        const now = performance.now();
        this.tick(now);
      }
    }, BACKGROUND_INTERVAL_MS);
  }
  
  private stopBackgroundTimer(): void {
    if (this.backgroundTimerId !== null) {
      clearInterval(this.backgroundTimerId);
      this.backgroundTimerId = null;
    }
  }
  
  /**
   * Handle page visibility changes
   * Only sets up the listener once to avoid duplicate handlers
   */
  private setupVisibilityHandler(): void {
    // Prevent multiple listeners
    if (this.visibilityHandlerBound) return;
    this.visibilityHandlerBound = true;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became inactive - switch to background mode
        this.isBackgroundMode = true;
        this.lastFrameTime = performance.now(); // Reset time to avoid huge jump
      } else {
        // Tab became active - switch back to foreground mode
        this.isBackgroundMode = false;
        this.lastFrameTime = performance.now(); // Reset time to avoid huge jump
        
        // Restart requestAnimationFrame if simulation is running
        if (this.state.isRunning && !this.state.isPaused && !this.state.isComplete) {
          if (this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(this.boundTick);
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  
  /**
   * Main animation tick - called every frame by requestAnimationFrame or background timer
   * 
   * CRITICAL: This is the core simulation loop.
   * Movement is calculated as: distance = groundSpeed * deltaTime
   */
  private tick(timestamp: number): void {
    // Calculate delta time
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = timestamp;
    }
    
    let deltaTimeMs = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    
    // Clamp delta time to prevent huge jumps
    // Allow larger jumps in background mode to keep simulation progressing
    const maxDelta = this.isBackgroundMode ? MAX_DELTA_TIME_MS : 100;
    deltaTimeMs = Math.min(deltaTimeMs, maxDelta);
    
    // Skip if delta is too small
    if (deltaTimeMs < 1) return;
    
    // Apply time scale
    const scaledDeltaMs = deltaTimeMs * this.timeScale;
    const deltaSeconds = scaledDeltaMs / 1000;
    
    // Update simulation
    this.updateSimulation(deltaSeconds);
    
    // Continue loop if still running (only requestAnimationFrame in foreground)
    if (this.state.isRunning && !this.state.isPaused && !this.state.isComplete) {
      if (!this.isBackgroundMode) {
        this.animationFrameId = requestAnimationFrame(this.boundTick);
      }
    } else {
      this.animationFrameId = null;
    }
  }
  
  /**
   * Update simulation state for a time step
   */
  private updateSimulation(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || this.state.isComplete) return;
    
    // Get current ground speed (knots)
    const groundSpeedKnots = this.getCurrentGroundSpeed();
    
    // Convert knots to nautical miles per second
    // 1 knot = 1 nautical mile per hour = 1/3600 nautical miles per second
    const nmPerSecond = groundSpeedKnots / 3600;
    
    // Calculate distance covered this frame
    const distanceThisFrame = nmPerSecond * deltaSeconds;
    
    // Update total distance covered
    const newDistanceCovered = this.state.distanceCovered + distanceThisFrame;
    
    // Check if we've completed the flight
    if (newDistanceCovered >= this.totalDistance) {
      this.completeSimulation();
      return;
    }
    
    // Get position at new distance
    const positionData = this.getPositionAtDistance(newDistanceCovered);
    
    if (positionData) {
      const prevLegIndex = this.state.currentLegIndex;
      
      // Update state
      this.state = {
        ...this.state,
        position: positionData.position,
        heading: positionData.heading,
        altitude: positionData.altitude,
        groundSpeed: groundSpeedKnots,
        progress: newDistanceCovered / this.totalDistance,
        distanceCovered: newDistanceCovered,
        distanceRemaining: this.totalDistance - newDistanceCovered,
        currentLegIndex: positionData.legIndex,
        legProgress: positionData.legProgress,
        elapsedTime: this.state.elapsedTime + deltaSeconds,
        estimatedTimeRemaining: this.calculateETA(newDistanceCovered),
      };
      
      // Check for leg change
      if (positionData.legIndex !== prevLegIndex && this.flightPlan) {
        const leg = this.flightPlan.legs[positionData.legIndex];
        if (leg && this.callbacks) {
          this.callbacks.onLegChange(positionData.legIndex, leg);
        }
      }
      
      // Update phase based on progress
      this.updatePhaseFromProgress(this.state.progress);
      
      // Notify listeners
      this.notifyStateUpdate();
    }
  }
  
  /**
   * Get the current ground speed based on phase and leg data
   */
  private getCurrentGroundSpeed(): number {
    // If we have leg-specific ground speed, use it
    if (this.flightPlan && this.state.currentLegIndex < this.flightPlan.legs.length) {
      const leg = this.flightPlan.legs[this.state.currentLegIndex];
      if (leg.groundSpeed > 0) {
        return leg.groundSpeed;
      }
    }
    
    // Fall back to phase-based speed
    return PHASE_SPEEDS[this.state.phase] || PHASE_SPEEDS.CRUISE;
  }
  
  /**
   * Calculate position, heading, altitude at a given distance along the route
   */
  private getPositionAtDistance(distance: number): {
    position: Coordinate;
    heading: number;
    altitude: number;
    legIndex: number;
    legProgress: number;
  } | null {
    if (this.waypoints.length < 2) return null;
    
    // Clamp distance
    const clampedDistance = Math.max(0, Math.min(distance, this.totalDistance));
    
    // Find which segment we're on
    let fromWaypoint: WaypointData | null = null;
    let toWaypoint: WaypointData | null = null;
    
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      if (clampedDistance <= this.waypoints[i + 1].cumulativeDistance) {
        fromWaypoint = this.waypoints[i];
        toWaypoint = this.waypoints[i + 1];
        break;
      }
    }
    
    // Default to last segment if not found
    if (!fromWaypoint || !toWaypoint) {
      fromWaypoint = this.waypoints[this.waypoints.length - 2];
      toWaypoint = this.waypoints[this.waypoints.length - 1];
    }
    
    // Calculate progress within this segment
    const segmentStart = fromWaypoint.cumulativeDistance;
    const segmentEnd = toWaypoint.cumulativeDistance;
    const segmentLength = segmentEnd - segmentStart;
    const distanceIntoSegment = clampedDistance - segmentStart;
    const segmentProgress = segmentLength > 0 ? distanceIntoSegment / segmentLength : 0;
    
    // Interpolate position along great circle
    const position = interpolatePosition(
      fromWaypoint.coordinate,
      toWaypoint.coordinate,
      segmentProgress
    );
    
    // Calculate heading
    const heading = calculateBearing(fromWaypoint.coordinate, toWaypoint.coordinate);
    
    // Calculate altitude based on overall flight progress (phase-based)
    const overallProgress = clampedDistance / this.totalDistance;
    const altitude = this.calculatePhaseAltitude(overallProgress, fromWaypoint.altitude, toWaypoint.altitude);
    
    return {
      position,
      heading,
      altitude: Math.round(altitude),
      legIndex: toWaypoint.legIndex,
      legProgress: segmentProgress,
    };
  }
  
  /**
   * Calculate altitude based on flight phase and progress
   * This ensures altitude follows a realistic climb-cruise-descent profile
   */
  private calculatePhaseAltitude(progress: number, _legFromAlt: number, _legToAlt: number): number {
    // Get cruise altitude from flight plan or default
    const cruiseAltitude = this.flightPlan?.summary?.cruiseAltitude || 35000;
    const departureElevation = this.flightPlan?.departure.elevation || 0;
    const arrivalElevation = this.flightPlan?.arrival.elevation || 0;
    
    // Define altitude profile based on progress
    if (progress < 0.02) {
      // TAXI - ground level
      return departureElevation;
    } else if (progress < 0.05) {
      // TAKEOFF - 0 to 3000 ft
      const takeoffProgress = (progress - 0.02) / 0.03;
      return departureElevation + (3000 * takeoffProgress);
    } else if (progress < 0.20) {
      // CLIMB - 3000 to cruise altitude
      const climbProgress = (progress - 0.05) / 0.15;
      return 3000 + ((cruiseAltitude - 3000) * climbProgress);
    } else if (progress < 0.75) {
      // CRUISE - maintain cruise altitude
      return cruiseAltitude;
    } else if (progress < 0.90) {
      // DESCENT - cruise to 10000 ft
      const descentProgress = (progress - 0.75) / 0.15;
      return cruiseAltitude - ((cruiseAltitude - 10000) * descentProgress);
    } else if (progress < 0.98) {
      // APPROACH - 10000 to 2000 ft
      const approachProgress = (progress - 0.90) / 0.08;
      return 10000 - (8000 * approachProgress);
    } else {
      // LANDING - 2000 to ground
      const landingProgress = (progress - 0.98) / 0.02;
      return 2000 - ((2000 - arrivalElevation) * landingProgress);
    }
  }
  
  /**
   * Calculate estimated time remaining
   */
  private calculateETA(currentDistance: number): number {
    const remainingDistance = this.totalDistance - currentDistance;
    const avgSpeed = this.getCurrentGroundSpeed();
    
    if (avgSpeed <= 0) return 0;
    
    // Convert nautical miles to hours, then to seconds
    return (remainingDistance / avgSpeed) * 3600;
  }
  
  /**
   * Update flight phase based on progress
   */
  private updatePhaseFromProgress(progress: number): void {
    let newPhase: FlightPhase;
    
    if (progress < 0.02) {
      newPhase = 'TAXI_OUT';
    } else if (progress < 0.05) {
      newPhase = 'TAKEOFF';
    } else if (progress < 0.20) {
      newPhase = 'CLIMB';
    } else if (progress < 0.75) {
      newPhase = 'CRUISE';
    } else if (progress < 0.90) {
      newPhase = 'DESCENT';
    } else if (progress < 0.98) {
      newPhase = 'APPROACH';
    } else if (progress < 1.0) {
      newPhase = 'LANDING';
    } else {
      newPhase = 'COMPLETED';
    }
    
    if (newPhase !== this.state.phase) {
      this.setPhase(newPhase);
    }
  }
  
  /**
   * Set flight phase and notify
   */
  private setPhase(newPhase: FlightPhase): void {
    const prevPhase = this.state.phase;
    this.state.phase = newPhase;
    
    if (this.callbacks) {
      this.callbacks.onPhaseChange(newPhase, prevPhase);
    }
  }
  
  /**
   * Complete the simulation
   */
  private completeSimulation(): void {
    // Set final position at destination
    if (this.flightPlan) {
      this.state = {
        ...this.state,
        position: { ...this.flightPlan.arrival.position },
        progress: 1,
        distanceCovered: this.totalDistance,
        distanceRemaining: 0,
        isComplete: true,
        isRunning: false,
        phase: 'COMPLETED',
        groundSpeed: 0,
        altitude: this.flightPlan.arrival.elevation,
      };
    }
    
    this.stopAnimationLoop();
    this.notifyStateUpdate();
    
    if (this.callbacks) {
      this.callbacks.onComplete();
    }
  }
  
  /**
   * Notify state update callback
   */
  private notifyStateUpdate(): void {
    if (this.callbacks) {
      this.callbacks.onStateUpdate({ ...this.state });
    }
  }
  
  // ============================================================================
  // CLEANUP
  // ============================================================================
  
  /**
   * Destroy the simulation engine and clean up resources
   */
  public destroy(): void {
    this.stopAnimationLoop();
    this.flightPlan = null;
    this.callbacks = null;
    this.waypoints = [];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let engineInstance: SimulationEngine | null = null;

/**
 * Get the singleton simulation engine instance
 */
export function getSimulationEngine(): SimulationEngine {
  if (!engineInstance) {
    engineInstance = new SimulationEngine();
  }
  return engineInstance;
}

/**
 * Format flight phase for display
 */
export function formatFlightPhase(phase: FlightPhase): string {
  const labels: Record<FlightPhase, string> = {
    PREFLIGHT: 'Pre-Flight',
    TAXI_OUT: 'Taxi Out',
    TAKEOFF: 'Takeoff',
    CLIMB: 'Climbing',
    CRUISE: 'Cruise',
    DESCENT: 'Descending',
    APPROACH: 'Approach',
    LANDING: 'Landing',
    TAXI_IN: 'Taxi In',
    COMPLETED: 'Completed',
  };
  return labels[phase] || phase;
}
