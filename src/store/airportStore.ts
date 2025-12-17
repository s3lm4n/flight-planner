/**
 * Airport Store
 * 
 * Global Zustand store for airport data with:
 * - CSV loading support
 * - Efficient indexing for fast lookups
 * - Autocomplete search
 * - Regional filtering (Europe + Turkey)
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { EnhancedAirport } from '@/types/airport';
import { 
  parseAirportsCsv, 
  loadAirportsFromFile, 
  EUROPEAN_COUNTRY_CODES 
} from '@/services/airports/csvParser';

// ============================================================================
// TYPES
// ============================================================================

interface AirportFilters {
  query?: string;
  country?: string;
  type?: EnhancedAirport['type'][];
  minRunwayLength?: number;
  hasILS?: boolean;
}

interface AirportStoreState {
  // Data
  airports: EnhancedAirport[];
  airportsByIcao: Map<string, EnhancedAirport>;
  airportsByIata: Map<string, EnhancedAirport>;
  
  // Loading state
  isLoading: boolean;
  isLoaded: boolean;
  loadError: string | null;
  
  // Metadata
  lastUpdated: Date | null;
  source: 'csv' | 'api' | 'local' | null;
  totalCount: number;
  
  // Filters
  activeFilters: AirportFilters;
  filteredAirports: EnhancedAirport[];
}

interface AirportStoreActions {
  // Loading
  loadFromCsv: (csvText: string) => Promise<void>;
  loadFromFile: (file: File) => Promise<void>;
  loadFromApi: () => Promise<void>;
  
  // Lookups
  getAirportByIcao: (icao: string) => EnhancedAirport | undefined;
  getAirportByIata: (iata: string) => EnhancedAirport | undefined;
  
  // Search
  searchAirports: (query: string, limit?: number) => EnhancedAirport[];
  setFilters: (filters: AirportFilters) => void;
  clearFilters: () => void;
  
  // Utilities
  getAirportsByCountry: (countryCode: string) => EnhancedAirport[];
  getAirportsInBounds: (bounds: { north: number; south: number; east: number; west: number }) => EnhancedAirport[];
  
  // Reset
  reset: () => void;
}

type AirportStore = AirportStoreState & AirportStoreActions;

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AirportStoreState = {
  airports: [],
  airportsByIcao: new Map(),
  airportsByIata: new Map(),
  isLoading: false,
  isLoaded: false,
  loadError: null,
  lastUpdated: null,
  source: null,
  totalCount: 0,
  activeFilters: {},
  filteredAirports: [],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build index maps from airport array
 */
function buildIndexes(airports: EnhancedAirport[]): {
  byIcao: Map<string, EnhancedAirport>;
  byIata: Map<string, EnhancedAirport>;
} {
  const byIcao = new Map<string, EnhancedAirport>();
  const byIata = new Map<string, EnhancedAirport>();
  
  for (const airport of airports) {
    byIcao.set(airport.icao.toUpperCase(), airport);
    if (airport.iata) {
      byIata.set(airport.iata.toUpperCase(), airport);
    }
  }
  
  return { byIcao, byIata };
}

/**
 * Filter airports by criteria
 */
function filterAirports(
  airports: EnhancedAirport[],
  filters: AirportFilters
): EnhancedAirport[] {
  let results = [...airports];
  
  // Query filter (ICAO, IATA, name, city)
  if (filters.query) {
    const query = filters.query.toUpperCase().trim();
    results = results.filter(airport =>
      airport.icao.toUpperCase().includes(query) ||
      airport.iata?.toUpperCase().includes(query) ||
      airport.name.toUpperCase().includes(query) ||
      airport.city.toUpperCase().includes(query)
    );
  }
  
  // Country filter
  if (filters.country) {
    const country = filters.country.toUpperCase();
    results = results.filter(airport =>
      airport.countryCode.toUpperCase() === country ||
      airport.country.toUpperCase().includes(country)
    );
  }
  
  // Type filter
  if (filters.type && filters.type.length > 0) {
    results = results.filter(airport => filters.type!.includes(airport.type));
  }
  
  // Minimum runway length filter
  if (filters.minRunwayLength) {
    results = results.filter(airport =>
      airport.runways.some(rwy => rwy.lengthMeters >= filters.minRunwayLength!)
    );
  }
  
  // ILS filter
  if (filters.hasILS) {
    results = results.filter(airport =>
      airport.runways.some(rwy => rwy.ils)
    );
  }
  
  return results;
}

/**
 * Sort airports by relevance for search
 */
function sortByRelevance(
  airports: EnhancedAirport[],
  query: string
): EnhancedAirport[] {
  const upperQuery = query.toUpperCase();
  
  return airports.sort((a, b) => {
    // Exact ICAO match first
    if (a.icao.toUpperCase() === upperQuery) return -1;
    if (b.icao.toUpperCase() === upperQuery) return 1;
    
    // Exact IATA match second
    if (a.iata?.toUpperCase() === upperQuery) return -1;
    if (b.iata?.toUpperCase() === upperQuery) return 1;
    
    // ICAO starts with query
    if (a.icao.toUpperCase().startsWith(upperQuery) && !b.icao.toUpperCase().startsWith(upperQuery)) return -1;
    if (b.icao.toUpperCase().startsWith(upperQuery) && !a.icao.toUpperCase().startsWith(upperQuery)) return 1;
    
    // Larger airports first
    const typeOrder: Record<string, number> = {
      LARGE_AIRPORT: 0,
      MEDIUM_AIRPORT: 1,
      SMALL_AIRPORT: 2,
      HELIPORT: 3,
      SEAPLANE_BASE: 4,
      CLOSED: 5,
    };
    
    const aOrder = typeOrder[a.type] ?? 5;
    const bOrder = typeOrder[b.type] ?? 5;
    
    if (aOrder !== bOrder) return aOrder - bOrder;
    
    // Alphabetically by ICAO
    return a.icao.localeCompare(b.icao);
  });
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useAirportStore = create<AirportStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      ...initialState,
      
      // Load from CSV text
      loadFromCsv: async (csvText: string) => {
        set({ isLoading: true, loadError: null });
        
        try {
          const airports = await parseAirportsCsv(csvText, {
            filterEurope: true,
            includeSmallAirports: true,
            includeClosed: false,
          });
          
          const { byIcao, byIata } = buildIndexes(airports);
          
          set({
            airports,
            airportsByIcao: byIcao,
            airportsByIata: byIata,
            filteredAirports: airports,
            isLoading: false,
            isLoaded: true,
            loadError: null,
            lastUpdated: new Date(),
            source: 'csv',
            totalCount: airports.length,
          });
          
          console.log(`✅ Loaded ${airports.length} airports from CSV`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to parse CSV';
          set({
            isLoading: false,
            loadError: message,
          });
          console.error('❌ Failed to load airports:', error);
        }
      },
      
      // Load from File object
      loadFromFile: async (file: File) => {
        set({ isLoading: true, loadError: null });
        
        try {
          const airports = await loadAirportsFromFile(file);
          const { byIcao, byIata } = buildIndexes(airports);
          
          set({
            airports,
            airportsByIcao: byIcao,
            airportsByIata: byIata,
            filteredAirports: airports,
            isLoading: false,
            isLoaded: true,
            loadError: null,
            lastUpdated: new Date(),
            source: 'csv',
            totalCount: airports.length,
          });
          
          console.log(`✅ Loaded ${airports.length} airports from file: ${file.name}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to load file';
          set({
            isLoading: false,
            loadError: message,
          });
        }
      },
      
      // Load from ICAO API (fallback)
      loadFromApi: async () => {
        set({ isLoading: true, loadError: null });
        
        try {
          // Dynamic import to avoid circular dependency
          const { fetchEuropeanAirports } = await import('@/api/icao');
          const airports = await fetchEuropeanAirports();
          const { byIcao, byIata } = buildIndexes(airports);
          
          set({
            airports,
            airportsByIcao: byIcao,
            airportsByIata: byIata,
            filteredAirports: airports,
            isLoading: false,
            isLoaded: true,
            loadError: null,
            lastUpdated: new Date(),
            source: 'api',
            totalCount: airports.length,
          });
          
          console.log(`✅ Loaded ${airports.length} airports from API`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch from API';
          set({
            isLoading: false,
            loadError: message,
          });
        }
      },
      
      // Get by ICAO code (O(1) lookup)
      getAirportByIcao: (icao: string) => {
        return get().airportsByIcao.get(icao.toUpperCase());
      },
      
      // Get by IATA code (O(1) lookup)
      getAirportByIata: (iata: string) => {
        return get().airportsByIata.get(iata.toUpperCase());
      },
      
      // Search airports with autocomplete
      searchAirports: (query: string, limit = 20) => {
        const { airports } = get();
        
        if (!query.trim()) {
          // Return top airports when no query
          return sortByRelevance(airports, '').slice(0, limit);
        }
        
        const filtered = filterAirports(airports, { query });
        const sorted = sortByRelevance(filtered, query);
        
        return sorted.slice(0, limit);
      },
      
      // Set active filters
      setFilters: (filters: AirportFilters) => {
        const { airports } = get();
        const filtered = filterAirports(airports, filters);
        
        set({
          activeFilters: filters,
          filteredAirports: sortByRelevance(filtered, filters.query || ''),
        });
      },
      
      // Clear filters
      clearFilters: () => {
        const { airports } = get();
        set({
          activeFilters: {},
          filteredAirports: airports,
        });
      },
      
      // Get airports by country
      getAirportsByCountry: (countryCode: string) => {
        return get().airports.filter(
          a => a.countryCode.toUpperCase() === countryCode.toUpperCase()
        );
      },
      
      // Get airports within geographic bounds
      getAirportsInBounds: (bounds) => {
        return get().airports.filter(airport => {
          const { lat, lon } = airport.position;
          return (
            lat >= bounds.south &&
            lat <= bounds.north &&
            lon >= bounds.west &&
            lon <= bounds.east
          );
        });
      },
      
      // Reset store
      reset: () => {
        set(initialState);
      },
    }),
    { name: 'airport-store' }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get European airport count by country
 */
export function useAirportCountByCountry() {
  const airports = useAirportStore(state => state.airports);
  
  const counts: Record<string, number> = {};
  for (const airport of airports) {
    const code = airport.countryCode || 'Unknown';
    counts[code] = (counts[code] || 0) + 1;
  }
  
  return counts;
}

/**
 * Get Turkish airports only
 */
export function useTurkishAirports() {
  const airports = useAirportStore(state => state.airports);
  return airports.filter(a => a.countryCode === 'TR');
}

/**
 * Get large airports only
 */
export function useLargeAirports() {
  const airports = useAirportStore(state => state.airports);
  return airports.filter(a => a.type === 'LARGE_AIRPORT');
}
