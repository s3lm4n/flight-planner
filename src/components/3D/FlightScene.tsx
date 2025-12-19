/**
 * 3D Flight Scene Component
 * 
 * React Three Fiber scene for visualizing flight simulation.
 * Includes:
 * - Ground plane with runway
 * - Aircraft model (simple geometry or GLTF)
 * - Flight path visualization
 * - Camera controls
 */

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// TYPES
// ============================================================================

export interface AircraftState {
  position: [number, number, number]; // [x, y, z] in scene coordinates
  rotation: [number, number, number]; // [pitch, yaw, roll] in radians
  speed: number;                      // knots
  altitude: number;                   // feet
  heading: number;                    // degrees
  phase: 'PARKED' | 'TAXI' | 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'APPROACH' | 'LANDING' | 'LANDED';
}

export interface SceneProps {
  aircraftState: AircraftState;
  routePoints?: [number, number, number][]; // Route as 3D points
  departurePosition?: [number, number];      // [x, z] ground coordinates
  arrivalPosition?: [number, number];        // [x, z] ground coordinates
  cameraMode?: 'orbit' | 'follow' | 'cockpit';
  isNoGo?: boolean;                          // Red aircraft if true
  onCameraChange?: (mode: string) => void;
}

// ============================================================================
// SCENE SCALE
// ============================================================================

// 1 unit = 1 nautical mile for horizontal, 1000 feet for vertical
const SCALE = {
  horizontal: 1,  // 1 unit = 1 nm
  vertical: 0.01, // 1 unit = 100 ft (scaled for visual)
};

// ============================================================================
// AIRCRAFT COMPONENT
// ============================================================================

interface AircraftProps {
  state: AircraftState;
  isNoGo: boolean;
}

function Aircraft({ state, isNoGo }: AircraftProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Update position and rotation
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(...state.position);
      groupRef.current.rotation.set(
        state.rotation[0], // pitch
        state.rotation[1], // yaw
        state.rotation[2]  // roll
      );
    }
  }, [state]);

  const bodyColor = isNoGo ? '#ff3333' : '#ffffff';
  const accentColor = isNoGo ? '#aa0000' : '#0066cc';

  return (
    <group ref={groupRef}>
      {/* Fuselage */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 2, 16]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      
      {/* Nose cone */}
      <mesh position={[0, 0, 1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.15, 0.3, 16]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      {/* Tail cone */}
      <mesh position={[0, 0, -1.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.15, 0.3, 16]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      {/* Wings */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3, 0.05, 0.5]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>

      {/* Horizontal stabilizer */}
      <mesh position={[0, 0.1, -0.9]}>
        <boxGeometry args={[1, 0.03, 0.25]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>

      {/* Vertical stabilizer */}
      <mesh position={[0, 0.3, -0.9]}>
        <boxGeometry args={[0.03, 0.4, 0.35]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>

      {/* Engines (under wings) */}
      <mesh position={[0.6, -0.15, 0.1]}>
        <cylinderGeometry args={[0.08, 0.1, 0.4, 12]} />
        <meshStandardMaterial color="#666666" />
      </mesh>
      <mesh position={[-0.6, -0.15, 0.1]}>
        <cylinderGeometry args={[0.08, 0.1, 0.4, 12]} />
        <meshStandardMaterial color="#666666" />
      </mesh>

      {/* Cockpit windows */}
      <mesh position={[0, 0.08, 0.85]} rotation={[Math.PI / 6, 0, 0]}>
        <boxGeometry args={[0.2, 0.08, 0.15]} />
        <meshStandardMaterial color="#333344" opacity={0.8} transparent />
      </mesh>
    </group>
  );
}

// ============================================================================
// GROUND PLANE
// ============================================================================

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#3a5f0b" />
    </mesh>
  );
}

// ============================================================================
// RUNWAY
// ============================================================================

interface RunwayProps {
  position: [number, number];
  heading: number;
  length: number; // meters
}

function Runway({ position, heading, length }: RunwayProps) {
  const lengthNm = length / 1852; // Convert to nautical miles
  const widthNm = 45 / 1852;      // 45m standard width

  return (
    <group position={[position[0], 0.001, position[1]]} rotation={[0, -heading * (Math.PI / 180), 0]}>
      {/* Runway surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[widthNm, lengthNm]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Center line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[widthNm * 0.05, lengthNm * 0.9]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Threshold markings */}
      {[-1, 1].map((end) => (
        <group key={end} position={[0, 0.001, end * lengthNm * 0.45]}>
          {[-3, -2, -1, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[i * widthNm * 0.1, 0, 0]}>
              <planeGeometry args={[widthNm * 0.05, lengthNm * 0.05]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ============================================================================
// FLIGHT PATH
// ============================================================================

interface FlightPathProps {
  points: [number, number, number][];
  color?: string;
}

function FlightPath({ points, color = '#00ff00' }: FlightPathProps) {
  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={2}
      dashed={false}
    />
  );
}

// ============================================================================
// WAYPOINT MARKERS
// ============================================================================

interface WaypointMarkersProps {
  waypoints: Array<{
    name: string;
    position: [number, number, number];
    type: string;
  }>;
}

function WaypointMarkers({ waypoints }: WaypointMarkersProps) {
  return (
    <group>
      {waypoints.map((wp, idx) => (
        <group key={idx} position={wp.position}>
          {/* Vertical line to ground */}
          <Line
            points={[[0, 0, 0], [0, -wp.position[1], 0]]}
            color="#ffffff"
            lineWidth={1}
            dashed
          />
          
          {/* Marker point */}
          <mesh>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color={
              wp.type === 'DEPARTURE' ? '#00ff00' :
              wp.type === 'ARRIVAL' ? '#ff0000' :
              '#ffff00'
            } />
          </mesh>

          {/* Label */}
          <Text
            position={[0, 0.3, 0]}
            fontSize={0.2}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
          >
            {wp.name}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ============================================================================
// FOLLOW CAMERA
// ============================================================================

interface FollowCameraProps {
  target: THREE.Vector3;
  heading: number;
  enabled: boolean;
}

function FollowCamera({ target, heading, enabled }: FollowCameraProps) {
  const { camera } = useThree();

  useFrame(() => {
    if (!enabled) return;

    // Position camera behind and above aircraft
    const distance = 5;
    const height = 2;
    const headingRad = (heading + 180) * (Math.PI / 180);

    const offsetX = Math.sin(headingRad) * distance;
    const offsetZ = Math.cos(headingRad) * distance;

    camera.position.lerp(
      new THREE.Vector3(
        target.x + offsetX,
        target.y + height,
        target.z + offsetZ
      ),
      0.05
    );

    camera.lookAt(target);
  });

  return null;
}

// ============================================================================
// SCENE CONTENT
// ============================================================================

interface SceneContentProps extends SceneProps {
  // Internal props
}

function SceneContent({
  aircraftState,
  routePoints = [],
  departurePosition = [0, 0],
  arrivalPosition = [10, 0],
  cameraMode = 'orbit',
  isNoGo = false,
}: SceneContentProps) {
  const aircraftRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // Update aircraft position reference
  useEffect(() => {
    aircraftRef.current.set(...aircraftState.position);
  }, [aircraftState.position]);

  // Convert route waypoints to markers
  const waypointMarkers = useMemo(() => {
    if (routePoints.length < 2) return [];
    
    return [
      { name: 'DEP', position: routePoints[0], type: 'DEPARTURE' },
      { name: 'ARR', position: routePoints[routePoints.length - 1], type: 'ARRIVAL' },
    ];
  }, [routePoints]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[50, 100, 50]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight args={['#87ceeb', '#3a5f0b', 0.3]} />

      {/* Sky color */}
      <color attach="background" args={['#87ceeb']} />

      {/* Ground */}
      <Ground />

      {/* Runways */}
      <Runway position={departurePosition} heading={90} length={3000} />
      <Runway position={arrivalPosition} heading={90} length={3000} />

      {/* Flight path */}
      {routePoints.length > 0 && (
        <FlightPath points={routePoints} color={isNoGo ? '#ff0000' : '#00ff00'} />
      )}

      {/* Waypoint markers */}
      <WaypointMarkers waypoints={waypointMarkers} />

      {/* Aircraft */}
      <Aircraft state={aircraftState} isNoGo={isNoGo} />

      {/* Camera controls */}
      {cameraMode === 'orbit' && (
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          maxPolarAngle={Math.PI / 2.1}
          minDistance={2}
          maxDistance={500}
        />
      )}

      {cameraMode === 'follow' && (
        <FollowCamera
          target={aircraftRef.current}
          heading={aircraftState.heading}
          enabled={true}
        />
      )}
    </>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FlightScene(props: SceneProps) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas shadows>
        <PerspectiveCamera
          makeDefault
          position={[10, 10, 10]}
          fov={60}
          near={0.1}
          far={10000}
        />
        <SceneContent {...props} />
      </Canvas>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert lat/lon to scene coordinates
 * Centers the scene on the midpoint between departure and arrival
 */
export function geoToSceneCoords(
  lat: number,
  lon: number,
  altitude: number,
  centerLat: number,
  centerLon: number
): [number, number, number] {
  // Simple projection (works for short distances)
  const x = (lon - centerLon) * 60 * Math.cos(centerLat * Math.PI / 180);
  const z = (centerLat - lat) * 60; // Flip for correct orientation
  const y = altitude * SCALE.vertical;

  return [x, y, z];
}

/**
 * Convert route waypoints to 3D scene coordinates
 */
export function routeToSceneCoords(
  waypoints: Array<{ latitude: number; longitude: number; altitude: number }>,
  centerLat: number,
  centerLon: number
): [number, number, number][] {
  return waypoints.map(wp => 
    geoToSceneCoords(wp.latitude, wp.longitude, wp.altitude, centerLat, centerLon)
  );
}

/**
 * Create aircraft state from route position
 */
export function createAircraftState(
  position: { latitude: number; longitude: number; altitude: number; heading: number; speed: number },
  centerLat: number,
  centerLon: number,
  phase: AircraftState['phase'] = 'CRUISE'
): AircraftState {
  const [x, y, z] = geoToSceneCoords(
    position.latitude,
    position.longitude,
    position.altitude,
    centerLat,
    centerLon
  );

  // Convert heading to yaw (rotation around Y axis)
  const yaw = -(position.heading - 90) * (Math.PI / 180);

  // Calculate pitch based on phase
  let pitch = 0;
  if (phase === 'CLIMB' || phase === 'TAKEOFF') {
    pitch = -0.15; // Nose up
  } else if (phase === 'DESCENT' || phase === 'APPROACH') {
    pitch = 0.05; // Slight nose down
  }

  return {
    position: [x, y, z],
    rotation: [pitch, yaw, 0],
    speed: position.speed,
    altitude: position.altitude,
    heading: position.heading,
    phase,
  };
}

export default FlightScene;
