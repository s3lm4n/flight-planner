/**
 * Runway Selector Component
 * 
 * CRITICAL COMPONENT: This selector is the single source of truth for runway selection.
 * 
 * REQUIREMENTS:
 * - Must display all available runways for a given airport
 * - Must show runway designator (e.g., "09L/27R")
 * - Must show runway heading
 * - Must show runway length
 * - Must show wind component analysis when weather is available
 * - Selection MUST populate the runway threshold coordinates
 * 
 * OUTPUT:
 * - SelectedRunway object containing:
 *   - designator (e.g., "09L")
 *   - runway (full Runway object)
 *   - end (RunwayEnd with threshold position)
 *   - windComponents (if weather available)
 */

import React, { useMemo } from 'react';
import { Runway, RunwayEnd, SelectedRunway, calculateRunwayWindComponents } from '@/types/runway';

interface RunwaySelectorProps {
  label: string;
  runways: Runway[];
  selectedRunway: SelectedRunway | null;
  onSelect: (runway: SelectedRunway | null) => void;
  windDirection?: number | 'VRB';
  windSpeed?: number;
  disabled?: boolean;
  requiredLength?: number;  // feet
  maxCrosswind?: number;    // knots
  maxTailwind?: number;     // knots
}

export const RunwaySelector: React.FC<RunwaySelectorProps> = ({
  label,
  runways,
  selectedRunway,
  onSelect,
  windDirection,
  windSpeed = 0,
  disabled = false,
  requiredLength = 0,
  maxCrosswind = 20,
  maxTailwind = 10,
}) => {
  // Generate all runway end options
  const runwayOptions = useMemo(() => {
    const options: Array<{
      runway: Runway;
      end: RunwayEnd;
      windComponents: { headwind: number; crosswind: number; tailwind: number };
      isRecommended: boolean;
      issues: string[];
    }> = [];

    for (const runway of runways) {
      for (const end of runway.ends) {
        // Calculate wind components
        const windComponents = windDirection !== undefined
          ? calculateRunwayWindComponents(end.heading, windDirection, windSpeed)
          : { headwind: 0, crosswind: 0, tailwind: 0 };

        // Check for issues
        const issues: string[] = [];
        
        if (requiredLength > 0 && runway.length < requiredLength) {
          issues.push(`Runway too short (${runway.length}ft < ${requiredLength}ft required)`);
        }
        
        if (windComponents.crosswind > maxCrosswind) {
          issues.push(`Crosswind ${windComponents.crosswind}kt exceeds ${maxCrosswind}kt limit`);
        }
        
        if (windComponents.tailwind > maxTailwind) {
          issues.push(`Tailwind ${windComponents.tailwind}kt exceeds ${maxTailwind}kt limit`);
        }

        if (runway.status === 'CLOSED') {
          issues.push('Runway is CLOSED');
        }

        options.push({
          runway,
          end,
          windComponents,
          isRecommended: issues.length === 0 && windComponents.headwind > 0,
          issues,
        });
      }
    }

    // Sort: recommended first, then by headwind (descending)
    options.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return b.windComponents.headwind - a.windComponents.headwind;
    });

    return options;
  }, [runways, windDirection, windSpeed, requiredLength, maxCrosswind, maxTailwind]);

  // Handle selection
  const handleSelect = (designator: string) => {
    if (!designator) {
      onSelect(null);
      return;
    }

    const option = runwayOptions.find(o => o.end.designator === designator);
    if (!option) {
      onSelect(null);
      return;
    }

    const selectedRunway: SelectedRunway = {
      designator: option.end.designator,
      runway: option.runway,
      end: option.end,
      windComponents: option.windComponents,
      isSuitable: option.issues.length === 0,
      issues: option.issues,
      isPreferred: option.isRecommended,
    };

    onSelect(selectedRunway);
  };

  // No runways available
  if (runways.length === 0) {
    return (
      <div className="runway-selector">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          ⚠️ No runway data available for this airport.
          Upload airport CSV or use an airport with known runways.
        </div>
      </div>
    );
  }

  return (
    <div className="runway-selector">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <select
        value={selectedRunway?.designator || ''}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        } ${
          selectedRunway && !selectedRunway.isSuitable
            ? 'border-yellow-400 bg-yellow-50'
            : 'border-gray-300'
        }`}
      >
        <option value="">Select runway...</option>
        {runwayOptions.map((option) => (
          <option
            key={option.end.designator}
            value={option.end.designator}
            className={option.isRecommended ? 'font-bold' : ''}
          >
            RWY {option.end.designator} ({option.end.heading}°) • {option.runway.length}ft
            {option.isRecommended && ' ★ RECOMMENDED'}
            {option.issues.length > 0 && ' ⚠️'}
          </option>
        ))}
      </select>

      {/* Selected runway details */}
      {selectedRunway && (
        <div className={`mt-2 p-3 rounded-lg text-sm ${
          selectedRunway.isSuitable
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium">Runway:</span>{' '}
              <span className="font-mono">{selectedRunway.designator}</span>
            </div>
            <div>
              <span className="font-medium">Heading:</span>{' '}
              <span className="font-mono">{selectedRunway.end.heading}°</span>
            </div>
            <div>
              <span className="font-medium">Length:</span>{' '}
              <span>{selectedRunway.runway.length.toLocaleString()} ft</span>
            </div>
            <div>
              <span className="font-medium">Width:</span>{' '}
              <span>{selectedRunway.runway.width} ft</span>
            </div>
            <div>
              <span className="font-medium">Threshold:</span>{' '}
              <span className="font-mono text-xs">
                {selectedRunway.end.threshold.lat.toFixed(4)}°,{' '}
                {selectedRunway.end.threshold.lon.toFixed(4)}°
              </span>
            </div>
            <div>
              <span className="font-medium">Elevation:</span>{' '}
              <span>{selectedRunway.end.elevation} ft MSL</span>
            </div>
          </div>

          {/* Wind analysis */}
          {windDirection !== undefined && windSpeed > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="font-medium mb-1">Wind Analysis:</div>
              <div className="flex gap-4 text-xs">
                <span className={selectedRunway.windComponents.headwind > 0 ? 'text-green-600' : 'text-gray-500'}>
                  Headwind: {selectedRunway.windComponents.headwind}kt
                </span>
                <span className={selectedRunway.windComponents.crosswind > maxCrosswind ? 'text-red-600' : 'text-gray-500'}>
                  Crosswind: {selectedRunway.windComponents.crosswind}kt
                </span>
                <span className={selectedRunway.windComponents.tailwind > maxTailwind ? 'text-red-600' : 'text-gray-500'}>
                  Tailwind: {selectedRunway.windComponents.tailwind}kt
                </span>
              </div>
            </div>
          )}

          {/* Issues */}
          {selectedRunway.issues.length > 0 && (
            <div className="mt-2 pt-2 border-t border-yellow-300">
              <div className="font-medium text-yellow-800 mb-1">⚠️ Issues:</div>
              <ul className="text-xs text-yellow-700 list-disc list-inside">
                {selectedRunway.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ILS info */}
          {selectedRunway.end.ils && (
            <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
              <span className="font-medium">ILS:</span>{' '}
              {selectedRunway.end.ils.frequency} MHz, Cat {selectedRunway.end.ils.category}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RunwaySelector;
