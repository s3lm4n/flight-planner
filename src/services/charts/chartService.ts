/**
 * Chart Abstraction Layer
 * 
 * Provides a unified interface for managing aviation charts:
 * - Manual PDF uploads
 * - External chart links (Jeppesen, AIP, etc.)
 * - Chart metadata and categorization
 */

// ============================================================================
// TYPES
// ============================================================================

/** Chart type classification */
export type ChartType =
  | 'AIRPORT_DIAGRAM'
  | 'PARKING_CHART'
  | 'SID'
  | 'STAR'
  | 'APPROACH'
  | 'TAXI'
  | 'MINIMUM_ALTITUDE'
  | 'HOT_SPOT'
  | 'NOISE_ABATEMENT'
  | 'OTHER';

/** Chart source provider */
export type ChartProvider =
  | 'JEPPESEN'
  | 'LIDO'
  | 'EUROCONTROL'
  | 'AIP'
  | 'FAA'
  | 'CUSTOM'
  | 'MANUAL';

/** Chart data */
export interface AviationChart {
  id: string;
  airportIcao: string;
  
  // Classification
  type: ChartType;
  name: string;
  description?: string;
  
  // Applicability
  runway?: string;              // For SID/STAR/Approach charts
  procedureName?: string;       // e.g., "RNAV 09L"
  
  // Source
  provider: ChartProvider;
  source: ChartSource;
  
  // Validity
  effectiveDate?: Date;
  expirationDate?: Date;
  airacCycle?: string;          // e.g., "2412" for Dec 2024
  
  // Metadata
  pageCount?: number;
  fileSize?: number;            // bytes
  lastUpdated: Date;
}

/** Chart source - either URL or uploaded file */
export type ChartSource =
  | { type: 'url'; url: string }
  | { type: 'file'; data: string; filename: string; mimeType: string }; // Base64 data

/** Chart query filters */
export interface ChartFilters {
  airportIcao?: string;
  type?: ChartType[];
  runway?: string;
  provider?: ChartProvider[];
}

// ============================================================================
// CHART SERVICE INTERFACE
// ============================================================================

export interface IChartService {
  /**
   * Get all charts for an airport
   */
  getChartsForAirport(icao: string): AviationChart[];
  
  /**
   * Get charts by type for an airport
   */
  getChartsByType(icao: string, type: ChartType): AviationChart[];
  
  /**
   * Get approach charts for a runway
   */
  getApproachCharts(icao: string, runway: string): AviationChart[];
  
  /**
   * Get SID charts for a runway
   */
  getSIDCharts(icao: string, runway: string): AviationChart[];
  
  /**
   * Get STAR charts for a runway
   */
  getSTARCharts(icao: string, runway: string): AviationChart[];
  
  /**
   * Add a manual chart (PDF upload)
   */
  addManualChart(chart: Omit<AviationChart, 'id' | 'lastUpdated'>): AviationChart;
  
  /**
   * Add an external chart link
   */
  addExternalChart(
    icao: string,
    type: ChartType,
    name: string,
    url: string,
    options?: {
      runway?: string;
      procedureName?: string;
      provider?: ChartProvider;
    }
  ): AviationChart;
  
  /**
   * Remove a chart
   */
  removeChart(chartId: string): boolean;
  
  /**
   * Search charts
   */
  searchCharts(filters: ChartFilters): AviationChart[];
}

// ============================================================================
// CHART SERVICE IMPLEMENTATION
// ============================================================================

class ChartService implements IChartService {
  private charts: Map<string, AviationChart> = new Map();
  private chartsByAirport: Map<string, Set<string>> = new Map();
  
  constructor() {
    // Initialize with some example external links
    this.initializeDefaultCharts();
  }
  
  private initializeDefaultCharts(): void {
    // Add some example chart links for major airports
    const defaultCharts: Array<{
      icao: string;
      type: ChartType;
      name: string;
      url: string;
      provider: ChartProvider;
    }> = [
      // Turkey - Istanbul Airports
      {
        icao: 'LTFM',
        type: 'AIRPORT_DIAGRAM',
        name: 'Istanbul Airport - Airport Diagram',
        url: 'https://aim.dhmi.gov.tr/airac/charts/LTFM/AD2-LTFM-ADC.pdf',
        provider: 'AIP',
      },
      {
        icao: 'LTBA',
        type: 'AIRPORT_DIAGRAM',
        name: 'Atatürk Airport - Airport Diagram',
        url: 'https://aim.dhmi.gov.tr/airac/charts/LTBA/AD2-LTBA-ADC.pdf',
        provider: 'AIP',
      },
      {
        icao: 'LTAC',
        type: 'AIRPORT_DIAGRAM',
        name: 'Ankara Esenboğa - Airport Diagram',
        url: 'https://aim.dhmi.gov.tr/airac/charts/LTAC/AD2-LTAC-ADC.pdf',
        provider: 'AIP',
      },
      // Germany
      {
        icao: 'EDDF',
        type: 'AIRPORT_DIAGRAM',
        name: 'Frankfurt - Airport Diagram',
        url: 'https://aip.dfs.de/basicAIP/pages/AD/AD2/EDDF/ED_AD_2_EDDF_ADC.pdf',
        provider: 'AIP',
      },
      // UK
      {
        icao: 'EGLL',
        type: 'AIRPORT_DIAGRAM',
        name: 'London Heathrow - Airport Diagram',
        url: 'https://www.aurora.nats.co.uk/htmlAIP/Publications/2024-12-05-AIRAC/html/eAIP/EG-AD-2.EGLL-en-GB.html',
        provider: 'AIP',
      },
    ];
    
    for (const chart of defaultCharts) {
      this.addExternalChart(
        chart.icao,
        chart.type,
        chart.name,
        chart.url,
        { provider: chart.provider }
      );
    }
  }
  
  private generateId(): string {
    return `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getChartsForAirport(icao: string): AviationChart[] {
    const chartIds = this.chartsByAirport.get(icao.toUpperCase());
    if (!chartIds) return [];
    
    return Array.from(chartIds)
      .map(id => this.charts.get(id))
      .filter((c): c is AviationChart => c !== undefined);
  }
  
  getChartsByType(icao: string, type: ChartType): AviationChart[] {
    return this.getChartsForAirport(icao).filter(c => c.type === type);
  }
  
  getApproachCharts(icao: string, runway: string): AviationChart[] {
    return this.getChartsForAirport(icao).filter(
      c => c.type === 'APPROACH' && (!c.runway || c.runway === runway)
    );
  }
  
  getSIDCharts(icao: string, runway: string): AviationChart[] {
    return this.getChartsForAirport(icao).filter(
      c => c.type === 'SID' && (!c.runway || c.runway === runway)
    );
  }
  
  getSTARCharts(icao: string, runway: string): AviationChart[] {
    return this.getChartsForAirport(icao).filter(
      c => c.type === 'STAR' && (!c.runway || c.runway === runway)
    );
  }
  
  addManualChart(chart: Omit<AviationChart, 'id' | 'lastUpdated'>): AviationChart {
    const id = this.generateId();
    const newChart: AviationChart = {
      ...chart,
      id,
      lastUpdated: new Date(),
    };
    
    this.charts.set(id, newChart);
    
    // Index by airport
    const icao = chart.airportIcao.toUpperCase();
    if (!this.chartsByAirport.has(icao)) {
      this.chartsByAirport.set(icao, new Set());
    }
    this.chartsByAirport.get(icao)!.add(id);
    
    return newChart;
  }
  
  addExternalChart(
    icao: string,
    type: ChartType,
    name: string,
    url: string,
    options: {
      runway?: string;
      procedureName?: string;
      provider?: ChartProvider;
    } = {}
  ): AviationChart {
    return this.addManualChart({
      airportIcao: icao.toUpperCase(),
      type,
      name,
      runway: options.runway,
      procedureName: options.procedureName,
      provider: options.provider || 'CUSTOM',
      source: { type: 'url', url },
    });
  }
  
  removeChart(chartId: string): boolean {
    const chart = this.charts.get(chartId);
    if (!chart) return false;
    
    this.charts.delete(chartId);
    
    const icao = chart.airportIcao.toUpperCase();
    this.chartsByAirport.get(icao)?.delete(chartId);
    
    return true;
  }
  
  searchCharts(filters: ChartFilters): AviationChart[] {
    let results = Array.from(this.charts.values());
    
    if (filters.airportIcao) {
      results = results.filter(
        c => c.airportIcao.toUpperCase() === filters.airportIcao!.toUpperCase()
      );
    }
    
    if (filters.type && filters.type.length > 0) {
      results = results.filter(c => filters.type!.includes(c.type));
    }
    
    if (filters.runway) {
      results = results.filter(c => !c.runway || c.runway === filters.runway);
    }
    
    if (filters.provider && filters.provider.length > 0) {
      results = results.filter(c => filters.provider!.includes(c.provider));
    }
    
    return results;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let chartServiceInstance: ChartService | null = null;

export function getChartService(): IChartService {
  if (!chartServiceInstance) {
    chartServiceInstance = new ChartService();
  }
  return chartServiceInstance;
}

// ============================================================================
// REACT INTEGRATION HELPERS
// ============================================================================

/**
 * Get chart type display label
 */
export function getChartTypeLabel(type: ChartType): string {
  const labels: Record<ChartType, string> = {
    AIRPORT_DIAGRAM: 'Airport Diagram',
    PARKING_CHART: 'Parking/Docking Chart',
    SID: 'Standard Instrument Departure',
    STAR: 'Standard Terminal Arrival',
    APPROACH: 'Approach Chart',
    TAXI: 'Taxi Chart',
    MINIMUM_ALTITUDE: 'Minimum Altitude Chart',
    HOT_SPOT: 'Hot Spot Chart',
    NOISE_ABATEMENT: 'Noise Abatement',
    OTHER: 'Other',
  };
  return labels[type];
}

/**
 * Get provider display label
 */
export function getProviderLabel(provider: ChartProvider): string {
  const labels: Record<ChartProvider, string> = {
    JEPPESEN: 'Jeppesen',
    LIDO: 'Lido/Lufthansa',
    EUROCONTROL: 'EUROCONTROL',
    AIP: 'National AIP',
    FAA: 'FAA',
    CUSTOM: 'Custom Link',
    MANUAL: 'Manual Upload',
  };
  return labels[provider];
}

/**
 * Get chart icon based on type
 */
export function getChartTypeIcon(type: ChartType): string {
  const icons: Record<ChartType, string> = {
    AIRPORT_DIAGRAM: '🗺️',
    PARKING_CHART: '🅿️',
    SID: '🛫',
    STAR: '🛬',
    APPROACH: '📍',
    TAXI: '🚗',
    MINIMUM_ALTITUDE: '📏',
    HOT_SPOT: '⚠️',
    NOISE_ABATEMENT: '🔇',
    OTHER: '📄',
  };
  return icons[type];
}
