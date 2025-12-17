/**
 * NOTAM Panel Component
 * 
 * Displays NOTAMs for departure and arrival airports.
 * Highlights critical NOTAMs affecting:
 * - Runway closures
 * - Minima changes
 * - Approach restrictions
 */

import React, { useState, useEffect } from 'react';
import { fetchNotams } from '@/api/icao';
import { Notam, NotamSeverity, NotamType } from '@/types/airport';

interface NotamPanelProps {
  departureIcao: string | null;
  arrivalIcao: string | null;
}

interface NotamDisplayProps {
  notam: Notam;
}

// ============================================================================
// SEVERITY STYLING
// ============================================================================

function getSeverityStyles(severity: NotamSeverity): {
  border: string;
  bg: string;
  badge: string;
  icon: string;
} {
  switch (severity) {
    case 'CRITICAL':
      return {
        border: 'border-red-500',
        bg: 'bg-red-50',
        badge: 'bg-red-600 text-white',
        icon: '🚫',
      };
    case 'WARNING':
      return {
        border: 'border-yellow-500',
        bg: 'bg-yellow-50',
        badge: 'bg-yellow-500 text-black',
        icon: '⚠️',
      };
    case 'INFO':
    default:
      return {
        border: 'border-blue-300',
        bg: 'bg-blue-50',
        badge: 'bg-blue-500 text-white',
        icon: 'ℹ️',
      };
  }
}

function getTypeLabel(type: NotamType): string {
  const labels: Record<NotamType, string> = {
    RUNWAY: 'Runway',
    TAXIWAY: 'Taxiway',
    APRON: 'Apron',
    LIGHTING: 'Lighting',
    NAVIGATION: 'Navigation',
    AIRSPACE: 'Airspace',
    OBSTACLE: 'Obstacle',
    PROCEDURE: 'Procedure',
    OTHER: 'Other',
  };
  return labels[type] || 'Other';
}

// ============================================================================
// NOTAM ITEM COMPONENT
// ============================================================================

const NotamItem: React.FC<NotamDisplayProps> = ({ notam }) => {
  const [expanded, setExpanded] = useState(false);
  const styles = getSeverityStyles(notam.severity);
  
  // Format dates
  const effectiveFrom = notam.effectiveFrom.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  const effectiveTo = notam.isPermanent 
    ? 'Permanent' 
    : notam.effectiveTo.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
  
  // Truncate text for preview
  const previewText = notam.text.length > 150 
    ? notam.text.substring(0, 150) + '...' 
    : notam.text;
  
  return (
    <div 
      className={`border-l-4 ${styles.border} ${styles.bg} rounded-r-lg p-3 mb-2 cursor-pointer transition-all hover:shadow-md`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{styles.icon}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${styles.badge}`}>
            {notam.severity}
          </span>
          <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">
            {getTypeLabel(notam.type)}
          </span>
          {notam.affectedRunway && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-mono">
              RWY {notam.affectedRunway}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{notam.id}</span>
      </div>
      
      {/* Impact badges */}
      {(notam.impactsRunway || notam.impactsTakeoff || notam.impactsLanding) && (
        <div className="flex gap-1 mb-2">
          {notam.impactsRunway && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
              Affects Runway
            </span>
          )}
          {notam.impactsTakeoff && (
            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
              Affects Takeoff
            </span>
          )}
          {notam.impactsLanding && (
            <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
              Affects Landing
            </span>
          )}
        </div>
      )}
      
      {/* NOTAM text */}
      <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">
        {expanded ? notam.text : previewText}
      </p>
      
      {/* Validity period */}
      <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
        <span>From: {effectiveFrom}</span>
        <span>To: {effectiveTo}</span>
      </div>
      
      {/* Expand indicator */}
      {notam.text.length > 150 && (
        <div className="text-center mt-1">
          <span className="text-xs text-blue-500">
            {expanded ? '▲ Show less' : '▼ Show more'}
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// AIRPORT NOTAMS SECTION
// ============================================================================

interface AirportNotamsSectionProps {
  icao: string;
  label: string;
}

const AirportNotamsSection: React.FC<AirportNotamsSectionProps> = ({ icao, label }) => {
  const [notams, setNotams] = useState<Notam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'runway'>('all');
  
  useEffect(() => {
    if (!icao) return;
    
    setLoading(true);
    setError(null);
    
    fetchNotams(icao)
      .then(data => {
        // Sort by severity (critical first) and then by date
        const sorted = data.sort((a, b) => {
          const severityOrder: Record<NotamSeverity, number> = {
            CRITICAL: 0,
            WARNING: 1,
            INFO: 2,
          };
          const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
          if (severityDiff !== 0) return severityDiff;
          return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
        });
        setNotams(sorted);
      })
      .catch(err => {
        console.error(`Failed to fetch NOTAMs for ${icao}:`, err);
        setError('Failed to load NOTAMs. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [icao]);
  
  // Filter NOTAMs
  const filteredNotams = notams.filter(notam => {
    if (filter === 'critical') return notam.severity === 'CRITICAL';
    if (filter === 'runway') return notam.impactsRunway || notam.type === 'RUNWAY';
    return true;
  });
  
  // Count by severity
  const criticalCount = notams.filter(n => n.severity === 'CRITICAL').length;
  const warningCount = notams.filter(n => n.severity === 'WARNING').length;
  const runwayCount = notams.filter(n => n.impactsRunway || n.type === 'RUNWAY').length;
  
  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-lg">📋</span>
          {label} - {icao}
          <span className="text-sm font-normal text-gray-500">
            ({notams.length} NOTAMs)
          </span>
        </h4>
        
        {/* Summary badges */}
        <div className="flex gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-bold">
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 bg-yellow-500 text-black rounded text-xs font-bold">
              {warningCount} Warning
            </span>
          )}
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            filter === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({notams.length})
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            filter === 'critical'
              ? 'bg-red-600 text-white'
              : 'bg-red-100 text-red-600 hover:bg-red-200'
          }`}
        >
          Critical ({criticalCount})
        </button>
        <button
          onClick={() => setFilter('runway')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            filter === 'runway'
              ? 'bg-purple-600 text-white'
              : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
          }`}
        >
          Runway ({runwayCount})
        </button>
      </div>
      
      {/* Content */}
      {loading && (
        <div className="text-center py-4 text-gray-500">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full mb-2"></div>
          <p>Loading NOTAMs...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      )}
      
      {!loading && !error && filteredNotams.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          No NOTAMs found for this filter.
        </div>
      )}
      
      {!loading && !error && filteredNotams.length > 0 && (
        <div className="max-h-96 overflow-y-auto pr-2">
          {filteredNotams.map(notam => (
            <NotamItem key={notam.id} notam={notam} />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN PANEL COMPONENT
// ============================================================================

export const NotamPanel: React.FC<NotamPanelProps> = ({
  departureIcao,
  arrivalIcao,
}) => {
  if (!departureIcao && !arrivalIcao) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📋</span>
          <h3 className="font-semibold text-lg">NOTAMs</h3>
        </div>
        <p className="text-gray-500 text-center py-4">
          Select departure or arrival airport to view NOTAMs.
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-600 to-orange-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <span className="text-xl">📋</span>
          NOTAMs (Notices to Air Missions)
        </h3>
      </div>
      
      <div className="p-4">
        {/* Warning banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-800">
          <strong>⚠️ Important:</strong> Always verify NOTAMs with official sources before flight.
          This display is for planning purposes only.
        </div>
        
        {/* Departure NOTAMs */}
        {departureIcao && (
          <AirportNotamsSection icao={departureIcao} label="Departure" />
        )}
        
        {/* Arrival NOTAMs */}
        {arrivalIcao && (
          <AirportNotamsSection icao={arrivalIcao} label="Arrival" />
        )}
      </div>
    </div>
  );
};

export default NotamPanel;
