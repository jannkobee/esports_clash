import type { LiveMapDefinition, LiveMapId, LiveMapRuntime } from './fpsLiveMapTypes.ts';
import { FONTESSA_MAP_DEFINITION, FONTESSA_MAP_RUNTIME } from './fpsLiveMap.ts';
import { SPILLWAY_MAP_DEFINITION, SPILLWAY_MAP_RUNTIME } from './fpsSpillwayMap.ts';

export const LIVE_MAP_DEFINITIONS: Readonly<Record<LiveMapId, LiveMapDefinition>> = Object.freeze({
  fontessa: FONTESSA_MAP_DEFINITION,
  spillway: SPILLWAY_MAP_DEFINITION,
});

export const LIVE_MAP_RUNTIMES: Readonly<Record<LiveMapId, LiveMapRuntime>> = Object.freeze({
  fontessa: FONTESSA_MAP_RUNTIME,
  spillway: SPILLWAY_MAP_RUNTIME,
});

export function getLiveMapDefinition(mapId: LiveMapId = 'fontessa'): LiveMapDefinition {
  return LIVE_MAP_DEFINITIONS[mapId] ?? FONTESSA_MAP_DEFINITION;
}

export function getLiveMapRuntime(mapId: LiveMapId = 'fontessa'): LiveMapRuntime {
  return LIVE_MAP_RUNTIMES[mapId] ?? LIVE_MAP_RUNTIMES.fontessa;
}

export function listLiveMaps(): readonly LiveMapDefinition[] {
  return [FONTESSA_MAP_DEFINITION, SPILLWAY_MAP_DEFINITION];
}
