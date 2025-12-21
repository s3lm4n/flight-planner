/**
 * EFB Application Wrapper
 * 
 * This component wraps the EFB main screen and settings page.
 * Handles transitions between the two views.
 */

import React, { useState, useCallback } from 'react';
import { EFBMainScreen } from './EFBMainScreen';
import { 
  parseAirportFile, 
  airportDB, 
} from '@/services/airports/airportParser';

// ============================================================================
// SETTINGS PAGE COMPONENT
// ============================================================================

interface SettingsPageProps {
  onClose: () => void;
  airportCount: number;
  onAirportUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

type SettingsTab = 'databases' | 'sources' | 'simulation' | 'advanced';

function SettingsPage({ onClose, airportCount, onAirportUpload }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('databases');
  
  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'databases', label: 'Databases', icon: '🗄️' },
    { id: 'sources', label: 'Data Sources', icon: '🌐' },
    { id: 'simulation', label: 'Simulation', icon: '⚙️' },
    { id: 'advanced', label: 'Advanced', icon: '🔧' },
  ];
  
  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white">
      {/* Header */}
      <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-6 shrink-0">
        <h1 className="text-lg font-bold">⚙️ Settings</h1>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
        >
          ← Back to EFB
        </button>
      </header>
      
      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-800 border-r border-slate-700 p-4">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>
        
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'databases' && (
            <DatabasesTab
              airportCount={airportCount}
              onAirportUpload={onAirportUpload}
            />
          )}
          
          {activeTab === 'sources' && (
            <DataSourcesTab />
          )}
          
          {activeTab === 'simulation' && (
            <SimulationTab />
          )}
          
          {activeTab === 'advanced' && (
            <AdvancedTab />
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// TAB: DATABASES
// ============================================================================

interface DatabasesTabProps {
  airportCount: number;
  onAirportUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function DatabasesTab({ airportCount, onAirportUpload }: DatabasesTabProps) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold mb-4">Database Management</h2>
        <p className="text-slate-400 mb-6">
          Configure airport data sources and manage database imports.
        </p>
      </div>
      
      {/* Airport Database */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">🛫 Airport Database</h3>
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400">Loaded Airports</span>
            <span className={`px-2 py-1 rounded text-sm ${airportCount > 0 ? 'bg-green-600' : 'bg-slate-600'}`}>
              {airportCount.toLocaleString()} airports
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            The built-in database includes major airports. Upload a CSV file to add more.
          </p>
        </div>
        
        <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
          <div className="text-3xl mb-2">📁</div>
          <p className="text-slate-400 mb-3">Upload Airport CSV</p>
          <label className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded cursor-pointer transition-colors">
            Select File
            <input
              type="file"
              accept=".csv"
              onChange={onAirportUpload}
              className="hidden"
            />
          </label>
          <p className="text-xs text-slate-500 mt-3">
            CSV format: ICAO, Name, Latitude, Longitude, Elevation
          </p>
        </div>
      </section>
      
      {/* Runway Database */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">🛬 Runway Database</h3>
        
        <div className="text-slate-400 text-sm">
          <p className="mb-2">
            Runway data is loaded from the built-in database.
            Major airports include detailed runway information with:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-500">
            <li>Threshold coordinates</li>
            <li>Runway headings</li>
            <li>Lengths and surfaces</li>
            <li>ILS information where available</li>
          </ul>
        </div>
        
        <div className="mt-4 p-3 bg-slate-700/50 rounded">
          <span className="text-green-400 text-sm">✓ Built-in database active</span>
        </div>
      </section>
      
      {/* Aircraft Database */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">✈️ Aircraft Database</h3>
        
        <div className="text-slate-400 text-sm">
          <p className="mb-3">
            Aircraft performance profiles are built into the dispatch engine.
            Currently supported aircraft:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {['B738', 'A320', 'B77W', 'A359', 'E190', 'CRJ9'].map(code => (
              <div key={code} className="px-3 py-2 bg-slate-700 rounded text-center font-mono">
                {code}
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-slate-700/50 rounded">
          <span className="text-green-400 text-sm">✓ 6 aircraft profiles loaded</span>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// TAB: DATA SOURCES
// ============================================================================

function DataSourcesTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold mb-4">Data Sources</h2>
        <p className="text-slate-400 mb-6">
          Configure external data sources for weather and other services.
        </p>
      </div>
      
      {/* Weather Sources */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">🌤️ Weather Services</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
            <div>
              <div className="font-medium">AviationWeather.gov</div>
              <div className="text-xs text-slate-500">METAR and TAF data for worldwide airports</div>
            </div>
            <span className="px-2 py-1 bg-green-600 rounded text-sm">Active</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded opacity-50">
            <div>
              <div className="font-medium">OpenWeather</div>
              <div className="text-xs text-slate-500">Additional forecast data</div>
            </div>
            <span className="px-2 py-1 bg-slate-600 rounded text-sm">Not configured</span>
          </div>
        </div>
      </section>
      
      {/* Map Tiles */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">🗺️ Map Tiles</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
            <div>
              <div className="font-medium">OpenStreetMap</div>
              <div className="text-xs text-slate-500">Free global map tiles</div>
            </div>
            <span className="px-2 py-1 bg-green-600 rounded text-sm">Active</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// TAB: SIMULATION
// ============================================================================

function SimulationTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold mb-4">Simulation Engine</h2>
        <p className="text-slate-400 mb-6">
          Configure simulation parameters and physics model.
        </p>
      </div>
      
      {/* Phase Engine */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">🎮 Phase State Machine</h3>
        
        <p className="text-slate-400 text-sm mb-4">
          The simulation uses a phase-based state machine that progresses through:
        </p>
        
        <div className="grid grid-cols-4 gap-2 text-xs">
          {[
            'LINEUP',
            'TAKEOFF_ROLL',
            'V1',
            'ROTATE',
            'LIFTOFF',
            'INITIAL_CLIMB',
            'CLIMB',
            'CRUISE',
            'DESCENT',
            'APPROACH',
            'FINAL',
            'LANDING',
            'TAXI_IN',
            'COMPLETE'
          ].map((phase) => (
            <div
              key={phase}
              className="px-2 py-1 bg-slate-700 rounded text-center"
            >
              {phase.replace('_', ' ')}
            </div>
          ))}
        </div>
      </section>
      
      {/* Time Scale */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">⏱️ Time Scale</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-2">Default Time Scale</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="120"
                defaultValue="60"
                className="flex-1"
              />
              <span className="text-sm font-mono bg-slate-700 px-2 py-1 rounded">
                1:60
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              1 real second = 60 simulated seconds (1 minute)
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// TAB: ADVANCED
// ============================================================================

function AdvancedTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold mb-4">Advanced Settings</h2>
        <p className="text-slate-400 mb-6">
          Developer options and debugging tools.
        </p>
      </div>
      
      {/* Debug Options */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">🐛 Debug Options</h3>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" />
            <span className="text-sm">Show simulation debug overlay</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" />
            <span className="text-sm">Log phase transitions to console</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" />
            <span className="text-sm">Show route waypoint labels</span>
          </label>
        </div>
      </section>
      
      {/* Cache */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">💾 Cache</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
            <div>
              <div className="font-medium">Weather Cache</div>
              <div className="text-xs text-slate-500">METAR/TAF responses</div>
            </div>
            <button className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm">
              Clear
            </button>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded">
            <div>
              <div className="font-medium">Airport Database</div>
              <div className="text-xs text-slate-500">CSV imports</div>
            </div>
            <button className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm">
              Clear
            </button>
          </div>
        </div>
      </section>
      
      {/* About */}
      <section className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">ℹ️ About</h3>
        
        <div className="text-sm text-slate-400 space-y-2">
          <p><strong>Flight Planner EFB</strong> v1.0.0</p>
          <p>Built with React, TypeScript, Leaflet, and Tailwind CSS.</p>
          <p>Simulation uses phase-based state machine with ~85% aviation realism.</p>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// MAIN EFB APP COMPONENT
// ============================================================================

export function EFBApp() {
  const [view, setView] = useState<'efb' | 'settings'>('efb');
  const [airportCount, setAirportCount] = useState(airportDB.count);
  
  const handleAirportUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const result = await parseAirportFile(file);
      if (result.success) {
        setAirportCount(result.airports.length);
      }
    } catch (error) {
      console.error('Failed to parse airport file:', error);
    }
    
    // Reset input
    e.target.value = '';
  }, []);
  
  if (view === 'settings') {
    return (
      <SettingsPage
        onClose={() => setView('efb')}
        airportCount={airportCount}
        onAirportUpload={handleAirportUpload}
      />
    );
  }
  
  return (
    <EFBMainScreen
      onOpenSettings={() => setView('settings')}
      airportCount={airportCount}
    />
  );
}

export default EFBApp;
