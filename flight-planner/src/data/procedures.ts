/**
 * Flight Procedures Database (SID, STAR, Approach)
 * 
 * MOCK DATA NOTICE:
 * This file contains SIMULATED procedure data that follows real aviation conventions.
 * Waypoint positions are realistic but DO NOT represent actual published procedures.
 * These are for demonstration and development purposes only.
 * 
 * TO REPLACE WITH REAL DATA:
 * 1. Subscribe to an AIRAC data provider (Jeppesen, Lido, Navigraph)
 * 2. Parse ARINC 424 format data
 * 3. Import real procedure databases (CIFP files)
 * 4. Update monthly with each AIRAC cycle (28-day cycle)
 * 
 * NAMING CONVENTIONS USED:
 * - SIDs: Usually named after a prominent fix + numeric identifier (e.g., RNAV1)
 * - STARs: Named after arrival fix + numeric (e.g., LENDY5)
 * - Approaches: Type + Runway (e.g., ILS13L)
 */

import { SID, STAR, Approach, ProcedureWaypoint, Coordinate } from '@/types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createWaypoint(
  id: string,
  position: Coordinate,
  options: Partial<Omit<ProcedureWaypoint, 'id' | 'position'>> = {}
): ProcedureWaypoint {
  return {
    id,
    name: id,
    type: options.type || 'FIX',
    position,
    flyOver: options.flyOver || false,
    ...options
  };
}

// ============================================================================
// KJFK PROCEDURES (NEW YORK JFK)
// ============================================================================

export const KJFK_SIDS: SID[] = [
  {
    id: 'RNAV1_KJFK',
    name: 'RNAV1 DEPARTURE',
    airportIcao: 'KJFK',
    runways: ['13L', '13R', '22L', '22R', '31L', '31R'],
    commonRoute: [
      createWaypoint('KJFK', { lat: 40.6413, lon: -73.7781 }, { type: 'AIRPORT' }),
      createWaypoint('SKORR', { lat: 40.5892, lon: -73.7500 }, { 
        altitudeConstraint: { type: 'above', altitude: 500 }
      }),
      createWaypoint('HAPIE', { lat: 40.5450, lon: -73.7200 }, { 
        altitudeConstraint: { type: 'above', altitude: 2000 }
      }),
      createWaypoint('MERIT', { lat: 40.4917, lon: -73.6833 }, { 
        altitudeConstraint: { type: 'above', altitude: 3000 }
      }),
      createWaypoint('GREKO', { lat: 40.4333, lon: -73.6333 }, {
        altitudeConstraint: { type: 'above', altitude: 4000 },
        speedConstraint: { type: 'max', speed: 250 }
      })
    ],
    transitions: [
      {
        name: 'WAVEY',
        waypoints: [
          createWaypoint('GREKO', { lat: 40.4333, lon: -73.6333 }),
          createWaypoint('SHIPP', { lat: 40.3667, lon: -73.5500 }),
          createWaypoint('WAVEY', { lat: 40.2833, lon: -73.4500 }, {
            altitudeConstraint: { type: 'above', altitude: 6000 }
          })
        ]
      },
      {
        name: 'COATE',
        waypoints: [
          createWaypoint('GREKO', { lat: 40.4333, lon: -73.6333 }),
          createWaypoint('NEION', { lat: 40.5000, lon: -73.5000 }),
          createWaypoint('COATE', { lat: 40.6000, lon: -73.3333 }, {
            altitudeConstraint: { type: 'above', altitude: 8000 }
          })
        ]
      }
    ],
    remarks: 'MOCK DATA - For simulation only'
  },
  {
    id: 'DEEZZ5_KJFK',
    name: 'DEEZZ FIVE DEPARTURE',
    airportIcao: 'KJFK',
    runways: ['04L', '04R'],
    commonRoute: [
      createWaypoint('KJFK', { lat: 40.6413, lon: -73.7781 }, { type: 'AIRPORT' }),
      createWaypoint('DEEZZ', { lat: 40.7167, lon: -73.8500 }, { 
        altitudeConstraint: { type: 'above', altitude: 1500 }
      }),
      createWaypoint('HAARP', { lat: 40.7833, lon: -73.9167 }, { 
        altitudeConstraint: { type: 'above', altitude: 2500 }
      }),
      createWaypoint('ELIOT', { lat: 40.8500, lon: -73.9833 }, {
        altitudeConstraint: { type: 'above', altitude: 4000 },
        speedConstraint: { type: 'max', speed: 250 }
      })
    ],
    transitions: [
      {
        name: 'GAYEL',
        waypoints: [
          createWaypoint('ELIOT', { lat: 40.8500, lon: -73.9833 }),
          createWaypoint('HAREM', { lat: 40.9333, lon: -74.0500 }),
          createWaypoint('GAYEL', { lat: 41.0167, lon: -74.1167 }, {
            altitudeConstraint: { type: 'above', altitude: 7000 }
          })
        ]
      }
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

export const KJFK_STARS: STAR[] = [
  {
    id: 'LENDY5_KJFK',
    name: 'LENDY FIVE ARRIVAL',
    airportIcao: 'KJFK',
    runways: ['13L', '13R', '22L', '22R'],
    transitions: [
      {
        name: 'MERIT',
        waypoints: [
          createWaypoint('MERIT', { lat: 40.4917, lon: -73.6833 }),
          createWaypoint('ROBER', { lat: 40.5333, lon: -73.7167 }),
          createWaypoint('LENDY', { lat: 40.5750, lon: -73.7500 }, {
            altitudeConstraint: { type: 'at', altitude: 11000 },
            speedConstraint: { type: 'max', speed: 280 }
          })
        ]
      },
      {
        name: 'COATE',
        waypoints: [
          createWaypoint('COATE', { lat: 40.6000, lon: -73.3333 }),
          createWaypoint('BETTE', { lat: 40.5833, lon: -73.5000 }),
          createWaypoint('LENDY', { lat: 40.5750, lon: -73.7500 }, {
            altitudeConstraint: { type: 'at', altitude: 11000 },
            speedConstraint: { type: 'max', speed: 280 }
          })
        ]
      }
    ],
    commonRoute: [
      createWaypoint('LENDY', { lat: 40.5750, lon: -73.7500 }),
      createWaypoint('CAMRN', { lat: 40.6000, lon: -73.7667 }, {
        altitudeConstraint: { type: 'at', altitude: 8000 },
        speedConstraint: { type: 'max', speed: 250 }
      }),
      createWaypoint('ZALPO', { lat: 40.6250, lon: -73.7833 }, {
        altitudeConstraint: { type: 'at', altitude: 5000 }
      }),
      createWaypoint('MEALS', { lat: 40.6500, lon: -73.8000 }, {
        altitudeConstraint: { type: 'at', altitude: 3000 }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  },
  {
    id: 'PARCH4_KJFK',
    name: 'PARCH FOUR ARRIVAL',
    airportIcao: 'KJFK',
    runways: ['31L', '31R', '04L', '04R'],
    transitions: [
      {
        name: 'DIXIE',
        waypoints: [
          createWaypoint('DIXIE', { lat: 39.9000, lon: -74.2667 }),
          createWaypoint('HOGGS', { lat: 40.1167, lon: -74.1167 }),
          createWaypoint('PARCH', { lat: 40.3333, lon: -73.9667 }, {
            altitudeConstraint: { type: 'at', altitude: 13000 },
            speedConstraint: { type: 'max', speed: 280 }
          })
        ]
      }
    ],
    commonRoute: [
      createWaypoint('PARCH', { lat: 40.3333, lon: -73.9667 }),
      createWaypoint('RVSEE', { lat: 40.4333, lon: -73.9000 }, {
        altitudeConstraint: { type: 'at', altitude: 10000 },
        speedConstraint: { type: 'max', speed: 250 }
      }),
      createWaypoint('ANNEY', { lat: 40.5333, lon: -73.8333 }, {
        altitudeConstraint: { type: 'at', altitude: 6000 }
      }),
      createWaypoint('BNDRR', { lat: 40.6000, lon: -73.7833 }, {
        altitudeConstraint: { type: 'at', altitude: 3000 }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

export const KJFK_APPROACHES: Approach[] = [
  {
    id: 'ILS13L_KJFK',
    name: 'ILS OR LOC RWY 13L',
    type: 'ILS',
    airportIcao: 'KJFK',
    runway: '13L',
    finalApproachCourse: 134,
    minimums: {
      da: 200,
      visibility: 0.5
    },
    transitions: [
      {
        name: 'MEALS',
        waypoints: [
          createWaypoint('MEALS', { lat: 40.6500, lon: -73.8000 }, {
            altitudeConstraint: { type: 'at', altitude: 3000 }
          }),
          createWaypoint('ZALPO', { lat: 40.6617, lon: -73.8100 }, {
            altitudeConstraint: { type: 'at', altitude: 2500 }
          }),
          createWaypoint('ROSLY', { lat: 40.6733, lon: -73.8200 }, {
            altitudeConstraint: { type: 'at', altitude: 2000 }
          })
        ]
      }
    ],
    finalApproach: [
      createWaypoint('ROSLY', { lat: 40.6733, lon: -73.8200 }, {
        altitudeConstraint: { type: 'at', altitude: 2000 }
      }),
      createWaypoint('ZALPO', { lat: 40.6617, lon: -73.8050 }, {
        altitudeConstraint: { type: 'at', altitude: 1800 }
      }),
      createWaypoint('RW13L', { lat: 40.6561, lon: -73.7939 }, { 
        type: 'RUNWAY',
        altitudeConstraint: { type: 'at', altitude: 13 }
      })
    ],
    missedApproach: [
      createWaypoint('RW13L', { lat: 40.6561, lon: -73.7939 }, { type: 'RUNWAY' }),
      createWaypoint('CATOD', { lat: 40.6400, lon: -73.7600 }, {
        altitudeConstraint: { type: 'above', altitude: 2000 }
      }),
      createWaypoint('SPENZ', { lat: 40.6200, lon: -73.7300 }, {
        altitudeConstraint: { type: 'at', altitude: 3000 },
        holdingPattern: {
          inboundCourse: 310,
          turnDirection: 'R',
          legTime: 1
        }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  },
  {
    id: 'ILS31R_KJFK',
    name: 'ILS OR LOC RWY 31R',
    type: 'ILS',
    airportIcao: 'KJFK',
    runway: '31R',
    finalApproachCourse: 314,
    minimums: {
      da: 200,
      visibility: 0.5
    },
    transitions: [
      {
        name: 'BNDRR',
        waypoints: [
          createWaypoint('BNDRR', { lat: 40.6000, lon: -73.7833 }, {
            altitudeConstraint: { type: 'at', altitude: 3000 }
          }),
          createWaypoint('JASSE', { lat: 40.6150, lon: -73.7700 }, {
            altitudeConstraint: { type: 'at', altitude: 2500 }
          })
        ]
      }
    ],
    finalApproach: [
      createWaypoint('JASSE', { lat: 40.6150, lon: -73.7700 }, {
        altitudeConstraint: { type: 'at', altitude: 2500 }
      }),
      createWaypoint('KRSTL', { lat: 40.6250, lon: -73.7600 }, {
        altitudeConstraint: { type: 'at', altitude: 1800 }
      }),
      createWaypoint('RW31R', { lat: 40.6363, lon: -73.7661 }, { 
        type: 'RUNWAY',
        altitudeConstraint: { type: 'at', altitude: 12 }
      })
    ],
    missedApproach: [
      createWaypoint('RW31R', { lat: 40.6363, lon: -73.7661 }, { type: 'RUNWAY' }),
      createWaypoint('GLDER', { lat: 40.6600, lon: -73.7900 }, {
        altitudeConstraint: { type: 'above', altitude: 2000 }
      }),
      createWaypoint('MANNE', { lat: 40.7000, lon: -73.8300 }, {
        altitudeConstraint: { type: 'at', altitude: 3000 },
        holdingPattern: {
          inboundCourse: 134,
          turnDirection: 'L',
          legTime: 1
        }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

// ============================================================================
// KLAX PROCEDURES (LOS ANGELES)
// ============================================================================

export const KLAX_SIDS: SID[] = [
  {
    id: 'ORCKA2_KLAX',
    name: 'ORCKA TWO DEPARTURE',
    airportIcao: 'KLAX',
    runways: ['24L', '24R', '25L', '25R'],
    commonRoute: [
      createWaypoint('KLAX', { lat: 33.9425, lon: -118.4081 }, { type: 'AIRPORT' }),
      createWaypoint('DAISY', { lat: 33.9617, lon: -118.4583 }, { 
        altitudeConstraint: { type: 'above', altitude: 500 }
      }),
      createWaypoint('HEFTY', { lat: 33.9833, lon: -118.5167 }, { 
        altitudeConstraint: { type: 'above', altitude: 3000 }
      }),
      createWaypoint('ORCKA', { lat: 34.0333, lon: -118.6000 }, {
        altitudeConstraint: { type: 'above', altitude: 6000 },
        speedConstraint: { type: 'max', speed: 250 }
      })
    ],
    transitions: [
      {
        name: 'LAXX',
        waypoints: [
          createWaypoint('ORCKA', { lat: 34.0333, lon: -118.6000 }),
          createWaypoint('TOAKS', { lat: 34.1167, lon: -118.7333 }),
          createWaypoint('LAXX', { lat: 34.2167, lon: -118.8833 }, {
            altitudeConstraint: { type: 'above', altitude: 10000 }
          })
        ]
      },
      {
        name: 'VNY',
        waypoints: [
          createWaypoint('ORCKA', { lat: 34.0333, lon: -118.6000 }),
          createWaypoint('SEAVU', { lat: 34.1000, lon: -118.5333 }),
          createWaypoint('VNY', { lat: 34.2097, lon: -118.4897 }, { 
            type: 'VOR',
            altitudeConstraint: { type: 'above', altitude: 8000 }
          })
        ]
      }
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

export const KLAX_STARS: STAR[] = [
  {
    id: 'RIIVR2_KLAX',
    name: 'RIIVR TWO ARRIVAL',
    airportIcao: 'KLAX',
    runways: ['24L', '24R', '25L', '25R'],
    transitions: [
      {
        name: 'BOGET',
        waypoints: [
          createWaypoint('BOGET', { lat: 34.5500, lon: -118.0500 }),
          createWaypoint('GRAMM', { lat: 34.4000, lon: -118.1500 }),
          createWaypoint('RIIVR', { lat: 34.2500, lon: -118.2500 }, {
            altitudeConstraint: { type: 'at', altitude: 12000 },
            speedConstraint: { type: 'max', speed: 280 }
          })
        ]
      }
    ],
    commonRoute: [
      createWaypoint('RIIVR', { lat: 34.2500, lon: -118.2500 }),
      createWaypoint('SILEX', { lat: 34.1500, lon: -118.3000 }, {
        altitudeConstraint: { type: 'at', altitude: 9000 },
        speedConstraint: { type: 'max', speed: 250 }
      }),
      createWaypoint('GADDO', { lat: 34.0500, lon: -118.3500 }, {
        altitudeConstraint: { type: 'at', altitude: 6000 }
      }),
      createWaypoint('JETSA', { lat: 33.9700, lon: -118.3800 }, {
        altitudeConstraint: { type: 'at', altitude: 4000 }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

export const KLAX_APPROACHES: Approach[] = [
  {
    id: 'ILS24R_KLAX',
    name: 'ILS OR LOC RWY 24R',
    type: 'ILS',
    airportIcao: 'KLAX',
    runway: '24R',
    finalApproachCourse: 249,
    minimums: {
      da: 195,
      visibility: 0.5
    },
    transitions: [
      {
        name: 'JETSA',
        waypoints: [
          createWaypoint('JETSA', { lat: 33.9700, lon: -118.3800 }, {
            altitudeConstraint: { type: 'at', altitude: 4000 }
          }),
          createWaypoint('EBONE', { lat: 33.9550, lon: -118.3900 }, {
            altitudeConstraint: { type: 'at', altitude: 3000 }
          })
        ]
      }
    ],
    finalApproach: [
      createWaypoint('EBONE', { lat: 33.9550, lon: -118.3900 }, {
        altitudeConstraint: { type: 'at', altitude: 3000 }
      }),
      createWaypoint('FUELR', { lat: 33.9450, lon: -118.4000 }, {
        altitudeConstraint: { type: 'at', altitude: 2200 }
      }),
      createWaypoint('RW24R', { lat: 33.9368, lon: -118.4060 }, { 
        type: 'RUNWAY',
        altitudeConstraint: { type: 'at', altitude: 120 }
      })
    ],
    missedApproach: [
      createWaypoint('RW24R', { lat: 33.9368, lon: -118.4060 }, { type: 'RUNWAY' }),
      createWaypoint('RAFFS', { lat: 33.9200, lon: -118.4200 }, {
        altitudeConstraint: { type: 'above', altitude: 2000 }
      }),
      createWaypoint('HADLY', { lat: 33.8800, lon: -118.4500 }, {
        altitudeConstraint: { type: 'at', altitude: 3000 },
        holdingPattern: {
          inboundCourse: 69,
          turnDirection: 'R',
          legTime: 1
        }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

// ============================================================================
// EGLL PROCEDURES (LONDON HEATHROW)
// ============================================================================

export const EGLL_SIDS: SID[] = [
  {
    id: 'WOBUN3G_EGLL',
    name: 'WOBUN THREE GOLF DEPARTURE',
    airportIcao: 'EGLL',
    runways: ['27L', '27R'],
    commonRoute: [
      createWaypoint('EGLL', { lat: 51.4700, lon: -0.4543 }, { type: 'AIRPORT' }),
      createWaypoint('UMLAT', { lat: 51.4950, lon: -0.5200 }, { 
        altitudeConstraint: { type: 'above', altitude: 3000 }
      }),
      createWaypoint('DETLN', { lat: 51.5300, lon: -0.6000 }, { 
        altitudeConstraint: { type: 'above', altitude: 4000 }
      }),
      createWaypoint('WOBUN', { lat: 51.5800, lon: -0.7000 }, {
        altitudeConstraint: { type: 'above', altitude: 5000 },
        speedConstraint: { type: 'max', speed: 250 }
      })
    ],
    transitions: [
      {
        name: 'BPK',
        waypoints: [
          createWaypoint('WOBUN', { lat: 51.5800, lon: -0.7000 }),
          createWaypoint('EDCOR', { lat: 51.7000, lon: -0.8000 }),
          createWaypoint('BPK', { lat: 51.7500, lon: -0.9000 }, {
            type: 'VOR',
            altitudeConstraint: { type: 'above', altitude: 8000 }
          })
        ]
      }
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

export const EGLL_STARS: STAR[] = [
  {
    id: 'LOGAN2A_EGLL',
    name: 'LOGAN TWO ALPHA ARRIVAL',
    airportIcao: 'EGLL',
    runways: ['09L', '09R', '27L', '27R'],
    transitions: [
      {
        name: 'LAM',
        waypoints: [
          createWaypoint('LAM', { lat: 51.6558, lon: 0.1536 }, { type: 'VOR' }),
          createWaypoint('BRAIN', { lat: 51.6200, lon: 0.0500 }),
          createWaypoint('LOGAN', { lat: 51.5800, lon: -0.1000 }, {
            altitudeConstraint: { type: 'at', altitude: 9000 },
            speedConstraint: { type: 'max', speed: 280 }
          })
        ]
      }
    ],
    commonRoute: [
      createWaypoint('LOGAN', { lat: 51.5800, lon: -0.1000 }),
      createWaypoint('TIMBA', { lat: 51.5400, lon: -0.2000 }, {
        altitudeConstraint: { type: 'at', altitude: 7000 },
        speedConstraint: { type: 'max', speed: 250 }
      }),
      createWaypoint('KORRY', { lat: 51.5000, lon: -0.3000 }, {
        altitudeConstraint: { type: 'at', altitude: 5000 }
      }),
      createWaypoint('LAPRA', { lat: 51.4800, lon: -0.3800 }, {
        altitudeConstraint: { type: 'at', altitude: 3000 }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

export const EGLL_APPROACHES: Approach[] = [
  {
    id: 'ILS27L_EGLL',
    name: 'ILS OR LOC RWY 27L',
    type: 'ILS',
    airportIcao: 'EGLL',
    runway: '27L',
    finalApproachCourse: 272,
    minimums: {
      da: 200,
      visibility: 0.6
    },
    transitions: [
      {
        name: 'LAPRA',
        waypoints: [
          createWaypoint('LAPRA', { lat: 51.4800, lon: -0.3800 }, {
            altitudeConstraint: { type: 'at', altitude: 3000 }
          }),
          createWaypoint('BOVVA', { lat: 51.4700, lon: -0.4000 }, {
            altitudeConstraint: { type: 'at', altitude: 2500 }
          })
        ]
      }
    ],
    finalApproach: [
      createWaypoint('BOVVA', { lat: 51.4700, lon: -0.4000 }, {
        altitudeConstraint: { type: 'at', altitude: 2500 }
      }),
      createWaypoint('ODLEG', { lat: 51.4650, lon: -0.4200 }, {
        altitudeConstraint: { type: 'at', altitude: 2000 }
      }),
      createWaypoint('RW27L', { lat: 51.4589, lon: -0.4325 }, { 
        type: 'RUNWAY',
        altitudeConstraint: { type: 'at', altitude: 77 }
      })
    ],
    missedApproach: [
      createWaypoint('RW27L', { lat: 51.4589, lon: -0.4325 }, { type: 'RUNWAY' }),
      createWaypoint('BILLO', { lat: 51.4400, lon: -0.4600 }, {
        altitudeConstraint: { type: 'above', altitude: 3000 }
      }),
      createWaypoint('MONTY', { lat: 51.4200, lon: -0.5000 }, {
        altitudeConstraint: { type: 'at', altitude: 4000 },
        holdingPattern: {
          inboundCourse: 92,
          turnDirection: 'R',
          legTime: 1
        }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

// ============================================================================
// LTFM PROCEDURES (ISTANBUL)
// ============================================================================

export const LTFM_SIDS: SID[] = [
  {
    id: 'TURAL2D_LTFM',
    name: 'TURAL TWO DELTA DEPARTURE',
    airportIcao: 'LTFM',
    runways: ['16L', '16R', '17L', '17R'],
    commonRoute: [
      createWaypoint('LTFM', { lat: 41.2753, lon: 28.7519 }, { type: 'AIRPORT' }),
      createWaypoint('ID401', { lat: 41.2000, lon: 28.7300 }, { 
        altitudeConstraint: { type: 'above', altitude: 3000 }
      }),
      createWaypoint('ID402', { lat: 41.1200, lon: 28.7000 }, { 
        altitudeConstraint: { type: 'above', altitude: 5000 }
      }),
      createWaypoint('TURAL', { lat: 41.0500, lon: 28.6500 }, {
        altitudeConstraint: { type: 'above', altitude: 7000 },
        speedConstraint: { type: 'max', speed: 250 }
      })
    ],
    transitions: [
      {
        name: 'ELBAL',
        waypoints: [
          createWaypoint('TURAL', { lat: 41.0500, lon: 28.6500 }),
          createWaypoint('GOKEL', { lat: 40.9000, lon: 28.5000 }),
          createWaypoint('ELBAL', { lat: 40.7500, lon: 28.3500 }, {
            altitudeConstraint: { type: 'above', altitude: 12000 }
          })
        ]
      },
      {
        name: 'VAYDA',
        waypoints: [
          createWaypoint('TURAL', { lat: 41.0500, lon: 28.6500 }),
          createWaypoint('KUMLA', { lat: 40.8500, lon: 28.8000 }),
          createWaypoint('VAYDA', { lat: 40.6000, lon: 28.9500 }, {
            altitudeConstraint: { type: 'above', altitude: 15000 }
          })
        ]
      }
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

export const LTFM_STARS: STAR[] = [
  {
    id: 'TEBRA3M_LTFM',
    name: 'TEBRA THREE MIKE ARRIVAL',
    airportIcao: 'LTFM',
    runways: ['34R', '34L', '35R', '35L'],
    transitions: [
      {
        name: 'OLKUM',
        waypoints: [
          createWaypoint('OLKUM', { lat: 41.8000, lon: 29.5000 }),
          createWaypoint('BEKPA', { lat: 41.6500, lon: 29.2000 }),
          createWaypoint('TEBRA', { lat: 41.5000, lon: 29.0000 }, {
            altitudeConstraint: { type: 'at', altitude: 14000 },
            speedConstraint: { type: 'max', speed: 280 }
          })
        ]
      }
    ],
    commonRoute: [
      createWaypoint('TEBRA', { lat: 41.5000, lon: 29.0000 }),
      createWaypoint('SULAY', { lat: 41.4200, lon: 28.9000 }, {
        altitudeConstraint: { type: 'at', altitude: 10000 },
        speedConstraint: { type: 'max', speed: 250 }
      }),
      createWaypoint('IF34R', { lat: 41.3500, lon: 28.8000 }, {
        altitudeConstraint: { type: 'at', altitude: 6000 }
      }),
      createWaypoint('ID515', { lat: 41.3000, lon: 28.7700 }, {
        altitudeConstraint: { type: 'at', altitude: 4000 }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

export const LTFM_APPROACHES: Approach[] = [
  {
    id: 'ILS34R_LTFM',
    name: 'ILS OR LOC RWY 34R',
    type: 'ILS',
    airportIcao: 'LTFM',
    runway: '34R',
    finalApproachCourse: 340,
    minimums: {
      da: 250,
      visibility: 0.6
    },
    transitions: [
      {
        name: 'ID515',
        waypoints: [
          createWaypoint('ID515', { lat: 41.3000, lon: 28.7700 }, {
            altitudeConstraint: { type: 'at', altitude: 4000 }
          }),
          createWaypoint('ID516', { lat: 41.2700, lon: 28.7650 }, {
            altitudeConstraint: { type: 'at', altitude: 3000 }
          })
        ]
      }
    ],
    finalApproach: [
      createWaypoint('ID516', { lat: 41.2700, lon: 28.7650 }, {
        altitudeConstraint: { type: 'at', altitude: 3000 }
      }),
      createWaypoint('ID517', { lat: 41.2600, lon: 28.7630 }, {
        altitudeConstraint: { type: 'at', altitude: 2000 }
      }),
      createWaypoint('RW34R', { lat: 41.2556, lon: 28.7639 }, { 
        type: 'RUNWAY',
        altitudeConstraint: { type: 'at', altitude: 323 }
      })
    ],
    missedApproach: [
      createWaypoint('RW34R', { lat: 41.2556, lon: 28.7639 }, { type: 'RUNWAY' }),
      createWaypoint('ID520', { lat: 41.2800, lon: 28.7500 }, {
        altitudeConstraint: { type: 'above', altitude: 2000 }
      }),
      createWaypoint('ID521', { lat: 41.3200, lon: 28.7300 }, {
        altitudeConstraint: { type: 'at', altitude: 4000 },
        holdingPattern: {
          inboundCourse: 160,
          turnDirection: 'L',
          legTime: 1
        }
      })
    ],
    remarks: 'MOCK DATA - For simulation only'
  }
];

// ============================================================================
// PROCEDURE LOOKUP FUNCTIONS
// ============================================================================

/** All SIDs indexed by airport */
export const sidsByAirport: Record<string, SID[]> = {
  KJFK: KJFK_SIDS,
  KLAX: KLAX_SIDS,
  EGLL: EGLL_SIDS,
  LTFM: LTFM_SIDS
};

/** All STARs indexed by airport */
export const starsByAirport: Record<string, STAR[]> = {
  KJFK: KJFK_STARS,
  KLAX: KLAX_STARS,
  EGLL: EGLL_STARS,
  LTFM: LTFM_STARS
};

/** All Approaches indexed by airport */
export const approachesByAirport: Record<string, Approach[]> = {
  KJFK: KJFK_APPROACHES,
  KLAX: KLAX_APPROACHES,
  EGLL: EGLL_APPROACHES,
  LTFM: LTFM_APPROACHES
};

/**
 * Get SIDs for an airport
 */
export function getSIDsForAirport(icao: string): SID[] {
  return sidsByAirport[icao.toUpperCase()] || [];
}

/**
 * Get STARs for an airport
 */
export function getSTARsForAirport(icao: string): STAR[] {
  return starsByAirport[icao.toUpperCase()] || [];
}

/**
 * Get approaches for an airport
 */
export function getApproachesForAirport(icao: string): Approach[] {
  return approachesByAirport[icao.toUpperCase()] || [];
}

/**
 * Get SID by ID
 */
export function getSID(airportIcao: string, sidId: string): SID | undefined {
  const sids = getSIDsForAirport(airportIcao);
  return sids.find(sid => sid.id === sidId);
}

/**
 * Get STAR by ID
 */
export function getSTAR(airportIcao: string, starId: string): STAR | undefined {
  const stars = getSTARsForAirport(airportIcao);
  return stars.find(star => star.id === starId);
}

/**
 * Get Approach by ID
 */
export function getApproach(airportIcao: string, approachId: string): Approach | undefined {
  const approaches = getApproachesForAirport(airportIcao);
  return approaches.find(approach => approach.id === approachId);
}

/**
 * Get SIDs for a specific runway
 */
export function getSIDsForRunway(airportIcao: string, runway: string): SID[] {
  const sids = getSIDsForAirport(airportIcao);
  return sids.filter(sid => sid.runways.includes(runway));
}

/**
 * Get STARs for a specific runway
 */
export function getSTARsForRunway(airportIcao: string, runway: string): STAR[] {
  const stars = getSTARsForAirport(airportIcao);
  return stars.filter(star => star.runways.includes(runway));
}

/**
 * Get approaches for a specific runway
 */
export function getApproachesForRunway(airportIcao: string, runway: string): Approach[] {
  const approaches = getApproachesForAirport(airportIcao);
  return approaches.filter(approach => approach.runway === runway);
}
