import { getFpsMap as getMapById } from './fpsMaps.ts';
import type { FpsRoundTactics } from './fpsPersonality.ts';
import type {
  FpsMap,
  FpsMatchEvent,
  FpsMatchReport,
  FpsPlayerLoadout,
  FpsRoundPlayerSnapshot,
  FpsSide,
  FpsTeamId
} from './fpsTypes.ts';

export interface FpsMapPoint {
  x: number;
  y: number;
}

export interface FpsReplayPlayer {
  playerId: string;
  name: string;
  team: FpsTeamId;
  side: FpsSide;
  zone: string;
  isAlive: boolean;
  hp: number;
  loadout: FpsPlayerLoadout;
  tactics?: FpsRoundTactics;
}

export interface FpsUtilityMarker {
  event: FpsMatchEvent;
  zone: string;
  kind: 'smoke' | 'flash';
}

export interface FpsReplayState {
  players: FpsReplayPlayer[];
  utility: FpsUtilityMarker[];
  bomb: { status: 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded' | 'none'; zone?: string; site?: 'A' | 'B'; remainingSeconds?: number };
  event?: FpsMatchEvent;
  eventIndex: number;
  clockText: string;
  score: { blue: number; red: number };
}

const EMPTY_LOADOUT: FpsPlayerLoadout = {
  secondaryWeapon: 'sidearm_standard',
  armor: 0,
  hasHelmet: false,
  hasDefuseKit: false,
  hasBomb: false,
  utilities: []
};

function cloneLoadout(loadout: FpsPlayerLoadout): FpsPlayerLoadout {
  return { ...loadout, utilities: [...loadout.utilities] };
}

function roundSnapshots(report: FpsMatchReport, roundNumber: number): FpsRoundPlayerSnapshot[] {
  return (report.roundSnapshots ?? []).filter(snapshot => snapshot.roundNumber === roundNumber);
}

export function getFpsRoundEvents(report: FpsMatchReport, roundNumber: number): FpsMatchEvent[] {
  return report.events.filter(event => event.roundNumber === roundNumber);
}

export function getFpsHalfLabel(roundNumber: number): string {
  if (roundNumber > 30) return 'OVERTIME';
  return roundNumber <= 15 ? 'FIRST HALF' : 'SECOND HALF';
}

export function formatFpsEventClock(event?: FpsMatchEvent): string {
  if (!event || !Number.isFinite(event.second)) return '—';
  const minutes = Math.floor(Math.max(0, event.second) / 60);
  const seconds = Math.floor(Math.max(0, event.second) % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function mapPlayersAtRoundStart(report: FpsMatchReport, roundNumber: number): FpsReplayPlayer[] {
  const map = getMapById(report.mapId);
  const snapshots = roundSnapshots(report, roundNumber);
  if (snapshots.length) {
    return snapshots.map(snapshot => ({
      playerId: snapshot.playerId,
      name: report.playerStats[snapshot.playerId]?.name ?? snapshot.playerId,
      team: snapshot.team,
      side: snapshot.side,
      zone: map.zones[snapshot.currentZone] ? snapshot.currentZone : (
        snapshot.side === 'attackers' ? map.attackerSpawnZone : map.defenderSpawnZone
      ),
      isAlive: snapshot.isAlive,
      hp: snapshot.hp,
      loadout: cloneLoadout(snapshot.loadout),
      tactics: snapshot.tactics ? structuredClone(snapshot.tactics) : undefined
    }));
  }

  const swapsBeforeRound = report.events.filter(
    event => event.type === 'side_swap' && event.roundNumber <= roundNumber
  ).length;
  const blueSide: FpsSide = swapsBeforeRound % 2 === 0 ? 'attackers' : 'defenders';
  return Object.values(report.playerStats).map(player => {
    const side = player.team === 'blue' ? blueSide : blueSide === 'attackers' ? 'defenders' : 'attackers';
    return {
      playerId: player.playerId,
      name: player.name,
      team: player.team,
      side,
      zone: side === 'attackers' ? map.attackerSpawnZone : map.defenderSpawnZone,
      isAlive: true,
      hp: 100,
      loadout: cloneLoadout(EMPTY_LOADOUT)
    };
  });
}

function scoreBeforeRound(report: FpsMatchReport, roundNumber: number): { blue: number; red: number } {
  const previous = report.roundResults.reduce<typeof report.roundResults[number] | undefined>(
    (latest, result) => result.roundNumber < roundNumber && (!latest || result.roundNumber > latest.roundNumber)
      ? result
      : latest,
    undefined
  );
  return previous
    ? { blue: previous.blueScoreAfter, red: previous.redScoreAfter }
    : { blue: 0, red: 0 };
}

export function getFpsReplayState(
  report: FpsMatchReport,
  roundNumber: number,
  eventIndex: number
): FpsReplayState {
  const events = getFpsRoundEvents(report, roundNumber);
  const cursor = Math.max(-1, Math.min(eventIndex, events.length - 1));
  const visibleEvents = events.slice(0, cursor + 1);
  const players = mapPlayersAtRoundStart(report, roundNumber);
  const playerById = new Map(players.map(player => [player.playerId, player]));
  const utility: FpsUtilityMarker[] = [];
  let bomb: FpsReplayState['bomb'] = {
    status: players.some(player => player.loadout.hasBomb && player.isAlive) ? 'carried' : 'none'
  };
  let plantedAt: number | undefined;

  for (const event of visibleEvents) {
    if (event.zone) {
      const actor = event.actorId ? playerById.get(event.actorId) : undefined;
      const target = event.targetId ? playerById.get(event.targetId) : undefined;
      if (actor && (report.simulationVersion !== 2 && report.simulationVersion !== 3 || ['player_moved', 'plant_started', 'plant_completed', 'defuse_started', 'defuse_completed'].includes(event.type))) actor.zone = event.zone;
      if (target) target.zone = event.zone;
    }

    if (event.type === 'damage' && event.targetId) {
      const target = playerById.get(event.targetId);
      if (target && event.targetHp !== undefined) target.hp = event.targetHp;
      if (target && event.targetArmor !== undefined) target.loadout.armor = event.targetArmor;
    }
    if (event.type === 'bomb_dropped') bomb = { status: 'dropped', zone: event.zone };
    if(event.type==='weapon_recovered' && event.actorId && event.weaponId) {
      const actor=playerById.get(event.actorId);if(actor)actor.loadout.primaryWeapon=event.weaponId;
    }
    if (event.type === 'bomb_picked_up') {
      const carrier = event.actorId ? playerById.get(event.actorId) : undefined;
      if (carrier) carrier.loadout.hasBomb = true;
      bomb = { status: 'carried' };
    }
    if (event.type === 'kill' || event.type === 'trade_kill' || event.type === 'player_eliminated') {
      const target = event.targetId ? playerById.get(event.targetId) : undefined;
      if (target) {
        target.isAlive = false;
        target.hp = 0;
        target.loadout.hasBomb = false;
      }
    }

    if (event.type === 'utility_deployed' && event.zone && event.weaponId) {
      const actor = event.actorId ? playerById.get(event.actorId) : undefined;
      const slot = actor?.loadout.utilities.indexOf(event.weaponId) ?? -1;
      if (actor && slot >= 0) actor.loadout.utilities.splice(slot, 1);
      const kind = event.weaponId === 'utility_smoke' ? 'smoke' : event.weaponId === 'utility_flash' ? 'flash' : undefined;
      if (kind) utility.push({ event, zone: event.zone, kind });
    }

    if (event.type === 'plant_completed') {
      for (const player of players) player.loadout.hasBomb = false;
      plantedAt = event.second;
      bomb = { status: 'planted', site: event.site, zone: event.zone, remainingSeconds: 40 };
    } else if (event.type === 'defuse_completed') {
      bomb = { status: 'defused', site: event.site };
    } else if (event.type === 'round_end') {
      const result = report.roundResults.find(item => item.roundNumber === roundNumber);
      if (result?.reason === 'device_exploded') bomb = { status: 'exploded', site: result.plantedSite, remainingSeconds: 0 };
      if (result?.reason === 'device_defused') bomb = { status: 'defused', site: result.plantedSite };
    }
  }

  if (bomb.status === 'planted' && plantedAt !== undefined && cursor >= 0) {
    bomb.remainingSeconds = Math.max(0, 40 - (events[cursor].second - plantedAt));
  }

  const score = scoreBeforeRound(report, roundNumber);
  const event = cursor >= 0 ? events[cursor] : undefined;
  const roundStart = events.find(item => item.type === 'round_start');
  const elapsedSeconds = event?.type === 'round_end'
    ? report.roundResults.find(result => result.roundNumber === roundNumber)?.roundDurationSeconds ?? 0
    : event && roundStart
      ? Math.max(0, event.second - roundStart.second)
      : 0;
  const secondsRemaining = bomb.status === 'planted' ? bomb.remainingSeconds ?? 0 : Math.max(0, 115 - elapsedSeconds + ((report.simulationVersion === 2 || report.simulationVersion === 3) ? 15 : 0));
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = Math.floor(secondsRemaining % 60);
  if (visibleEvents.some(event => event.type === 'round_end')) {
    const result = report.roundResults.find(item => item.roundNumber === roundNumber);
    if (result) {
      score.blue = result.blueScoreAfter;
      score.red = result.redScoreAfter;
    }
  }

  return {
    players,
    utility,
    bomb,
    event,
    eventIndex: cursor,
    clockText: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    score
  };
}

export function buildFpsMapLayout(map: FpsMap): Record<string, FpsMapPoint> {
  const distance = new Map<string, number>([[map.attackerSpawnZone, 0]]);
  const queue = [map.attackerSpawnZone];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    for (const neighbor of map.zones[id]?.connectedZones ?? []) {
      if (!map.zones[neighbor] || distance.has(neighbor)) continue;
      distance.set(neighbor, distance.get(id)! + 1);
      queue.push(neighbor);
    }
  }

  const unreachable = Object.keys(map.zones).filter(id => !distance.has(id)).sort();
  for (const id of unreachable) distance.set(id, (Math.max(0, ...distance.values()) + 1));
  const maxDepth = Math.max(1, ...distance.values());
  const columns = new Map<number, string[]>();
  for (const id of Object.keys(map.zones)) {
    const depth = distance.get(id) ?? 0;
    columns.set(depth, [...(columns.get(depth) ?? []), id]);
  }

  const layout: Record<string, FpsMapPoint> = {};
  for (const [depth, ids] of columns) {
    ids.sort((a, b) => a.localeCompare(b));
    ids.forEach((id, index) => {
      const count = ids.length;
      layout[id] = {
        x: maxDepth === 0 ? 50 : 8 + (depth / maxDepth) * 84,
        y: count === 1 ? 50 : 8 + (index / (count - 1)) * 84
      };
    });
  }
  return layout;
}
