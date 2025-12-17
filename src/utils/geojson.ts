/**
 * GeoJSON Utilities for Route Visualization
 * 
 * Creates GeoJSON features for flight routes to display on the map.
 */

import { Feature, LineString, Point, Position } from 'geojson';
import { LatLngBounds } from 'leaflet';
import {
  Coordinate,
  RouteSegmentType,
  RouteFeatureProperties,
  RouteGeoJSON,
  FlightPlan,
} from '@/types';
import { calculateDistance, calculateBearing, generateGreatCirclePath } from './aviation';

// ============================================================================
// COORDINATE HELPERS
// ============================================================================

/**
 * Convert our Coordinate type to GeoJSON Position [lon, lat]
 */
function toPosition(coord: Coordinate): Position {
  return [coord.lon, coord.lat];
}

// ============================================================================
// SEGMENT COLORS AND STYLES
// ============================================================================

const SEGMENT_COLORS: Record<RouteSegmentType, string> = {
  TAXI_OUT: '#6B7280', // Gray
  SID: '#10B981',      // Green
  ENROUTE: '#3B82F6',  // Blue
  STAR: '#F59E0B',     // Amber
  APPROACH: '#EF4444', // Red
  TAXI_IN: '#6B7280',  // Gray
};

const SEGMENT_WEIGHTS: Record<RouteSegmentType, number> = {
  TAXI_OUT: 2,
  SID: 3,
  ENROUTE: 4,
  STAR: 3,
  APPROACH: 3,
  TAXI_IN: 2,
};

/**
 * Get color for a segment type
 */
export function getSegmentColor(segmentType: RouteSegmentType): string {
  return SEGMENT_COLORS[segmentType] || '#718096';
}

/**
 * Get route style for a segment type
 */
export function getRouteStyle(segmentType: RouteSegmentType): {
  color: string;
  weight: number;
  opacity: number;
  dashArray?: string;
} {
  const isTaxi = segmentType === 'TAXI_OUT' || segmentType === 'TAXI_IN';
  
  return {
    color: SEGMENT_COLORS[segmentType] || '#718096',
    weight: SEGMENT_WEIGHTS[segmentType] || 3,
    opacity: 0.8,
    dashArray: isTaxi ? '5, 5' : undefined,
  };
}

// ============================================================================
// FEATURE CREATION
// ============================================================================

/**
 * Create a waypoint point feature
 */
function createWaypointFeature(
  position: Coordinate,
  waypointId: string,
  waypointName: string | undefined,
  segmentType: RouteSegmentType,
  altitude?: number
): Feature<Point, RouteFeatureProperties> {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: toPosition(position),
    },
    properties: {
      segmentType,
      waypointId,
      waypointName: waypointName || waypointId,
      altitude,
    },
  };
}

/**
 * Create a route segment line feature
 */
function createLineFeature(
  from: Coordinate,
  to: Coordinate,
  segmentType: RouteSegmentType,
  legId: string,
  useGreatCircle: boolean = true
): Feature<LineString, RouteFeatureProperties> {
  let coordinates: Position[];
  
  if (useGreatCircle && segmentType === 'ENROUTE') {
    // Use great circle path for enroute segments
    const distance = calculateDistance(from, to);
    const numPoints = Math.max(2, Math.min(100, Math.ceil(distance / 10)));
    const path = generateGreatCirclePath(from, to, numPoints);
    coordinates = path.map(toPosition);
  } else {
    // Straight line for other segments
    coordinates = [toPosition(from), toPosition(to)];
  }
  
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates,
    },
    properties: {
      segmentType,
      legId,
      distance: calculateDistance(from, to),
      bearing: calculateBearing(from, to),
    },
  };
}

// ============================================================================
// FLIGHT PLAN TO GEOJSON
// ============================================================================

/**
 * Build complete route GeoJSON from a flight plan
 */
export function buildCompleteRouteGeoJSON(flightPlan: FlightPlan): RouteGeoJSON {
  const features: Feature<LineString | Point, RouteFeatureProperties>[] = [];
  
  for (const leg of flightPlan.legs) {
    // Add from waypoint
    features.push(createWaypointFeature(
      leg.from.position,
      leg.from.id,
      leg.from.name,
      leg.segmentType,
      leg.altitude
    ));
    
    // Add line segment
    const useGreatCircle = leg.segmentType === 'ENROUTE' && leg.distance > 50;
    features.push(createLineFeature(
      leg.from.position,
      leg.to.position,
      leg.segmentType,
      leg.id,
      useGreatCircle
    ));
  }
  
  // Add final waypoint (arrival)
  if (flightPlan.legs.length > 0) {
    const lastLeg = flightPlan.legs[flightPlan.legs.length - 1];
    features.push(createWaypointFeature(
      lastLeg.to.position,
      lastLeg.to.id,
      lastLeg.to.name,
      lastLeg.segmentType,
      0 // Ground level
    ));
  }
  
  return {
    type: 'FeatureCollection',
    features,
  };
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter route GeoJSON by segment type
 */
export function filterRouteBySegment(
  routeGeoJSON: RouteGeoJSON,
  segmentType: RouteSegmentType
): RouteGeoJSON {
  return {
    type: 'FeatureCollection',
    features: routeGeoJSON.features.filter(
      feature => feature.properties?.segmentType === segmentType
    ),
  };
}

// ============================================================================
// BOUNDS CALCULATION
// ============================================================================

/**
 * Calculate bounds from route GeoJSON
 */
export function calculateRouteBounds(routeGeoJSON: RouteGeoJSON): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  
  for (const feature of routeGeoJSON.features) {
    if (feature.geometry.type === 'Point') {
      const [lon, lat] = feature.geometry.coordinates;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    } else if (feature.geometry.type === 'LineString') {
      for (const [lon, lat] of feature.geometry.coordinates) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      }
    }
  }
  
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Get Leaflet bounds from route GeoJSON
 */
export function getLeafletBounds(routeGeoJSON: RouteGeoJSON): LatLngBounds {
  const { minLat, maxLat, minLon, maxLon } = calculateRouteBounds(routeGeoJSON);
  
  // Add some padding
  const latPadding = (maxLat - minLat) * 0.1;
  const lonPadding = (maxLon - minLon) * 0.1;
  
  return new LatLngBounds(
    [minLat - latPadding, minLon - lonPadding],
    [maxLat + latPadding, maxLon + lonPadding]
  );
}
