/**
 * Data Viewer Component
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';

type ViewType = 'airports' | 'notams';

export const DataViewer: React.FC = () => {
  const [viewType, setViewType] = useState<ViewType>('airports');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [viewType]);

  const loadData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = viewType === 'airports' 
        ? await adminApi.getAirports()
        : await adminApi.getNotams();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return JSON.stringify(item).toLowerCase().includes(search);
  });

  const displayedData = filteredData.slice(0, 100);

  return (
    <div className="data-viewer">
      <header className="page-header">
        <h2>View Data</h2>
        <p>Browse stored airports and NOTAMs</p>
      </header>

      <div className="viewer-controls">
        <div className="tabs">
          <button 
            className={`tab ${viewType === 'airports' ? 'active' : ''}`}
            onClick={() => setViewType('airports')}
          >
            🛫 Airports ({viewType === 'airports' ? data.length : '...'})
          </button>
          <button 
            className={`tab ${viewType === 'notams' ? 'active' : ''}`}
            onClick={() => setViewType('notams')}
          >
            📋 NOTAMs ({viewType === 'notams' ? data.length : '...'})
          </button>
        </div>

        <div className="search-bar">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
          />
          <button onClick={loadData} className="btn-secondary">
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && <div className="error-panel">{error}</div>}

      {isLoading ? (
        <div className="loading">Loading data...</div>
      ) : (
        <div className="data-table-container">
          {filteredData.length === 0 ? (
            <p className="empty-state">
              {data.length === 0 
                ? 'No data available. Upload a CSV file first.'
                : 'No results match your search.'}
            </p>
          ) : (
            <>
              <p className="results-info">
                Showing {displayedData.length} of {filteredData.length} records
                {filteredData.length !== data.length && ` (${data.length} total)`}
              </p>

              {viewType === 'airports' ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ICAO</th>
                      <th>IATA</th>
                      <th>Name</th>
                      <th>City</th>
                      <th>Country</th>
                      <th>Lat</th>
                      <th>Lon</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedData.map((airport, idx) => (
                      <tr key={airport.icao || idx}>
                        <td><strong>{airport.icao}</strong></td>
                        <td>{airport.iata || '-'}</td>
                        <td>{airport.name}</td>
                        <td>{airport.city || '-'}</td>
                        <td>{airport.country}</td>
                        <td>{airport.lat?.toFixed(4)}</td>
                        <td>{airport.lon?.toFixed(4)}</td>
                        <td>{airport.type || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>ICAO</th>
                      <th>Type</th>
                      <th>Text</th>
                      <th>Effective From</th>
                      <th>Effective To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedData.map((notam, idx) => (
                      <tr key={notam.id || idx}>
                        <td>{notam.id}</td>
                        <td><strong>{notam.icao}</strong></td>
                        <td>{notam.type}</td>
                        <td className="text-cell">{notam.text?.substring(0, 100)}...</td>
                        <td>{new Date(notam.effectiveFrom).toLocaleDateString()}</td>
                        <td>{notam.effectiveTo 
                          ? new Date(notam.effectiveTo).toLocaleDateString() 
                          : 'Permanent'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
