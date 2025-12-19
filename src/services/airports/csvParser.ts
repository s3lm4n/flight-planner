/**
 * Airport CSV Parser Service
 * 
 * Parses airport data from CSV files following OurAirports format.
 * Supports filtering for European and Turkish airports.
 */

import { EnhancedAirport } from '@/types/airport';
import { Coordinate } from '@/types';

// ============================================================================
// CSV COLUMN DEFINITIONS (OurAirports format)
// ============================================================================

interface CsvAirportRow {
  id: string;
  ident: string;           // ICAO code
  type: string;            // large_airport, medium_airport, small_airport, heliport, seaplane_base, closed
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  elevation_ft: string;
  continent: string;
  iso_country: string;     // Country code (e.g., "TR", "DE")
  iso_region: string;      // Region code (e.g., "TR-34")
  municipality: string;    // City
  scheduled_service: string;
  gps_code: string;
  iata_code: string;
  local_code: string;
  home_link: string;
  wikipedia_link: string;
  keywords: string;
}

// ============================================================================
// EUROPEAN & TURKISH ICAO PREFIXES
// ============================================================================

export const EUROPEAN_ICAO_PREFIXES = [
  // Western Europe
  'EG', // United Kingdom
  'EI', // Ireland
  'LF', // France
  'EB', // Belgium
  'EH', // Netherlands
  'ED', // Germany
  'LO', // Austria
  'LS', // Switzerland
  'LI', // Italy
  'LE', // Spain
  'LP', // Portugal
  'LX', // Gibraltar
  
  // Northern Europe
  'EK', // Denmark
  'EN', // Norway
  'ES', // Sweden
  'EF', // Finland
  'BI', // Iceland
  
  // Eastern Europe
  'EP', // Poland
  'LK', // Czech Republic
  'LZ', // Slovakia
  'LH', // Hungary
  'LR', // Romania
  'LB', // Bulgaria
  'LW', // North Macedonia
  'LY', // Serbia & Montenegro
  'LD', // Croatia
  'LJ', // Slovenia
  'LA', // Albania
  'LQ', // Bosnia & Herzegovina
  'LU', // Moldova
  'UK', // Ukraine
  'EY', // Lithuania
  'EV', // Latvia
  'EE', // Estonia
  'UM', // Belarus
  
  // Mediterranean
  'LG', // Greece
  'LC', // Cyprus
  'LM', // Malta
  
  // Turkey (Key requirement)
  'LT', // Turkey
];

// ============================================================================
// EUROPEAN COUNTRY CODES (ISO 3166-1 alpha-2)
// ============================================================================

export const EUROPEAN_COUNTRY_CODES = [
  // EU Members
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // Non-EU European
  'GB', 'NO', 'IS', 'CH', 'RS', 'ME', 'MK', 'AL', 'BA', 'XK',
  'MD', 'UA', 'BY',
  // Turkey (Key requirement)
  'TR',
];

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Parse CSV text into rows
 */
export function parseCsvText(csvText: string): CsvAirportRow[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];
  
  // Parse header row
  const headers = parseCSVLine(lines[0]);
  const rows: CsvAirportRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    
    rows.push(row as unknown as CsvAirportRow);
  }
  
  return rows;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

/**
 * Convert airport type from CSV to enum
 */
function parseAirportType(type: string): EnhancedAirport['type'] {
  switch (type?.toLowerCase()) {
    case 'large_airport':
      return 'LARGE_AIRPORT';
    case 'medium_airport':
      return 'MEDIUM_AIRPORT';
    case 'small_airport':
      return 'SMALL_AIRPORT';
    case 'heliport':
      return 'HELIPORT';
    case 'seaplane_base':
      return 'SEAPLANE_BASE';
    case 'closed':
      return 'CLOSED';
    default:
      return 'SMALL_AIRPORT';
  }
}

/**
 * Convert CSV row to EnhancedAirport object
 */
export function csvRowToAirport(row: CsvAirportRow): EnhancedAirport | null {
  // Skip invalid rows
  if (!row.ident || !row.latitude_deg || !row.longitude_deg) {
    return null;
  }
  
  const lat = parseFloat(row.latitude_deg);
  const lon = parseFloat(row.longitude_deg);
  
  if (isNaN(lat) || isNaN(lon)) {
    return null;
  }
  
  const position: Coordinate = { lat, lon };
  const elevation = parseFloat(row.elevation_ft) || 0;
  
  return {
    icao: row.ident.toUpperCase(),
    iata: row.iata_code || undefined,
    name: row.name || row.ident,
    city: row.municipality || '',
    region: row.iso_region || '',
    country: getCountryName(row.iso_country),
    countryCode: row.iso_country || '',
    position,
    elevation,
    magneticVariation: 0, // Would need separate declination data
    type: parseAirportType(row.type),
    timezone: 'UTC', // Would need timezone data
    runways: [], // Runways loaded separately
    lastUpdated: new Date(),
  };
}

/**
 * Get country name from ISO code
 */
function getCountryName(code: string): string {
  const countryNames: Record<string, string> = {
    'TR': 'Turkey',
    'DE': 'Germany',
    'FR': 'France',
    'GB': 'United Kingdom',
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'AT': 'Austria',
    'CH': 'Switzerland',
    'PL': 'Poland',
    'CZ': 'Czech Republic',
    'GR': 'Greece',
    'PT': 'Portugal',
    'SE': 'Sweden',
    'NO': 'Norway',
    'DK': 'Denmark',
    'FI': 'Finland',
    'IE': 'Ireland',
    'HU': 'Hungary',
    'RO': 'Romania',
    'BG': 'Bulgaria',
    'HR': 'Croatia',
    'SK': 'Slovakia',
    'SI': 'Slovenia',
    'LV': 'Latvia',
    'LT': 'Lithuania',
    'EE': 'Estonia',
    'CY': 'Cyprus',
    'MT': 'Malta',
    'LU': 'Luxembourg',
    'IS': 'Iceland',
    'RS': 'Serbia',
    'BA': 'Bosnia and Herzegovina',
    'ME': 'Montenegro',
    'MK': 'North Macedonia',
    'AL': 'Albania',
    'UA': 'Ukraine',
    'MD': 'Moldova',
    'BY': 'Belarus',
    'XK': 'Kosovo',
  };
  
  return countryNames[code?.toUpperCase()] || code || 'Unknown';
}

/**
 * Filter airports to European + Turkey region
 */
export function filterEuropeanAirports(airports: EnhancedAirport[]): EnhancedAirport[] {
  return airports.filter(airport => {
    // Check by ICAO prefix
    const prefix = airport.icao.substring(0, 2);
    if (EUROPEAN_ICAO_PREFIXES.includes(prefix)) {
      return true;
    }
    
    // Check by country code
    if (EUROPEAN_COUNTRY_CODES.includes(airport.countryCode)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Filter out closed airports and those without useful infrastructure
 */
export function filterOperationalAirports(airports: EnhancedAirport[]): EnhancedAirport[] {
  return airports.filter(airport => {
    // Exclude closed airports
    if (airport.type === 'CLOSED') {
      return false;
    }
    
    // Include all other types
    return true;
  });
}

/**
 * Parse airports from CSV and filter for Europe + Turkey
 */
export async function parseAirportsCsv(
  csvText: string,
  options: {
    filterEurope?: boolean;
    includeSmallAirports?: boolean;
    includeClosed?: boolean;
  } = {}
): Promise<EnhancedAirport[]> {
  const {
    filterEurope = true,
    includeSmallAirports = true,
    includeClosed = false,
  } = options;
  
  // Parse CSV
  const rows = parseCsvText(csvText);
  
  // Convert to airport objects
  let airports = rows
    .map(csvRowToAirport)
    .filter((a): a is EnhancedAirport => a !== null);
  
  // Apply filters
  if (filterEurope) {
    airports = filterEuropeanAirports(airports);
  }
  
  if (!includeClosed) {
    airports = filterOperationalAirports(airports);
  }
  
  if (!includeSmallAirports) {
    airports = airports.filter(a => 
      a.type === 'LARGE_AIRPORT' || a.type === 'MEDIUM_AIRPORT'
    );
  }
  
  return airports;
}

/**
 * Load airports from a CSV file
 */
export async function loadAirportsFromFile(file: File): Promise<EnhancedAirport[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const csvText = event.target?.result as string;
        const airports = await parseAirportsCsv(csvText);
        resolve(airports);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Load airports from a URL
 */
export async function loadAirportsFromUrl(url: string): Promise<EnhancedAirport[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const csvText = await response.text();
    return parseAirportsCsv(csvText);
  } catch (error) {
    console.error('Failed to load airports from URL:', error);
    throw error;
  }
}
