import type { ArenaSceneFrame } from './match-viewer/ArenaFrame.ts';
import type { RecordedMatchEvent } from './matchReplay.ts';

export interface OnlineSnapshot {
  type: 'snapshot'; schema: 1; match_id: string; sequence: number; plan_hash: string;
  versions: Record<string, string>; speed: number;
  execution?:{mode:string;from_second?:number;notice?:string};
  snapshot: { schema: 1; second: number; finished: boolean; fingerprint: string;
    frame: ArenaSceneFrame; events: RecordedMatchEvent[] };
}

export function acceptOnlineSnapshot(raw: unknown, matchId: string, versions: Record<string, string>, lastSequence: number): raw is OnlineSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const value = raw as OnlineSnapshot, frame = value.snapshot?.frame;
  return value.type === 'snapshot' && value.schema === 1 && value.match_id === matchId
    && Number.isSafeInteger(value.sequence) && value.sequence > lastSequence && value.sequence <= 7202
    && !!value.versions && Object.entries(versions).every(([key, version]) => value.versions[key] === version)
    && !!frame && Number.isFinite(frame.second) && frame.second >= 0 && frame.second <= 1801
    && Array.isArray(frame.champions) && frame.champions.length === 10
    && Array.isArray(frame.minions) && frame.minions.length <= 2000
    && Array.isArray(frame.structures) && Array.isArray(frame.projectiles) && Array.isArray(frame.spells)
    && Array.isArray(frame.camps) && Array.isArray(frame.wards) && !!frame.dragon
    && [...frame.champions, ...frame.minions, ...frame.structures].every(unit => Number.isFinite(unit.x) && Number.isFinite(unit.y));
}

/** Interpolate received positions only. No extrapolation, game clock or combat resolution. */
export function interpolateSpectatorFrame(previous: ArenaSceneFrame, current: ArenaSceneFrame, fraction: number): ArenaSceneFrame {
  const t = Math.max(0, Math.min(1, fraction));
  const blend = <T extends {readonly id:string;readonly x:number;readonly y:number;readonly isAlive?:boolean}>(before:readonly T[],after:readonly T[]):T[] => {
    const positions=new Map(before.map(actor=>[actor.id,actor]));
    return after.map(actor=>{
      const prior=positions.get(actor.id);
      return prior&&prior.isAlive!==false&&actor.isAlive!==false
        ? {...actor,x:prior.x+(actor.x-prior.x)*t,y:prior.y+(actor.y-prior.y)*t}:actor;
    });
  };
  return { ...current, second: previous.second + (current.second - previous.second) * t,
    champions:blend(previous.champions,current.champions),
    minions:blend(previous.minions,current.minions),
    projectiles:blend(previous.projectiles,current.projectiles) };
}
