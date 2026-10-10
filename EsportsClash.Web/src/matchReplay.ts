import type { ChampionKit, CoachCard, PlayerCard } from './types';
import type { MatchInsights } from './matchInspector';

export const SIMULATION_STEP = 1 / 30;

export function createMatchRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function consumeFixedSteps(
  accumulator: { current: number }, realSeconds: number, speed: number, stopped: boolean
): number {
  if (stopped) return 0;
  accumulator.current += Math.min(Math.max(realSeconds, 0), 0.1) * speed;
  const steps = Math.floor((accumulator.current + 1e-9) / SIMULATION_STEP);
  accumulator.current = Math.max(0, accumulator.current - steps * SIMULATION_STEP);
  return steps;
}

export function rerollAfterBalanceGame(runsLeftBeforeCompletion: number): boolean {
  // An odd-numbered run is followed by the same seed with the teams swapped.
  return runsLeftBeforeCompletion % 2 === 0;
}

export interface RecordedMatchEvent {
  second: number;
  type: string;
  text: string;
}

export interface MatchReport {
  version: 1;
  seed: number;
  batchId?: number;
  draft: {
    blue: { player: PlayerCard; champion: ChampionKit }[];
    red: { player: PlayerCard; champion: ChampionKit }[];
    blueCoach?: CoachCard;
    redCoach?: CoachCard;
  };
  winner: 'blue' | 'red';
  durationSeconds: number;
  blueRating: number;
  redRating: number;
  fullBuildsAt15: number | null;
  itemCounts?: Partial<Record<8 | 10 | 12 | 13, number[]>>;
  blueKills: number;
  redKills: number;
  skillshotsFired: number;
  skillshotsHit: number;
  events: RecordedMatchEvent[];
  insights?: MatchInsights;
}

export function summarizeMatchReports(reports: MatchReport[]) {
  const count = reports.length;
  const total = (get: (report: MatchReport) => number) => reports.reduce((sum, report) => sum + get(report), 0);
  const shots = total(report => report.skillshotsFired);
  const allAvatarInsights = reports.flatMap(report => Object.values(report.insights?.players ?? {}));
  const averageMetric = (get: (insight: typeof allAvatarInsights[number]) => number) =>
    allAvatarInsights.length ? allAvatarInsights.reduce((sum, insight) => sum + get(insight), 0) / allAvatarInsights.length : 0;
  const higherRatedWins = reports.filter(report =>
    report.blueRating === report.redRating ? false :
      (report.blueRating > report.redRating ? report.winner === 'blue' : report.winner === 'red')
  ).length;
  const unequalRatings = reports.filter(report => report.blueRating !== report.redRating).length;
  const reached15 = reports.filter(report => report.durationSeconds >= 900 && report.fullBuildsAt15 !== null);
  const itemTiming = (minute: 8 | 10 | 12 | 13) => {
    const snapshots = reports.flatMap(report => report.itemCounts?.[minute] ? [report.itemCounts[minute]!] : []);
    const allCounts = snapshots.flat();
    return { matches: snapshots.length,
      averageItems: allCounts.length ? allCounts.reduce((sum, count) => sum + count, 0) / allCounts.length : 0,
      bestFarmerItems: snapshots.length ? snapshots.reduce((sum, counts) => sum + Math.max(...counts), 0) / snapshots.length : 0 };
  };
  return {
    matches: count,
    averageMinutes: count ? total(report => report.durationSeconds) / count / 60 : 0,
    blueWinRate: count ? reports.filter(report => report.winner === 'blue').length / count : 0,
    higherRatedWinRate: unequalRatings ? higherRatedWins / unequalRatings : 0,
    skillshotHitRate: shots ? total(report => report.skillshotsHit) / shots : 0,
    averageSkill2Casts: averageMetric(insight => insight.casts.skill2),
    averageManaBlocks: averageMetric(insight => insight.manaBlocks),
    blackHoleInterrupts: allAvatarInsights.reduce((sum, insight) => sum + insight.blackHoleInterrupts, 0),
    paxiEscapeJaunts: allAvatarInsights.reduce((sum, insight) => sum + insight.escapeJaunts, 0),
    matchesAt15: reached15.length,
    averageFullBuildsAt15: reached15.length
      ? reached15.reduce((sum, report) => sum + (report.fullBuildsAt15 ?? 0), 0) / reached15.length : 0,
    itemTimings: { 8: itemTiming(8), 10: itemTiming(10), 12: itemTiming(12), 13: itemTiming(13) },
    averageObjectiveTime: (() => {
      const times = reports.flatMap(report => report.events
        .filter(event => (event.type === 'dragon' && /dragon slain/i.test(event.text))
          || (event.type === 'jungle' && /claimed Gravemarch/i.test(event.text)))
        .map(event => event.second));
      return times.length ? times.reduce((sum, time) => sum + time, 0) / times.length / 60 : 0;
    })()
  };
}

export function resolveNeutralKillCredit<T extends { id: string; team: 'blue' | 'red' }>(
  lastHit: { attackerId: string; second: number } | undefined,
  victimTeam: 'blue' | 'red', now: number, champions: T[], windowSeconds = 10
): T | null {
  if (!lastHit || now - lastHit.second > windowSeconds || now < lastHit.second) return null;
  return champions.find(champion => champion.id === lastHit.attackerId && champion.team !== victimTeam) ?? null;
}

export function resolveTurretKillReward<T extends { id: string; team: 'blue' | 'red'; gold: number }>(
  victim: { team: 'blue' | 'red'; lastEnemyDamage?: { attackerId: string; second: number } },
  now: number,
  champions: T[],
  windowSeconds = 10,
  bounty = 300
): { killer: T | null; splitGoldPerAlly: number; turretTeam: 'blue' | 'red'; turretAllies: T[] } {
  const turretTeam: 'blue' | 'red' = victim.team === 'blue' ? 'red' : 'blue';
  const killer = resolveNeutralKillCredit(victim.lastEnemyDamage, victim.team, now, champions, windowSeconds);
  const turretAllies = champions.filter(c => c.team === turretTeam);
  if (killer) {
    return { killer, splitGoldPerAlly: 0, turretTeam, turretAllies };
  }
  const splitGoldPerAlly = turretAllies.length > 0 ? Math.floor(bounty / turretAllies.length) : 0;
  return { killer: null, splitGoldPerAlly, turretTeam, turretAllies };
}
