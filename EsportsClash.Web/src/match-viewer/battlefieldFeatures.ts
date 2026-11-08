import type { ArenaAtmosphere, ArenaElement, ArenaFeature, ArenaLightingId } from './ArenaFrame';

/** Minimal structural inputs so this stays a pure, renderer-free presentation adapter. */
type ScuttlerLike = { id:string; x:number; y:number; hp:number; maxHp:number; isAlive:boolean; shrineTeam?:'blue'|'red'; shrineExpiresAt?:number };
type PlantLike = { id:string; kind:'blast_cone'|'scryer_bloom'|'honeyfruit'; x:number; y:number; isAlive:boolean };
type PortalLike = { id:string; team:'blue'|'red'; fromX:number; fromY:number; toX:number; toY:number; expiresAt:number };
type SupplyDropLike = { id:string; x:number; y:number; active:boolean; capturingTeam?:'blue'|'red'; captureProgress:number; claimedByTeam?:'blue'|'red' };

/** Overtime Convergence begins at 18:00; the lighting turns to dusk from then on. */
export const DUSK_START_SECOND = 18 * 60;
const LIGHTING_IDS: readonly ArenaLightingId[] = ['daylight', 'dusk', 'overcast'];

export function parseLightingOverride(value: string | null | undefined): ArenaLightingId | undefined {
  return LIGHTING_IDS.find(id => id === value);
}

/** Read-only presentation state. Never feeds back into the simulation. */
export function resolveArenaAtmosphere(second: number, element: ArenaElement | null, override?: ArenaLightingId): ArenaAtmosphere {
  return Object.freeze({ lighting: override ?? (second >= DUSK_START_SECOND ? 'dusk' : 'daylight'), element });
}

/**
 * Copies primitives for every live battlefield prop. Dormant plants stay visible (active=false)
 * so players can read their respawn state; dead scuttlers, expired gates and claimed drops are omitted.
 */
export function buildArenaFeatures(input: {
  second: number;
  scuttlers: readonly ScuttlerLike[];
  plants: readonly PlantLike[];
  portals: readonly PortalLike[];
  supplyDrop: SupplyDropLike | null;
  /** Seconds of uncontested standing needed to claim the drop (`SUPPLY_DROP_CAPTURE_SECONDS`). */
  supplyCaptureSeconds: number;
}): ArenaFeature[] {
  const out: ArenaFeature[] = [];
  for (const s of input.scuttlers) {
    if (s.isAlive) out.push({ id: s.id, kind: 'scuttler', x: s.x, y: s.y, team: 'neutral', active: true, hp: s.hp, maxHp: s.maxHp });
    if (s.shrineTeam && s.shrineExpiresAt !== undefined && input.second < s.shrineExpiresAt) {
      out.push({ id: `${s.id}:shrine`, kind: 'speed_shrine', x: s.x, y: s.y, team: s.shrineTeam, active: true, hp: 1, maxHp: 1,
        progress: Math.max(0, Math.min(1, (s.shrineExpiresAt - input.second) / 65)) });
    }
  }
  for (const p of input.plants) {
    out.push({ id: p.id, kind: p.kind, x: p.x, y: p.y, team: 'neutral', active: p.isAlive, hp: p.isAlive ? 1 : 0, maxHp: 1 });
  }
  for (const g of input.portals) {
    if (g.expiresAt <= input.second) continue;
    out.push({ id: `${g.id}:in`, kind: 'hexgate', x: g.fromX, y: g.fromY, team: g.team, active: true, hp: 1, maxHp: 1 });
    out.push({ id: `${g.id}:out`, kind: 'hexgate', x: g.toX, y: g.toY, team: g.team, active: true, hp: 1, maxHp: 1 });
  }
  const d = input.supplyDrop;
  if (d && d.active && !d.claimedByTeam) {
    out.push({ id: d.id, kind: 'supply_drop', x: d.x, y: d.y, team: d.capturingTeam ?? 'neutral', active: true, hp: 1, maxHp: 1,
      progress: Math.max(0, Math.min(1, d.captureProgress / Math.max(0.001, input.supplyCaptureSeconds))) });
  }
  return out;
}
