/**
 * Validation Warnings Panel Component
 * 
 * Displays flight validation results with clear warnings and blocking issues.
 * Shows runway analysis, weather conditions, NOTAMs, and performance validation.
 */

import React from 'react';
import { 
  FlightValidationResult, 
  ValidationSeverity, 
  RunwayAnalysis, 
  WindComponents,
  AirportValidation
} from '@/types/aircraft';

interface ValidationWarningsPanelProps {
  validation: FlightValidationResult | null;
  isLoading?: boolean;
}

// Issue severity badge
const SeverityBadge: React.FC<{ severity: ValidationSeverity }> = ({ severity }) => {
  const styles: Record<ValidationSeverity, string> = {
    BLOCKING: 'bg-red-600 text-white',
    ERROR: 'bg-orange-500 text-white',
    WARNING: 'bg-yellow-500 text-white',
    INFO: 'bg-blue-500 text-white',
  };
  
  const icons: Record<ValidationSeverity, string> = {
    BLOCKING: '⛔',
    ERROR: '⚠️',
    WARNING: '⚡',
    INFO: 'ℹ️',
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[severity]}`}>
      {icons[severity]} {severity}
    </span>
  );
};

// Wind components display
const WindDisplay: React.FC<{ wind: WindComponents; limits?: { maxCrosswind: number; maxTailwind: number } }> = ({ wind, limits }) => {
  const crosswindExceeded = limits && Math.abs(wind.crosswind) > limits.maxCrosswind;
  const tailwindExceeded = limits && wind.tailwind > limits.maxTailwind;
  
  return (
    <div className="flex items-center gap-4 text-sm">
      <div className={`${crosswindExceeded ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
        ↔ Crosswind: {Math.abs(wind.crosswind).toFixed(0)} kt
        {crosswindExceeded && limits && <span className="text-xs ml-1">(max {limits.maxCrosswind})</span>}
      </div>
      <div className={`${wind.headwind < 0 ? tailwindExceeded ? 'text-red-600 font-bold' : 'text-orange-600' : 'text-green-600'}`}>
        {wind.headwind >= 0 
          ? `↑ Headwind: ${wind.headwind.toFixed(0)} kt` 
          : `↓ Tailwind: ${Math.abs(wind.headwind).toFixed(0)} kt`}
        {tailwindExceeded && limits && <span className="text-xs ml-1">(max {limits.maxTailwind})</span>}
      </div>
    </div>
  );
};

// Runway analysis display
const RunwayAnalysisDisplay: React.FC<{ 
  analysis: RunwayAnalysis; 
  type: 'departure' | 'arrival';
  aircraftNeeds?: { takeoff: number; landing: number };
}> = ({ analysis, type, aircraftNeeds }) => {
  const required = aircraftNeeds 
    ? (type === 'departure' ? aircraftNeeds.takeoff : aircraftNeeds.landing)
    : analysis.requiredLength;
  
  return (
    <div className={`p-3 rounded-lg border ${analysis.isSuitable ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">
          Runway {analysis.designator}
        </div>
        <span className={`px-2 py-0.5 rounded text-xs ${analysis.isSuitable ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {analysis.isSuitable ? '✓ Suitable' : '✗ Unsuitable'}
        </span>
      </div>
      
      {/* Runway length bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Available: {analysis.availableLength}m</span>
          {required > 0 && <span>Required: {required}m</span>}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          {required > 0 && (
            <div 
              className={`h-full ${analysis.availableLength >= required ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, (analysis.availableLength / Math.max(analysis.availableLength, required)) * 100)}%` }}
            />
          )}
        </div>
        {required > 0 && analysis.availableLength < required && (
          <div className="text-xs text-red-600 mt-1">
            ⚠️ Short by {required - analysis.availableLength}m
          </div>
        )}
      </div>
      
      {/* Wind components */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-600 mb-1">Wind Analysis:</div>
        <div className="flex items-center gap-4 text-sm">
          <span className={analysis.headwindComponent >= 0 ? 'text-green-600' : 'text-orange-600'}>
            {analysis.headwindComponent >= 0 
              ? `↑ Headwind: ${analysis.headwindComponent.toFixed(0)} kt`
              : `↓ Tailwind: ${Math.abs(analysis.headwindComponent).toFixed(0)} kt`}
          </span>
          <span className={analysis.crosswindComponent > 25 ? 'text-red-600' : 'text-gray-600'}>
            ↔ Crosswind: {analysis.crosswindComponent.toFixed(0)} kt
          </span>
        </div>
      </div>
      
      {/* Issues */}
      {analysis.issues.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
          {analysis.issues.map((issue, idx) => (
            <div key={idx} className={`text-xs ${
              issue.severity === 'BLOCKING' ? 'text-red-700' :
              issue.severity === 'ERROR' ? 'text-orange-700' :
              'text-yellow-700'
            }`}>
              • {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Airport validation display
const AirportValidationDisplay: React.FC<{ 
  validation: AirportValidation;
  type: 'departure' | 'arrival';
}> = ({ validation, type }) => {
  const icon = type === 'departure' ? '🛫' : '🛬';
  const label = type === 'departure' ? 'Departure' : 'Arrival';
  
  return (
    <details className="border border-gray-200 rounded-lg overflow-hidden">
      <summary className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 font-medium">
        {icon} {label}: {validation.icao}
        {!validation.isValid && (
          <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Issues</span>
        )}
      </summary>
      <div className="p-4 space-y-4">
        {/* Weather status */}
        <div className={`p-3 rounded-lg ${validation.weatherValid ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="text-sm font-medium">
            {validation.weatherValid ? '✓ Weather OK' : '⚠️ Weather Concerns'}
          </div>
          {validation.windComponents && (
            <div className="mt-2">
              <WindDisplay wind={validation.windComponents} />
            </div>
          )}
        </div>
        
        {/* Runways */}
        {validation.suitableRunways && validation.suitableRunways.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">
              Runway Analysis ({validation.suitableRunways.filter(r => r.isSuitable).length} suitable):
            </div>
            {validation.suitableRunways.map((analysis, idx) => (
              <RunwayAnalysisDisplay key={idx} analysis={analysis} type={type} />
            ))}
            {validation.recommendedRunway && (
              <div className="text-sm text-green-700 font-medium">
                ✓ Recommended: Runway {validation.recommendedRunway}
              </div>
            )}
          </div>
        )}
        
        {/* NOTAMs */}
        {validation.relevantNotams && validation.relevantNotams.length > 0 && (
          <div className={`p-3 rounded-lg ${validation.hasBlockingNotam ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="text-sm font-medium mb-2">
              {validation.hasBlockingNotam ? '⛔ Blocking NOTAM(s)' : '⚠️ Active NOTAMs'}
            </div>
            {validation.relevantNotams.map((notam, idx) => (
              <div key={idx} className="text-xs text-gray-700 py-1">
                • {notam}
              </div>
            ))}
          </div>
        )}
        
        {/* Airport issues */}
        {validation.issues.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Issues:</div>
            {validation.issues.map((issue, idx) => (
              <div key={idx} className={`p-2 rounded text-sm ${
                issue.severity === 'BLOCKING' ? 'bg-red-50 text-red-800' :
                issue.severity === 'ERROR' ? 'bg-orange-50 text-orange-800' :
                'bg-yellow-50 text-yellow-800'
              }`}>
                <SeverityBadge severity={issue.severity} />
                <span className="ml-2">{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
};

// Main component
export const ValidationWarningsPanel: React.FC<ValidationWarningsPanelProps> = ({
  validation,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Validating flight...</span>
        </div>
      </div>
    );
  }
  
  if (!validation) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-500 text-sm">
        Select aircraft and airports to validate the flight plan.
      </div>
    );
  }
  
  const allIssues = validation.issues;
  const blockingIssues = allIssues.filter(i => i.severity === 'BLOCKING');
  const errorIssues = allIssues.filter(i => i.severity === 'ERROR');
  const warningIssues = allIssues.filter(i => i.severity === 'WARNING');
  
  return (
    <div className="space-y-4">
      {/* Overall status header */}
      <div className={`p-4 rounded-lg border ${
        !validation.canProceed ? 'bg-red-50 border-red-300' :
        !validation.isValid ? 'bg-yellow-50 border-yellow-300' :
        'bg-green-50 border-green-300'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-lg font-bold ${
              !validation.canProceed ? 'text-red-700' :
              !validation.isValid ? 'text-yellow-700' :
              'text-green-700'
            }`}>
              {!validation.canProceed 
                ? '⛔ Flight Cannot Operate' 
                : !validation.isValid 
                  ? '⚠️ Flight Possible with Caution'
                  : '✅ Flight Cleared'}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {blockingIssues.length} blocking • {errorIssues.length} errors • {warningIssues.length} warnings
            </div>
          </div>
          
          {/* Summary badges */}
          <div className="flex gap-2">
            {blockingIssues.length > 0 && (
              <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium">
                {blockingIssues.length} Blocking
              </span>
            )}
            {errorIssues.length > 0 && (
              <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-sm font-medium">
                {errorIssues.length} Errors
              </span>
            )}
            {warningIssues.length > 0 && (
              <span className="px-3 py-1 bg-yellow-500 text-white rounded-full text-sm font-medium">
                {warningIssues.length} Warnings
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Blocking issues section */}
      {blockingIssues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">
            <span className="text-lg">⛔</span> Blocking Issues
          </h3>
          <div className="space-y-2">
            {blockingIssues.map((issue, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-red-200">
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={issue.severity} />
                  <div className="flex-1">
                    <div className="font-medium text-red-800">{issue.title}</div>
                    <div className="text-sm text-red-700 mt-1">{issue.message}</div>
                    {issue.recommendation && (
                      <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                        💡 {issue.recommendation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Errors section */}
      {errorIssues.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
            <span className="text-lg">⚠️</span> Errors
          </h3>
          <div className="space-y-2">
            {errorIssues.map((issue, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-orange-200">
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={issue.severity} />
                  <div className="flex-1">
                    <div className="font-medium text-orange-800">{issue.title}</div>
                    <div className="text-sm text-orange-700 mt-1">{issue.message}</div>
                    {issue.recommendation && (
                      <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                        💡 {issue.recommendation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Warnings section */}
      {warningIssues.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
            <span className="text-lg">⚡</span> Warnings
          </h3>
          <div className="space-y-2">
            {warningIssues.map((issue, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-yellow-200">
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={issue.severity} />
                  <div className="flex-1">
                    <div className="font-medium text-yellow-800">{issue.title}</div>
                    <div className="text-sm text-yellow-700 mt-1">{issue.message}</div>
                    {issue.recommendation && (
                      <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                        💡 {issue.recommendation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Departure airport validation */}
      {validation.departureValidation && (
        <AirportValidationDisplay 
          validation={validation.departureValidation} 
          type="departure" 
        />
      )}
      
      {/* Arrival airport validation */}
      {validation.arrivalValidation && (
        <AirportValidationDisplay 
          validation={validation.arrivalValidation} 
          type="arrival" 
        />
      )}
      
      {/* All clear message */}
      {allIssues.length === 0 && (
        <div className="p-6 text-center bg-green-50 rounded-lg border border-green-200">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-green-800 font-bold">All Checks Passed</div>
          <div className="text-sm text-green-600">Flight is cleared for operation</div>
        </div>
      )}
    </div>
  );
};

export default ValidationWarningsPanel;
