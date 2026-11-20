/**
 * Official matches on the live 3D engine (simulation version 5).
 *
 * One deterministic, headless run per scheduled match: the pinned allocation (players, manager-chosen
 * roles, identity, seed, map) in, the MR15 report the API settles (same contract as the recorded engine)
 * out. Learners are frozen (the engine's defaults), nothing is persisted, and the public report carries
 * no private identity state. An optional observer receives every tick (the replay recorder).
 */
import type { PlayerCard } from '../types.ts';
import type { FpsIdentityExperiment, FpsMatchEvent, FpsPlayerMatchStats, FpsRoundResult, FpsTeamId } from './fpsTypes.ts';
import type { LiveMapId } from './fpsLiveMapTypes.ts';
import { FpsLiveSimulation, LIVE_FPS_STEP, type FpsPlaybookUpdate, type LiveEvent, type LiveRoundTelemetry, type LiveSimulationOptions } from './fpsLiveSimulation.ts';
import { FPS_BEHAVIOR_METRICS, type FpsBehaviorMetric } from './fpsPlayerArchitecture.ts';
import type { FpsAudioCue } from './fpsBroadcastAudio.ts';
import { compatibleApproved } from './fpsApprovedLearning.ts';
import { loadFpsOpponentModel, loadFpsTeamPlaybook } from './fpsLivePlaybook.ts';
import { loadFpsUtilityBrain } from './fpsUtilityBrain.ts';

export const FPS_OFFICIAL_SIMULATION_VERSION = 5;
export const FPS_OFFICIAL_LIVE_MAPS: readonly LiveMapId[] = ['fontessa', 'spillway'];
/** Map for a new allocation, from its seed (the API mirrors this choice). */
export const officialLiveMapForSeed = (seed: number): LiveMapId => FPS_OFFICIAL_LIVE_MAPS[seed % FPS_OFFICIAL_LIVE_MAPS.length];

export type FpsOfficialRoundReason = 'attackers_eliminated' | 'defenders_eliminated' | 'device_exploded' | 'device_defused' | 'time_expired';
const REASONS: Record<string, FpsOfficialRoundReason> = {
  'Device detonated': 'device_exploded', 'Device defused': 'device_defused', 'Defenders eliminated': 'defenders_eliminated',
  'Attackers eliminated': 'attackers_eliminated', 'Time expired': 'time_expired',
};

export interface FpsOfficialLiveReport {
  version: 1; simulationVersion: 5; engine: 'live-3d'; format: 'MR15_TACTICAL_FPS';
  seed: number; mapId: LiveMapId; mapName: string; totalRounds: number;
  winnerTeam: FpsTeamId; winner: FpsTeamId;
  finalScore: Record<FpsTeamId, number>; halfScore: Record<FpsTeamId, number>; secondHalfScore: Record<FpsTeamId, number>; overtimeScore?: Record<FpsTeamId, number>;
  roundResults: FpsRoundResult[]; playerStats: Record<string, FpsPlayerMatchStats>; events: FpsMatchEvent[];
  /** Observed decisions per player and metric (lawful, decision-only): the identity engine adds these counts. */
  behaviorSummary: Record<string, Partial<Record<FpsBehaviorMetric, { opportunities: number; attempts: number }>>>;
  /** Each player's assigned position per round (role familiarity); no private state. */
  roundSnapshots: { roundNumber: number; playerId: string; team: FpsTeamId; side: 'attackers' | 'defenders'; tactics: { position: string } }[];
  /** Played (live) seconds, the basis for training XP. */
  durationSeconds: number;
  /** Whole broadcast length in seconds (freeze, live and post-round time): replay and settlement timing. */
  broadcastSeconds: number;
  /** Broadcast timestamp (seconds) when each round's live phase started, for replay round-seeking. */
  roundStartSeconds: number[];
  /** Lawful per-round playbook/opponent summaries when club playbooks were pinned for this match. */
  playbookExperience?: Partial<Record<FpsTeamId, { rounds: FpsPlaybookUpdate['round'][]; observed: NonNullable<FpsPlaybookUpdate['observed']>[] }>>;
}
export interface FpsOfficialTeamLearningInput {
  playbook?: unknown;
  opponents?: unknown;
  utility?: unknown;
  opponentId?: string;
}
export interface FpsOfficialTick { sim: FpsLiveSimulation; tick: number; cues: FpsAudioCue[] }
export interface FpsOfficialOptions {
  /** Called after every simulation step (replay recording). */
  onTick?: (tick: FpsOfficialTick) => void;
  /** Safety bound; a regulation match is about 95k steps. */
  maxSteps?: number;
  /** Optional immutable hash-pinned approved learning bundle (run strictly frozen for determinism). */
  approvedBundle?: unknown;
  /** Optional per-team frozen lineage snapshots (club playbooks, opponent models, utility brains). */
  teamLearning?: Partial<Record<FpsTeamId, FpsOfficialTeamLearningInput>>;
}

export function simulateOfficialLiveMatch(blue: PlayerCard[], red: PlayerCard[], seed: number, mapId: LiveMapId,
  identity: FpsIdentityExperiment, options: FpsOfficialOptions = {}): FpsOfficialLiveReport {
  if (!FPS_OFFICIAL_LIVE_MAPS.includes(mapId)) throw new Error(`Unsupported official live map: ${mapId}`);
  const rounds: LiveRoundTelemetry[] = [];
  const approved = compatibleApproved(options.approvedBundle);
  const playbookExperience: Partial<Record<FpsTeamId, { rounds: FpsPlaybookUpdate['round'][]; observed: NonNullable<FpsPlaybookUpdate['observed']>[] }>> = {};
  const teamLearning: NonNullable<LiveSimulationOptions['teamLearning']> = {};
  for (const team of ['blue', 'red'] as const) {
    const input = options.teamLearning?.[team];
    const book = loadFpsTeamPlaybook(input?.playbook) ?? approved?.playbooks?.[mapId];
    const opponents = loadFpsOpponentModel(input?.opponents) ?? approved?.opponents;
    const util = loadFpsUtilityBrain(input?.utility) ?? approved?.utility;
    if (book || opponents || util) {
      const bucket = { rounds: [] as FpsPlaybookUpdate['round'][], observed: [] as NonNullable<FpsPlaybookUpdate['observed']>[] };
      if (book || input?.playbook || input?.opponentId) playbookExperience[team] = bucket;
      teamLearning[team] = {
        ...(book || input?.opponentId ? {
          playbook: {
            mode: 'frozen',
            ...(book && book.map === mapId ? { model: book } : {}),
            ...(opponents ? { opponents } : {}),
            ...(input?.opponentId ? { opponent: input.opponentId } : {}),
            onRound: u => { bucket.rounds.push(u.round); if (u.observed) bucket.observed.push(u.observed); },
          },
        } : {}),
        ...(util ? { utilityLearning: { mode: 'frozen', model: util } } : {}),
      };
    }
  }
  const simOptions: LiveSimulationOptions = {
    mapId,
    onRoundComplete: r => rounds.push(r),
    ...(approved ? {
      learning: { mode: 'frozen', model: approved.navigation },
      mechanicsLearning: { mode: 'frozen', model: approved.combat },
      movementLearning: { mode: 'frozen', model: approved.movement },
      ...(approved.utility ? { utilityLearning: { mode: 'frozen', model: approved.utility } } : {}),
    } : {}),
    ...(Object.keys(teamLearning).length ? { teamLearning } : {}),
  };
  // Strictly frozen: deterministic across processes; optional pinned models never mutate in-match.
  const sim = new FpsLiveSimulation(blue, red, seed, identity, simOptions);
  const names = new Map([...blue, ...red].map(p => [p.id, p.name]));
  const events: FpsMatchEvent[] = [];
  const clutches = new Map<string, number>(), setPieces = new Map<string, number>();
  let lastEvent = 0, tick = 0, liveStartedAt = 0, roundLive = 0;
  let clutch: { team: FpsTeamId; id: string } | undefined;
  let executeCounted = false;
  const roundDurations: number[] = [];
  const roundStartSeconds: number[] = [];
  const roundExecuted: boolean[] = [];
  const roundCash: { blue: number; red: number }[] = [];
  const maxSteps = options.maxSteps ?? 400_000;
  let previous = sim.officialRoundState();
  while (previous.phase !== 'finished' && tick < maxSteps) {
    sim.step(); tick++;
    const cues = sim.drainAudioCues();
    options.onTick?.({ sim, tick, cues });
    const state = sim.officialRoundState();
    if (previous.phase !== 'live' && state.phase === 'live') {
      liveStartedAt = state.time; clutch = undefined; executeCounted = false;
      roundStartSeconds.push(+(tick * LIVE_FPS_STEP).toFixed(2));
      roundCash.push({ ...state.cash });
    }
    if (state.phase === 'live') {
      roundLive = state.time - liveStartedAt;
      // A clutch: one player left against at least one opponent, decided by the round result below.
      for (const team of ['blue', 'red'] as const) {
        const other = team === 'blue' ? 'red' : 'blue';
        if (!clutch && state.alive[team].length === 1 && state.alive[other].length >= 1) clutch = { team, id: state.alive[team][0] };
      }
      if (state.executing && !executeCounted) {
        executeCounted = true;
        for (const id of state.alive[state.attackTeam]) setPieces.set(id, (setPieces.get(id) ?? 0) + 1);
      }
    }
    for (const e of sim.eventsSince(lastEvent)) { lastEvent = e.id; const converted = convertEvent(e, state.round, tick, names); if (converted) events.push(converted); }
    if (previous.phase === 'live' && state.phase !== 'live') {
      roundDurations.push(Math.max(LIVE_FPS_STEP, roundLive));
      roundExecuted.push(executeCounted);
      const result = rounds[rounds.length - 1];
      if (clutch && result?.winner === clutch.team && state.alive[clutch.team].includes(clutch.id)) clutches.set(clutch.id, (clutches.get(clutch.id) ?? 0) + 1);
    }
    previous = state;
  }
  if (previous.phase !== 'finished') throw new Error('Official live match did not finish within its step bound.');
  const snapshot = sim.snapshot();
  const score: Record<FpsTeamId, number> = { blue: 0, red: 0 };
  const half: Record<FpsTeamId, number> = { blue: 0, red: 0 }, second: Record<FpsTeamId, number> = { blue: 0, red: 0 }, overtime: Record<FpsTeamId, number> = { blue: 0, red: 0 };
  const roundResults: FpsRoundResult[] = rounds.map((r, i) => {
    score[r.winner]++;
    (r.round <= 15 ? half : r.round <= 30 ? second : overtime)[r.winner]++;
    const reason = REASONS[r.reason];
    if (!reason) throw new Error(`Unknown round end reason: ${r.reason}`);
    const executed = roundExecuted[i] ?? false;
    const cash = roundCash[i] ?? { blue: 0, red: 0 };
    return {
      roundNumber: i + 1, winnerTeam: r.winner, winnerSide: r.winner === r.attackTeam ? 'attackers' : 'defenders', reason,
      roundDurationSeconds: +(roundDurations[i] ?? LIVE_FPS_STEP).toFixed(2), devicePlanted: r.planted, ...(r.site && r.planted ? { plantedSite: r.site } : {}),
      setPieceExecuted: executed, setPieceSuccessful: executed && r.winner === r.attackTeam, blueScoreAfter: score.blue, redScoreAfter: score.red, blueCashTotal: cash.blue, redCashTotal: cash.red,
    } as FpsRoundResult;
  });
  const totalRounds = roundResults.length;
  const playerStats: Record<string, FpsPlayerMatchStats> = {};
  const behaviorSummary: FpsOfficialLiveReport['behaviorSummary'] = {};
  const headshotKills = new Map<string, number>();
  for (const e of events) if (e.type === 'kill' && e.isHeadshot && e.actorId) headshotKills.set(e.actorId, (headshotKills.get(e.actorId) ?? 0) + 1);
  for (const p of snapshot.players) {
    const impact = p.impact;
    playerStats[p.id] = {
      playerId: p.id, name: p.name, team: p.team, kills: p.kills, deaths: p.deaths, assists: p.assists ?? 0,
      damage: Math.round(impact.damage), adr: +(impact.damage / Math.max(1, totalRounds)).toFixed(1),
      headshotRate: p.kills > 0 ? +Math.min(100, (headshotKills.get(p.id) ?? 0) / p.kills * 100).toFixed(1) : 0,
      plants: impact.plants, defuses: impact.defuses, firstBloods: impact.openingKills, tradeKills: impact.tradeKills,
      clutchesWon: clutches.get(p.id) ?? 0, setPiecesInvolved: Math.min(100, setPieces.get(p.id) ?? 0),
    } as FpsPlayerMatchStats;
    const summary: Partial<Record<FpsBehaviorMetric, { opportunities: number; attempts: number }>> = {};
    for (const metric of FPS_BEHAVIOR_METRICS) { const m = p.behavior?.metrics[metric]; if (m && m.opportunities > 0) summary[metric] = { opportunities: m.opportunities, attempts: m.attempts }; }
    behaviorSummary[p.id] = summary;
  }
  const roundSnapshots: FpsOfficialLiveReport['roundSnapshots'] = [];
  rounds.forEach((r, i) => {
    for (const p of snapshot.players) {
      const attacking = p.team === r.attackTeam, assigned = identity.players[p.id]?.assignments;
      if (assigned) roundSnapshots.push({ roundNumber: i + 1, playerId: p.id, team: p.team, side: attacking ? 'attackers' : 'defenders', tactics: { position: attacking ? assigned.t : assigned.ct } });
    }
  });
  const winner = snapshot.winner;
  if (winner !== 'blue' && winner !== 'red') throw new Error('Official live match has no winner.');
  return {
    version: 1, simulationVersion: 5, engine: 'live-3d', format: 'MR15_TACTICAL_FPS', seed, mapId, mapName: snapshot.mapName, totalRounds,
    winnerTeam: winner, winner, finalScore: score, halfScore: half, secondHalfScore: second, ...(totalRounds > 30 ? { overtimeScore: overtime } : {}),
    roundResults, playerStats, events, behaviorSummary, roundSnapshots,
    durationSeconds: +roundDurations.reduce((s, d) => s + d, 0).toFixed(2),
    broadcastSeconds: +(tick * LIVE_FPS_STEP).toFixed(2),
    roundStartSeconds,
    ...(Object.keys(playbookExperience).length ? { playbookExperience } : {}),
  };
}

/** Public kill/round/objective events in the recorded-engine event shape (match pages, world media). */
function convertEvent(e: LiveEvent, round: number, tick: number, names: Map<string, string>): FpsMatchEvent | undefined {
  const base = { tick, second: +(tick * LIVE_FPS_STEP).toFixed(2), roundNumber: round, text: e.text.replace(/\s+/g, ' ').slice(0, 240) };
  // Team-kills, self-damage and the bomb blast are eliminations, not credited kills.
  if (e.kind === 'kill' && e.targetId && (!e.actorId || /TEAMKILL|SELF DAMAGE/.test(e.text)))
    return { ...base, type: 'player_eliminated', ...(e.actorId ? { actorId: e.actorId, actorName: names.get(e.actorId) } : {}), targetId: e.targetId, targetName: names.get(e.targetId) };
  if (e.kind === 'kill' && e.actorId && e.targetId) return { ...base, type: 'kill', actorId: e.actorId, actorName: names.get(e.actorId), targetId: e.targetId, targetName: names.get(e.targetId), isHeadshot: !!e.headshot };
  if (e.kind === 'round') return { ...base, type: /win ·/.test(e.text) ? 'round_end' : 'round_start' };
  if (e.kind === 'objective' && /planted/i.test(e.text) && !/\[RADIO\]/.test(e.text)) return { ...base, type: 'plant_completed', actorId: e.actorId, actorName: e.actorId ? names.get(e.actorId) : undefined };
  if (e.kind === 'objective' && /defused/i.test(e.text) && !/\[RADIO\]/.test(e.text)) return { ...base, type: 'defuse_completed', actorId: e.actorId, actorName: e.actorId ? names.get(e.actorId) : undefined };
  return undefined;
}
