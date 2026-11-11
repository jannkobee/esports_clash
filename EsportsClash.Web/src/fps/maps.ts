import type { FpsMap, FpsMapId } from './types.ts';

export const FPS_MAPS: Record<FpsMapId, FpsMap> = {
  breakwater: {
    id: 'breakwater',
    name: 'Breakwater',
    description: 'Harbor warehouses and drydock facility with long crane sightlines and tight container alleys.',
    attackerSpawnZone: 'zone_harbor_gates',
    defenderSpawnZone: 'zone_customs_office',
    siteAZones: ['zone_warehouse_a', 'zone_crane_deck'],
    siteBZones: ['zone_pier_b', 'zone_container_yard'],
    chokeZones: ['choke_warehouse_rollup', 'choke_sluice_gate'],
    zones: {
      zone_harbor_gates: {
        id: 'zone_harbor_gates',
        name: 'Harbor Gates (T Spawn)',
        isSpawn: 'attackers',
        connectedZones: ['zone_cargo_alley_a', 'zone_dock_road_b', 'zone_drydock_mid'],
        coverQuality: 0.6,
        engagementDistance: 'long'
      },
      zone_cargo_alley_a: {
        id: 'zone_cargo_alley_a',
        name: 'Cargo Alley A',
        connectedZones: ['zone_harbor_gates', 'choke_warehouse_rollup'],
        coverQuality: 0.5,
        engagementDistance: 'medium'
      },
      choke_warehouse_rollup: {
        id: 'choke_warehouse_rollup',
        name: 'Rollup Door Choke A',
        isChoke: true,
        site: 'A',
        connectedZones: ['zone_cargo_alley_a', 'zone_warehouse_a'],
        coverQuality: 0.25,
        engagementDistance: 'medium'
      },
      zone_warehouse_a: {
        id: 'zone_warehouse_a',
        name: 'Bombsite A (Warehouse Main)',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['choke_warehouse_rollup', 'zone_crane_deck', 'zone_connector_mid_a', 'zone_customs_office'],
        coverQuality: 0.7,
        engagementDistance: 'medium'
      },
      zone_crane_deck: {
        id: 'zone_crane_deck',
        name: 'Crane Deck (High Ground)',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['zone_warehouse_a'],
        coverQuality: 0.8,
        engagementDistance: 'long'
      },
      zone_dock_road_b: {
        id: 'zone_dock_road_b',
        name: 'Dock Road B',
        connectedZones: ['zone_harbor_gates', 'choke_sluice_gate'],
        coverQuality: 0.45,
        engagementDistance: 'medium'
      },
      choke_sluice_gate: {
        id: 'choke_sluice_gate',
        name: 'Sluice Gate Choke B',
        isChoke: true,
        site: 'B',
        connectedZones: ['zone_dock_road_b', 'zone_pier_b'],
        coverQuality: 0.2,
        engagementDistance: 'close'
      },
      zone_pier_b: {
        id: 'zone_pier_b',
        name: 'Bombsite B (Submarine Pier)',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['choke_sluice_gate', 'zone_container_yard', 'zone_connector_mid_b', 'zone_customs_office'],
        coverQuality: 0.65,
        engagementDistance: 'close'
      },
      zone_container_yard: {
        id: 'zone_container_yard',
        name: 'Container Yard B',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['zone_pier_b'],
        coverQuality: 0.75,
        engagementDistance: 'close'
      },
      zone_drydock_mid: {
        id: 'zone_drydock_mid',
        name: 'Drydock Central (Mid)',
        connectedZones: ['zone_harbor_gates', 'zone_connector_mid_a', 'zone_connector_mid_b'],
        coverQuality: 0.4,
        engagementDistance: 'long'
      },
      zone_connector_mid_a: {
        id: 'zone_connector_mid_a',
        name: 'Drydock Connector A',
        connectedZones: ['zone_drydock_mid', 'zone_warehouse_a'],
        coverQuality: 0.5,
        engagementDistance: 'medium'
      },
      zone_connector_mid_b: {
        id: 'zone_connector_mid_b',
        name: 'Drydock Connector B',
        connectedZones: ['zone_drydock_mid', 'zone_pier_b'],
        coverQuality: 0.5,
        engagementDistance: 'close'
      },
      zone_customs_office: {
        id: 'zone_customs_office',
        name: 'Customs Office (CT Spawn)',
        isSpawn: 'defenders',
        connectedZones: ['zone_warehouse_a', 'zone_pier_b'],
        coverQuality: 0.6,
        engagementDistance: 'medium'
      }
    },
    rotationTimes: {
      zone_customs_office: { zone_warehouse_a: 6, zone_pier_b: 6 },
      zone_warehouse_a: { zone_pier_b: 14, zone_drydock_mid: 9 },
      zone_pier_b: { zone_warehouse_a: 14, zone_drydock_mid: 9 }
    }
  },

  foundry: {
    id: 'foundry',
    name: 'Foundry',
    description: 'Heavy steel manufacturing complex centered around a blast furnace and automated assembly lines.',
    attackerSpawnZone: 'zone_rail_yard',
    defenderSpawnZone: 'zone_control_tower',
    siteAZones: ['zone_blast_furnace_a', 'zone_molten_vat'],
    siteBZones: ['zone_assembly_hall_b', 'zone_press_line'],
    chokeZones: ['choke_furnace_ramp', 'choke_assembly_gate'],
    zones: {
      zone_rail_yard: {
        id: 'zone_rail_yard',
        name: 'Rail Yard (T Spawn)',
        isSpawn: 'attackers',
        connectedZones: ['zone_ramp_approach_a', 'zone_boiler_mid', 'zone_conveyor_b'],
        coverQuality: 0.6,
        engagementDistance: 'long'
      },
      zone_ramp_approach_a: {
        id: 'zone_ramp_approach_a',
        name: 'Furnace Approach A',
        connectedZones: ['zone_rail_yard', 'choke_furnace_ramp'],
        coverQuality: 0.5,
        engagementDistance: 'medium'
      },
      choke_furnace_ramp: {
        id: 'choke_furnace_ramp',
        name: 'Furnace Ramp Choke A',
        isChoke: true,
        site: 'A',
        connectedZones: ['zone_ramp_approach_a', 'zone_blast_furnace_a'],
        coverQuality: 0.25,
        engagementDistance: 'medium'
      },
      zone_blast_furnace_a: {
        id: 'zone_blast_furnace_a',
        name: 'Bombsite A (Blast Furnace)',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['choke_furnace_ramp', 'zone_molten_vat', 'zone_vent_connector_a', 'zone_control_tower'],
        coverQuality: 0.7,
        engagementDistance: 'medium'
      },
      zone_molten_vat: {
        id: 'zone_molten_vat',
        name: 'Molten Vat Catwalk',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['zone_blast_furnace_a'],
        coverQuality: 0.65,
        engagementDistance: 'long'
      },
      zone_conveyor_b: {
        id: 'zone_conveyor_b',
        name: 'Conveyor Run B',
        connectedZones: ['zone_rail_yard', 'choke_assembly_gate'],
        coverQuality: 0.45,
        engagementDistance: 'close'
      },
      choke_assembly_gate: {
        id: 'choke_assembly_gate',
        name: 'Assembly Gate Choke B',
        isChoke: true,
        site: 'B',
        connectedZones: ['zone_conveyor_b', 'zone_assembly_hall_b'],
        coverQuality: 0.2,
        engagementDistance: 'close'
      },
      zone_assembly_hall_b: {
        id: 'zone_assembly_hall_b',
        name: 'Bombsite B (Assembly Hall)',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['choke_assembly_gate', 'zone_press_line', 'zone_pipe_connector_b', 'zone_control_tower'],
        coverQuality: 0.75,
        engagementDistance: 'close'
      },
      zone_press_line: {
        id: 'zone_press_line',
        name: 'Hydraulic Press Line',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['zone_assembly_hall_b'],
        coverQuality: 0.8,
        engagementDistance: 'close'
      },
      zone_boiler_mid: {
        id: 'zone_boiler_mid',
        name: 'Boiler Pipe Alley (Mid)',
        connectedZones: ['zone_rail_yard', 'zone_vent_connector_a', 'zone_pipe_connector_b'],
        coverQuality: 0.45,
        engagementDistance: 'long'
      },
      zone_vent_connector_a: {
        id: 'zone_vent_connector_a',
        name: 'Ventilation Duct A',
        connectedZones: ['zone_boiler_mid', 'zone_blast_furnace_a'],
        coverQuality: 0.55,
        engagementDistance: 'close'
      },
      zone_pipe_connector_b: {
        id: 'zone_pipe_connector_b',
        name: 'Steam Pipe Connector B',
        connectedZones: ['zone_boiler_mid', 'zone_assembly_hall_b'],
        coverQuality: 0.5,
        engagementDistance: 'medium'
      },
      zone_control_tower: {
        id: 'zone_control_tower',
        name: 'Control Tower (CT Spawn)',
        isSpawn: 'defenders',
        connectedZones: ['zone_blast_furnace_a', 'zone_assembly_hall_b'],
        coverQuality: 0.65,
        engagementDistance: 'medium'
      }
    },
    rotationTimes: {
      zone_control_tower: { zone_blast_furnace_a: 5, zone_assembly_hall_b: 6 },
      zone_blast_furnace_a: { zone_assembly_hall_b: 13, zone_boiler_mid: 8 },
      zone_assembly_hall_b: { zone_blast_furnace_a: 13, zone_boiler_mid: 8 }
    }
  },

  'old-quarter': {
    id: 'old-quarter',
    name: 'Old Quarter',
    description: 'Dense historical European streets, stone arches, and cobblestone courtyards.',
    attackerSpawnZone: 'zone_fountain_square',
    defenderSpawnZone: 'zone_clocktower_steps',
    siteAZones: ['zone_market_a', 'zone_bell_tower'],
    siteBZones: ['zone_courtyard_b', 'zone_church_cloister'],
    chokeZones: ['choke_market_arch', 'choke_cloister_gate'],
    zones: {
      zone_fountain_square: {
        id: 'zone_fountain_square',
        name: 'Fountain Square (T Spawn)',
        isSpawn: 'attackers',
        connectedZones: ['zone_cobblestone_a', 'zone_alley_mid', 'zone_wine_walk_b'],
        coverQuality: 0.55,
        engagementDistance: 'medium'
      },
      zone_cobblestone_a: {
        id: 'zone_cobblestone_a',
        name: 'Cobblestone Street A',
        connectedZones: ['zone_fountain_square', 'choke_market_arch'],
        coverQuality: 0.5,
        engagementDistance: 'medium'
      },
      choke_market_arch: {
        id: 'choke_market_arch',
        name: 'Market Archway Choke A',
        isChoke: true,
        site: 'A',
        connectedZones: ['zone_cobblestone_a', 'zone_market_a'],
        coverQuality: 0.3,
        engagementDistance: 'medium'
      },
      zone_market_a: {
        id: 'zone_market_a',
        name: 'Bombsite A (Market Square)',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['choke_market_arch', 'zone_bell_tower', 'zone_cellar_connector_a', 'zone_clocktower_steps'],
        coverQuality: 0.7,
        engagementDistance: 'medium'
      },
      zone_bell_tower: {
        id: 'zone_bell_tower',
        name: 'Bell Tower Balcony',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['zone_market_a'],
        coverQuality: 0.8,
        engagementDistance: 'long'
      },
      zone_wine_walk_b: {
        id: 'zone_wine_walk_b',
        name: 'Wine Walk B',
        connectedZones: ['zone_fountain_square', 'choke_cloister_gate'],
        coverQuality: 0.45,
        engagementDistance: 'close'
      },
      choke_cloister_gate: {
        id: 'choke_cloister_gate',
        name: 'Cloister Gate Choke B',
        isChoke: true,
        site: 'B',
        connectedZones: ['zone_wine_walk_b', 'zone_courtyard_b'],
        coverQuality: 0.25,
        engagementDistance: 'close'
      },
      zone_courtyard_b: {
        id: 'zone_courtyard_b',
        name: 'Bombsite B (Church Courtyard)',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['choke_cloister_gate', 'zone_church_cloister', 'zone_crypt_connector_b', 'zone_clocktower_steps'],
        coverQuality: 0.75,
        engagementDistance: 'close'
      },
      zone_church_cloister: {
        id: 'zone_church_cloister',
        name: 'Church Cloister Pillars',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['zone_courtyard_b'],
        coverQuality: 0.8,
        engagementDistance: 'close'
      },
      zone_alley_mid: {
        id: 'zone_alley_mid',
        name: 'Central Alleyway (Mid)',
        connectedZones: ['zone_fountain_square', 'zone_cellar_connector_a', 'zone_crypt_connector_b'],
        coverQuality: 0.4,
        engagementDistance: 'long'
      },
      zone_cellar_connector_a: {
        id: 'zone_cellar_connector_a',
        name: 'Wine Cellar Connector A',
        connectedZones: ['zone_alley_mid', 'zone_market_a'],
        coverQuality: 0.6,
        engagementDistance: 'close'
      },
      zone_crypt_connector_b: {
        id: 'zone_crypt_connector_b',
        name: 'Crypt Tunnel Connector B',
        connectedZones: ['zone_alley_mid', 'zone_courtyard_b'],
        coverQuality: 0.55,
        engagementDistance: 'close'
      },
      zone_clocktower_steps: {
        id: 'zone_clocktower_steps',
        name: 'Clocktower Steps (CT Spawn)',
        isSpawn: 'defenders',
        connectedZones: ['zone_market_a', 'zone_courtyard_b'],
        coverQuality: 0.6,
        engagementDistance: 'medium'
      }
    },
    rotationTimes: {
      zone_clocktower_steps: { zone_market_a: 5, zone_courtyard_b: 6 },
      zone_market_a: { zone_courtyard_b: 12, zone_alley_mid: 7 },
      zone_courtyard_b: { zone_market_a: 12, zone_alley_mid: 7 }
    }
  },

  'red-mesa': {
    id: 'red-mesa',
    name: 'Red Mesa',
    description: 'Dry canyon relay station with broad exterior angles and an underground missile launch silo.',
    attackerSpawnZone: 'zone_canyon_basin',
    defenderSpawnZone: 'zone_command_bunker',
    siteAZones: ['zone_radar_terrace_a', 'zone_solar_array'],
    siteBZones: ['zone_missile_silo_b', 'zone_blast_chamber'],
    chokeZones: ['choke_terrace_path', 'choke_blast_hatch'],
    zones: {
      zone_canyon_basin: {
        id: 'zone_canyon_basin',
        name: 'Canyon Basin (T Spawn)',
        isSpawn: 'attackers',
        connectedZones: ['zone_ridge_a', 'zone_trench_mid', 'zone_silo_access_b'],
        coverQuality: 0.5,
        engagementDistance: 'long'
      },
      zone_ridge_a: {
        id: 'zone_ridge_a',
        name: 'Terrace Ridge A',
        connectedZones: ['zone_canyon_basin', 'choke_terrace_path'],
        coverQuality: 0.45,
        engagementDistance: 'long'
      },
      choke_terrace_path: {
        id: 'choke_terrace_path',
        name: 'Terrace Path Choke A',
        isChoke: true,
        site: 'A',
        connectedZones: ['zone_ridge_a', 'zone_radar_terrace_a'],
        coverQuality: 0.25,
        engagementDistance: 'long'
      },
      zone_radar_terrace_a: {
        id: 'zone_radar_terrace_a',
        name: 'Bombsite A (Radar Terrace)',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['choke_terrace_path', 'zone_solar_array', 'zone_trench_connector_a', 'zone_command_bunker'],
        coverQuality: 0.65,
        engagementDistance: 'long'
      },
      zone_solar_array: {
        id: 'zone_solar_array',
        name: 'Solar Panel Array',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['zone_radar_terrace_a'],
        coverQuality: 0.7,
        engagementDistance: 'long'
      },
      zone_silo_access_b: {
        id: 'zone_silo_access_b',
        name: 'Silo Access Road B',
        connectedZones: ['zone_canyon_basin', 'choke_blast_hatch'],
        coverQuality: 0.5,
        engagementDistance: 'medium'
      },
      choke_blast_hatch: {
        id: 'choke_blast_hatch',
        name: 'Blast Hatch Choke B',
        isChoke: true,
        site: 'B',
        connectedZones: ['zone_silo_access_b', 'zone_missile_silo_b'],
        coverQuality: 0.2,
        engagementDistance: 'close'
      },
      zone_missile_silo_b: {
        id: 'zone_missile_silo_b',
        name: 'Bombsite B (Missile Silo)',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['choke_blast_hatch', 'zone_blast_chamber', 'zone_vent_shaft_b', 'zone_command_bunker'],
        coverQuality: 0.8,
        engagementDistance: 'close'
      },
      zone_blast_chamber: {
        id: 'zone_blast_chamber',
        name: 'Silo Exhaust Pit',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['zone_missile_silo_b'],
        coverQuality: 0.75,
        engagementDistance: 'close'
      },
      zone_trench_mid: {
        id: 'zone_trench_mid',
        name: 'Canyon Gorge Trench (Mid)',
        connectedZones: ['zone_canyon_basin', 'zone_trench_connector_a', 'zone_vent_shaft_b'],
        coverQuality: 0.4,
        engagementDistance: 'long'
      },
      zone_trench_connector_a: {
        id: 'zone_trench_connector_a',
        name: 'Trench Cut Connector A',
        connectedZones: ['zone_trench_mid', 'zone_radar_terrace_a'],
        coverQuality: 0.5,
        engagementDistance: 'medium'
      },
      zone_vent_shaft_b: {
        id: 'zone_vent_shaft_b',
        name: 'Sub-Surface Vent Shaft B',
        connectedZones: ['zone_trench_mid', 'zone_missile_silo_b'],
        coverQuality: 0.6,
        engagementDistance: 'close'
      },
      zone_command_bunker: {
        id: 'zone_command_bunker',
        name: 'Command Bunker (CT Spawn)',
        isSpawn: 'defenders',
        connectedZones: ['zone_radar_terrace_a', 'zone_missile_silo_b'],
        coverQuality: 0.7,
        engagementDistance: 'medium'
      }
    },
    rotationTimes: {
      zone_command_bunker: { zone_radar_terrace_a: 6, zone_missile_silo_b: 6 },
      zone_radar_terrace_a: { zone_missile_silo_b: 15, zone_trench_mid: 9 },
      zone_missile_silo_b: { zone_radar_terrace_a: 15, zone_trench_mid: 9 }
    }
  },

  northpoint: {
    id: 'northpoint',
    name: 'Northpoint',
    description: 'Sub-zero arctic polar research facility with cryogenic laboratories and heavy drill halls.',
    attackerSpawnZone: 'zone_helipad_tarmac',
    defenderSpawnZone: 'zone_server_core',
    siteAZones: ['zone_cryo_lab_a', 'zone_mezzanine'],
    siteBZones: ['zone_drill_hall_b', 'zone_generator_room'],
    chokeZones: ['choke_decon_chamber', 'choke_generator_tunnel'],
    zones: {
      zone_helipad_tarmac: {
        id: 'zone_helipad_tarmac',
        name: 'Helipad Tarmac (T Spawn)',
        isSpawn: 'attackers',
        connectedZones: ['zone_snow_drift_a', 'zone_crevasse_mid', 'zone_hangar_road_b'],
        coverQuality: 0.5,
        engagementDistance: 'long'
      },
      zone_snow_drift_a: {
        id: 'zone_snow_drift_a',
        name: 'Snow Drift A',
        connectedZones: ['zone_helipad_tarmac', 'choke_decon_chamber'],
        coverQuality: 0.45,
        engagementDistance: 'medium'
      },
      choke_decon_chamber: {
        id: 'choke_decon_chamber',
        name: 'Decontamination Chamber Choke A',
        isChoke: true,
        site: 'A',
        connectedZones: ['zone_snow_drift_a', 'zone_cryo_lab_a'],
        coverQuality: 0.25,
        engagementDistance: 'close'
      },
      zone_cryo_lab_a: {
        id: 'zone_cryo_lab_a',
        name: 'Bombsite A (Cryogenic Lab)',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['choke_decon_chamber', 'zone_mezzanine', 'zone_duct_connector_a', 'zone_server_core'],
        coverQuality: 0.75,
        engagementDistance: 'medium'
      },
      zone_mezzanine: {
        id: 'zone_mezzanine',
        name: 'Observation Mezzanine',
        site: 'A',
        isSiteArea: true,
        connectedZones: ['zone_cryo_lab_a'],
        coverQuality: 0.8,
        engagementDistance: 'long'
      },
      zone_hangar_road_b: {
        id: 'zone_hangar_road_b',
        name: 'Hangar Road B',
        connectedZones: ['zone_helipad_tarmac', 'choke_generator_tunnel'],
        coverQuality: 0.5,
        engagementDistance: 'medium'
      },
      choke_generator_tunnel: {
        id: 'choke_generator_tunnel',
        name: 'Generator Tunnel Choke B',
        isChoke: true,
        site: 'B',
        connectedZones: ['zone_hangar_road_b', 'zone_drill_hall_b'],
        coverQuality: 0.25,
        engagementDistance: 'close'
      },
      zone_drill_hall_b: {
        id: 'zone_drill_hall_b',
        name: 'Bombsite B (Deep Borehole Drill)',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['choke_generator_tunnel', 'zone_generator_room', 'zone_vent_connector_b', 'zone_server_core'],
        coverQuality: 0.7,
        engagementDistance: 'medium'
      },
      zone_generator_room: {
        id: 'zone_generator_room',
        name: 'Heavy Diesel Generator Room',
        site: 'B',
        isSiteArea: true,
        connectedZones: ['zone_drill_hall_b'],
        coverQuality: 0.75,
        engagementDistance: 'close'
      },
      zone_crevasse_mid: {
        id: 'zone_crevasse_mid',
        name: 'Ice Crevasse Bridge (Mid)',
        connectedZones: ['zone_helipad_tarmac', 'zone_duct_connector_a', 'zone_vent_connector_b'],
        coverQuality: 0.45,
        engagementDistance: 'long'
      },
      zone_duct_connector_a: {
        id: 'zone_duct_connector_a',
        name: 'Cryo Duct Connector A',
        connectedZones: ['zone_crevasse_mid', 'zone_cryo_lab_a'],
        coverQuality: 0.55,
        engagementDistance: 'close'
      },
      zone_vent_connector_b: {
        id: 'zone_vent_connector_b',
        name: 'Utility Trench Connector B',
        connectedZones: ['zone_crevasse_mid', 'zone_drill_hall_b'],
        coverQuality: 0.5,
        engagementDistance: 'close'
      },
      zone_server_core: {
        id: 'zone_server_core',
        name: 'Server Core (CT Spawn)',
        isSpawn: 'defenders',
        connectedZones: ['zone_cryo_lab_a', 'zone_drill_hall_b'],
        coverQuality: 0.65,
        engagementDistance: 'medium'
      }
    },
    rotationTimes: {
      zone_server_core: { zone_cryo_lab_a: 5, zone_drill_hall_b: 5 },
      zone_cryo_lab_a: { zone_drill_hall_b: 12, zone_crevasse_mid: 7 },
      zone_drill_hall_b: { zone_cryo_lab_a: 12, zone_crevasse_mid: 7 }
    }
  }
};

export function getFpsMap(mapId: FpsMapId): FpsMap {
  const map = FPS_MAPS[mapId];
  if (!map) {
    throw new Error(`Unknown map ID: ${mapId}`);
  }
  return map;
}

export function validateMapReachability(map: FpsMap): boolean {
  // Check that both attacker and defender spawns can reach both Site A and Site B
  const visitedFromT = new Set<string>();
  const queueT: string[] = [map.attackerSpawnZone];
  visitedFromT.add(map.attackerSpawnZone);
  while (queueT.length > 0) {
    const current = queueT.shift()!;
    const zone = map.zones[current];
    if (!zone) continue;
    for (const neighbor of zone.connectedZones) {
      if (!visitedFromT.has(neighbor)) {
        visitedFromT.add(neighbor);
        queueT.push(neighbor);
      }
    }
  }

  const visitedFromCT = new Set<string>();
  const queueCT: string[] = [map.defenderSpawnZone];
  visitedFromCT.add(map.defenderSpawnZone);
  while (queueCT.length > 0) {
    const current = queueCT.shift()!;
    const zone = map.zones[current];
    if (!zone) continue;
    for (const neighbor of zone.connectedZones) {
      if (!visitedFromCT.has(neighbor)) {
        visitedFromCT.add(neighbor);
        queueCT.push(neighbor);
      }
    }
  }

  // Verify all site zones are reachable from both spawns
  const allSites = [...map.siteAZones, ...map.siteBZones];
  for (const siteZone of allSites) {
    if (!visitedFromT.has(siteZone) || !visitedFromCT.has(siteZone)) {
      return false;
    }
  }

  return true;
}
