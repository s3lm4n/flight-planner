/**
 * CSV Airport Parser
 * 
 * Parses user-uploaded CSV files containing airport data.
 * 
 * IMPORTANT:
 * ==========
 * - ICAO code, latitude, longitude, elevation are the ONLY trusted fields
 * - Airport names may have broken encoding and are DISPLAY-ONLY
 * - ALL routing/dispatch logic must use ICAO + coordinates ONLY
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CSVAirport {
  icao: string;           // 4-letter ICAO code (TRUSTED)
  latitude: number;       // Decimal degrees (TRUSTED)
  longitude: number;      // Decimal degrees (TRUSTED)
  elevation: number;      // Feet MSL (TRUSTED)
  name: string;           // Display only - may have encoding issues
  iata?: string;          // 3-letter IATA code (if available)
  city?: string;          // City name (display only)
  country?: string;       // Country code/name (display only)
  type?: string;          // Airport type (large, medium, small, etc.)
}

export interface ParseResult {
  success: boolean;
  airports: CSVAirport[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
}

// ============================================================================
// COLUMN MAPPING
// ============================================================================

// Common CSV column names for each field
const COLUMN_MAPPINGS: Record<string, string[]> = {
  icao: ['icao', 'icao_code', 'ident', 'airport_ident', 'airportident'],
  latitude: ['latitude', 'lat', 'latitude_deg', 'geo_lat'],
  longitude: ['longitude', 'lon', 'long', 'longitude_deg', 'geo_lon'],
  elevation: ['elevation', 'elevation_ft', 'elev', 'alt', 'altitude'],
  name: ['name', 'airport_name', 'airportname'],
  iata: ['iata', 'iata_code'],
  city: ['city', 'municipality'],
  country: ['country', 'country_code', 'iso_country'],
  type: ['type', 'airport_type'],
};

// ============================================================================
// PARSER FUNCTIONS
// ============================================================================

/**
 * Parse a CSV string into airport records
 */
export function parseAirportCSV(csvContent: string): ParseResult {
  const result: ParseResult = {
    success: false,
    airports: [],
    errors: [],
    warnings: [],
    totalRows: 0,
    validRows: 0,
  };

  try {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length < 2) {
      result.errors.push('CSV must have at least a header row and one data row');
      return result;
    }

    // Parse header
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
    
    // Map columns to our fields
    const columnMap = mapColumns(headers);
    
    // Validate required columns exist
    if (columnMap.icao === -1) {
      result.errors.push('Missing required column: ICAO code (icao, ident, airport_ident)');
    }
    if (columnMap.latitude === -1) {
      result.errors.push('Missing required column: Latitude (latitude, lat)');
    }
    if (columnMap.longitude === -1) {
      result.errors.push('Missing required column: Longitude (longitude, lon)');
    }
    
    if (result.errors.length > 0) {
      return result;
    }

    // Parse data rows
    result.totalRows = lines.length - 1;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        const airport = parseAirportRow(values, columnMap, i + 1);
        
        if (airport) {
          result.airports.push(airport);
          result.validRows++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.warnings.push(`Row ${i + 1}: ${message}`);
      }
    }

    result.success = result.airports.length > 0;
    
    if (result.validRows < result.totalRows) {
      result.warnings.push(
        `Parsed ${result.validRows} of ${result.totalRows} rows successfully`
      );
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Failed to parse CSV: ${message}`);
  }

  return result;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Don't forget the last field
  result.push(current.trim());
  
  return result;
}

/**
 * Map CSV headers to our field indices
 */
function mapColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {
    icao: -1,
    latitude: -1,
    longitude: -1,
    elevation: -1,
    name: -1,
    iata: -1,
    city: -1,
    country: -1,
    type: -1,
  };

  for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
    for (const alias of aliases) {
      const index = headers.indexOf(alias);
      if (index !== -1) {
        map[field] = index;
        break;
      }
    }
  }

  return map;
}

/**
 * Parse a single row into an airport record
 */
function parseAirportRow(
  values: string[], 
  columnMap: Record<string, number>,
  _rowNum: number
): CSVAirport | null {
  // Extract values
  const icaoRaw = columnMap.icao >= 0 ? values[columnMap.icao] : '';
  const latRaw = columnMap.latitude >= 0 ? values[columnMap.latitude] : '';
  const lonRaw = columnMap.longitude >= 0 ? values[columnMap.longitude] : '';
  const elevRaw = columnMap.elevation >= 0 ? values[columnMap.elevation] : '0';

  // Validate ICAO code
  const icao = icaoRaw.toUpperCase().trim();
  if (!icao || icao.length !== 4) {
    throw new Error(`Invalid ICAO code: "${icaoRaw}"`);
  }
  
  // Validate ICAO format (letters and numbers only)
  if (!/^[A-Z0-9]{4}$/.test(icao)) {
    throw new Error(`Invalid ICAO format: "${icao}"`);
  }

  // Parse latitude
  const latitude = parseFloat(latRaw);
  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`Invalid latitude: "${latRaw}"`);
  }

  // Parse longitude
  const longitude = parseFloat(lonRaw);
  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude: "${lonRaw}"`);
  }

  // Parse elevation (default to 0 if missing)
  let elevation = parseFloat(elevRaw);
  if (isNaN(elevation)) {
    elevation = 0;
  }

  // Build airport record
  const airport: CSVAirport = {
    icao,
    latitude,
    longitude,
    elevation,
    name: columnMap.name >= 0 ? values[columnMap.name] || icao : icao,
    iata: columnMap.iata >= 0 ? values[columnMap.iata]?.toUpperCase() : undefined,
    city: columnMap.city >= 0 ? values[columnMap.city] : undefined,
    country: columnMap.country >= 0 ? values[columnMap.country] : undefined,
    type: columnMap.type >= 0 ? values[columnMap.type] : undefined,
  };

  return airport;
}

/**
 * Parse CSV file from a File object
 */
export async function parseAirportFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const content = event.target?.result as string;
      resolve(parseAirportCSV(content));
    };
    
    reader.onerror = () => {
      resolve({
        success: false,
        airports: [],
        errors: ['Failed to read file'],
        warnings: [],
        totalRows: 0,
        validRows: 0,
      });
    };
    
    reader.readAsText(file);
  });
}

// ============================================================================
// AIRPORT STORE/DATABASE
// ============================================================================

/**
 * In-memory airport database
 */
class AirportDatabase {
  private airports: Map<string, CSVAirport> = new Map();
  private listeners: Set<() => void> = new Set();

  /**
   * Load airports from CSV parse result
   */
  load(result: ParseResult): void {
    if (!result.success) return;
    
    this.airports.clear();
    for (const airport of result.airports) {
      this.airports.set(airport.icao, airport);
    }
    
    this.notifyListeners();
  }

  /**
   * Get airport by ICAO code
   */
  get(icao: string): CSVAirport | undefined {
    return this.airports.get(icao.toUpperCase());
  }

  /**
   * Check if airport exists
   */
  has(icao: string): boolean {
    return this.airports.has(icao.toUpperCase());
  }

  /**
   * Get all airports
   */
  getAll(): CSVAirport[] {
    return Array.from(this.airports.values());
  }

  /**
   * Search airports by ICAO prefix or name
   */
  search(query: string, limit: number = 20): CSVAirport[] {
    const q = query.toUpperCase().trim();
    if (!q) return [];

    const results: CSVAirport[] = [];
    
    for (const airport of this.airports.values()) {
      // ICAO exact match first
      if (airport.icao === q) {
        results.unshift(airport);
        continue;
      }
      
      // ICAO prefix match
      if (airport.icao.startsWith(q)) {
        results.push(airport);
        continue;
      }
      
      // Name contains (display only - not for logic)
      if (airport.name.toUpperCase().includes(q)) {
        results.push(airport);
      }
      
      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  }

  /**
   * Find airports near a coordinate
   */
  findNear(lat: number, lon: number, radiusNm: number, limit: number = 10): CSVAirport[] {
    const results: { airport: CSVAirport; distance: number }[] = [];
    
    for (const airport of this.airports.values()) {
      const distance = this.calculateDistanceNm(lat, lon, airport.latitude, airport.longitude);
      if (distance <= radiusNm) {
        results.push({ airport, distance });
      }
    }
    
    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);
    
    return results.slice(0, limit).map(r => r.airport);
  }

  /**
   * Calculate great circle distance in nautical miles
   */
  private calculateDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get count of loaded airports
   */
  get count(): number {
    return this.airports.size;
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Clear all airports
   */
  clear(): void {
    this.airports.clear();
    this.notifyListeners();
  }
}

// Export singleton instance
export const airportDB = new AirportDatabase();
