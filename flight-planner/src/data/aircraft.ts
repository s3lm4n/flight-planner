/**
 * Aircraft Database
 * 
 * REAL DATA NOTICE:
 * This file contains realistic aircraft performance data based on publicly available information.
 * Performance numbers are representative and should not be used for actual flight planning.
 * 
 * TO REPLACE WITH REAL DATA:
 * 1. Use manufacturer performance manuals
 * 2. Subscribe to aircraft performance databases
 * 3. Integrate with operational flight planning systems
 */

import { Aircraft } from '@/types';

export const aircraftDatabase: Record<string, Aircraft> = {
  // ============================================================================
  // NARROW-BODY JETS
  // ============================================================================
  
  B738: {
    icaoType: 'B738',
    name: 'Boeing 737-800',
    manufacturer: 'Boeing',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 145,
      vR: 150,
      v2: 155,
      vRef: 135,
      cruiseSpeed: 450,
      maxSpeed: 340, // Mach 0.82
      stallSpeed: 107,
      climbRate: 2500,
      descentRate: 1800,
      climbSpeed: 280,
      descentSpeed: 290,
      serviceCeiling: 41000,
      optimalAltitude: 36000,
      fuelBurn: 850, // gallons/hour
      fuelCapacity: 6875,
      maxRange: 2935
    },
    dimensions: {
      wingspan: 117,
      length: 129,
      height: 41
    }
  },
  
  B739: {
    icaoType: 'B739',
    name: 'Boeing 737-900ER',
    manufacturer: 'Boeing',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 148,
      vR: 153,
      v2: 158,
      vRef: 140,
      cruiseSpeed: 450,
      maxSpeed: 340,
      stallSpeed: 112,
      climbRate: 2400,
      descentRate: 1800,
      climbSpeed: 280,
      descentSpeed: 290,
      serviceCeiling: 41000,
      optimalAltitude: 36000,
      fuelBurn: 900,
      fuelCapacity: 7837,
      maxRange: 3200
    },
    dimensions: {
      wingspan: 117,
      length: 138,
      height: 41
    }
  },

  B37M: {
    icaoType: 'B37M',
    name: 'Boeing 737 MAX 7',
    manufacturer: 'Boeing',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 140,
      vR: 145,
      v2: 150,
      vRef: 130,
      cruiseSpeed: 450,
      maxSpeed: 340,
      stallSpeed: 105,
      climbRate: 2600,
      descentRate: 1800,
      climbSpeed: 280,
      descentSpeed: 290,
      serviceCeiling: 41000,
      optimalAltitude: 37000,
      fuelBurn: 780,
      fuelCapacity: 6820,
      maxRange: 3850
    },
    dimensions: {
      wingspan: 118,
      length: 116,
      height: 40
    }
  },

  B38M: {
    icaoType: 'B38M',
    name: 'Boeing 737 MAX 8',
    manufacturer: 'Boeing',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 145,
      vR: 150,
      v2: 155,
      vRef: 135,
      cruiseSpeed: 453,
      maxSpeed: 340,
      stallSpeed: 107,
      climbRate: 2500,
      descentRate: 1800,
      climbSpeed: 280,
      descentSpeed: 290,
      serviceCeiling: 41000,
      optimalAltitude: 37000,
      fuelBurn: 810,
      fuelCapacity: 6820,
      maxRange: 3550
    },
    dimensions: {
      wingspan: 118,
      length: 129,
      height: 40
    }
  },

  A320: {
    icaoType: 'A320',
    name: 'Airbus A320-200',
    manufacturer: 'Airbus',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 143,
      vR: 148,
      v2: 153,
      vRef: 133,
      cruiseSpeed: 447,
      maxSpeed: 350,
      stallSpeed: 109,
      climbRate: 2500,
      descentRate: 1800,
      climbSpeed: 280,
      descentSpeed: 290,
      serviceCeiling: 39100,
      optimalAltitude: 36000,
      fuelBurn: 800,
      fuelCapacity: 6400,
      maxRange: 3300
    },
    dimensions: {
      wingspan: 117,
      length: 123,
      height: 39
    }
  },

  A319: {
    icaoType: 'A319',
    name: 'Airbus A319-100',
    manufacturer: 'Airbus',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 138,
      vR: 143,
      v2: 148,
      vRef: 128,
      cruiseSpeed: 447,
      maxSpeed: 350,
      stallSpeed: 105,
      climbRate: 2600,
      descentRate: 1800,
      climbSpeed: 280,
      descentSpeed: 290,
      serviceCeiling: 41000,
      optimalAltitude: 36000,
      fuelBurn: 720,
      fuelCapacity: 6400,
      maxRange: 3700
    },
    dimensions: {
      wingspan: 117,
      length: 111,
      height: 39
    }
  },

  A321: {
    icaoType: 'A321',
    name: 'Airbus A321-200',
    manufacturer: 'Airbus',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 150,
      vR: 155,
      v2: 160,
      vRef: 140,
      cruiseSpeed: 447,
      maxSpeed: 350,
      stallSpeed: 115,
      climbRate: 2400,
      descentRate: 1800,
      climbSpeed: 280,
      descentSpeed: 290,
      serviceCeiling: 39100,
      optimalAltitude: 36000,
      fuelBurn: 880,
      fuelCapacity: 6400,
      maxRange: 3200
    },
    dimensions: {
      wingspan: 117,
      length: 146,
      height: 39
    }
  },

  A20N: {
    icaoType: 'A20N',
    name: 'Airbus A320neo',
    manufacturer: 'Airbus',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 143,
      vR: 148,
      v2: 153,
      vRef: 133,
      cruiseSpeed: 450,
      maxSpeed: 350,
      stallSpeed: 109,
      climbRate: 2600,
      descentRate: 1800,
      climbSpeed: 280,
      descentSpeed: 290,
      serviceCeiling: 41000,
      optimalAltitude: 37000,
      fuelBurn: 680,
      fuelCapacity: 6400,
      maxRange: 3500
    },
    dimensions: {
      wingspan: 118,
      length: 123,
      height: 39
    }
  },

  A21N: {
    icaoType: 'A21N',
    name: 'Airbus A321neo',
    manufacturer: 'Airbus',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 150,
      vR: 155,
      v2: 160,
      vRef: 140,
      cruiseSpeed: 450,
      maxSpeed: 350,
      stallSpeed: 115,
      climbRate: 2500,
      descentRate: 1800,
      climbSpeed: 280,
      descentSpeed: 290,
      serviceCeiling: 41000,
      optimalAltitude: 37000,
      fuelBurn: 750,
      fuelCapacity: 8450,
      maxRange: 4000
    },
    dimensions: {
      wingspan: 118,
      length: 146,
      height: 39
    }
  },

  // ============================================================================
  // WIDE-BODY JETS
  // ============================================================================

  B772: {
    icaoType: 'B772',
    name: 'Boeing 777-200',
    manufacturer: 'Boeing',
    category: 'D',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 155,
      vR: 160,
      v2: 165,
      vRef: 145,
      cruiseSpeed: 490,
      maxSpeed: 350,
      stallSpeed: 125,
      climbRate: 2200,
      descentRate: 2000,
      climbSpeed: 300,
      descentSpeed: 310,
      serviceCeiling: 43100,
      optimalAltitude: 39000,
      fuelBurn: 2100,
      fuelCapacity: 31000,
      maxRange: 5240
    },
    dimensions: {
      wingspan: 199,
      length: 209,
      height: 61
    }
  },

  B77L: {
    icaoType: 'B77L',
    name: 'Boeing 777-200LR',
    manufacturer: 'Boeing',
    category: 'D',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 158,
      vR: 163,
      v2: 168,
      vRef: 148,
      cruiseSpeed: 490,
      maxSpeed: 350,
      stallSpeed: 128,
      climbRate: 2100,
      descentRate: 2000,
      climbSpeed: 300,
      descentSpeed: 310,
      serviceCeiling: 43100,
      optimalAltitude: 39000,
      fuelBurn: 2200,
      fuelCapacity: 47890,
      maxRange: 8555
    },
    dimensions: {
      wingspan: 213,
      length: 209,
      height: 61
    }
  },

  B773: {
    icaoType: 'B773',
    name: 'Boeing 777-300',
    manufacturer: 'Boeing',
    category: 'D',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 160,
      vR: 165,
      v2: 170,
      vRef: 150,
      cruiseSpeed: 490,
      maxSpeed: 350,
      stallSpeed: 130,
      climbRate: 2000,
      descentRate: 2000,
      climbSpeed: 300,
      descentSpeed: 310,
      serviceCeiling: 43100,
      optimalAltitude: 39000,
      fuelBurn: 2300,
      fuelCapacity: 31000,
      maxRange: 6015
    },
    dimensions: {
      wingspan: 199,
      length: 242,
      height: 61
    }
  },

  B77W: {
    icaoType: 'B77W',
    name: 'Boeing 777-300ER',
    manufacturer: 'Boeing',
    category: 'D',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 162,
      vR: 167,
      v2: 172,
      vRef: 152,
      cruiseSpeed: 490,
      maxSpeed: 350,
      stallSpeed: 132,
      climbRate: 2100,
      descentRate: 2000,
      climbSpeed: 300,
      descentSpeed: 310,
      serviceCeiling: 43100,
      optimalAltitude: 39000,
      fuelBurn: 2400,
      fuelCapacity: 47890,
      maxRange: 7370
    },
    dimensions: {
      wingspan: 213,
      length: 242,
      height: 61
    }
  },

  B788: {
    icaoType: 'B788',
    name: 'Boeing 787-8 Dreamliner',
    manufacturer: 'Boeing',
    category: 'C',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 150,
      vR: 155,
      v2: 160,
      vRef: 140,
      cruiseSpeed: 488,
      maxSpeed: 350,
      stallSpeed: 120,
      climbRate: 2500,
      descentRate: 1900,
      climbSpeed: 290,
      descentSpeed: 300,
      serviceCeiling: 43000,
      optimalAltitude: 40000,
      fuelBurn: 1600,
      fuelCapacity: 33340,
      maxRange: 7355
    },
    dimensions: {
      wingspan: 197,
      length: 186,
      height: 56
    }
  },

  B789: {
    icaoType: 'B789',
    name: 'Boeing 787-9 Dreamliner',
    manufacturer: 'Boeing',
    category: 'C',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 153,
      vR: 158,
      v2: 163,
      vRef: 143,
      cruiseSpeed: 488,
      maxSpeed: 350,
      stallSpeed: 123,
      climbRate: 2400,
      descentRate: 1900,
      climbSpeed: 290,
      descentSpeed: 300,
      serviceCeiling: 43000,
      optimalAltitude: 40000,
      fuelBurn: 1700,
      fuelCapacity: 33340,
      maxRange: 7635
    },
    dimensions: {
      wingspan: 197,
      length: 206,
      height: 56
    }
  },

  B78X: {
    icaoType: 'B78X',
    name: 'Boeing 787-10 Dreamliner',
    manufacturer: 'Boeing',
    category: 'C',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 158,
      vR: 163,
      v2: 168,
      vRef: 148,
      cruiseSpeed: 488,
      maxSpeed: 350,
      stallSpeed: 128,
      climbRate: 2300,
      descentRate: 1900,
      climbSpeed: 290,
      descentSpeed: 300,
      serviceCeiling: 43000,
      optimalAltitude: 40000,
      fuelBurn: 1800,
      fuelCapacity: 33340,
      maxRange: 6430
    },
    dimensions: {
      wingspan: 197,
      length: 224,
      height: 56
    }
  },

  A332: {
    icaoType: 'A332',
    name: 'Airbus A330-200',
    manufacturer: 'Airbus',
    category: 'D',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 148,
      vR: 153,
      v2: 158,
      vRef: 138,
      cruiseSpeed: 470,
      maxSpeed: 350,
      stallSpeed: 120,
      climbRate: 2200,
      descentRate: 1900,
      climbSpeed: 290,
      descentSpeed: 300,
      serviceCeiling: 41450,
      optimalAltitude: 38000,
      fuelBurn: 1900,
      fuelCapacity: 36700,
      maxRange: 7250
    },
    dimensions: {
      wingspan: 198,
      length: 193,
      height: 58
    }
  },

  A333: {
    icaoType: 'A333',
    name: 'Airbus A330-300',
    manufacturer: 'Airbus',
    category: 'D',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 152,
      vR: 157,
      v2: 162,
      vRef: 142,
      cruiseSpeed: 470,
      maxSpeed: 350,
      stallSpeed: 125,
      climbRate: 2100,
      descentRate: 1900,
      climbSpeed: 290,
      descentSpeed: 300,
      serviceCeiling: 41450,
      optimalAltitude: 38000,
      fuelBurn: 2000,
      fuelCapacity: 36700,
      maxRange: 6350
    },
    dimensions: {
      wingspan: 198,
      length: 209,
      height: 58
    }
  },

  A339: {
    icaoType: 'A339',
    name: 'Airbus A330-900neo',
    manufacturer: 'Airbus',
    category: 'D',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 152,
      vR: 157,
      v2: 162,
      vRef: 142,
      cruiseSpeed: 475,
      maxSpeed: 350,
      stallSpeed: 125,
      climbRate: 2300,
      descentRate: 1900,
      climbSpeed: 290,
      descentSpeed: 300,
      serviceCeiling: 41450,
      optimalAltitude: 39000,
      fuelBurn: 1700,
      fuelCapacity: 36700,
      maxRange: 7200
    },
    dimensions: {
      wingspan: 210,
      length: 209,
      height: 58
    }
  },

  A359: {
    icaoType: 'A359',
    name: 'Airbus A350-900',
    manufacturer: 'Airbus',
    category: 'D',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 155,
      vR: 160,
      v2: 165,
      vRef: 145,
      cruiseSpeed: 488,
      maxSpeed: 350,
      stallSpeed: 125,
      climbRate: 2500,
      descentRate: 2000,
      climbSpeed: 300,
      descentSpeed: 310,
      serviceCeiling: 43100,
      optimalAltitude: 41000,
      fuelBurn: 1850,
      fuelCapacity: 36000,
      maxRange: 8100
    },
    dimensions: {
      wingspan: 212,
      length: 219,
      height: 56
    }
  },

  A35K: {
    icaoType: 'A35K',
    name: 'Airbus A350-1000',
    manufacturer: 'Airbus',
    category: 'D',
    wakeCategory: 'H',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 160,
      vR: 165,
      v2: 170,
      vRef: 150,
      cruiseSpeed: 488,
      maxSpeed: 350,
      stallSpeed: 130,
      climbRate: 2400,
      descentRate: 2000,
      climbSpeed: 300,
      descentSpeed: 310,
      serviceCeiling: 43100,
      optimalAltitude: 41000,
      fuelBurn: 2000,
      fuelCapacity: 41000,
      maxRange: 8700
    },
    dimensions: {
      wingspan: 212,
      length: 242,
      height: 56
    }
  },

  A388: {
    icaoType: 'A388',
    name: 'Airbus A380-800',
    manufacturer: 'Airbus',
    category: 'E',
    wakeCategory: 'J',
    engineType: 'JET',
    engineCount: 4,
    performance: {
      v1: 165,
      vR: 170,
      v2: 175,
      vRef: 155,
      cruiseSpeed: 480,
      maxSpeed: 345,
      stallSpeed: 140,
      climbRate: 1800,
      descentRate: 1800,
      climbSpeed: 300,
      descentSpeed: 320,
      serviceCeiling: 43100,
      optimalAltitude: 39000,
      fuelBurn: 3200,
      fuelCapacity: 81890,
      maxRange: 8000
    },
    dimensions: {
      wingspan: 262,
      length: 239,
      height: 79
    }
  },

  // ============================================================================
  // REGIONAL JETS
  // ============================================================================

  E190: {
    icaoType: 'E190',
    name: 'Embraer E190',
    manufacturer: 'Embraer',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 130,
      vR: 135,
      v2: 140,
      vRef: 125,
      cruiseSpeed: 433,
      maxSpeed: 320,
      stallSpeed: 100,
      climbRate: 2800,
      descentRate: 1700,
      climbSpeed: 270,
      descentSpeed: 280,
      serviceCeiling: 41000,
      optimalAltitude: 37000,
      fuelBurn: 580,
      fuelCapacity: 3050,
      maxRange: 2400
    },
    dimensions: {
      wingspan: 94,
      length: 118,
      height: 34
    }
  },

  E195: {
    icaoType: 'E195',
    name: 'Embraer E195',
    manufacturer: 'Embraer',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 135,
      vR: 140,
      v2: 145,
      vRef: 130,
      cruiseSpeed: 433,
      maxSpeed: 320,
      stallSpeed: 105,
      climbRate: 2700,
      descentRate: 1700,
      climbSpeed: 270,
      descentSpeed: 280,
      serviceCeiling: 41000,
      optimalAltitude: 37000,
      fuelBurn: 620,
      fuelCapacity: 3050,
      maxRange: 2200
    },
    dimensions: {
      wingspan: 94,
      length: 128,
      height: 35
    }
  },

  E290: {
    icaoType: 'E290',
    name: 'Embraer E195-E2',
    manufacturer: 'Embraer',
    category: 'C',
    wakeCategory: 'M',
    engineType: 'JET',
    engineCount: 2,
    performance: {
      v1: 135,
      vR: 140,
      v2: 145,
      vRef: 130,
      cruiseSpeed: 450,
      maxSpeed: 320,
      stallSpeed: 105,
      climbRate: 2900,
      descentRate: 1700,
      climbSpeed: 275,
      descentSpeed: 285,
      serviceCeiling: 41000,
      optimalAltitude: 38000,
      fuelBurn: 530,
      fuelCapacity: 3730,
      maxRange: 2600
    },
    dimensions: {
      wingspan: 115,
      length: 135,
      height: 35
    }
  },

  // ============================================================================
  // TURBOPROPS
  // ============================================================================

  DH8D: {
    icaoType: 'DH8D',
    name: 'De Havilland Dash 8-400',
    manufacturer: 'De Havilland Canada',
    category: 'B',
    wakeCategory: 'M',
    engineType: 'TURBOPROP',
    engineCount: 2,
    performance: {
      v1: 115,
      vR: 120,
      v2: 125,
      vRef: 110,
      cruiseSpeed: 360,
      maxSpeed: 360,
      stallSpeed: 85,
      climbRate: 1800,
      descentRate: 1500,
      climbSpeed: 200,
      descentSpeed: 220,
      serviceCeiling: 27000,
      optimalAltitude: 25000,
      fuelBurn: 350,
      fuelCapacity: 1650,
      maxRange: 1362
    },
    dimensions: {
      wingspan: 93,
      length: 107,
      height: 27
    }
  },

  AT76: {
    icaoType: 'AT76',
    name: 'ATR 72-600',
    manufacturer: 'ATR',
    category: 'B',
    wakeCategory: 'M',
    engineType: 'TURBOPROP',
    engineCount: 2,
    performance: {
      v1: 105,
      vR: 110,
      v2: 115,
      vRef: 100,
      cruiseSpeed: 275,
      maxSpeed: 300,
      stallSpeed: 75,
      climbRate: 1500,
      descentRate: 1400,
      climbSpeed: 180,
      descentSpeed: 200,
      serviceCeiling: 25000,
      optimalAltitude: 22000,
      fuelBurn: 220,
      fuelCapacity: 1450,
      maxRange: 825
    },
    dimensions: {
      wingspan: 89,
      length: 89,
      height: 25
    }
  }
};

/**
 * Get aircraft by ICAO type designator
 */
export function getAircraft(icaoType: string): Aircraft | undefined {
  return aircraftDatabase[icaoType.toUpperCase()];
}

/**
 * Get all aircraft as array
 */
export function getAllAircraft(): Aircraft[] {
  return Object.values(aircraftDatabase);
}

/**
 * Search aircraft by type or name
 */
export function searchAircraft(query: string): Aircraft[] {
  const upperQuery = query.toUpperCase();
  return Object.values(aircraftDatabase).filter(
    aircraft =>
      aircraft.icaoType.includes(upperQuery) ||
      aircraft.name.toUpperCase().includes(upperQuery) ||
      aircraft.manufacturer.toUpperCase().includes(upperQuery)
  );
}

/**
 * Get aircraft grouped by manufacturer
 */
export function getAircraftByManufacturer(): Record<string, Aircraft[]> {
  const grouped: Record<string, Aircraft[]> = {};
  
  for (const aircraft of Object.values(aircraftDatabase)) {
    if (!grouped[aircraft.manufacturer]) {
      grouped[aircraft.manufacturer] = [];
    }
    grouped[aircraft.manufacturer].push(aircraft);
  }
  
  return grouped;
}
