/**
 * Airport Database
 * 
 * MOCK DATA NOTICE:
 * This file contains realistic airport data that follows real-world conventions.
 * Coordinates, elevations, and magnetic variations are accurate.
 * Runway dimensions and frequencies are realistic but may not match current published data.
 * 
 * TO REPLACE WITH REAL DATA:
 * 1. Subscribe to an AIRAC data provider (Jeppesen, Lido, Navigraph)
 * 2. Parse ARINC 424 format or use provider's API
 * 3. Replace this file's exports with parsed real data
 * 4. Update data monthly with each AIRAC cycle
 */

import { Airport } from '@/types';

/**
 * Major airports database
 * Contains detailed data for route planning
 */
export const airports: Record<string, Airport> = {
  // ============================================================================
  // UNITED STATES
  // ============================================================================
  
  KJFK: {
    icao: 'KJFK',
    iata: 'JFK',
    name: 'John F. Kennedy International Airport',
    city: 'New York',
    country: 'United States',
    position: { lat: 40.6413, lon: -73.7781 },
    elevation: 13,
    magneticVariation: -13.0,
    timezone: 'America/New_York',
    runways: [
      {
        id: '04L/22R',
        length: 11351,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '04L',
            heading: 44,
            threshold: { lat: 40.6297, lon: -73.7889 },
            elevation: 12,
            tora: 11351,
            toda: 11351,
            asda: 11351,
            lda: 11351,
            ils: { frequency: 110.9, course: 44, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '22R',
            heading: 224,
            threshold: { lat: 40.6524, lon: -73.7631 },
            elevation: 13,
            tora: 11351,
            toda: 11351,
            asda: 11351,
            lda: 11351,
            ils: { frequency: 111.5, course: 224, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '04R/22L',
        length: 8400,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '04R',
            heading: 44,
            threshold: { lat: 40.6250, lon: -73.7756 },
            elevation: 11,
            tora: 8400,
            toda: 8400,
            asda: 8400,
            lda: 8400
          },
          {
            designator: '22L',
            heading: 224,
            threshold: { lat: 40.6430, lon: -73.7550 },
            elevation: 12,
            tora: 8400,
            toda: 8400,
            asda: 8400,
            lda: 8400,
            ils: { frequency: 108.9, course: 224, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '13L/31R',
        length: 10000,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '13L',
            heading: 134,
            threshold: { lat: 40.6561, lon: -73.7939 },
            elevation: 13,
            tora: 10000,
            toda: 10000,
            asda: 10000,
            lda: 10000,
            ils: { frequency: 111.1, course: 134, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '31R',
            heading: 314,
            threshold: { lat: 40.6363, lon: -73.7661 },
            elevation: 12,
            tora: 10000,
            toda: 10000,
            asda: 10000,
            lda: 10000,
            ils: { frequency: 109.5, course: 314, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '13R/31L',
        length: 14511,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '13R',
            heading: 134,
            threshold: { lat: 40.6653, lon: -73.8025 },
            elevation: 13,
            tora: 14511,
            toda: 14511,
            asda: 14511,
            lda: 14511,
            ils: { frequency: 109.1, course: 134, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '31L',
            heading: 314,
            threshold: { lat: 40.6325, lon: -73.7500 },
            elevation: 11,
            tora: 14511,
            toda: 14511,
            asda: 14511,
            lda: 14511,
            ils: { frequency: 110.3, course: 314, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      }
    ],
    parking: [
      { name: 'A1', position: { lat: 40.6450, lon: -73.7850 }, heading: 90, type: 'GATE', size: 'H' },
      { name: 'A2', position: { lat: 40.6452, lon: -73.7845 }, heading: 90, type: 'GATE', size: 'H' },
      { name: 'B1', position: { lat: 40.6440, lon: -73.7830 }, heading: 180, type: 'GATE', size: 'L' },
      { name: 'B2', position: { lat: 40.6438, lon: -73.7825 }, heading: 180, type: 'GATE', size: 'L' },
    ],
    taxiways: [
      { name: 'A', path: [{ lat: 40.6450, lon: -73.7850 }, { lat: 40.6440, lon: -73.7800 }], width: 75, surface: 'ASPH' },
      { name: 'B', path: [{ lat: 40.6440, lon: -73.7800 }, { lat: 40.6400, lon: -73.7750 }], width: 75, surface: 'ASPH' },
      { name: 'C', path: [{ lat: 40.6400, lon: -73.7750 }, { lat: 40.6350, lon: -73.7700 }], width: 75, surface: 'ASPH' },
    ],
    frequencies: {
      atis: 128.725,
      ground: 121.9,
      tower: 119.1,
      approach: 132.4,
      departure: 135.9,
      center: 128.55
    }
  },

  KLAX: {
    icao: 'KLAX',
    iata: 'LAX',
    name: 'Los Angeles International Airport',
    city: 'Los Angeles',
    country: 'United States',
    position: { lat: 33.9425, lon: -118.4081 },
    elevation: 128,
    magneticVariation: 12.5,
    timezone: 'America/Los_Angeles',
    runways: [
      {
        id: '06L/24R',
        length: 8926,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '06L',
            heading: 69,
            threshold: { lat: 33.9469, lon: -118.4319 },
            elevation: 126,
            tora: 8926,
            toda: 8926,
            asda: 8926,
            lda: 8926,
            ils: { frequency: 108.5, course: 69, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '24R',
            heading: 249,
            threshold: { lat: 33.9368, lon: -118.4060 },
            elevation: 120,
            tora: 8926,
            toda: 8926,
            asda: 8926,
            lda: 8926,
            ils: { frequency: 111.7, course: 249, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '06R/24L',
        length: 10285,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '06R',
            heading: 69,
            threshold: { lat: 33.9436, lon: -118.4336 },
            elevation: 126,
            tora: 10285,
            toda: 10285,
            asda: 10285,
            lda: 10285,
            ils: { frequency: 109.9, course: 69, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '24L',
            heading: 249,
            threshold: { lat: 33.9311, lon: -118.4019 },
            elevation: 116,
            tora: 10285,
            toda: 10285,
            asda: 10285,
            lda: 10285,
            ils: { frequency: 109.5, course: 249, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '07L/25R',
        length: 12091,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '07L',
            heading: 69,
            threshold: { lat: 33.9356, lon: -118.4256 },
            elevation: 126,
            tora: 12091,
            toda: 12091,
            asda: 12091,
            lda: 12091,
            ils: { frequency: 110.7, course: 69, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '25R',
            heading: 249,
            threshold: { lat: 33.9217, lon: -118.3858 },
            elevation: 120,
            tora: 12091,
            toda: 12091,
            asda: 12091,
            lda: 12091,
            ils: { frequency: 110.9, course: 249, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '07R/25L',
        length: 11096,
        width: 200,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '07R',
            heading: 69,
            threshold: { lat: 33.9314, lon: -118.4219 },
            elevation: 126,
            tora: 11096,
            toda: 11096,
            asda: 11096,
            lda: 11096,
            ils: { frequency: 108.5, course: 69, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '25L',
            heading: 249,
            threshold: { lat: 33.9189, lon: -118.3856 },
            elevation: 120,
            tora: 11096,
            toda: 11096,
            asda: 11096,
            lda: 11096,
            ils: { frequency: 110.3, course: 249, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      }
    ],
    parking: [
      { name: 'T4-41', position: { lat: 33.9550, lon: -118.4030 }, heading: 270, type: 'GATE', size: 'H' },
      { name: 'T5-51', position: { lat: 33.9540, lon: -118.4020 }, heading: 270, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'AA', path: [{ lat: 33.9450, lon: -118.4100 }, { lat: 33.9420, lon: -118.4050 }], width: 75, surface: 'ASPH' },
      { name: 'BB', path: [{ lat: 33.9420, lon: -118.4050 }, { lat: 33.9380, lon: -118.4000 }], width: 75, surface: 'ASPH' },
    ],
    frequencies: {
      atis: 133.8,
      ground: 121.65,
      tower: 133.9,
      approach: 124.5,
      departure: 124.3,
      center: 134.65
    }
  },

  KORD: {
    icao: 'KORD',
    iata: 'ORD',
    name: "O'Hare International Airport",
    city: 'Chicago',
    country: 'United States',
    position: { lat: 41.9742, lon: -87.9073 },
    elevation: 672,
    magneticVariation: -3.0,
    timezone: 'America/Chicago',
    runways: [
      {
        id: '10L/28R',
        length: 13000,
        width: 200,
        surface: 'CONC',
        lighting: true,
        ends: [
          {
            designator: '10L',
            heading: 99,
            threshold: { lat: 41.9839, lon: -87.9381 },
            elevation: 672,
            tora: 13000,
            toda: 13000,
            asda: 13000,
            lda: 13000,
            ils: { frequency: 110.1, course: 99, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '28R',
            heading: 279,
            threshold: { lat: 41.9758, lon: -87.8886 },
            elevation: 670,
            tora: 13000,
            toda: 13000,
            asda: 13000,
            lda: 13000,
            ils: { frequency: 109.7, course: 279, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '10R/28L',
        length: 10801,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '10R',
            heading: 99,
            threshold: { lat: 41.9756, lon: -87.9286 },
            elevation: 673,
            tora: 10801,
            toda: 10801,
            asda: 10801,
            lda: 10801,
            ils: { frequency: 110.9, course: 99, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '28L',
            heading: 279,
            threshold: { lat: 41.9686, lon: -87.8869 },
            elevation: 671,
            tora: 10801,
            toda: 10801,
            asda: 10801,
            lda: 10801,
            ils: { frequency: 111.3, course: 279, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      }
    ],
    parking: [
      { name: 'C10', position: { lat: 41.9750, lon: -87.9050 }, heading: 180, type: 'GATE', size: 'H' },
      { name: 'C12', position: { lat: 41.9752, lon: -87.9045 }, heading: 180, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'A', path: [{ lat: 41.9750, lon: -87.9100 }, { lat: 41.9720, lon: -87.9050 }], width: 75, surface: 'CONC' },
      { name: 'B', path: [{ lat: 41.9720, lon: -87.9050 }, { lat: 41.9690, lon: -87.9000 }], width: 75, surface: 'CONC' },
    ],
    frequencies: {
      atis: 135.4,
      ground: 121.67,
      tower: 126.9,
      approach: 124.35,
      departure: 125.0,
      center: 133.0
    }
  },

  // ============================================================================
  // EUROPE
  // ============================================================================

  EGLL: {
    icao: 'EGLL',
    iata: 'LHR',
    name: 'Heathrow Airport',
    city: 'London',
    country: 'United Kingdom',
    position: { lat: 51.4700, lon: -0.4543 },
    elevation: 83,
    magneticVariation: -0.5,
    timezone: 'Europe/London',
    runways: [
      {
        id: '09L/27R',
        length: 12799,
        width: 164,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '09L',
            heading: 92,
            threshold: { lat: 51.4775, lon: -0.4875 },
            elevation: 79,
            tora: 12799,
            toda: 12799,
            asda: 12799,
            lda: 12799,
            ils: { frequency: 109.5, course: 92, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '27R',
            heading: 272,
            threshold: { lat: 51.4714, lon: -0.4336 },
            elevation: 77,
            tora: 12799,
            toda: 12799,
            asda: 12799,
            lda: 12799,
            ils: { frequency: 110.3, course: 272, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '09R/27L',
        length: 12001,
        width: 164,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '09R',
            heading: 92,
            threshold: { lat: 51.4642, lon: -0.4836 },
            elevation: 79,
            tora: 12001,
            toda: 12001,
            asda: 12001,
            lda: 12001,
            ils: { frequency: 110.9, course: 92, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '27L',
            heading: 272,
            threshold: { lat: 51.4589, lon: -0.4325 },
            elevation: 77,
            tora: 12001,
            toda: 12001,
            asda: 12001,
            lda: 12001,
            ils: { frequency: 109.1, course: 272, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      }
    ],
    parking: [
      { name: 'T5-A1', position: { lat: 51.4722, lon: -0.4869 }, heading: 90, type: 'GATE', size: 'H' },
      { name: 'T5-A2', position: { lat: 51.4720, lon: -0.4865 }, heading: 90, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'Links', path: [{ lat: 51.4750, lon: -0.4700 }, { lat: 51.4720, lon: -0.4650 }], width: 75, surface: 'ASPH' },
    ],
    frequencies: {
      atis: 113.75,
      ground: 121.7,
      tower: 118.5,
      approach: 119.72,
      departure: 118.82,
      center: 126.07
    }
  },

  LFPG: {
    icao: 'LFPG',
    iata: 'CDG',
    name: 'Charles de Gaulle Airport',
    city: 'Paris',
    country: 'France',
    position: { lat: 49.0097, lon: 2.5479 },
    elevation: 392,
    magneticVariation: -1.0,
    timezone: 'Europe/Paris',
    runways: [
      {
        id: '08L/26R',
        length: 13829,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '08L',
            heading: 85,
            threshold: { lat: 49.0236, lon: 2.5028 },
            elevation: 387,
            tora: 13829,
            toda: 13829,
            asda: 13829,
            lda: 13829,
            ils: { frequency: 110.3, course: 85, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '26R',
            heading: 265,
            threshold: { lat: 49.0167, lon: 2.5933 },
            elevation: 385,
            tora: 13829,
            toda: 13829,
            asda: 13829,
            lda: 13829,
            ils: { frequency: 109.5, course: 265, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '08R/26L',
        length: 8858,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '08R',
            heading: 85,
            threshold: { lat: 49.0131, lon: 2.5167 },
            elevation: 390,
            tora: 8858,
            toda: 8858,
            asda: 8858,
            lda: 8858,
            ils: { frequency: 110.9, course: 85, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '26L',
            heading: 265,
            threshold: { lat: 49.0075, lon: 2.5750 },
            elevation: 387,
            tora: 8858,
            toda: 8858,
            asda: 8858,
            lda: 8858,
            ils: { frequency: 108.7, course: 265, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '09L/27R',
        length: 8858,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '09L',
            heading: 92,
            threshold: { lat: 49.0019, lon: 2.5222 },
            elevation: 394,
            tora: 8858,
            toda: 8858,
            asda: 8858,
            lda: 8858,
            ils: { frequency: 111.7, course: 92, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '27R',
            heading: 272,
            threshold: { lat: 48.9961, lon: 2.5806 },
            elevation: 391,
            tora: 8858,
            toda: 8858,
            asda: 8858,
            lda: 8858,
            ils: { frequency: 109.9, course: 272, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '09R/27L',
        length: 13829,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '09R',
            heading: 92,
            threshold: { lat: 48.9914, lon: 2.5083 },
            elevation: 398,
            tora: 13829,
            toda: 13829,
            asda: 13829,
            lda: 13829,
            ils: { frequency: 108.5, course: 92, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '27L',
            heading: 272,
            threshold: { lat: 48.9844, lon: 2.5989 },
            elevation: 393,
            tora: 13829,
            toda: 13829,
            asda: 13829,
            lda: 13829,
            ils: { frequency: 111.1, course: 272, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      }
    ],
    parking: [
      { name: '2E-K55', position: { lat: 49.0050, lon: 2.5700 }, heading: 270, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'Y', path: [{ lat: 49.0100, lon: 2.5600 }, { lat: 49.0080, lon: 2.5550 }], width: 75, surface: 'ASPH' },
    ],
    frequencies: {
      atis: 127.25,
      ground: 121.6,
      tower: 119.25,
      approach: 126.43,
      departure: 127.75,
      center: 132.77
    }
  },

  EDDF: {
    icao: 'EDDF',
    iata: 'FRA',
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    country: 'Germany',
    position: { lat: 50.0264, lon: 8.5431 },
    elevation: 364,
    magneticVariation: 1.5,
    timezone: 'Europe/Berlin',
    runways: [
      {
        id: '07L/25R',
        length: 13123,
        width: 148,
        surface: 'CONC',
        lighting: true,
        ends: [
          {
            designator: '07L',
            heading: 72,
            threshold: { lat: 50.0333, lon: 8.4917 },
            elevation: 364,
            tora: 13123,
            toda: 13123,
            asda: 13123,
            lda: 13123,
            ils: { frequency: 111.3, course: 72, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '25R',
            heading: 252,
            threshold: { lat: 50.0222, lon: 8.5944 },
            elevation: 360,
            tora: 13123,
            toda: 13123,
            asda: 13123,
            lda: 13123,
            ils: { frequency: 110.1, course: 252, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '07R/25L',
        length: 13123,
        width: 148,
        surface: 'CONC',
        lighting: true,
        ends: [
          {
            designator: '07R',
            heading: 72,
            threshold: { lat: 50.0153, lon: 8.4972 },
            elevation: 365,
            tora: 13123,
            toda: 13123,
            asda: 13123,
            lda: 13123,
            ils: { frequency: 110.3, course: 72, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '25L',
            heading: 252,
            threshold: { lat: 50.0042, lon: 8.6000 },
            elevation: 361,
            tora: 13123,
            toda: 13123,
            asda: 13123,
            lda: 13123,
            ils: { frequency: 109.7, course: 252, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '18/36',
        length: 13123,
        width: 148,
        surface: 'CONC',
        lighting: true,
        ends: [
          {
            designator: '18',
            heading: 180,
            threshold: { lat: 50.0550, lon: 8.5347 },
            elevation: 362,
            tora: 13123,
            toda: 13123,
            asda: 13123,
            lda: 13123,
            ils: { frequency: 111.5, course: 180, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '36',
            heading: 360,
            threshold: { lat: 50.0167, lon: 8.5347 },
            elevation: 365,
            tora: 13123,
            toda: 13123,
            asda: 13123,
            lda: 13123
          }
        ]
      }
    ],
    parking: [
      { name: 'A1', position: { lat: 50.0500, lon: 8.5700 }, heading: 180, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'N', path: [{ lat: 50.0300, lon: 8.5500 }, { lat: 50.0280, lon: 8.5450 }], width: 75, surface: 'CONC' },
    ],
    frequencies: {
      atis: 118.02,
      ground: 121.8,
      tower: 119.9,
      approach: 120.8,
      departure: 120.15,
      center: 128.3
    }
  },

  // ============================================================================
  // TURKEY
  // ============================================================================

  LTFM: {
    icao: 'LTFM',
    iata: 'IST',
    name: 'Istanbul Airport',
    city: 'Istanbul',
    country: 'Turkey',
    position: { lat: 41.2753, lon: 28.7519 },
    elevation: 325,
    magneticVariation: 5.5,
    timezone: 'Europe/Istanbul',
    runways: [
      {
        id: '16L/34R',
        length: 13451,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '16L',
            heading: 160,
            threshold: { lat: 41.2953, lon: 28.7389 },
            elevation: 320,
            tora: 13451,
            toda: 13451,
            asda: 13451,
            lda: 13451,
            ils: { frequency: 109.5, course: 160, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '34R',
            heading: 340,
            threshold: { lat: 41.2556, lon: 28.7639 },
            elevation: 323,
            tora: 13451,
            toda: 13451,
            asda: 13451,
            lda: 13451,
            ils: { frequency: 110.9, course: 340, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '16R/34L',
        length: 13451,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '16R',
            heading: 160,
            threshold: { lat: 41.2967, lon: 28.7556 },
            elevation: 318,
            tora: 13451,
            toda: 13451,
            asda: 13451,
            lda: 13451,
            ils: { frequency: 110.3, course: 160, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '34L',
            heading: 340,
            threshold: { lat: 41.2569, lon: 28.7806 },
            elevation: 322,
            tora: 13451,
            toda: 13451,
            asda: 13451,
            lda: 13451,
            ils: { frequency: 111.1, course: 340, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '17L/35R',
        length: 13451,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '17L',
            heading: 170,
            threshold: { lat: 41.2875, lon: 28.7183 },
            elevation: 326,
            tora: 13451,
            toda: 13451,
            asda: 13451,
            lda: 13451,
            ils: { frequency: 108.7, course: 170, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '35R',
            heading: 350,
            threshold: { lat: 41.2478, lon: 28.7306 },
            elevation: 330,
            tora: 13451,
            toda: 13451,
            asda: 13451,
            lda: 13451,
            ils: { frequency: 109.1, course: 350, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      }
    ],
    parking: [
      { name: 'A1', position: { lat: 41.2700, lon: 28.7500 }, heading: 90, type: 'GATE', size: 'H' },
      { name: 'A2', position: { lat: 41.2702, lon: 28.7505 }, heading: 90, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'A', path: [{ lat: 41.2700, lon: 28.7500 }, { lat: 41.2680, lon: 28.7450 }], width: 75, surface: 'ASPH' },
      { name: 'B', path: [{ lat: 41.2680, lon: 28.7450 }, { lat: 41.2650, lon: 28.7400 }], width: 75, surface: 'ASPH' },
    ],
    frequencies: {
      atis: 128.2,
      ground: 121.7,
      tower: 118.1,
      approach: 120.7,
      departure: 128.05,
      center: 126.9
    }
  },

  LTBA: {
    icao: 'LTBA',
    iata: 'ISL',
    name: 'Atatürk International Airport',
    city: 'Istanbul',
    country: 'Turkey',
    position: { lat: 40.9769, lon: 28.8146 },
    elevation: 163,
    magneticVariation: 5.5,
    timezone: 'Europe/Istanbul',
    runways: [
      {
        id: '05/23',
        length: 9842,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '05',
            heading: 53,
            threshold: { lat: 40.9694, lon: 28.7972 },
            elevation: 161,
            tora: 9842,
            toda: 9842,
            asda: 9842,
            lda: 9842,
            ils: { frequency: 110.3, course: 53, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '23',
            heading: 233,
            threshold: { lat: 40.9844, lon: 28.8319 },
            elevation: 157,
            tora: 9842,
            toda: 9842,
            asda: 9842,
            lda: 9842,
            ils: { frequency: 109.9, course: 233, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '17L/35R',
        length: 9843,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '17L',
            heading: 175,
            threshold: { lat: 40.9917, lon: 28.8083 },
            elevation: 158,
            tora: 9843,
            toda: 9843,
            asda: 9843,
            lda: 9843,
            ils: { frequency: 111.7, course: 175, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '35R',
            heading: 355,
            threshold: { lat: 40.9625, lon: 28.8139 },
            elevation: 163,
            tora: 9843,
            toda: 9843,
            asda: 9843,
            lda: 9843,
            ils: { frequency: 110.7, course: 355, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '17R/35L',
        length: 9843,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '17R',
            heading: 175,
            threshold: { lat: 40.9903, lon: 28.8256 },
            elevation: 155,
            tora: 9843,
            toda: 9843,
            asda: 9843,
            lda: 9843,
            ils: { frequency: 109.3, course: 175, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '35L',
            heading: 355,
            threshold: { lat: 40.9611, lon: 28.8311 },
            elevation: 161,
            tora: 9843,
            toda: 9843,
            asda: 9843,
            lda: 9843,
            ils: { frequency: 108.9, course: 355, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      }
    ],
    parking: [
      { name: 'D1', position: { lat: 40.9780, lon: 28.8150 }, heading: 180, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'A', path: [{ lat: 40.9780, lon: 28.8150 }, { lat: 40.9760, lon: 28.8100 }], width: 75, surface: 'ASPH' },
    ],
    frequencies: {
      atis: 128.4,
      ground: 121.9,
      tower: 118.3,
      approach: 124.05,
      departure: 125.9,
      center: 126.9
    }
  },

  LTCN: {
    icao: 'LTCN',
    iata: 'KCM',
    name: 'Kahramanmaraş Airport',
    city: 'Kahramanmaraş',
    country: 'Turkey',
    position: { lat: 37.5388, lon: 36.9535 },
    elevation: 1723,
    magneticVariation: 5.0,
    timezone: 'Europe/Istanbul',
    runways: [
      {
        id: '04/22',
        length: 9843,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '04',
            heading: 40,
            threshold: { lat: 37.5320, lon: 36.9430 },
            elevation: 1720,
            tora: 9843,
            toda: 9843,
            asda: 9843,
            lda: 9843
          },
          {
            designator: '22',
            heading: 220,
            threshold: { lat: 37.5456, lon: 36.9640 },
            elevation: 1726,
            tora: 9843,
            toda: 9843,
            asda: 9843,
            lda: 9843
          }
        ]
      }
    ],
    parking: [
      { name: 'APRON1', position: { lat: 37.5390, lon: 36.9540 }, heading: 90, type: 'RAMP', size: 'M' },
    ],
    taxiways: [
      { name: 'A', path: [{ lat: 37.5390, lon: 36.9540 }, { lat: 37.5380, lon: 36.9520 }], width: 60, surface: 'ASPH' },
    ],
    frequencies: {
      tower: 118.1,
      approach: 119.7,
      center: 128.8
    }
  },

  LTBU: {
    icao: 'LTBU',
    iata: 'TEQ',
    name: 'Tekirdağ Çorlu Airport',
    city: 'Tekirdağ',
    country: 'Turkey',
    position: { lat: 41.1382, lon: 27.9191 },
    elevation: 574,
    magneticVariation: 5.5,
    timezone: 'Europe/Istanbul',
    runways: [
      {
        id: '08/26',
        length: 9843,
        width: 148,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '08',
            heading: 80,
            threshold: { lat: 41.1350, lon: 27.8983 },
            elevation: 570,
            tora: 9843,
            toda: 9843,
            asda: 9843,
            lda: 9843,
            ils: { frequency: 110.1, course: 80, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '26',
            heading: 260,
            threshold: { lat: 41.1414, lon: 27.9400 },
            elevation: 578,
            tora: 9843,
            toda: 9843,
            asda: 9843,
            lda: 9843,
            ils: { frequency: 108.7, course: 260, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      }
    ],
    parking: [
      { name: 'APRON1', position: { lat: 41.1390, lon: 27.9200 }, heading: 90, type: 'RAMP', size: 'M' },
    ],
    taxiways: [
      { name: 'A', path: [{ lat: 41.1390, lon: 27.9200 }, { lat: 41.1380, lon: 27.9150 }], width: 60, surface: 'ASPH' },
    ],
    frequencies: {
      tower: 118.5,
      approach: 120.1,
      center: 126.9
    }
  },
  
  // ============================================================================
  // ASIA
  // ============================================================================
  
  VHHH: {
    icao: 'VHHH',
    iata: 'HKG',
    name: 'Hong Kong International Airport',
    city: 'Hong Kong',
    country: 'China',
    position: { lat: 22.3080, lon: 113.9185 },
    elevation: 28,
    magneticVariation: -2.5,
    timezone: 'Asia/Hong_Kong',
    runways: [
      {
        id: '07L/25R',
        length: 12467,
        width: 200,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '07L',
            heading: 73,
            threshold: { lat: 22.3153, lon: 113.8889 },
            elevation: 22,
            tora: 12467,
            toda: 12467,
            asda: 12467,
            lda: 12467,
            ils: { frequency: 110.9, course: 73, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '25R',
            heading: 253,
            threshold: { lat: 22.3042, lon: 113.9481 },
            elevation: 18,
            tora: 12467,
            toda: 12467,
            asda: 12467,
            lda: 12467,
            ils: { frequency: 109.7, course: 253, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '07R/25L',
        length: 12467,
        width: 200,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '07R',
            heading: 73,
            threshold: { lat: 22.2986, lon: 113.8917 },
            elevation: 24,
            tora: 12467,
            toda: 12467,
            asda: 12467,
            lda: 12467,
            ils: { frequency: 111.1, course: 73, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '25L',
            heading: 253,
            threshold: { lat: 22.2875, lon: 113.9508 },
            elevation: 20,
            tora: 12467,
            toda: 12467,
            asda: 12467,
            lda: 12467,
            ils: { frequency: 108.5, course: 253, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      }
    ],
    parking: [
      { name: 'T1-1', position: { lat: 22.3100, lon: 113.9200 }, heading: 270, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'A', path: [{ lat: 22.3100, lon: 113.9200 }, { lat: 22.3080, lon: 113.9150 }], width: 75, surface: 'ASPH' },
    ],
    frequencies: {
      atis: 128.2,
      ground: 121.6,
      tower: 118.4,
      approach: 119.1,
      departure: 123.95,
      center: 132.8
    }
  },

  RJTT: {
    icao: 'RJTT',
    iata: 'HND',
    name: 'Tokyo Haneda Airport',
    city: 'Tokyo',
    country: 'Japan',
    position: { lat: 35.5494, lon: 139.7798 },
    elevation: 21,
    magneticVariation: -7.5,
    timezone: 'Asia/Tokyo',
    runways: [
      {
        id: '04/22',
        length: 9840,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '04',
            heading: 41,
            threshold: { lat: 35.5361, lon: 139.7653 },
            elevation: 21,
            tora: 9840,
            toda: 9840,
            asda: 9840,
            lda: 9840,
            ils: { frequency: 110.1, course: 41, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '22',
            heading: 221,
            threshold: { lat: 35.5606, lon: 139.7917 },
            elevation: 18,
            tora: 9840,
            toda: 9840,
            asda: 9840,
            lda: 9840,
            ils: { frequency: 111.7, course: 221, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '16L/34R',
        length: 11024,
        width: 200,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '16L',
            heading: 164,
            threshold: { lat: 35.5636, lon: 139.7689 },
            elevation: 19,
            tora: 11024,
            toda: 11024,
            asda: 11024,
            lda: 11024,
            ils: { frequency: 109.5, course: 164, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '34R',
            heading: 344,
            threshold: { lat: 35.5331, lon: 139.7758 },
            elevation: 21,
            tora: 11024,
            toda: 11024,
            asda: 11024,
            lda: 11024,
            ils: { frequency: 108.5, course: 344, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '16R/34L',
        length: 9840,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '16R',
            heading: 164,
            threshold: { lat: 35.5628, lon: 139.7886 },
            elevation: 16,
            tora: 9840,
            toda: 9840,
            asda: 9840,
            lda: 9840,
            ils: { frequency: 110.9, course: 164, glideslope: 3.0, categoryType: 'I' }
          },
          {
            designator: '34L',
            heading: 344,
            threshold: { lat: 35.5347, lon: 139.7953 },
            elevation: 18,
            tora: 9840,
            toda: 9840,
            asda: 9840,
            lda: 9840,
            ils: { frequency: 111.3, course: 344, glideslope: 3.0, categoryType: 'I' }
          }
        ]
      },
      {
        id: '05/23',
        length: 8200,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '05',
            heading: 53,
            threshold: { lat: 35.5472, lon: 139.7997 },
            elevation: 15,
            tora: 8200,
            toda: 8200,
            asda: 8200,
            lda: 8200
          },
          {
            designator: '23',
            heading: 233,
            threshold: { lat: 35.5592, lon: 139.8208 },
            elevation: 12,
            tora: 8200,
            toda: 8200,
            asda: 8200,
            lda: 8200
          }
        ]
      }
    ],
    parking: [
      { name: '18', position: { lat: 35.5500, lon: 139.7800 }, heading: 90, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'A', path: [{ lat: 35.5500, lon: 139.7800 }, { lat: 35.5480, lon: 139.7750 }], width: 75, surface: 'ASPH' },
    ],
    frequencies: {
      atis: 128.8,
      ground: 121.7,
      tower: 118.1,
      approach: 119.1,
      departure: 126.0,
      center: 125.7
    }
  },

  // ============================================================================
  // MIDDLE EAST
  // ============================================================================

  OMDB: {
    icao: 'OMDB',
    iata: 'DXB',
    name: 'Dubai International Airport',
    city: 'Dubai',
    country: 'United Arab Emirates',
    position: { lat: 25.2528, lon: 55.3644 },
    elevation: 62,
    magneticVariation: 2.0,
    timezone: 'Asia/Dubai',
    runways: [
      {
        id: '12L/30R',
        length: 13123,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '12L',
            heading: 119,
            threshold: { lat: 25.2664, lon: 55.3303 },
            elevation: 55,
            tora: 13123,
            toda: 13123,
            asda: 13123,
            lda: 13123,
            ils: { frequency: 110.1, course: 119, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '30R',
            heading: 299,
            threshold: { lat: 25.2397, lon: 55.3992 },
            elevation: 58,
            tora: 13123,
            toda: 13123,
            asda: 13123,
            lda: 13123,
            ils: { frequency: 109.5, course: 299, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      },
      {
        id: '12R/30L',
        length: 14764,
        width: 150,
        surface: 'ASPH',
        lighting: true,
        ends: [
          {
            designator: '12R',
            heading: 119,
            threshold: { lat: 25.2578, lon: 55.3147 },
            elevation: 58,
            tora: 14764,
            toda: 14764,
            asda: 14764,
            lda: 14764,
            ils: { frequency: 111.3, course: 119, glideslope: 3.0, categoryType: 'III' }
          },
          {
            designator: '30L',
            heading: 299,
            threshold: { lat: 25.2269, lon: 55.3947 },
            elevation: 62,
            tora: 14764,
            toda: 14764,
            asda: 14764,
            lda: 14764,
            ils: { frequency: 110.7, course: 299, glideslope: 3.0, categoryType: 'III' }
          }
        ]
      }
    ],
    parking: [
      { name: 'T3-A1', position: { lat: 25.2550, lon: 55.3650 }, heading: 180, type: 'GATE', size: 'H' },
    ],
    taxiways: [
      { name: 'K', path: [{ lat: 25.2550, lon: 55.3650 }, { lat: 25.2530, lon: 55.3600 }], width: 75, surface: 'ASPH' },
    ],
    frequencies: {
      atis: 126.45,
      ground: 118.35,
      tower: 118.75,
      approach: 124.45,
      departure: 121.35,
      center: 132.45
    }
  }
};

/**
 * Get airport by ICAO code
 */
export function getAirport(icao: string): Airport | undefined {
  return airports[icao.toUpperCase()];
}

/**
 * Search airports by partial ICAO or name
 */
export function searchAirports(query: string, limit = 10): Airport[] {
  const upperQuery = query.toUpperCase();
  const results: Airport[] = [];
  
  for (const airport of Object.values(airports)) {
    if (
      airport.icao.includes(upperQuery) ||
      airport.name.toUpperCase().includes(upperQuery) ||
      airport.city.toUpperCase().includes(upperQuery) ||
      (airport.iata && airport.iata.includes(upperQuery))
    ) {
      results.push(airport);
      if (results.length >= limit) break;
    }
  }
  
  return results;
}

/**
 * Get list of all airport ICAO codes
 */
export function getAllAirportIcaos(): string[] {
  return Object.keys(airports);
}

/**
 * Get all airports
 */
export function getAllAirports(): Airport[] {
  return Object.values(airports);
}

/**
 * Get nearby airports within radius (nautical miles)
 */
export function getNearbyAirports(
  position: { lat: number; lon: number },
  radiusNm: number
): Airport[] {
  // Using simplified great circle distance approximation
  const results: Airport[] = [];
  
  for (const airport of Object.values(airports)) {
    const dLat = Math.abs(airport.position.lat - position.lat);
    const dLon = Math.abs(airport.position.lon - position.lon);
    
    // Quick rough filter (1 degree ≈ 60nm at equator)
    if (dLat > radiusNm / 60 || dLon > radiusNm / 40) continue;
    
    // Haversine formula for actual distance
    const R = 3440.065; // Earth radius in nautical miles
    const lat1 = position.lat * Math.PI / 180;
    const lat2 = airport.position.lat * Math.PI / 180;
    const dLatRad = dLat * Math.PI / 180;
    const dLonRad = dLon * Math.PI / 180;
    
    const a = 
      Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLonRad / 2) * Math.sin(dLonRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    if (distance <= radiusNm) {
      results.push(airport);
    }
  }
  
  return results;
}
