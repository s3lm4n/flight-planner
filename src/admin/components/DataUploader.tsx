/**
 * Data Uploader Component
 */

import React, { useState, useRef } from 'react';
import { adminApi } from '../api';

type DataType = 'airports' | 'notams';

export const DataUploader: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dataType, setDataType] = useState<DataType>('airports');
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setResult(null);

    try {
      const response = await adminApi.uploadCSV(selectedFile, dataType);
      setResult({
        success: true,
        message: response.message + (response.errors?.length 
          ? ` (${response.errors.length} warnings)` 
          : ''),
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = async (type: 'airports' | 'notams' | 'all') => {
    if (!confirm(`Are you sure you want to clear ${type} data?`)) return;

    try {
      await adminApi.clearData(type);
      setResult({ success: true, message: `${type} data cleared` });
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to clear data',
      });
    }
  };

  return (
    <div className="data-uploader">
      <header className="page-header">
        <h2>Upload Data</h2>
        <p>Import CSV files for airports, NOTAMs, and more</p>
      </header>

      <div className="upload-section">
        <div className="upload-form">
          <div className="form-group">
            <label>Data Type</label>
            <select 
              value={dataType} 
              onChange={(e) => setDataType(e.target.value as DataType)}
            >
              <option value="airports">Airports</option>
              <option value="notams">NOTAMs</option>
            </select>
          </div>

          <div className="form-group">
            <label>CSV File</label>
            <div className="file-input-wrapper">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <span className="file-name">{selectedFile.name}</span>
              )}
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="btn-primary"
          >
            {isUploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>

        {result && (
          <div className={`result-message ${result.success ? 'success' : 'error'}`}>
            {result.success ? '✅' : '❌'} {result.message}
          </div>
        )}
      </div>

      <div className="format-info">
        <h3>Expected CSV Formats</h3>
        
        <div className="format-card">
          <h4>Airports</h4>
          <code>icao,iata,name,city,country,lat,lon,elevation,type</code>
          <p>Required: icao, lat, lon, country</p>
        </div>

        <div className="format-card">
          <h4>NOTAMs</h4>
          <code>id,icao,text,effective_from,effective_to,type</code>
          <p>Required: id, icao, text</p>
        </div>
      </div>

      <div className="danger-zone">
        <h3>⚠️ Danger Zone</h3>
        <p>Clear stored data. This action cannot be undone.</p>
        <div className="danger-buttons">
          <button onClick={() => handleClear('airports')} className="btn-danger">
            Clear Airports
          </button>
          <button onClick={() => handleClear('notams')} className="btn-danger">
            Clear NOTAMs
          </button>
          <button onClick={() => handleClear('all')} className="btn-danger">
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
};
