/**
 * Dashboard Component
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';

interface Stats {
  airports: number;
  notams: number;
  apiKeys: number;
  activeApiKeys: number;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await adminApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error-panel">{error}</div>;
  }

  return (
    <div className="dashboard">
      <header className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your flight planner data</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🛫</div>
          <div className="stat-content">
            <h3>{stats?.airports.toLocaleString() || 0}</h3>
            <p>Airports</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{stats?.notams.toLocaleString() || 0}</h3>
            <p>NOTAMs</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔑</div>
          <div className="stat-content">
            <h3>{stats?.apiKeys || 0}</h3>
            <p>API Keys</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{stats?.activeApiKeys || 0}</h3>
            <p>Active Keys</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button onClick={() => window.location.hash = 'upload'} className="action-btn">
            📤 Upload Data
          </button>
          <button onClick={() => window.location.hash = 'keys'} className="action-btn">
            🔑 Manage API Keys
          </button>
          <button onClick={loadStats} className="action-btn secondary">
            🔄 Refresh Stats
          </button>
        </div>
      </div>

      <div className="info-panel">
        <h3>API Endpoints</h3>
        <div className="endpoint-list">
          <code>GET /api/airports</code>
          <code>GET /api/airports/:icao</code>
          <code>GET /api/notams</code>
          <code>GET /api/search?q=...</code>
          <code>POST /api/route</code>
        </div>
      </div>
    </div>
  );
};
