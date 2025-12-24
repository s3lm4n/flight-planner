/**
 * Runway Layer Component
 * 
 * Renders airport runways on the Leaflet map with:
 * - Accurate runway geometry (threshold to threshold)
 * - Correct scale based on runway dimensions
 * - Right-click context menu for runway selection
 * - Visual indication of selected runways
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Polyline, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Runway, RunwayEnd, SelectedRunway } from '@/types/runway';
import { Coordinate } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

interface RunwayLayerProps {
  runways: Runway[];
  airportIcao: string;
  airportPosition: Coordinate;
  selectedDepartureRunway: SelectedRunway | null;
  selectedArrivalRunway: SelectedRunway | null;
  onSelectDepartureRunway: (designator: string) => void;
  onSelectArrivalRunway: (designator: string) => void;
  isVisible: boolean;
}

interface ContextMenuState {
  visible: boolean;
  position: { x: number; y: number };
  runwayEnd: RunwayEnd | null;
  runway: Runway | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Runway colors
const RUNWAY_COLORS = {
  default: '#4a5568',        // Gray
  departure: '#38a169',      // Green
  arrival: '#3182ce',        // Blue
  selected: '#ed8936',       // Orange
  centerline: '#ffffff',     // White
  threshold: '#f6e05e',      // Yellow
  displaced: '#ed8936',      // Orange
};

// ============================================================================
// STYLING PROPS TYPES (WCAG-compliant text/background contrast)
// ============================================================================

type BackgroundVariant = 'light' | 'dark';
type TextVariant = 'primary' | 'secondary';
type Emphasis = 'normal' | 'highlight';

interface DerivedStyles {
  container: React.CSSProperties;
  heading: React.CSSProperties;
  text: React.CSSProperties;
  secondary: React.CSSProperties;
  accent: React.CSSProperties;
}

/**
 * Derive all colors from explicit props - no internal state-based color decisions
 * Enforces WCAG contrast: light bg → dark text, dark bg → light text
 */
function getStylesFromProps(
  backgroundVariant: BackgroundVariant,
  textVariant: TextVariant,
  emphasis: Emphasis
): DerivedStyles {
  const isLightBg = backgroundVariant === 'light';
  const isPrimary = textVariant === 'primary';
  const isHighlight = emphasis === 'highlight';

  // WCAG-compliant text colors based on background
  const primaryTextColor = isLightBg ? '#1a202c' : '#ffffff';  // gray-900 or white
  const secondaryTextColor = isLightBg ? '#4a5568' : '#a0aec0'; // gray-600 or gray-400
  const accentColor = isHighlight 
    ? (isLightBg ? '#2563eb' : '#60a5fa')  // blue-600 or blue-400
    : (isLightBg ? '#059669' : '#34d399'); // green-600 or green-400

  return {
    container: {
      textAlign: 'center' as const,
    },
    heading: {
      color: isPrimary ? primaryTextColor : secondaryTextColor,
      fontWeight: 'bold',
      fontSize: '1.125rem', // text-lg
      lineHeight: '1.75rem',
    },
    text: {
      color: isPrimary ? primaryTextColor : secondaryTextColor,
      fontSize: '0.875rem', // text-sm
      lineHeight: '1.25rem',
    },
    secondary: {
      color: secondaryTextColor,
      fontSize: '0.875rem',
      lineHeight: '1.25rem',
    },
    accent: {
      color: accentColor,
      fontSize: '0.875rem',
      lineHeight: '1.25rem',
    },
  };
}

// ============================================================================
// RUNWAY INFO POPUP COMPONENT
// ============================================================================

interface RunwayInfoPopupProps {
  designator: string;
  heading: number;
  elevation: number;
  ils?: {
    category: string;
    frequency: number;
  };
  backgroundVariant: BackgroundVariant;
  textVariant: TextVariant;
  emphasis: Emphasis;
}

/**
 * Displays runway information in a popup with explicit prop-based styling.
 * All colors are derived from props - no internal state-based color decisions.
 */
function RunwayInfoPopup({
  designator,
  heading,
  elevation,
  ils,
  backgroundVariant,
  textVariant,
  emphasis,
}: RunwayInfoPopupProps) {
  const styles = getStylesFromProps(backgroundVariant, textVariant, emphasis);

  return (
    <div style={styles.container}>
      <p style={styles.heading}>{designator}</p>
      <p style={styles.text}>Heading: {heading}°</p>
      <p style={styles.text}>Elevation: {elevation}ft</p>
      {ils && (
        <p style={styles.accent}>
          ILS CAT {ils.category} - {ils.frequency}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate destination point given start, bearing, and distance
 */
function destinationPoint(
  start: Coordinate,
  bearingDeg: number,
  distanceMeters: number
): Coordinate {
  const R = 6371000; // Earth radius in meters
  const d = distanceMeters / R;
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

// Utility function - kept for future use when rendering runway polygons
// function calculateRunwayPolygon(runway: Runway): L.LatLngExpression[] {
//   const [end1, end2] = runway.ends;
//   const widthMeters = runway.width * 0.3048;
//   const halfWidth = widthMeters / 2;
//   const perpBearing1 = (end1.heading + 90) % 360;
//   const perpBearing2 = (end1.heading + 270) % 360;
//   const corner1 = destinationPoint(end1.threshold, perpBearing1, halfWidth);
//   const corner2 = destinationPoint(end1.threshold, perpBearing2, halfWidth);
//   const corner3 = destinationPoint(end2.threshold, perpBearing2, halfWidth);
//   const corner4 = destinationPoint(end2.threshold, perpBearing1, halfWidth);
//   return [
//     [corner1.lat, corner1.lon], [corner2.lat, corner2.lon],
//     [corner3.lat, corner3.lon], [corner4.lat, corner4.lon],
//     [corner1.lat, corner1.lon], // Close the polygon
//   ];
// }

/**
 * Create runway threshold marker icon
 */
function createThresholdIcon(isSelected: boolean, isDeparture: boolean): L.DivIcon {
  const color = isSelected
    ? RUNWAY_COLORS.selected
    : isDeparture
    ? RUNWAY_COLORS.departure
    : RUNWAY_COLORS.arrival;

  return L.divIcon({
    className: 'runway-threshold-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 2px solid white;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        ▲
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

/**
 * Create runway designator icon
 */
function createDesignatorIcon(designator: string, isSelected: boolean): L.DivIcon {
  const bgColor = isSelected ? RUNWAY_COLORS.selected : '#1a202c';
  
  return L.divIcon({
    className: 'runway-designator-marker',
    html: `
      <div style="
        background: ${bgColor};
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        font-family: monospace;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        border: 1px solid white;
      ">
        ${designator}
      </div>
    `,
    iconSize: [50, 20],
    iconAnchor: [25, 10],
  });
}

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onSelectDeparture: () => void;
  onSelectArrival: () => void;
}

function RunwayContextMenu({ state, onClose, onSelectDeparture, onSelectArrival }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (state.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [state.visible, onClose]);

  if (!state.visible || !state.runwayEnd) return null;

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-[1000] py-2 min-w-[200px]"
      style={{
        left: state.position.x,
        top: state.position.y,
      }}
    >
      <div className="px-4 py-2 border-b border-gray-600">
        <p className="font-bold text-white">Runway {state.runwayEnd.designator}</p>
        <p className="text-xs text-gray-400">
          HDG {state.runwayEnd.heading}° | {state.runway?.length}ft
        </p>
      </div>
      
      <button
        className="w-full px-4 py-2 text-left text-green-400 hover:bg-gray-700 flex items-center gap-2"
        onClick={() => {
          onSelectDeparture();
          onClose();
        }}
      >
        <span>🛫</span>
        <span>Set as Departure Runway</span>
      </button>
      
      <button
        className="w-full px-4 py-2 text-left text-blue-400 hover:bg-gray-700 flex items-center gap-2"
        onClick={() => {
          onSelectArrival();
          onClose();
        }}
      >
        <span>🛬</span>
        <span>Set as Arrival Runway</span>
      </button>
      
      <div className="border-t border-gray-600 mt-2 pt-2">
        <button
          className="w-full px-4 py-2 text-left text-gray-400 hover:bg-gray-700 text-sm"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SINGLE RUNWAY COMPONENT
// ============================================================================

interface SingleRunwayProps {
  runway: Runway;
  isDepartureRunway: boolean;
  isArrivalRunway: boolean;
  departureDesignator: string | null;
  arrivalDesignator: string | null;
  onRightClick: (end: RunwayEnd, runway: Runway, event: L.LeafletMouseEvent) => void;
}

function SingleRunway({
  runway,
  isDepartureRunway,
  isArrivalRunway,
  departureDesignator,
  arrivalDesignator,
  onRightClick,
}: SingleRunwayProps) {
  // Determine color based on selection
  let runwayColor = RUNWAY_COLORS.default;
  if (isDepartureRunway && isArrivalRunway) {
    runwayColor = RUNWAY_COLORS.selected;
  } else if (isDepartureRunway) {
    runwayColor = RUNWAY_COLORS.departure;
  } else if (isArrivalRunway) {
    runwayColor = RUNWAY_COLORS.arrival;
  }

  // Runway centerline
  const centerline: L.LatLngExpression[] = [
    [runway.ends[0].threshold.lat, runway.ends[0].threshold.lon],
    [runway.ends[1].threshold.lat, runway.ends[1].threshold.lon],
  ];

  return (
    <>
      {/* Runway surface (as thick line) */}
      <Polyline
        positions={centerline}
        pathOptions={{
          color: runwayColor,
          weight: Math.max(4, runway.width / 30), // Scale with runway width
          opacity: 0.8,
        }}
        eventHandlers={{
          contextmenu: (e) => {
            e.originalEvent.preventDefault();
            // Determine which end is closer
            const clickLat = e.latlng.lat;
            const clickLon = e.latlng.lng;
            const dist0 = Math.abs(clickLat - runway.ends[0].threshold.lat) +
                          Math.abs(clickLon - runway.ends[0].threshold.lon);
            const dist1 = Math.abs(clickLat - runway.ends[1].threshold.lat) +
                          Math.abs(clickLon - runway.ends[1].threshold.lon);
            const nearerEnd = dist0 < dist1 ? runway.ends[0] : runway.ends[1];
            onRightClick(nearerEnd, runway, e);
          },
        }}
      />

      {/* Runway centerline markings */}
      <Polyline
        positions={centerline}
        pathOptions={{
          color: RUNWAY_COLORS.centerline,
          weight: 1,
          opacity: 0.6,
          dashArray: '10, 10',
        }}
      />

      {/* Threshold markers for both ends */}
      {runway.ends.map((end, idx) => {
        const isSelectedDeparture = departureDesignator === end.designator;
        const isSelectedArrival = arrivalDesignator === end.designator;
        const isSelected = isSelectedDeparture || isSelectedArrival;

        // Position designator label offset from threshold
        const labelOffset = destinationPoint(
          end.threshold,
          (end.heading + 180) % 360, // Opposite direction
          runway.width * 0.3 // Offset by runway width
        );

        return (
          <React.Fragment key={`${runway.id}-${idx}`}>
            {/* Threshold marker */}
            <Marker
              position={[end.threshold.lat, end.threshold.lon]}
              icon={createThresholdIcon(isSelected, isSelectedDeparture)}
              eventHandlers={{
                contextmenu: (e) => {
                  e.originalEvent.preventDefault();
                  onRightClick(end, runway, e);
                },
              }}
            >
              <Popup>
                {/* 
                  Leaflet popups have white background by default.
                  Pass explicit styling props to ensure WCAG-compliant contrast.
                  Selected state uses highlight emphasis for visual distinction.
                */}
                <RunwayInfoPopup
                  designator={end.designator}
                  heading={end.heading}
                  elevation={end.elevation}
                  ils={end.ils}
                  backgroundVariant="light"
                  textVariant="primary"
                  emphasis={isSelected ? 'highlight' : 'normal'}
                />
              </Popup>
            </Marker>

            {/* Designator label */}
            <Marker
              position={[labelOffset.lat, labelOffset.lon]}
              icon={createDesignatorIcon(end.designator, isSelected)}
              interactive={false}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}

// ============================================================================
// MAIN RUNWAY LAYER COMPONENT
// ============================================================================

export function RunwayLayer({
  runways,
  airportIcao: _airportIcao,
  airportPosition: _airportPosition,
  selectedDepartureRunway,
  selectedArrivalRunway,
  onSelectDepartureRunway,
  onSelectArrivalRunway,
  isVisible,
}: RunwayLayerProps) {
  const map = useMap();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
    runwayEnd: null,
    runway: null,
  });

  // Handle right-click on runway
  const handleRightClick = useCallback((
    end: RunwayEnd,
    runway: Runway,
    event: L.LeafletMouseEvent
  ) => {
    const containerPoint = map.latLngToContainerPoint(event.latlng);
    const mapContainer = map.getContainer().getBoundingClientRect();
    
    setContextMenu({
      visible: true,
      position: {
        x: mapContainer.left + containerPoint.x,
        y: mapContainer.top + containerPoint.y,
      },
      runwayEnd: end,
      runway: runway,
    });
  }, [map]);

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle departure selection
  const handleSelectDeparture = useCallback(() => {
    if (contextMenu.runwayEnd) {
      onSelectDepartureRunway(contextMenu.runwayEnd.designator);
    }
  }, [contextMenu.runwayEnd, onSelectDepartureRunway]);

  // Handle arrival selection
  const handleSelectArrival = useCallback(() => {
    if (contextMenu.runwayEnd) {
      onSelectArrivalRunway(contextMenu.runwayEnd.designator);
    }
  }, [contextMenu.runwayEnd, onSelectArrivalRunway]);

  // Close context menu on map click
  useMapEvents({
    click: handleCloseContextMenu,
  });

  if (!isVisible || runways.length === 0) {
    return null;
  }

  return (
    <>
      {runways.map((runway) => {
        const isDepartureRunway = runway.ends.some(
          e => e.designator === selectedDepartureRunway?.designator
        );
        const isArrivalRunway = runway.ends.some(
          e => e.designator === selectedArrivalRunway?.designator
        );

        return (
          <SingleRunway
            key={runway.id}
            runway={runway}
            isDepartureRunway={isDepartureRunway}
            isArrivalRunway={isArrivalRunway}
            departureDesignator={selectedDepartureRunway?.designator ?? null}
            arrivalDesignator={selectedArrivalRunway?.designator ?? null}
            onRightClick={handleRightClick}
          />
        );
      })}

      {/* Context Menu (rendered in portal to avoid map clipping) */}
      <RunwayContextMenu
        state={contextMenu}
        onClose={handleCloseContextMenu}
        onSelectDeparture={handleSelectDeparture}
        onSelectArrival={handleSelectArrival}
      />
    </>
  );
}

export default RunwayLayer;
