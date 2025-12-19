/**
 * Simple Flight Simulation Engine
 * 
 * A straightforward simulation that uses requestAnimationFrame for smooth updates.
 * This ensures the simulation never freezes and runs smoothly with React's render cycle.
 * 
 * Key fixes:
 * - Uses requestAnimationFrame instead of setInterval for smoother updates
 * - Non-blocking rendering
 * - Proper cleanup on stop/destroy
 */

import { Coordinate, FlightPlan, FlightLeg } from '@/types';

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
  position: Coordinate;
  heading: number;
  altitude: number;
  groundSpeed: number;
  progress: number;
  distanceCovered: number;
  distanceRemaining: number;
  currentLegIndex: number;
  legProgress: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  phase: FlightPhase;
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

// ============================================================================
// CONSTANTS
// ============================================================================

const TARGET_FPS = 30; // Target 30 FPS for smooth updates
const MIN_FRAME_TIME_MS = 1000 / TARGET_FPS;

const PHASE_SPEEDS: Record<FlightPhase, number> = {
  PREFLIGHT: 0,
  TAXI_OUT: 20,
  TAKEOFF: 160,
  CLIMB: 300,
  CRUISE: 480,
  DESCENT: 350,
  APPROACH: 200,
  LANDING: 150,
  TAXI_IN: 20,
  COMPLETED: 0,
};

// ============================================================================
// SIMPLE SIMULATION CLASS
// ============================================================================

export class SimpleSimulation {
  private flightPlan: FlightPlan | null = null;
  private totalDistance: number = 0;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private timeScale: number = 1;
  private callbacks: SimulationCallbacks | null = null;
  private isDestroyed: boolean = false;
  
  private state: SimulationState = {
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

  /**
   * Initialize with a flight plan
   */
  public initialize(flightPlan: FlightPlan, callbacks: SimulationCallbacks): void {
    this.stop();
    this.isDestroyed = false;
    
    this.flightPlan = flightPlan;
    this.callbacks = callbacks;
    this.timeScale = 1;
    this.lastFrameTime = 0;
    
    // Calculate total distance
    this.totalDistance = flightPlan.legs.reduce((sum, leg) => sum + leg.distance, 0);
    
    // Set initial state
    this.state = {
      position: { ...flightPlan.departure.position },
      heading: flightPlan.legs[0]?.course || 0,
      altitude: flightPlan.departure.elevation || 0,
      groundSpeed: 0,
      progress: 0,
      distanceCovered: 0,
      distanceRemaining: this.totalDistance,
      currentLegIndex: 0,
      legProgress: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: this.calculateInitialETA(),
      phase: 'PREFLIGHT',
      isRunning: false,
      isPaused: false,
      isComplete: false,
    };
    
    this.notifyStateUpdate();
  }

  /**
   * Start or resume simulation using requestAnimationFrame
   */
  public play(): void {
    if (!this.flightPlan || this.state.isComplete || this.isDestroyed) return;
    if (this.state.isRunning && !this.state.isPaused) return;
    
    // Transition from PREFLIGHT
    if (this.state.phase === 'PREFLIGHT') {
      this.setPhase('TAXI_OUT');
    }
    
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.lastFrameTime = performance.now();
    
    // Start animation loop if not already running
    if (this.animationFrameId === null) {
      this.scheduleNextFrame();
    }
    
    this.notifyStateUpdate();
  }

  /**
   * Pause simulation
   */
  public pause(): void {
    if (!this.state.isRunning || this.state.isPaused) return;
    
    this.state.isPaused = true;
    this.notifyStateUpdate();
  }

  /**
   * Stop and reset simulation
   */
  public stop(): void {
    // Cancel any pending animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.flightPlan) {
      this.state = {
        position: { ...this.flightPlan.departure.position },
        heading: this.flightPlan.legs[0]?.course || 0,
        altitude: this.flightPlan.departure.elevation || 0,
        groundSpeed: 0,
        progress: 0,
        distanceCovered: 0,
        distanceRemaining: this.totalDistance,
        currentLegIndex: 0,
        legProgress: 0,
        elapsedTime: 0,
        estimatedTimeRemaining: this.calculateInitialETA(),
        phase: 'PREFLIGHT',
        isRunning: false,
        isPaused: false,
        isComplete: false,
      };
    }
    
    this.notifyStateUpdate();
  }

  /**
   * Reset to beginning
   */
  public reset(): void {
    const wasRunning = this.state.isRunning && !this.state.isPaused;
    this.stop();
    if (wasRunning) {
      this.play();
    }
  }

  /**
   * Set time scale
   */
  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, Math.min(100, scale));
  }

  /**
   * Get time scale
   */
  public getTimeScale(): number {
    return this.timeScale;
  }

  /**
   * Seek to progress (0-1)
   */
  public seekToProgress(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    const targetDistance = this.totalDistance * clamped;
    
    this.state.distanceCovered = targetDistance;
    this.state.distanceRemaining = this.totalDistance - targetDistance;
    this.state.progress = clamped;
    
    this.updatePositionFromDistance();
    this.updatePhaseFromProgress();
    
    if (clamped >= 1) {
      this.completeSimulation();
    }
    
    this.notifyStateUpdate();
  }

  /**
   * Get current state
   */
  public getState(): Readonly<SimulationState> {
    return { ...this.state };
  }

  /**
   * Destroy
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.stop();
    this.flightPlan = null;
    this.callbacks = null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Schedule next animation frame
   */
  private scheduleNextFrame(): void {
    if (this.isDestroyed) return;
    
    this.animationFrameId = requestAnimationFrame((timestamp) => {
      this.animationLoop(timestamp);
    });
  }

  /**
   * Main animation loop using requestAnimationFrame
   */
  private animationLoop(timestamp: number): void {
    // Exit if destroyed or stopped
    if (this.isDestroyed || !this.state.isRunning) {
      this.animationFrameId = null;
      return;
    }
    
    // Skip if paused but keep loop running
    if (this.state.isPaused) {
      this.lastFrameTime = timestamp;
      this.scheduleNextFrame();
      return;
    }
    
    // Calculate delta time
    const deltaMs = timestamp - this.lastFrameTime;
    
    // Throttle to target FPS
    if (deltaMs >= MIN_FRAME_TIME_MS) {
      this.tick(deltaMs);
      this.lastFrameTime = timestamp;
    }
    
    // Schedule next frame if still running
    if (this.state.isRunning && !this.state.isComplete) {
      this.scheduleNextFrame();
    } else {
      this.animationFrameId = null;
    }
  }

  private tick(deltaMs: number = MIN_FRAME_TIME_MS): void {
    if (!this.state.isRunning || this.state.isPaused || this.state.isComplete) {
      return;
    }
    
    // Calculate time step (convert ms to seconds, apply scale)
    // Cap delta to prevent jumps on tab switch
    const cappedDeltaMs = Math.min(deltaMs, 100);
    const deltaSeconds = (cappedDeltaMs / 1000) * this.timeScale;
    
    // Get current speed based on phase
    const speed = PHASE_SPEEDS[this.state.phase] || PHASE_SPEEDS.CRUISE;
    this.state.groundSpeed = speed;
    
    // Calculate distance traveled (speed in knots, convert to nm/s)
    const nmPerSecond = speed / 3600;
    const distanceTraveled = nmPerSecond * deltaSeconds;
    
    // Update distance
    this.state.distanceCovered += distanceTraveled;
    this.state.distanceRemaining = Math.max(0, this.totalDistance - this.state.distanceCovered);
    this.state.progress = this.totalDistance > 0 ? this.state.distanceCovered / this.totalDistance : 0;
    
    // Update elapsed time
    this.state.elapsedTime += deltaSeconds;
    
    // Update position based on distance
    this.updatePositionFromDistance();
    
    // Update flight phase
    this.updatePhaseFromProgress();
    
    // Update altitude
    this.updateAltitude();
    
    // Update ETA
    this.updateETA();
    
    // Check completion
    if (this.state.progress >= 1) {
      this.completeSimulation();
      return;
    }
    
    this.notifyStateUpdate();
  }

  private updatePositionFromDistance(): void {
    if (!this.flightPlan || this.flightPlan.legs.length === 0) return;
    
    let remainingDistance = this.state.distanceCovered;
    let currentLegIndex = 0;
    
    // Find which leg we're on
    for (let i = 0; i < this.flightPlan.legs.length; i++) {
      const leg = this.flightPlan.legs[i];
      if (remainingDistance <= leg.distance) {
        currentLegIndex = i;
        break;
      }
      remainingDistance -= leg.distance;
      currentLegIndex = i;
    }
    
    // Get current leg
    const leg = this.flightPlan.legs[currentLegIndex];
    if (!leg) return;
    
    // Check for leg change
    if (currentLegIndex !== this.state.currentLegIndex) {
      this.state.currentLegIndex = currentLegIndex;
      this.callbacks?.onLegChange(currentLegIndex, leg);
    }
    
    // Calculate progress within leg
    const legProgress = leg.distance > 0 ? Math.min(1, remainingDistance / leg.distance) : 0;
    this.state.legProgress = legProgress;
    
    // Interpolate position (simple linear interpolation)
    const fromPos = leg.from.position;
    const toPos = leg.to.position;
    
    this.state.position = {
      lat: fromPos.lat + (toPos.lat - fromPos.lat) * legProgress,
      lon: fromPos.lon + (toPos.lon - fromPos.lon) * legProgress,
    };
    
    // Update heading
    this.state.heading = leg.course || this.calculateBearing(fromPos, toPos);
  }

  private updatePhaseFromProgress(): void {
    const progress = this.state.progress;
    const elapsedTime = this.state.elapsedTime;
    const distanceCovered = this.state.distanceCovered;
    let newPhase: FlightPhase;
    
    // Use time-based thresholds for early phases (in seconds)
    // and distance-based for later phases to ensure realistic progression
    const TAXI_TIME = 120; // 2 minutes taxi
    const TAKEOFF_TIME = 180; // 3 minutes total (1 min takeoff roll)
    const INITIAL_CLIMB_DISTANCE = 5; // 5nm for initial climb
    
    // Calculate remaining distance to destination for descent phases
    const distanceToGo = this.state.distanceRemaining;
    const APPROACH_DISTANCE = 30; // Start approach 30nm out
    const LANDING_DISTANCE = 5; // Final 5nm is landing
    const DESCENT_DISTANCE = 80; // Start descent 80nm out
    
    if (elapsedTime < TAXI_TIME && distanceCovered < 2) {
      newPhase = 'TAXI_OUT';
    } else if (elapsedTime < TAKEOFF_TIME && distanceCovered < INITIAL_CLIMB_DISTANCE) {
      newPhase = 'TAKEOFF';
    } else if (distanceToGo > DESCENT_DISTANCE && progress < 0.85) {
      // In climb or cruise based on progress
      if (progress < 0.15) {
        newPhase = 'CLIMB';
      } else {
        newPhase = 'CRUISE';
      }
    } else if (distanceToGo > APPROACH_DISTANCE) {
      newPhase = 'DESCENT';
    } else if (distanceToGo > LANDING_DISTANCE) {
      newPhase = 'APPROACH';
    } else {
      newPhase = 'LANDING';
    }
    
    if (newPhase !== this.state.phase) {
      this.setPhase(newPhase);
    }
  }

  private updateAltitude(): void {
    const phase = this.state.phase;
    const cruiseAlt = this.flightPlan?.summary?.cruiseAltitude || 35000;
    const depElev = this.flightPlan?.departure.elevation || 0;
    const arrElev = this.flightPlan?.arrival.elevation || 0;
    const distanceToGo = this.state.distanceRemaining;
    const elapsedTime = this.state.elapsedTime;
    
    const TAXI_TIME = 120;
    const TAKEOFF_TIME = 180;
    
    switch (phase) {
      case 'TAXI_OUT':
      case 'PREFLIGHT':
        this.state.altitude = depElev;
        break;
        
      case 'TAKEOFF': {
        // Climb from ground to ~3000ft during takeoff
        const takeoffProgress = Math.min(1, (elapsedTime - TAXI_TIME) / (TAKEOFF_TIME - TAXI_TIME));
        this.state.altitude = depElev + (3000 - depElev) * takeoffProgress;
        break;
      }
      
      case 'CLIMB': {
        // Climb from 3000 to cruise altitude
        // Use a target climb rate: ~2000 fpm average -> takes ~16 min to reach FL350
        const climbDuration = ((cruiseAlt - 3000) / 2000) * 60; // seconds
        const timeInClimb = elapsedTime - TAKEOFF_TIME;
        const climbProgress = Math.min(1, timeInClimb / climbDuration);
        this.state.altitude = 3000 + (cruiseAlt - 3000) * climbProgress;
        break;
      }
      
      case 'CRUISE':
        this.state.altitude = cruiseAlt;
        break;
        
      case 'DESCENT': {
        // Descend from cruise to ~10000ft over 50nm
        const descentProgress = Math.min(1, (80 - distanceToGo) / 50);
        this.state.altitude = cruiseAlt - (cruiseAlt - 10000) * descentProgress;
        break;
      }
      
      case 'APPROACH': {
        // Descend from 10000 to ~2000ft over 25nm  
        const approachProgress = Math.min(1, (30 - distanceToGo) / 25);
        this.state.altitude = 10000 - 8000 * approachProgress;
        break;
      }
      
      case 'LANDING': {
        // Final descent to runway
        const landingProgress = Math.min(1, (5 - distanceToGo) / 5);
        this.state.altitude = 2000 - (2000 - arrElev) * landingProgress;
        break;
      }
      
      case 'TAXI_IN':
      case 'COMPLETED':
        this.state.altitude = arrElev;
        break;
    }
    
    this.state.altitude = Math.round(Math.max(0, this.state.altitude));
  }

  private updateETA(): void {
    if (this.state.groundSpeed > 0) {
      // ETA in seconds = remaining distance (nm) / speed (kt) * 3600
      this.state.estimatedTimeRemaining = (this.state.distanceRemaining / this.state.groundSpeed) * 3600;
    }
  }

  private calculateInitialETA(): number {
    const avgSpeed = PHASE_SPEEDS.CRUISE;
    return (this.totalDistance / avgSpeed) * 3600;
  }

  private setPhase(newPhase: FlightPhase): void {
    const prevPhase = this.state.phase;
    this.state.phase = newPhase;
    this.callbacks?.onPhaseChange(newPhase, prevPhase);
  }

  private completeSimulation(): void {
    // Cancel animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.flightPlan) {
      this.state.position = { ...this.flightPlan.arrival.position };
      this.state.altitude = this.flightPlan.arrival.elevation || 0;
    }
    
    this.state.progress = 1;
    this.state.distanceCovered = this.totalDistance;
    this.state.distanceRemaining = 0;
    this.state.groundSpeed = 0;
    this.state.isComplete = true;
    this.state.isRunning = false;
    this.state.phase = 'COMPLETED';
    
    this.notifyStateUpdate();
    this.callbacks?.onComplete();
  }

  private notifyStateUpdate(): void {
    this.callbacks?.onStateUpdate({ ...this.state });
  }

  private calculateBearing(from: Coordinate, to: Coordinate): number {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLon = (to.lon - from.lon) * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: SimpleSimulation | null = null;

export function getSimpleSimulation(): SimpleSimulation {
  if (!instance) {
    instance = new SimpleSimulation();
  }
  return instance;
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
