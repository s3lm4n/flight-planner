/**
 * Settings Panel Component
 * 
 * Centralized settings for the flight planner application.
 * Includes:
 * - Airport CSV import
 * - Worker URL configuration
 * - Map display preferences
 * - Simulation preferences
 */

import React, { useState, useCallback } from 'react';
import { 
  parseAirportFile, 
  airportDB, 
  ParseResult 
} from '@/services/airports/airportParser';

// ============================================================================
// TYPES
// ============================================================================

export interface AppSettings {
  // API Settings
  workerUrl: string;
  
  // Map Settings
  mapStyle: 'osm' | 'satellite' | 'dark' | 'light';
  showTerrain: boolean;
  defaultZoom: number;
  
  // Simulation Settings
  defaultSpeed: number;
  autoPlay: boolean;
  showTrail: boolean;
  
  // Units
  distanceUnit: 'nm' | 'km' | 'mi';
  altitudeUnit: 'ft' | 'm';
  speedUnit: 'kt' | 'kmh' | 'mph';
  
  // Display
  showWeatherOverlay: boolean;
  showAirspaces: boolean;
  showNavaids: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  workerUrl: import.meta.env.VITE_WORKER_URL || 'http://localhost:8787',
  mapStyle: 'osm',
  showTerrain: false,
  defaultZoom: 6,
  defaultSpeed: 2,
  autoPlay: false,
  showTrail: true,
  distanceUnit: 'nm',
  altitudeUnit: 'ft',
  speedUnit: 'kt',
  showWeatherOverlay: true,
  showAirspaces: false,
  showNavaids: false,
};

// ============================================================================
// STORAGE
// ============================================================================

const SETTINGS_KEY = 'flightPlannerSettings';

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// ============================================================================
// SETTINGS CONTEXT
// ============================================================================

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  airportCount: number;
  setAirportCount: (count: number) => void;
}

export const SettingsContext = React.createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  airportCount: 0,
  setAirportCount: () => {},
});

export const useSettings = () => React.useContext(SettingsContext);

interface SettingsProviderProps {
  children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [airportCount, setAirportCount] = useState(0);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, airportCount, setAirportCount }}>
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================================
// SETTINGS PANEL COMPONENT
// ============================================================================

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAP_STYLES = [
  { value: 'osm', label: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { value: 'satellite', label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  { value: 'dark', label: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { value: 'light', label: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
];

export function getMapTileUrl(style: string): string {
  const mapStyle = MAP_STYLES.find(s => s.value === style);
  return mapStyle?.url || MAP_STYLES[0].url;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, airportCount, setAirportCount } = useSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ParseResult | null>(null);
  const [activeTab, setActiveTab] = useState<'airports' | 'api' | 'map' | 'simulation' | 'units'>('airports');

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setUploadResult(null);
    
    try {
      const result = await parseAirportFile(file);
      setUploadResult(result);
      
      if (result.success) {
        airportDB.load(result);
        setAirportCount(result.validRows);
      }
    } catch (error) {
      console.error('Failed to parse file:', error);
      setUploadResult({
        success: false,
        airports: [],
        totalRows: 0,
        validRows: 0,
        errors: [(error as Error).message || 'Unknown error'],
        warnings: [],
      });
    }
    
    setIsLoading(false);
  };

  // Clear airport database
  const handleClearAirports = useCallback(() => {
    airportDB.clear();
    setAirportCount(0);
    setUploadResult(null);
  }, [setAirportCount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            ⚙️ Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          {[
            { id: 'airports', label: '📁 Airports', count: airportCount },
            { id: 'api', label: '🔌 API' },
            { id: 'map', label: '🗺️ Map' },
            { id: 'simulation', label: '🎮 Simulation' },
            { id: 'units', label: '📏 Units' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Airports Tab */}
          {activeTab === 'airports' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Airport Database</h3>
                
                {/* Upload Section */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="airport-csv"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isLoading}
                    className="hidden"
                  />
                  <label
                    htmlFor="airport-csv"
                    className="cursor-pointer"
                  >
                    <div className="text-gray-500 mb-3">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <span className="text-blue-600 font-medium hover:text-blue-700">
                      Click to upload CSV
                    </span>
                    <span className="text-gray-500"> or drag and drop</span>
                  </label>
                  
                  {isLoading && (
                    <div className="mt-4 text-gray-500">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                      <p className="mt-2">Processing airports...</p>
                    </div>
                  )}
                </div>

                {/* Upload Result */}
                {uploadResult && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    uploadResult.success 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    {uploadResult.success ? (
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">✅</span>
                        <div>
                          <p className="font-medium text-green-800">
                            Successfully loaded {uploadResult.validRows} airports
                          </p>
                          {uploadResult.errors.length > 0 && (
                            <p className="text-sm text-green-600 mt-1">
                              {uploadResult.errors.length} rows skipped
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">❌</span>
                        <div>
                          <p className="font-medium text-red-800">Upload failed</p>
                          <ul className="text-sm text-red-600 mt-1 list-disc list-inside">
                            {uploadResult.errors.slice(0, 5).map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Current Status */}
                {airportCount > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-800">
                        {airportCount} airports loaded
                      </p>
                      <p className="text-sm text-blue-600">
                        Ready for flight planning
                      </p>
                    </div>
                    <button
                      onClick={handleClearAirports}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                    >
                      Clear All
                    </button>
                  </div>
                )}

                {/* CSV Format Help */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2">CSV Format</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Required columns: <code className="bg-gray-200 px-1 rounded">icao</code> (or <code className="bg-gray-200 px-1 rounded">ident</code>), 
                    <code className="bg-gray-200 px-1 rounded">latitude</code>, 
                    <code className="bg-gray-200 px-1 rounded">longitude</code>
                  </p>
                  <p className="text-sm text-gray-600">
                    Optional: <code className="bg-gray-200 px-1 rounded">elevation</code>, 
                    <code className="bg-gray-200 px-1 rounded">name</code>, 
                    <code className="bg-gray-200 px-1 rounded">iata</code>, 
                    <code className="bg-gray-200 px-1 rounded">city</code>, 
                    <code className="bg-gray-200 px-1 rounded">country</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* API Tab */}
          {activeTab === 'api' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">API Configuration</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cloudflare Worker URL
                    </label>
                    <input
                      type="text"
                      value={settings.workerUrl}
                      onChange={(e) => updateSettings({ workerUrl: e.target.value })}
                      placeholder="https://flight-planner-api.example.workers.dev"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your Cloudflare Worker endpoint for weather and airport data
                    </p>
                  </div>

                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">⚠️ API Note</h4>
                    <p className="text-sm text-yellow-700">
                      Weather data requires a deployed Cloudflare Worker. Without it, 
                      the app uses simulated weather for demonstration.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Map Tab */}
          {activeTab === 'map' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Map Preferences</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Map Style
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {MAP_STYLES.map(style => (
                        <button
                          key={style.value}
                          onClick={() => updateSettings({ mapStyle: style.value as AppSettings['mapStyle'] })}
                          className={`p-3 rounded-lg border-2 text-left transition-colors ${
                            settings.mapStyle === style.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="font-medium">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Zoom Level: {settings.defaultZoom}
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="15"
                      value={settings.defaultZoom}
                      onChange={(e) => updateSettings({ defaultZoom: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showWeatherOverlay}
                        onChange={(e) => updateSettings({ showWeatherOverlay: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="text-gray-700">Show weather overlay</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showAirspaces}
                        onChange={(e) => updateSettings({ showAirspaces: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="text-gray-700">Show airspaces</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showNavaids}
                        onChange={(e) => updateSettings({ showNavaids: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="text-gray-700">Show navaids</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Simulation Tab */}
          {activeTab === 'simulation' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Simulation Preferences</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Speed: {settings.defaultSpeed}x
                    </label>
                    <div className="flex gap-2">
                      {[0.5, 1, 2, 5, 10, 20].map(speed => (
                        <button
                          key={speed}
                          onClick={() => updateSettings({ defaultSpeed: speed })}
                          className={`px-3 py-2 rounded ${
                            settings.defaultSpeed === speed
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoPlay}
                        onChange={(e) => updateSettings({ autoPlay: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="text-gray-700">Auto-play when flight plan is generated</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showTrail}
                        onChange={(e) => updateSettings({ showTrail: e.target.checked })}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="text-gray-700">Show aircraft trail on map</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Units Tab */}
          {activeTab === 'units' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Units of Measurement</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Distance
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'nm', label: 'Nautical Miles (nm)' },
                        { value: 'km', label: 'Kilometers (km)' },
                        { value: 'mi', label: 'Statute Miles (mi)' },
                      ].map(unit => (
                        <button
                          key={unit.value}
                          onClick={() => updateSettings({ distanceUnit: unit.value as AppSettings['distanceUnit'] })}
                          className={`px-4 py-2 rounded ${
                            settings.distanceUnit === unit.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {unit.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Altitude
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'ft', label: 'Feet (ft)' },
                        { value: 'm', label: 'Meters (m)' },
                      ].map(unit => (
                        <button
                          key={unit.value}
                          onClick={() => updateSettings({ altitudeUnit: unit.value as AppSettings['altitudeUnit'] })}
                          className={`px-4 py-2 rounded ${
                            settings.altitudeUnit === unit.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {unit.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Speed
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'kt', label: 'Knots (kt)' },
                        { value: 'kmh', label: 'km/h' },
                        { value: 'mph', label: 'mph' },
                      ].map(unit => (
                        <button
                          key={unit.value}
                          onClick={() => updateSettings({ speedUnit: unit.value as AppSettings['speedUnit'] })}
                          className={`px-4 py-2 rounded ${
                            settings.speedUnit === unit.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {unit.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> Aviation standard units are nautical miles, feet, and knots. 
                      Other units are provided for convenience but may affect display accuracy.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
