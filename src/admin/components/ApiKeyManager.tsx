/**
 * API Key Manager Component
 */

import React, { useState, useEffect } from 'react';
import { adminApi } from '../api';

interface ApiKey {
  id: string;
  key: string;
  name: string;
  createdAt: string;
  lastUsed?: string;
  permissions: string[];
  active: boolean;
}

export const ApiKeyManager: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState<ApiKey | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const keys = await adminApi.getApiKeys();
      setApiKeys(keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    setNewKeyResult(null);

    try {
      const newKey = await adminApi.createApiKey(newKeyName.trim());
      setNewKeyResult(newKey);
      setNewKeyName('');
      loadApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Delete API key "${keyName}"? This cannot be undone.`)) return;

    try {
      await adminApi.deleteApiKey(keyId);
      setApiKeys(apiKeys.filter(k => k.id !== keyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (isLoading) {
    return <div className="loading">Loading API keys...</div>;
  }

  return (
    <div className="api-key-manager">
      <header className="page-header">
        <h2>API Keys</h2>
        <p>Manage API keys for the public application</p>
      </header>

      {error && <div className="error-panel">{error}</div>}

      {/* Create New Key */}
      <div className="create-key-section">
        <h3>Create New API Key</h3>
        <form onSubmit={handleCreateKey} className="create-key-form">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production App)"
            required
          />
          <button type="submit" disabled={isCreating} className="btn-primary">
            {isCreating ? 'Creating...' : 'Create Key'}
          </button>
        </form>

        {newKeyResult && (
          <div className="new-key-result">
            <h4>🎉 New API Key Created</h4>
            <p>Copy this key now - it won't be shown again!</p>
            <div className="key-display">
              <code>{newKeyResult.key}</code>
              <button onClick={() => copyToClipboard(newKeyResult.key)} className="btn-copy">
                📋 Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Key List */}
      <div className="keys-list">
        <h3>Existing Keys ({apiKeys.length})</h3>
        
        {apiKeys.length === 0 ? (
          <p className="empty-state">No API keys yet. Create one above.</p>
        ) : (
          <table className="keys-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td><code>{key.key}</code></td>
                  <td>{new Date(key.createdAt).toLocaleDateString()}</td>
                  <td>{key.lastUsed 
                    ? new Date(key.lastUsed).toLocaleDateString() 
                    : 'Never'}
                  </td>
                  <td>
                    <span className={`status ${key.active ? 'active' : 'inactive'}`}>
                      {key.active ? '✅ Active' : '❌ Inactive'}
                    </span>
                  </td>
                  <td>
                    <button 
                      onClick={() => handleDeleteKey(key.id, key.name)}
                      className="btn-danger btn-small"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="usage-info">
        <h3>Usage</h3>
        <p>Include the API key in your requests:</p>
        <div className="code-examples">
          <div className="code-example">
            <label>Header:</label>
            <code>X-API-Key: your_api_key_here</code>
          </div>
          <div className="code-example">
            <label>Bearer Token:</label>
            <code>Authorization: Bearer your_api_key_here</code>
          </div>
        </div>
      </div>
    </div>
  );
};
