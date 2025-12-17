/**
 * Flight Planner Global State Store
 * 
 * Uses Zustand for state management with proper typing and actions.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Airport,
  Aircraft,
  FlightPlan,
  AirportWeather,
  AnimationState,
  RouteGeoJSON,
  RouteSegmentType,
} from '@/types';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialAnimation: AnimationState = {
  isPlaying: false,
  isPaused: false,
  progress: 0,
  currentLegIndex: 0,
  speed: 1,
};

const initialLayers: Record<RouteSegmentType, boolean> = {
  TAXI_OUT: true,
  SID: true,
  ENROUTE: true,
  STAR: true,
  APPROACH: true,
  TAXI_IN: true,
};

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface FlightStore {
  // Selection
  departureAirport: Airport | null;
  arrivalAirport: Airport | null;
  selectedAircraft: Aircraft | null;
  
  // Weather
  departureWeather: AirportWeather | null;
  arrivalWeather: AirportWeather | null;
  
  // Flight Plan
  flightPlan: FlightPlan | null;
  routeGeoJSON: RouteGeoJSON | null;
  
  // Animation
  animation: AnimationState;
  
  // Layer visibility
  layers: Record<RouteSegmentType, boolean>;
  
  // Loading states
  isLoadingWeather: boolean;
  isGeneratingPlan: boolean;
  
  // Actions - Selection
  setDepartureAirport: (airport: Airport | null) => void;
  setArrivalAirport: (airport: Airport | null) => void;
  setSelectedAircraft: (aircraft: Aircraft | null) => void;
  
  // Actions - Weather
  setDepartureWeather: (weather: AirportWeather | null) => void;
  setArrivalWeather: (weather: AirportWeather | null) => void;
  setIsLoadingWeather: (loading: boolean) => void;
  
  // Actions - Flight Plan
  setFlightPlan: (plan: FlightPlan | null) => void;
  setRouteGeoJSON: (route: RouteGeoJSON | null) => void;
  setIsGeneratingPlan: (loading: boolean) => void;
  
  // Actions - Animation
  setAnimation: (update: Partial<AnimationState>) => void;
  
  // Actions - Layers
  toggleLayer: (layer: RouteSegmentType) => void;
  setAllLayers: (visible: boolean) => void;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useFlightStore = create<FlightStore>()(
  devtools(
    (set) => ({
      // Initial state
      departureAirport: null,
      arrivalAirport: null,
      selectedAircraft: null,
      departureWeather: null,
      arrivalWeather: null,
      flightPlan: null,
      routeGeoJSON: null,
      animation: initialAnimation,
      layers: initialLayers,
      isLoadingWeather: false,
      isGeneratingPlan: false,
      
      // Selection actions
      setDepartureAirport: (airport) => set({ departureAirport: airport }),
      setArrivalAirport: (airport) => set({ arrivalAirport: airport }),
      setSelectedAircraft: (aircraft) => set({ selectedAircraft: aircraft }),
      
      // Weather actions
      setDepartureWeather: (weather) => set({ departureWeather: weather }),
      setArrivalWeather: (weather) => set({ arrivalWeather: weather }),
      setIsLoadingWeather: (loading) => set({ isLoadingWeather: loading }),
      
      // Flight plan actions
      setFlightPlan: (plan) => set({ flightPlan: plan }),
      setRouteGeoJSON: (route) => set({ routeGeoJSON: route }),
      setIsGeneratingPlan: (loading) => set({ isGeneratingPlan: loading }),
      
      // Animation actions
      setAnimation: (update) => set((state) => ({
        animation: { ...state.animation, ...update },
      })),
      
      // Layer actions
      toggleLayer: (layer) => set((state) => ({
        layers: {
          ...state.layers,
          [layer]: !state.layers[layer],
        },
      })),
      
      setAllLayers: (visible) => set({
        layers: {
          TAXI_OUT: visible,
          SID: visible,
          ENROUTE: visible,
          STAR: visible,
          APPROACH: visible,
          TAXI_IN: visible,
        },
      }),
    }),
    { name: 'flight-store' }
  )
);
