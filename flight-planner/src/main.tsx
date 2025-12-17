/**
 * Application Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
// Use App for now (AppEnhanced has the enhanced features but needs more work)
import App from './App';
import './styles/index.css';

// Render the application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
