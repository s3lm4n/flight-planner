/**
 * CSV Parser Service
 * Parses CSV files for airports, ICAO codes, NOTAMs, etc.
 */

import { Airport, Notam, ParseResult } from './types';

/**
 * Generic CSV parser
 */
export function parseCSV<T>(
  csvContent: string,
  mapper: (row: Record<string, string>, index: number) => T | null,
  options: {
    delimiter?: string;
    skipHeader?: boolean;
    trimValues?: boolean;
  } = {}
): ParseResult<T> {
  const { delimiter = ',', skipHeader = true, trimValues = true } = options;
  const errors: string[] = [];
  const data: T[] = [];
  
  try {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length === 0) {
      return { success: false, errors: ['Empty CSV file'] };
    }
    
    // Parse header
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine, delimiter).map(h => 
      trimValues ? h.trim().toLowerCase().replace(/\s+/g, '_') : h
    );
    
    // Parse rows
    const startIndex = skipHeader ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i], delimiter);
        
        if (values.length !== headers.length) {
          errors.push(`Row ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
          continue;
        }
        
        // Create row object
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = trimValues ? values[index].trim() : values[index];
        });
        
        // Map to target type
        const mapped = mapper(row, i);
        if (mapped) {
          data.push(mapped);
        }
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
      }
    }
    
    return {
      success: true,
      data,
      errors: errors.length > 0 ? errors : undefined,
      rowCount: data.length,
    };
  } catch (error) {
    return {
      success: false,
      errors: [`CSV parse error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Parse single CSV line (handles quoted values)
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Parse airports CSV
 * Expected columns: icao, iata, name, city, country, lat, lon, elevation, type
 */
export function parseAirportsCSV(csvContent: string): ParseResult<Airport> {
  return parseCSV<Airport>(csvContent, (row) => {
    const icao = row.icao || row.icao_code || row.ident;
    const lat = parseFloat(row.lat || row.latitude || row.latitude_deg || '0');
    const lon = parseFloat(row.lon || row.longitude || row.longitude_deg || '0');
    
    if (!icao || isNaN(lat) || isNaN(lon)) {
      return null;
    }
    
    return {
      icao: icao.toUpperCase(),
      iata: row.iata || row.iata_code || undefined,
      name: row.name || row.airport_name || 'Unknown',
      city: row.city || row.municipality || undefined,
      country: row.country || row.iso_country || row.country_code || 'XX',
      lat,
      lon,
      elevation: row.elevation ? parseFloat(row.elevation) : undefined,
      type: row.type || row.airport_type || undefined,
    };
  });
}

/**
 * Parse NOTAMs CSV
 * Expected columns: id, icao, text, effective_from, effective_to, type
 */
export function parseNotamsCSV(csvContent: string): ParseResult<Notam> {
  return parseCSV<Notam>(csvContent, (row) => {
    const id = row.id || row.notam_id;
    const icao = row.icao || row.icao_code || row.location;
    const text = row.text || row.message || row.content;
    
    if (!id || !icao || !text) {
      return null;
    }
    
    return {
      id,
      icao: icao.toUpperCase(),
      text,
      effectiveFrom: row.effective_from || row.start_date || new Date().toISOString(),
      effectiveTo: row.effective_to || row.end_date || undefined,
      type: row.type || row.notam_type || 'NOTAM',
    };
  });
}

/**
 * Parse generic key-value CSV
 */
export function parseKeyValueCSV(csvContent: string): ParseResult<{ key: string; value: string }> {
  return parseCSV(csvContent, (row) => {
    const key = row.key || row.code || row.id;
    const value = row.value || row.name || row.description;
    
    if (!key) return null;
    
    return { key, value: value || '' };
  });
}

/**
 * Detect CSV type based on headers
 */
export function detectCSVType(csvContent: string): 'airports' | 'notams' | 'icao' | 'unknown' {
  const firstLine = csvContent.split(/\r?\n/)[0]?.toLowerCase() || '';
  
  if (firstLine.includes('icao') && (firstLine.includes('lat') || firstLine.includes('latitude'))) {
    return 'airports';
  }
  
  if (firstLine.includes('notam') || (firstLine.includes('icao') && firstLine.includes('text'))) {
    return 'notams';
  }
  
  if (firstLine.includes('code') || firstLine.includes('icao')) {
    return 'icao';
  }
  
  return 'unknown';
}
