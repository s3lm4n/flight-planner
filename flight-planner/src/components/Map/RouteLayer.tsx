/**
 * Route Layer Component
 * 
 * Renders a specific segment type (SID, ENROUTE, STAR, etc.) on the map.
 */

import React, { useMemo } from 'react';
import { GeoJSON, CircleMarker, Tooltip } from 'react-leaflet';
import { Feature, LineString, Point } from 'geojson';
import { RouteGeoJSON, RouteSegmentType, RouteFeatureProperties } from '@/types';
import { filterRouteBySegment, getRouteStyle, getSegmentColor } from '@/utils/geojson';
import { formatBearing, formatDistance } from '@/utils/aviation';

interface RouteLayerProps {
  routeGeoJSON: RouteGeoJSON;
  segmentType: RouteSegmentType | null;
  showWaypoints?: boolean;
}

export const RouteLayer: React.FC<RouteLayerProps> = ({
  routeGeoJSON,
  segmentType,
  showWaypoints = false,
}) => {
  // Filter route by segment type
  const filteredRoute = useMemo(() => {
    if (segmentType === null) {
      return routeGeoJSON;
    }
    return filterRouteBySegment(routeGeoJSON, segmentType);
  }, [routeGeoJSON, segmentType]);
  
  // Get style for this segment type
  const style = useMemo(() => {
    if (segmentType === null) return { color: '#718096', weight: 2, opacity: 0.7 };
    return getRouteStyle(segmentType);
  }, [segmentType]);
  
  // Render waypoints if requested
  if (showWaypoints) {
    const waypoints = filteredRoute.features.filter(
      (f): f is Feature<Point, RouteFeatureProperties> => f.geometry.type === 'Point'
    );
    
    return (
      <>
        {waypoints.map((waypoint, index) => {
          const [lon, lat] = waypoint.geometry.coordinates;
          const props = waypoint.properties;
          const color = props?.segmentType ? getSegmentColor(props.segmentType) : '#718096';
          
          return (
            <CircleMarker
              key={`waypoint-${props?.waypointId || index}`}
              center={[lat, lon]}
              radius={6}
              fillColor={color}
              fillOpacity={0.8}
              color="#fff"
              weight={2}
            >
              <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                <div className="text-sm font-semibold">
                  {props?.waypointName || props?.waypointId || 'Waypoint'}
                </div>
                {props?.altitude && (
                  <div className="text-xs text-gray-600">
                    Alt: {props.altitude.toLocaleString()} ft
                  </div>
                )}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </>
    );
  }
  
  // Render line segments
  const lineFeatures = filteredRoute.features.filter(
    (f): f is Feature<LineString, RouteFeatureProperties> => f.geometry.type === 'LineString'
  );
  
  if (lineFeatures.length === 0) {
    return null;
  }
  
  // Create a FeatureCollection with just line features
  const lineCollection: RouteGeoJSON = {
    type: 'FeatureCollection',
    features: lineFeatures,
  };
  
  return (
    <GeoJSON
      key={`route-${segmentType || 'all'}-${lineFeatures.length}`}
      data={lineCollection}
      style={() => ({
        color: style.color,
        weight: style.weight,
        opacity: style.opacity,
        dashArray: style.dashArray,
      })}
      onEachFeature={(feature, layer) => {
        const props = feature.properties as RouteFeatureProperties;
        if (props) {
          const content = [
            props.segmentType && `<strong>${props.segmentType}</strong>`,
            props.distance && `Distance: ${formatDistance(props.distance)}`,
            props.bearing && `Bearing: ${formatBearing(props.bearing)}`,
          ]
            .filter(Boolean)
            .join('<br/>');
          
          if (content) {
            layer.bindTooltip(content, {
              sticky: true,
              className: 'route-tooltip',
            });
          }
        }
      }}
    />
  );
};

export default RouteLayer;
