/**
 * Flight Planner Application Entry Point
 * 
 * Main entry that renders the FS2024-style EFB Flight Planner.
 * 
 * FEATURES:
 * - Dispatch engine with feasibility checks
 * - Phase-based flight simulation
 * - METAR/TAF weather integration
 * - Fuel planning and weight calculations
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// Main EFB Application
import { EFBApp } from './components/EFBApp';

import './styles/index.css';

// Render the application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EFBApp />
  </React.StrictMode>
);
