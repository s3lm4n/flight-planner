/**
 * Layer Control Component
 * 
 * Provides toggles for different route layers (SID, ENROUTE, STAR, etc.)
 */

import React from 'react';
import { RouteSegmentType } from '@/types';
import { getSegmentColor } from '@/utils/geojson';

interface LayerControlProps {
  layers: Record<RouteSegmentType, boolean>;
  onToggleLayer: (layer: RouteSegmentType) => void;
  onToggleAll: (visible: boolean) => void;
}

const LAYER_CONFIG: { type: RouteSegmentType; label: string; description: string }[] = [
  { type: 'TAXI_OUT', label: 'Taxi Out', description: 'Departure taxi route' },
  { type: 'SID', label: 'SID', description: 'Standard Instrument Departure' },
  { type: 'ENROUTE', label: 'Enroute', description: 'Cruise phase airways' },
  { type: 'STAR', label: 'STAR', description: 'Standard Terminal Arrival Route' },
  { type: 'APPROACH', label: 'Approach', description: 'Final approach procedure' },
  { type: 'TAXI_IN', label: 'Taxi In', description: 'Arrival taxi route' },
];

export const LayerControl: React.FC<LayerControlProps> = ({
  layers,
  onToggleLayer,
  onToggleAll,
}) => {
  // Check if all layers are visible
  const allVisible = Object.values(layers).every(Boolean);
  const noneVisible = Object.values(layers).every(v => !v);
  
  return (
    <div className="layer-control bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
      <div className="flex items-center justify-between border-b pb-2 mb-3">
        <h3 className="font-semibold text-gray-800">Route Layers</h3>
        <div className="flex gap-1">
          <button
            onClick={() => onToggleAll(true)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              allVisible
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Show all layers"
          >
            All
          </button>
          <button
            onClick={() => onToggleAll(false)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              noneVisible
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Hide all layers"
          >
            None
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        {LAYER_CONFIG.map(({ type, label, description }) => {
          const color = getSegmentColor(type);
          const isVisible = layers[type];
          
          return (
            <label
              key={type}
              className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                isVisible ? 'bg-gray-50' : 'opacity-50'
              } hover:bg-gray-100`}
              title={description}
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => onToggleLayer(type)}
                className="sr-only"
              />
              
              {/* Color indicator */}
              <span
                className="w-4 h-4 rounded-full flex-shrink-0 border-2"
                style={{
                  backgroundColor: isVisible ? color : 'transparent',
                  borderColor: color,
                }}
              />
              
              {/* Layer info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-800">{label}</div>
                <div className="text-xs text-gray-500 truncate">{description}</div>
              </div>
              
              {/* Toggle indicator */}
              <div
                className={`w-10 h-5 rounded-full transition-colors flex items-center ${
                  isVisible ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                    isVisible ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </label>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="mt-4 pt-3 border-t">
        <div className="text-xs text-gray-500 mb-2">Route Phase Colors</div>
        <div className="flex flex-wrap gap-2">
          {LAYER_CONFIG.map(({ type, label }) => (
            <div
              key={type}
              className="flex items-center gap-1 text-xs"
              style={{ opacity: layers[type] ? 1 : 0.4 }}
            >
              <span
                className="w-3 h-1 rounded"
                style={{ backgroundColor: getSegmentColor(type) }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LayerControl;
