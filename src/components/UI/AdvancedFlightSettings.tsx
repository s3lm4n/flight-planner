/**
 * Advanced Flight Settings Component
 * 
 * Comprehensive panel for manual entry of aircraft performance parameters including:
 * - Weights & Limits (MTOW, MLW, MZFW, OEW, payload)
 * - Speeds (V1, VR, V2, Vref, Vapp, climb/cruise/descent speeds)
 * - Fuel Planning (taxi, trip, alternate, holding, contingency, reserves)
 * - Performance (cruise altitude, cost index, climb gradient, anti-ice, packs)
 */

import React, { useState, useCallback, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface WeightSettings {
  ALD: number;           // Actual Landing Distance (m)
  RDL: number;           // Required Distance for Landing (m)
  MTOW: number;          // Maximum Takeoff Weight (kg)
  MLW: number;           // Maximum Landing Weight (kg)
  MZFW: number;          // Maximum Zero Fuel Weight (kg)
  OEW: number;           // Operating Empty Weight (kg)
  payloadWeight: number; // Payload Weight (kg)
  actualTOW: number;     // Actual Takeoff Weight (kg)
}

export interface SpeedSettings {
  V1: number;            // Decision Speed (kts)
  VR: number;            // Rotation Speed (kts)
  V2: number;            // Takeoff Safety Speed (kts)
  Vref: number;          // Reference Landing Speed (kts)
  Vapp: number;          // Approach Speed (kts)
  climbSpeed: number;    // Climb Speed (kts)
  cruiseSpeed: number;   // Cruise Speed (kts)
  descentSpeed: number;  // Descent Speed (kts)
}

export interface FuelSettings {
  taxiFuel: number;       // Taxi Fuel (kg)
  tripFuel: number;       // Trip Fuel (kg)
  alternateFuel: number;  // Alternate Fuel (kg)
  holdingFuel: number;    // Holding Fuel (kg)
  contingency: number;    // Contingency % (default 5%)
  extraFuel: number;      // Extra Fuel (kg)
  minimumFuel: number;    // Final Reserve (kg)
  totalFuel: number;      // Total Fuel (kg)
}

export interface PerformanceSettings {
  cruiseAltitude: number; // Cruise Altitude (ft)
  costIndex: number;      // Cost Index (0-999)
  climbGradient: number;  // Climb Gradient (%)
  antiIce: 'off' | 'engine' | 'wing' | 'all';
  packsSetting: 'off' | 'reduced' | 'normal' | 'high';
}

export interface AdvancedSettings {
  weights: WeightSettings;
  speeds: SpeedSettings;
  fuel: FuelSettings;
  performance: PerformanceSettings;
}

interface AdvancedFlightSettingsProps {
  initialSettings?: Partial<AdvancedSettings>;
  onSettingsChange?: (settings: AdvancedSettings) => void;
  aircraftCode?: string;
  collapsed?: boolean;
}

// ============================================================================
// STORAGE KEY
// ============================================================================

const STORAGE_KEY = 'flightPlannerAdvancedSettings';

// ============================================================================
// DEFAULT VALUES
// ============================================================================

function getDefaultSettings(): AdvancedSettings {
  return {
    weights: {
      ALD: 0,
      RDL: 0,
      MTOW: 78000,
      MLW: 66000,
      MZFW: 62500,
      OEW: 42500,
      payloadWeight: 15000,
      actualTOW: 0,
    },
    speeds: {
      V1: 135,
      VR: 140,
      V2: 145,
      Vref: 130,
      Vapp: 140,
      climbSpeed: 280,
      cruiseSpeed: 450,
      descentSpeed: 280,
    },
    fuel: {
      taxiFuel: 200,
      tripFuel: 5000,
      alternateFuel: 1500,
      holdingFuel: 500,
      contingency: 5,
      extraFuel: 0,
      minimumFuel: 800,
      totalFuel: 0,
    },
    performance: {
      cruiseAltitude: 35000,
      costIndex: 35,
      climbGradient: 3.3,
      antiIce: 'off',
      packsSetting: 'normal',
    },
  };
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

type ValidatorFn = (value: number, settings: AdvancedSettings) => ValidationResult;

const validators: Record<string, ValidatorFn> = {
  VR: (value, settings) => ({
    isValid: value >= settings.speeds.V1,
    error: value < settings.speeds.V1 ? 'VR must be ≥ V1' : undefined,
  }),
  V2: (value, settings) => ({
    isValid: value >= settings.speeds.VR,
    error: value < settings.speeds.VR ? 'V2 must be ≥ VR' : undefined,
  }),
  Vapp: (value, settings) => ({
    isValid: value >= settings.speeds.Vref,
    error: value < settings.speeds.Vref ? 'Vapp must be ≥ Vref' : undefined,
  }),
  MLW: (value, settings) => ({
    isValid: value <= settings.weights.MTOW,
    error: value > settings.weights.MTOW ? 'MLW must be ≤ MTOW' : undefined,
  }),
  MZFW: (value, settings) => ({
    isValid: value <= settings.weights.MLW,
    error: value > settings.weights.MLW ? 'MZFW must be ≤ MLW' : undefined,
  }),
};

// ============================================================================
// INPUT GROUP COMPONENT
// ============================================================================

interface InputGroupProps {
  label: string;
  value: number;
  unit?: string;
  onChange: (value: number) => void;
  tooltip?: string;
  min?: number;
  max?: number;
  step?: number;
  error?: string | null;
  disabled?: boolean;
}

function InputGroup({
  label,
  value,
  unit,
  onChange,
  tooltip,
  min,
  max,
  step = 1,
  error,
  disabled = false,
}: InputGroupProps) {
  const [focused, setFocused] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value) || 0;
    onChange(newValue);
  };

  return (
    <div className="input-group mb-3">
      <label className="block text-sm text-gray-300 mb-1 flex items-center gap-1">
        {label}
        {tooltip && (
          <span
            className="text-blue-400 cursor-help text-xs"
            title={tooltip}
          >
            ⓘ
          </span>
        )}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value || ''}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={`flex-1 bg-gray-700 border rounded px-3 py-2 text-white text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-600 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : focused ? 'border-blue-500' : 'border-gray-600'}
          `}
        />
        {unit && (
          <span className="text-gray-400 text-sm min-w-[40px]">{unit}</span>
        )}
      </div>
      {error && (
        <span className="text-red-400 text-xs mt-1 block">{error}</span>
      )}
    </div>
  );
}

// ============================================================================
// CALCULATED FIELD COMPONENT
// ============================================================================

interface CalculatedFieldProps {
  label: string;
  value: number;
  unit?: string;
  warning?: boolean;
  emphasized?: boolean;
}

function CalculatedField({
  label,
  value,
  unit,
  warning = false,
  emphasized = false,
}: CalculatedFieldProps) {
  return (
    <div
      className={`flex justify-between items-center p-3 rounded mb-3
        ${emphasized ? 'bg-blue-900/50 border-2 border-blue-500' : 'bg-gray-700'}
        ${warning ? 'border-2 border-orange-500' : ''}
      `}
    >
      <span className="text-gray-300 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-mono font-semibold ${emphasized ? 'text-lg' : ''} ${warning ? 'text-orange-400' : 'text-white'}`}>
          {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        {unit && <span className="text-gray-400 text-sm">{unit}</span>}
        {warning && <span className="text-orange-400">⚠️</span>}
      </div>
    </div>
  );
}

// ============================================================================
// SELECT GROUP COMPONENT
// ============================================================================

interface SelectGroupProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

function SelectGroup({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SelectGroupProps) {
  return (
    <div className="select-group mb-3">
      <label className="block text-sm text-gray-300 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-600 disabled:cursor-not-allowed cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ============================================================================
// PANEL SECTION HEADER
// ============================================================================

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-white font-semibold text-sm uppercase tracking-wide mb-3 mt-4 first:mt-0 border-b border-gray-600 pb-1">
      {children}
    </h4>
  );
}

// ============================================================================
// WEIGHTS PANEL
// ============================================================================

interface WeightsPanelProps {
  settings: WeightSettings;
  totalFuel: number;
  onUpdate: <K extends keyof WeightSettings>(key: K, value: WeightSettings[K]) => void;
  allSettings: AdvancedSettings;
}

function WeightsPanel({ settings, totalFuel, onUpdate, allSettings }: WeightsPanelProps) {
  const actualTOW = settings.OEW + settings.payloadWeight + totalFuel;
  const towExceeded = actualTOW > settings.MTOW;

  return (
    <div className="settings-panel">
      <SectionHeader>Weight Limits</SectionHeader>
      <InputGroup
        label="MTOW (Maximum Takeoff Weight)"
        value={settings.MTOW}
        unit="kg"
        onChange={(v) => onUpdate('MTOW', v)}
        tooltip="Maximum certified takeoff weight"
        min={0}
        max={500000}
      />
      <InputGroup
        label="MLW (Maximum Landing Weight)"
        value={settings.MLW}
        unit="kg"
        onChange={(v) => onUpdate('MLW', v)}
        error={validators.MLW(settings.MLW, allSettings).error}
        min={0}
        max={500000}
      />
      <InputGroup
        label="MZFW (Maximum Zero Fuel Weight)"
        value={settings.MZFW}
        unit="kg"
        onChange={(v) => onUpdate('MZFW', v)}
        error={validators.MZFW(settings.MZFW, allSettings).error}
        min={0}
        max={500000}
      />
      <InputGroup
        label="OEW (Operating Empty Weight)"
        value={settings.OEW}
        unit="kg"
        onChange={(v) => onUpdate('OEW', v)}
        tooltip="Weight of aircraft with crew, fluids, and equipment"
        min={0}
        max={500000}
      />

      <SectionHeader>Actual Weights</SectionHeader>
      <InputGroup
        label="Payload Weight"
        value={settings.payloadWeight}
        unit="kg"
        onChange={(v) => onUpdate('payloadWeight', v)}
        tooltip="Passengers, cargo, and baggage"
        min={0}
      />
      <CalculatedField
        label="Actual TOW"
        value={actualTOW}
        unit="kg"
        warning={towExceeded}
        emphasized
      />

      <SectionHeader>Landing Distance</SectionHeader>
      <InputGroup
        label="ALD (Actual Landing Distance)"
        value={settings.ALD}
        unit="m"
        onChange={(v) => onUpdate('ALD', v)}
        min={0}
      />
      <InputGroup
        label="RDL (Required Distance for Landing)"
        value={settings.RDL}
        unit="m"
        onChange={(v) => onUpdate('RDL', v)}
        min={0}
      />
    </div>
  );
}

// ============================================================================
// SPEEDS PANEL
// ============================================================================

interface SpeedsPanelProps {
  settings: SpeedSettings;
  onUpdate: <K extends keyof SpeedSettings>(key: K, value: SpeedSettings[K]) => void;
  allSettings: AdvancedSettings;
}

function SpeedsPanel({ settings, onUpdate, allSettings }: SpeedsPanelProps) {
  return (
    <div className="settings-panel">
      <SectionHeader>Takeoff Speeds</SectionHeader>
      <InputGroup
        label="V1 (Decision Speed)"
        value={settings.V1}
        unit="kts"
        onChange={(v) => onUpdate('V1', v)}
        tooltip="Speed beyond which takeoff must continue"
        min={0}
        max={300}
      />
      <InputGroup
        label="VR (Rotation Speed)"
        value={settings.VR}
        unit="kts"
        onChange={(v) => onUpdate('VR', v)}
        error={validators.VR(settings.VR, allSettings).error}
        min={0}
        max={300}
      />
      <InputGroup
        label="V2 (Takeoff Safety Speed)"
        value={settings.V2}
        unit="kts"
        onChange={(v) => onUpdate('V2', v)}
        error={validators.V2(settings.V2, allSettings).error}
        min={0}
        max={300}
      />

      <SectionHeader>Landing Speeds</SectionHeader>
      <InputGroup
        label="Vref (Reference Landing Speed)"
        value={settings.Vref}
        unit="kts"
        onChange={(v) => onUpdate('Vref', v)}
        min={0}
        max={300}
      />
      <InputGroup
        label="Vapp (Approach Speed)"
        value={settings.Vapp}
        unit="kts"
        onChange={(v) => onUpdate('Vapp', v)}
        error={validators.Vapp(settings.Vapp, allSettings).error}
        min={0}
        max={300}
      />

      <SectionHeader>Flight Speeds</SectionHeader>
      <InputGroup
        label="Climb Speed"
        value={settings.climbSpeed}
        unit="kts"
        onChange={(v) => onUpdate('climbSpeed', v)}
        min={0}
        max={500}
      />
      <InputGroup
        label="Cruise Speed"
        value={settings.cruiseSpeed}
        unit="kts"
        onChange={(v) => onUpdate('cruiseSpeed', v)}
        min={0}
        max={600}
      />
      <InputGroup
        label="Descent Speed"
        value={settings.descentSpeed}
        unit="kts"
        onChange={(v) => onUpdate('descentSpeed', v)}
        min={0}
        max={500}
      />
    </div>
  );
}

// ============================================================================
// FUEL PANEL
// ============================================================================

interface FuelPanelProps {
  settings: FuelSettings;
  onUpdate: <K extends keyof FuelSettings>(key: K, value: FuelSettings[K]) => void;
}

function FuelPanel({ settings, onUpdate }: FuelPanelProps) {
  const contingencyFuel = settings.tripFuel * (settings.contingency / 100);
  const totalFuel =
    settings.taxiFuel +
    settings.tripFuel +
    settings.alternateFuel +
    settings.holdingFuel +
    contingencyFuel +
    settings.extraFuel +
    settings.minimumFuel;

  // Update total fuel when calculated
  useEffect(() => {
    if (totalFuel !== settings.totalFuel) {
      onUpdate('totalFuel', totalFuel);
    }
  }, [totalFuel, settings.totalFuel, onUpdate]);

  return (
    <div className="settings-panel">
      <SectionHeader>Required Fuel</SectionHeader>
      <InputGroup
        label="Taxi Fuel"
        value={settings.taxiFuel}
        unit="kg"
        onChange={(v) => onUpdate('taxiFuel', v)}
        tooltip="Fuel for taxi, APU, and engine start"
        min={0}
      />
      <InputGroup
        label="Trip Fuel"
        value={settings.tripFuel}
        unit="kg"
        onChange={(v) => onUpdate('tripFuel', v)}
        tooltip="Fuel from brake release to touchdown"
        min={0}
      />
      <InputGroup
        label="Alternate Fuel"
        value={settings.alternateFuel}
        unit="kg"
        onChange={(v) => onUpdate('alternateFuel', v)}
        tooltip="Fuel to fly to alternate airport"
        min={0}
      />
      <InputGroup
        label="Holding Fuel"
        value={settings.holdingFuel}
        unit="kg"
        onChange={(v) => onUpdate('holdingFuel', v)}
        tooltip="Fuel for holding/delays"
        min={0}
      />

      <SectionHeader>Contingency & Reserves</SectionHeader>
      <InputGroup
        label="Contingency %"
        value={settings.contingency}
        unit="%"
        onChange={(v) => onUpdate('contingency', v)}
        tooltip="Typically 5% of trip fuel or 5 minutes"
        min={0}
        max={10}
        step={0.5}
      />
      <CalculatedField
        label="Contingency Fuel"
        value={contingencyFuel}
        unit="kg"
      />
      <InputGroup
        label="Extra Fuel (Captain's discretion)"
        value={settings.extraFuel}
        unit="kg"
        onChange={(v) => onUpdate('extraFuel', v)}
        min={0}
      />
      <InputGroup
        label="Final Reserve (Minimum)"
        value={settings.minimumFuel}
        unit="kg"
        onChange={(v) => onUpdate('minimumFuel', v)}
        tooltip="30 minutes at holding speed at 1500ft"
        min={0}
      />

      <div className="mt-4 pt-4 border-t-2 border-gray-600">
        <CalculatedField
          label="TOTAL FUEL REQUIRED"
          value={totalFuel}
          unit="kg"
          emphasized
        />
      </div>
    </div>
  );
}

// ============================================================================
// PERFORMANCE PANEL
// ============================================================================

interface PerformancePanelProps {
  settings: PerformanceSettings;
  onUpdate: <K extends keyof PerformanceSettings>(key: K, value: PerformanceSettings[K]) => void;
}

function PerformancePanel({ settings, onUpdate }: PerformancePanelProps) {
  return (
    <div className="settings-panel">
      <SectionHeader>Flight Planning</SectionHeader>
      <InputGroup
        label="Cruise Altitude"
        value={settings.cruiseAltitude}
        unit="ft"
        onChange={(v) => onUpdate('cruiseAltitude', v)}
        step={1000}
        min={0}
        max={50000}
      />
      <InputGroup
        label="Cost Index"
        value={settings.costIndex}
        onChange={(v) => onUpdate('costIndex', v)}
        tooltip="Ratio of time cost to fuel cost (0-999)"
        min={0}
        max={999}
      />
      <InputGroup
        label="Climb Gradient"
        value={settings.climbGradient}
        unit="%"
        onChange={(v) => onUpdate('climbGradient', v)}
        step={0.1}
        min={0}
        max={10}
      />

      <SectionHeader>Environmental</SectionHeader>
      <SelectGroup
        label="Anti-Ice"
        value={settings.antiIce}
        options={['off', 'engine', 'wing', 'all']}
        onChange={(v) => onUpdate('antiIce', v as PerformanceSettings['antiIce'])}
      />
      <SelectGroup
        label="Packs Setting"
        value={settings.packsSetting}
        options={['off', 'reduced', 'normal', 'high']}
        onChange={(v) => onUpdate('packsSetting', v as PerformanceSettings['packsSetting'])}
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type TabType = 'weights' | 'speeds' | 'fuel' | 'performance';

export function AdvancedFlightSettings({
  initialSettings,
  onSettingsChange,
  aircraftCode,
  collapsed: initialCollapsed = true,
}: AdvancedFlightSettingsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('weights');
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [settings, setSettings] = useState<AdvancedSettings>(() => {
    // Try to load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...getDefaultSettings(), ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load saved settings:', e);
    }
    return { ...getDefaultSettings(), ...initialSettings };
  });

  // Save to localStorage when settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  // Update handlers
  const handleWeightUpdate = useCallback(<K extends keyof WeightSettings>(
    key: K,
    value: WeightSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      weights: { ...prev.weights, [key]: value },
    }));
  }, []);

  const handleSpeedUpdate = useCallback(<K extends keyof SpeedSettings>(
    key: K,
    value: SpeedSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      speeds: { ...prev.speeds, [key]: value },
    }));
  }, []);

  const handleFuelUpdate = useCallback(<K extends keyof FuelSettings>(
    key: K,
    value: FuelSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      fuel: { ...prev.fuel, [key]: value },
    }));
  }, []);

  const handlePerformanceUpdate = useCallback(<K extends keyof PerformanceSettings>(
    key: K,
    value: PerformanceSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      performance: { ...prev.performance, [key]: value },
    }));
  }, []);

  // Reset to defaults
  const handleReset = useCallback(() => {
    const defaults = getDefaultSettings();
    setSettings(defaults);
  }, []);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'weights', label: 'Weights', icon: '⚖️' },
    { id: 'speeds', label: 'Speeds', icon: '🚀' },
    { id: 'fuel', label: 'Fuel', icon: '⛽' },
    { id: 'performance', label: 'Perf', icon: '📊' },
  ];

  return (
    <div className="advanced-flight-settings bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-750 hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <span className="text-blue-300 font-semibold">Advanced Settings</span>
          {aircraftCode && (
            <span className="text-gray-400 text-sm">({aircraftCode})</span>
          )}
        </div>
        <span className="text-gray-400 text-sm">
          {collapsed ? '▼' : '▲'}
        </span>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="p-4">
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-900 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }
                `}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {activeTab === 'weights' && (
              <WeightsPanel
                settings={settings.weights}
                totalFuel={settings.fuel.totalFuel}
                onUpdate={handleWeightUpdate}
                allSettings={settings}
              />
            )}
            {activeTab === 'speeds' && (
              <SpeedsPanel
                settings={settings.speeds}
                onUpdate={handleSpeedUpdate}
                allSettings={settings}
              />
            )}
            {activeTab === 'fuel' && (
              <FuelPanel
                settings={settings.fuel}
                onUpdate={handleFuelUpdate}
              />
            )}
            {activeTab === 'performance' && (
              <PerformancePanel
                settings={settings.performance}
                onUpdate={handlePerformanceUpdate}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-700">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors"
            >
              Reset Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdvancedFlightSettings;
