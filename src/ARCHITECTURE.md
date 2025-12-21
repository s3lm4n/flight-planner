# FS2024-Style Flight Planner Architecture

## Overview

This architecture implements a **flight-simulator-correct** simulation system with:
- **Phase-driven simulation** (not time-driven)
- **Immutable snapshot** when entering simulation
- **1D runway-aligned motion** during ground phases
- **Passive map** that only renders (no validation logic)
- **Clear file ownership**

## NON-NEGOTIABLE Rules

1. **Immutable Snapshot**: Once simulation starts, planning state is FROZEN
2. **1D Runway Motion**: Takeoff/landing roll ONLY moves along runway vector
3. **Phase-Driven**: Transitions based on conditions (speed, altitude), not elapsed time
4. **Passive Map**: Map ONLY renders; validation is separate
5. **File Ownership**: Each file owns exactly one responsibility

## File Ownership Table

| File | Owns |
|------|------|
| `types/simulation.ts` | All simulation type definitions |
| `services/geometry/runwayGeometry.ts` | All runway/great-circle math |
| `simulation/SimulationSnapshot.ts` | Planning→Simulation freeze |
| `simulation/phases/TakeoffPhase.ts` | Ground-phase physics |
| `simulation/phases/EnroutePhase.ts` | Enroute flight physics |
| `simulation/phases/LandingPhase.ts` | Approach/landing physics |
| `simulation/PhaseStateMachine.ts` | Phase transitions, React hook |
| `components/Map/PassiveFlightMap.tsx` | Map rendering ONLY |
| `components/FS2024FlightPlanner.tsx` | Main app component |

## Flight Phases

```
LINEUP → TAKEOFF_ROLL → V1 → ROTATE → LIFTOFF → INITIAL_CLIMB →
CLIMB → CRUISE → DESCENT → APPROACH → FINAL → LANDING → TAXI_IN → COMPLETE
```

### Phase Transition Conditions

| Phase | Exit Condition |
|-------|----------------|
| LINEUP | Throttle up (isPlaying && countdown complete) |
| TAKEOFF_ROLL | IAS >= V1 |
| V1 | IAS >= VR |
| ROTATE | pitch >= 8° AND IAS >= V2 |
| LIFTOFF | AGL > 35ft |
| INITIAL_CLIMB | Heading aligned AND speed >= climb speed |
| CLIMB | Altitude >= cruise altitude |
| CRUISE | Distance remaining <= TOD distance |
| DESCENT | Altitude <= approach altitude AND near IAF |
| APPROACH | Aligned with runway AND on glideslope |
| FINAL | AGL <= 50ft |
| LANDING | Groundspeed < 20 kts |
| TAXI_IN | Time elapsed (10 seconds) |
| COMPLETE | Terminal state |

## Color Conventions

- **Departure Airport**: GREEN (#22c55e)
- **Arrival Airport**: BLUE (#3b82f6) - NEVER RED
- **Aircraft**: Blue (#2563eb)
- **Route**: Blue (#2563eb)
- **Validation warnings**: Yellow (in sidebar, NOT map)

## Usage

```tsx
import { FS2024FlightPlanner } from '@/components/FS2024FlightPlanner';

function App() {
  return <FS2024FlightPlanner />;
}
```

Or use individual pieces:

```tsx
import { usePhaseSimulation, createSimulationSnapshot } from '@/simulation';
import { PassiveFlightMap } from '@/components/Map/PassiveFlightMap';
import { SimulationSnapshot } from '@/types/simulation';

function MyComponent() {
  const [snapshot, setSnapshot] = useState<SimulationSnapshot | null>(null);
  const simulation = usePhaseSimulation();
  
  const handleStart = () => {
    const snap = createSimulationSnapshot(planningState);
    setSnapshot(snap);
    simulation.loadSnapshot(snap);
  };
  
  return (
    <PassiveFlightMap
      snapshot={snapshot}
      output={simulation.isReady ? simulation.output : null}
      routeCoordinates={routeCoords}
    />
  );
}
```

## V-Speed Calculation

V-speeds are calculated when creating the snapshot based on aircraft performance:

```typescript
const v1 = Math.round(aircraft.approachSpeedKts * 0.9);   // Decision speed
const vR = Math.round(aircraft.approachSpeedKts * 0.95);  // Rotation speed
const v2 = Math.round(aircraft.approachSpeedKts * 1.1);   // Takeoff safety
const vRef = Math.round(aircraft.approachSpeedKts);       // Reference landing
```

## Runway Geometry

All runway geometry is in `services/geometry/runwayGeometry.ts`:

- `calculateRunwayUnitVector(threshold, heading, lengthNm)` - Get unit vector along runway
- `getPositionOnRunway(threshold, unitVector, distanceNm)` - Position along centerline
- `calculateHeading(from, to)` - Great circle heading
- `interpolateGreatCircle(from, to, fraction)` - Position along great circle
- `calculateDistanceNm(from, to)` - Distance in nautical miles
