/**
 * Dispatch Panel Component
 * 
 * Professional dispatch decision display showing:
 * - GO / NO-GO / CONDITIONAL status
 * - Fuel planning breakdown
 * - Weight & balance check
 * - Weather assessment
 * - Runway suitability
 * - All validation issues
 * 
 * Follows airline dispatcher standards.
 */

import React, { useEffect, useState } from 'react';
import { Airport, FlightPlan } from '@/types';
import { EnhancedAirport } from '@/types/airport';
import { DecodedMetar } from '@/api/aviationWeather';
import { 
  generateDispatchDecision, 
  DispatchDecision,
  DispatchInput,
  generateSimulatedWeather,
  SimulatedWeather,
} from '@/services/dispatch/dispatchService';

// ============================================================================
// TYPES
// ============================================================================

interface DispatchPanelProps {
  flightPlan: FlightPlan | null;
  departureAirport: EnhancedAirport | Airport | null;
  arrivalAirport: EnhancedAirport | Airport | null;
  departureWeather: DecodedMetar | null;
  arrivalWeather: DecodedMetar | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function convertToEnhancedAirport(airport: Airport | EnhancedAirport): EnhancedAirport {
  // If already enhanced, return as is
  if ('countryCode' in airport) {
    return airport as EnhancedAirport;
  }
  
  // Convert basic Airport to EnhancedAirport
  const basic = airport as Airport;
  return {
    icao: basic.icao,
    iata: basic.iata,
    name: basic.name,
    city: basic.city,
    country: basic.country,
    countryCode: basic.country.substring(0, 2).toUpperCase(),
    position: basic.position,
    elevation: basic.elevation,
    magneticVariation: basic.magneticVariation || 0,
    type: 'LARGE_AIRPORT',
    timezone: basic.timezone || 'UTC',
    runways: basic.runways.map(rwy => ({
      id: rwy.id,
      designator: rwy.id.split('/')[0] || rwy.id,
      reciprocalDesignator: rwy.id.split('/')[1] || rwy.id,
      lengthMeters: rwy.length * 0.3048, // feet to meters
      widthMeters: rwy.width * 0.3048,
      surface: rwy.surface === 'ASPH' ? 'ASP' : rwy.surface === 'CONC' ? 'CON' : 'ASP',
      headingTrue: rwy.ends[0]?.heading || 0,
      headingMagnetic: rwy.ends[0]?.heading || 0,
      reciprocalHeadingTrue: rwy.ends[1]?.heading || 0,
      reciprocalHeadingMagnetic: rwy.ends[1]?.heading || 0,
      thresholdElevation: rwy.ends[0]?.elevation || basic.elevation,
      reciprocalThresholdElevation: rwy.ends[1]?.elevation || basic.elevation,
      thresholdPosition: rwy.ends[0]?.threshold || basic.position,
      reciprocalThresholdPosition: rwy.ends[1]?.threshold || basic.position,
      status: 'OPEN' as const,
      lighting: rwy.lighting,
      ils: !!rwy.ends[0]?.ils,
      tora: rwy.length * 0.3048,
      toda: rwy.length * 0.3048,
      asda: rwy.length * 0.3048,
      lda: rwy.length * 0.3048,
    })),
    frequencies: basic.frequencies,
  };
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

const StatusBadge: React.FC<{ status: 'GO' | 'NO-GO' | 'CONDITIONAL' }> = ({ status }) => {
  const config = {
    'GO': {
      bg: 'bg-green-600',
      text: 'text-white',
      icon: '✓',
      label: 'FLIGHT IS FEASIBLE',
    },
    'NO-GO': {
      bg: 'bg-red-600',
      text: 'text-white',
      icon: '✗',
      label: 'FLIGHT IS NOT FEASIBLE',
    },
    'CONDITIONAL': {
      bg: 'bg-yellow-500',
      text: 'text-black',
      icon: '⚠',
      label: 'CONDITIONAL - REVIEW WARNINGS',
    },
  };
  
  const { bg, text, icon, label } = config[status];
  
  return (
    <div className={`${bg} ${text} px-4 py-3 rounded-lg text-center font-bold text-lg`}>
      <span className="text-2xl mr-2">{icon}</span>
      {label}
    </div>
  );
};

// ============================================================================
// FUEL BREAKDOWN COMPONENT
// ============================================================================

interface FuelBreakdownProps {
  fuelPlan: DispatchDecision['fuelCheck']['fuelPlan'];
}

const FuelBreakdown: React.FC<FuelBreakdownProps> = ({ fuelPlan }) => {
  const rows = [
    { label: 'Taxi Fuel', value: fuelPlan.taxiFuel },
    { label: 'Trip Fuel', value: fuelPlan.tripFuel },
    { label: 'Contingency (5%)', value: fuelPlan.contingencyFuel },
    { label: 'Alternate', value: fuelPlan.alternateFuel },
    { label: 'Holding (30 min)', value: fuelPlan.holdingFuel },
    { label: 'Final Reserve', value: fuelPlan.finalReserveFuel },
  ];
  
  return (
    <div className="bg-gray-50 rounded p-3">
      <h4 className="font-semibold text-gray-700 mb-2 text-sm">Fuel Planning (kg)</h4>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-b border-gray-200 last:border-0">
              <td className="py-1 text-gray-600">{row.label}</td>
              <td className="py-1 text-right font-mono">{row.value.toLocaleString()}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-300 font-bold">
            <td className="py-1 text-gray-800">Total Required</td>
            <td className="py-1 text-right font-mono">{fuelPlan.totalFuelRequired.toLocaleString()}</td>
          </tr>
          <tr className={fuelPlan.isFuelSufficient ? 'text-green-600' : 'text-red-600'}>
            <td className="py-1">Fuel On Board</td>
            <td className="py-1 text-right font-mono font-bold">{fuelPlan.totalFuelOnBoard.toLocaleString()}</td>
          </tr>
          {fuelPlan.extraFuel > 0 && (
            <tr className="text-blue-600">
              <td className="py-1">Extra Fuel</td>
              <td className="py-1 text-right font-mono">+{fuelPlan.extraFuel.toLocaleString()}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-2 text-xs text-gray-500">
        Flight Time: {fuelPlan.totalFlightTime} min | Est. Landing Weight: {fuelPlan.estimatedLandingWeight.toLocaleString()} kg
      </div>
    </div>
  );
};

// ============================================================================
// CHECK ITEM COMPONENT
// ============================================================================

interface CheckItemProps {
  label: string;
  passed: boolean;
  message: string;
  details?: React.ReactNode;
}

const CheckItem: React.FC<CheckItemProps> = ({ label, passed, message, details }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={`border rounded p-2 ${passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => details && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className={`text-lg ${passed ? 'text-green-600' : 'text-red-600'}`}>
            {passed ? '✓' : '✗'}
          </span>
          <span className="font-medium text-sm">{label}</span>
        </div>
        {details && (
          <span className="text-gray-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
        )}
      </div>
      <div className={`text-xs mt-1 ${passed ? 'text-green-700' : 'text-red-700'}`}>
        {message}
      </div>
      {isExpanded && details && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          {details}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// ISSUES LIST COMPONENT
// ============================================================================

interface IssuesListProps {
  issues: DispatchDecision['issues'];
}

const IssuesList: React.FC<IssuesListProps> = ({ issues }) => {
  if (issues.length === 0) {
    return (
      <div className="text-center text-green-600 py-4">
        <span className="text-2xl">✓</span>
        <p className="text-sm mt-1">No issues detected</p>
      </div>
    );
  }
  
  const blocking = issues.filter(i => i.severity === 'BLOCKING');
  const warnings = issues.filter(i => i.severity === 'WARNING');
  const info = issues.filter(i => i.severity === 'INFO');
  
  return (
    <div className="space-y-2">
      {blocking.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-red-600 uppercase">Blocking Issues</div>
          {blocking.map(issue => (
            <div key={issue.id} className="bg-red-100 border border-red-200 rounded p-2 text-xs">
              <div className="font-semibold text-red-800">{issue.title}</div>
              <div className="text-red-700">{issue.message}</div>
              {issue.recommendation && (
                <div className="mt-1 text-red-600 italic">💡 {issue.recommendation}</div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {warnings.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-yellow-600 uppercase">Warnings</div>
          {warnings.map(issue => (
            <div key={issue.id} className="bg-yellow-100 border border-yellow-200 rounded p-2 text-xs">
              <div className="font-semibold text-yellow-800">{issue.title}</div>
              <div className="text-yellow-700">{issue.message}</div>
            </div>
          ))}
        </div>
      )}
      
      {info.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-blue-600 uppercase">Information</div>
          {info.map(issue => (
            <div key={issue.id} className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700">
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SIMULATED WEATHER NOTICE
// ============================================================================

interface SimulatedWeatherNoticeProps {
  airport: string;
  weather: SimulatedWeather;
}

const SimulatedWeatherNotice: React.FC<SimulatedWeatherNoticeProps> = ({ airport, weather }) => (
  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
    <div className="flex items-center gap-1 text-amber-700 font-semibold">
      <span>⚠️</span>
      <span>Simulated Weather for {airport}</span>
    </div>
    <div className="text-amber-600 mt-1">
      METAR unavailable. Using simulated conditions: Wind {weather.wind.direction}° @ {weather.wind.speed}kt, 
      Vis {weather.visibility}SM, Temp {weather.temperature}°C
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DispatchPanel: React.FC<DispatchPanelProps> = ({
  flightPlan,
  departureAirport,
  arrivalAirport,
  departureWeather,
  arrivalWeather,
}) => {
  const [decision, setDecision] = useState<DispatchDecision | null>(null);
  const [simulatedDepartureWx, setSimulatedDepartureWx] = useState<SimulatedWeather | null>(null);
  const [simulatedArrivalWx, setSimulatedArrivalWx] = useState<SimulatedWeather | null>(null);
  
  // Generate dispatch decision when inputs change
  useEffect(() => {
    if (!flightPlan || !departureAirport || !arrivalAirport || !flightPlan.aircraft) {
      setDecision(null);
      return;
    }
    
    // Convert airports to enhanced format
    const enhancedDep = convertToEnhancedAirport(departureAirport);
    const enhancedArr = convertToEnhancedAirport(arrivalAirport);
    
    // Generate simulated weather if needed
    let simDepWx: SimulatedWeather | null = null;
    let simArrWx: SimulatedWeather | null = null;
    
    if (!departureWeather) {
      simDepWx = generateSimulatedWeather(enhancedDep);
      setSimulatedDepartureWx(simDepWx);
    } else {
      setSimulatedDepartureWx(null);
    }
    
    if (!arrivalWeather) {
      simArrWx = generateSimulatedWeather(enhancedArr);
      setSimulatedArrivalWx(simArrWx);
    } else {
      setSimulatedArrivalWx(null);
    }
    
    // Build dispatch input
    const input: DispatchInput = {
      flightPlan,
      aircraft: flightPlan.aircraft,
      departureAirport: enhancedDep,
      arrivalAirport: enhancedArr,
      departureWeather: departureWeather,
      arrivalWeather: arrivalWeather,
      payloadKg: 15000, // Default payload
    };
    
    // Generate decision
    const result = generateDispatchDecision(input);
    setDecision(result);
  }, [flightPlan, departureAirport, arrivalAirport, departureWeather, arrivalWeather]);
  
  // Don't render if no flight plan
  if (!flightPlan || !decision) {
    return null;
  }
  
  return (
    <div className="dispatch-panel bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          📋 Dispatch Release
        </h3>
        <div className="text-indigo-200 text-xs mt-1">
          {flightPlan.departure.icao} → {flightPlan.arrival.icao} • {flightPlan.aircraft?.name || 'Unknown Aircraft'}
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Main Status Badge */}
        <StatusBadge status={decision.overallStatus} />
        
        {/* Simulated Weather Notices */}
        {simulatedDepartureWx && (
          <SimulatedWeatherNotice 
            airport={flightPlan.departure.icao} 
            weather={simulatedDepartureWx} 
          />
        )}
        {simulatedArrivalWx && (
          <SimulatedWeatherNotice 
            airport={flightPlan.arrival.icao} 
            weather={simulatedArrivalWx} 
          />
        )}
        
        {/* Check Items Grid */}
        <div className="grid grid-cols-2 gap-2">
          <CheckItem
            label="Range"
            passed={decision.rangeCheck.passed}
            message={decision.rangeCheck.message}
          />
          <CheckItem
            label="Fuel"
            passed={decision.fuelCheck.passed}
            message={decision.fuelCheck.message}
            details={<FuelBreakdown fuelPlan={decision.fuelCheck.fuelPlan} />}
          />
          <CheckItem
            label="Weight"
            passed={decision.weightCheck.passed}
            message={decision.weightCheck.message}
          />
          <CheckItem
            label="Dep Runway"
            passed={decision.runwayCheck.departure.passed}
            message={decision.runwayCheck.departure.message}
          />
          <CheckItem
            label="Arr Runway"
            passed={decision.runwayCheck.arrival.passed}
            message={decision.runwayCheck.arrival.message}
          />
          <CheckItem
            label="Dep Weather"
            passed={decision.weatherCheck.departure.passed}
            message={decision.weatherCheck.departure.message}
          />
          <CheckItem
            label="Arr Weather"
            passed={decision.weatherCheck.arrival.passed}
            message={decision.weatherCheck.arrival.message}
          />
        </div>
        
        {/* Issues Section */}
        <div>
          <h4 className="font-semibold text-gray-700 text-sm mb-2">Validation Issues</h4>
          <IssuesList issues={decision.issues} />
        </div>
        
        {/* Summary */}
        <div className="bg-gray-100 rounded p-3 text-xs font-mono whitespace-pre-wrap text-gray-700">
          {decision.summary.join('\n')}
        </div>
        
        {/* Footer */}
        <div className="text-xs text-gray-400 text-center pt-2 border-t">
          Dispatch computed at {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default DispatchPanel;
