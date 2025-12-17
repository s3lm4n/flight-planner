/**
 * Chart Viewer Component
 * 
 * Displays aviation charts with support for:
 * - PDF viewing (embedded or download)
 * - External links
 * - Manual uploads
 */

import React, { useState, useCallback } from 'react';
import {
  AviationChart,
  ChartType,
  getChartService,
  getChartTypeLabel,
  getChartTypeIcon,
  getProviderLabel,
} from '@/services/charts/chartService';

interface ChartViewerProps {
  airportIcao: string;
  runway?: string;
}

interface ChartUploadModalProps {
  airportIcao: string;
  onClose: () => void;
  onUpload: (chart: AviationChart) => void;
}

// ============================================================================
// CHART UPLOAD MODAL
// ============================================================================

const ChartUploadModal: React.FC<ChartUploadModalProps> = ({
  airportIcao,
  onClose,
  onUpload,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChartType>('AIRPORT_DIAGRAM');
  const [runway, setRunway] = useState('');
  const [sourceType, setSourceType] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a chart name');
      return;
    }
    
    if (sourceType === 'url' && !url.trim()) {
      alert('Please enter a URL');
      return;
    }
    
    if (sourceType === 'file' && !file) {
      alert('Please select a file');
      return;
    }
    
    setIsUploading(true);
    
    try {
      const chartService = getChartService();
      let newChart: AviationChart;
      
      if (sourceType === 'url') {
        newChart = chartService.addExternalChart(
          airportIcao,
          type,
          name,
          url,
          {
            runway: runway || undefined,
            provider: 'CUSTOM',
          }
        );
      } else if (file) {
        // Read file as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        newChart = chartService.addManualChart({
          airportIcao,
          type,
          name,
          runway: runway || undefined,
          provider: 'MANUAL',
          source: {
            type: 'file',
            data: base64,
            filename: file.name,
            mimeType: file.type,
          },
        });
      } else {
        throw new Error('Invalid source type');
      }
      
      onUpload(newChart);
      onClose();
    } catch (error) {
      console.error('Failed to upload chart:', error);
      alert('Failed to add chart. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [airportIcao, name, type, runway, sourceType, url, file, onUpload, onClose]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg">Add Chart for {airportIcao}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Chart name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chart Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ILS RWY 09L"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          
          {/* Chart type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chart Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ChartType)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="AIRPORT_DIAGRAM">Airport Diagram</option>
              <option value="SID">SID</option>
              <option value="STAR">STAR</option>
              <option value="APPROACH">Approach</option>
              <option value="TAXI">Taxi Chart</option>
              <option value="PARKING_CHART">Parking Chart</option>
              <option value="MINIMUM_ALTITUDE">Minimum Altitude</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          
          {/* Runway (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Runway (optional)
            </label>
            <input
              type="text"
              value={runway}
              onChange={(e) => setRunway(e.target.value.toUpperCase())}
              placeholder="e.g., 09L"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Source type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={sourceType === 'url'}
                  onChange={() => setSourceType('url')}
                  className="text-blue-600"
                />
                <span className="text-sm">External URL</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={sourceType === 'file'}
                  onChange={() => setSourceType('file')}
                  className="text-blue-600"
                />
                <span className="text-sm">Upload PDF</span>
              </label>
            </div>
          </div>
          
          {/* URL input */}
          {sourceType === 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chart URL *
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required={sourceType === 'url'}
              />
            </div>
          )}
          
          {/* File input */}
          {sourceType === 'file' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PDF File *
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required={sourceType === 'file'}
              />
            </div>
          )}
          
          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading ? 'Adding...' : 'Add Chart'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// CHART ITEM COMPONENT
// ============================================================================

interface ChartItemProps {
  chart: AviationChart;
  onDelete: (id: string) => void;
}

const ChartItem: React.FC<ChartItemProps> = ({ chart, onDelete }) => {
  const handleOpen = () => {
    if (chart.source.type === 'url') {
      window.open(chart.source.url, '_blank');
    } else if (chart.source.type === 'file') {
      // Open base64 PDF in new tab
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe width="100%" height="100%" src="${chart.source.data}"></iframe>`
        );
      }
    }
  };
  
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <span className="text-2xl">{getChartTypeIcon(chart.type)}</span>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800 truncate">{chart.name}</div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{getChartTypeLabel(chart.type)}</span>
          {chart.runway && (
            <>
              <span>•</span>
              <span className="font-mono">RWY {chart.runway}</span>
            </>
          )}
          <span>•</span>
          <span>{getProviderLabel(chart.provider)}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpen}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Open
        </button>
        <button
          onClick={() => onDelete(chart.id)}
          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
          title="Delete chart"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN CHART VIEWER COMPONENT
// ============================================================================

export const ChartViewer: React.FC<ChartViewerProps> = ({
  airportIcao,
  runway,
}) => {
  const [showUpload, setShowUpload] = useState(false);
  const [charts, setCharts] = useState<AviationChart[]>([]);
  const [filter, setFilter] = useState<ChartType | 'ALL'>('ALL');
  
  // Load charts on mount and when airport changes
  React.useEffect(() => {
    if (!airportIcao) {
      setCharts([]);
      return;
    }
    
    const chartService = getChartService();
    const airportCharts = chartService.getChartsForAirport(airportIcao);
    setCharts(airportCharts);
  }, [airportIcao]);
  
  const handleUpload = useCallback((chart: AviationChart) => {
    setCharts(prev => [...prev, chart]);
  }, []);
  
  const handleDelete = useCallback((chartId: string) => {
    if (!confirm('Are you sure you want to delete this chart?')) return;
    
    const chartService = getChartService();
    chartService.removeChart(chartId);
    setCharts(prev => prev.filter(c => c.id !== chartId));
  }, []);
  
  // Filter charts
  const filteredCharts = filter === 'ALL' 
    ? charts 
    : charts.filter(c => c.type === filter);
  
  // Further filter by runway if specified
  const displayCharts = runway
    ? filteredCharts.filter(c => !c.runway || c.runway === runway)
    : filteredCharts;
  
  if (!airportIcao) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="text-center text-gray-500 py-8">
          <span className="text-4xl mb-4 block">📑</span>
          <p>Select an airport to view charts</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-700 flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          📑 Charts - {airportIcao}
          {runway && <span className="text-teal-200 text-sm">RWY {runway}</span>}
        </h3>
        <button
          onClick={() => setShowUpload(true)}
          className="px-3 py-1 bg-white bg-opacity-20 text-white text-sm rounded hover:bg-opacity-30 transition-colors"
        >
          + Add Chart
        </button>
      </div>
      
      {/* Filters */}
      <div className="px-4 py-2 border-b flex gap-2 overflow-x-auto">
        {(['ALL', 'AIRPORT_DIAGRAM', 'SID', 'STAR', 'APPROACH', 'TAXI'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-sm rounded whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'ALL' ? 'All' : getChartTypeLabel(f as ChartType)}
          </button>
        ))}
      </div>
      
      {/* Charts list */}
      <div className="p-4">
        {displayCharts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <span className="text-3xl mb-2 block">📄</span>
            <p className="mb-2">No charts found</p>
            <button
              onClick={() => setShowUpload(true)}
              className="text-teal-600 hover:underline text-sm"
            >
              Add your first chart
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayCharts.map(chart => (
              <ChartItem
                key={chart.id}
                chart={chart}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Upload modal */}
      {showUpload && (
        <ChartUploadModal
          airportIcao={airportIcao}
          onClose={() => setShowUpload(false)}
          onUpload={handleUpload}
        />
      )}
    </div>
  );
};

export default ChartViewer;
