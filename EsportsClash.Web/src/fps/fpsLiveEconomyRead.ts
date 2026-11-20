import type { LiveWeaponHint } from './fpsLiveIntel.ts';

export type LiveEnemyEconomyTier = 'pistol' | 'broke_eco' | 'half_force' | 'full_buy' | 'rich_double_awp';

export interface LiveEnemyEconomyRead {
  estimatedAvgCash: number;
  tier: LiveEnemyEconomyTier;
  awpLikely: boolean;
  lowUtilityLikely: boolean;
  stackLikely: boolean;
  antiEcoWindow: boolean;
  liveOverride?: 'confirmed_eco' | 'confirmed_awp';
  observedSnipers: number;
  observedEco: number;
}

export interface LiveEnemyEconomyTracker {
  estimatedAvgCash: number;
  opponentLossStreak: number;
  survivingEnemies: number;
  survivingSnipers: number;
  survivingRifles: number;
  lastRoundKnownWeapons: Record<string, LiveWeaponHint>;
  roundObservedWeapons: Record<string, LiveWeaponHint>;
  read: LiveEnemyEconomyRead;
}

const SPEND_BY_TIER: Record<LiveEnemyEconomyTier, number> = {
  pistol: 700,
  broke_eco: 450,
  half_force: 2450,
  full_buy: 4300,
  rich_double_awp: 5100,
};

function computeRead(
  estimatedAvgCash: number,
  round: number,
  opponentIsDefendingNext: boolean,
  survivingSnipers: number,
  survivingRifles: number,
  ownAvgCash: number,
  roundObservedWeapons: Readonly<Record<string, LiveWeaponHint>>,
): LiveEnemyEconomyRead {
  let tier: LiveEnemyEconomyTier;
  if (round === 1 || round === 16) {
    tier = 'pistol';
  } else if (estimatedAvgCash >= 5600 || (survivingSnipers >= 1 && estimatedAvgCash >= 4000)) {
    tier = 'rich_double_awp';
  } else if (estimatedAvgCash >= 3750 || (survivingRifles >= 3 && estimatedAvgCash >= 2800)) {
    tier = 'full_buy';
  } else if (estimatedAvgCash >= 2700 || (survivingRifles >= 1 && estimatedAvgCash >= 2050)) {
    tier = 'half_force';
  } else {
    tier = 'broke_eco';
  }

  let observedSnipers = 0;
  let observedEco = 0;
  let observedRifles = 0;
  for (const hint of Object.values(roundObservedWeapons)) {
    if (hint === 'sniper') observedSnipers++;
    else if (hint === 'eco') observedEco++;
    else if (hint === 'rifle' || hint === 'suppressed') observedRifles++;
  }

  let liveOverride: LiveEnemyEconomyRead['liveOverride'];
  if (observedSnipers >= 1) liveOverride = 'confirmed_awp';
  else if (observedEco >= 3 && observedRifles === 0 && round !== 1 && round !== 16) liveOverride = 'confirmed_eco';

  const awpLikely =
    liveOverride === 'confirmed_awp' ||
    tier === 'rich_double_awp' ||
    survivingSnipers >= 1 ||
    (tier === 'full_buy' && estimatedAvgCash >= 4600);
  const lowUtilityLikely =
    liveOverride === 'confirmed_eco' ||
    tier === 'broke_eco' ||
    tier === 'pistol' ||
    (tier === 'half_force' && estimatedAvgCash < 2900);
  const stackLikely =
    opponentIsDefendingNext && (tier === 'broke_eco' || tier === 'half_force' || liveOverride === 'confirmed_eco');
  const antiEcoWindow =
    (tier === 'broke_eco' || tier === 'pistol' || liveOverride === 'confirmed_eco') && ownAvgCash >= 3200;

  return {
    estimatedAvgCash: Math.round(estimatedAvgCash),
    tier,
    awpLikely,
    lowUtilityLikely,
    stackLikely,
    antiEcoWindow,
    ...(liveOverride ? { liveOverride } : {}),
    observedSnipers,
    observedEco,
  };
}

export function createEnemyEconomyTracker(round = 1): LiveEnemyEconomyTracker {
  const cash = round >= 31 ? 10000 : 800;
  const roundObservedWeapons: Record<string, LiveWeaponHint> = {};
  return {
    estimatedAvgCash: cash,
    opponentLossStreak: 0,
    survivingEnemies: 0,
    survivingSnipers: 0,
    survivingRifles: 0,
    lastRoundKnownWeapons: {},
    roundObservedWeapons,
    read: computeRead(cash, round, true, 0, 0, cash, roundObservedWeapons),
  };
}

export function resetEnemyEconomyTracker(tracker: LiveEnemyEconomyTracker, round: number, opponentIsDefendingNext = true): void {
  const cash = round >= 31 ? 10000 : 800;
  tracker.estimatedAvgCash = cash;
  tracker.opponentLossStreak = 0;
  tracker.survivingEnemies = 0;
  tracker.survivingSnipers = 0;
  tracker.survivingRifles = 0;
  tracker.lastRoundKnownWeapons = {};
  tracker.roundObservedWeapons = {};
  tracker.read = computeRead(cash, round, opponentIsDefendingNext, 0, 0, cash, tracker.roundObservedWeapons);
}

/**
 * Updates the lawful mid-round enemy loadout impression from sightings, gunfire cues, or killfeed.
 * Never reads hidden opponent inventories directly.
 */
export function observeEnemyWeapon(
  tracker: LiveEnemyEconomyTracker,
  key: string,
  hint: LiveWeaponHint,
  opponentIsDefending = true,
  round = 2,
  ownAvgCash = 4000,
): LiveEnemyEconomyRead {
  const prev = tracker.roundObservedWeapons[key];
  if (prev === hint) return tracker.read;
  if (prev === 'sniper' && hint !== 'sniper') return tracker.read;
  tracker.roundObservedWeapons[key] = hint;
  const base = tracker.read;
  let observedSnipers = 0;
  let observedEco = 0;
  let observedRifles = 0;
  for (const w of Object.values(tracker.roundObservedWeapons)) {
    if (w === 'sniper') observedSnipers++;
    else if (w === 'eco') observedEco++;
    else if (w === 'rifle' || w === 'suppressed') observedRifles++;
  }
  let liveOverride = base.liveOverride;
  if (observedSnipers >= 1) liveOverride = 'confirmed_awp';
  else if (observedEco >= 3 && observedRifles === 0 && round !== 1 && round !== 16) liveOverride = 'confirmed_eco';
  else if (observedRifles >= 2 && liveOverride === 'confirmed_eco') liveOverride = undefined;

  tracker.read = {
    ...base,
    observedSnipers,
    observedEco,
    awpLikely: base.awpLikely || liveOverride === 'confirmed_awp',
    lowUtilityLikely: base.lowUtilityLikely || liveOverride === 'confirmed_eco',
    stackLikely: base.stackLikely || (opponentIsDefending && liveOverride === 'confirmed_eco'),
    antiEcoWindow: base.antiEcoWindow || (liveOverride === 'confirmed_eco' && ownAvgCash >= 3200),
    ...(liveOverride ? { liveOverride } : {}),
  };
  return tracker.read;
}

export interface EnemyEconomyRoundOutcome {
  opponentWon: boolean;
  opponentAttacked: boolean;
  opponentDefendingNext: boolean;
  bombPlanted: boolean;
  reason: string;
  survivingEnemyCount: number;
  survivingObservedHints: readonly LiveWeaponHint[];
  nextRound: number;
  ownAvgCash: number;
}

/**
 * Updates next-round opponent economy prediction strictly from public round outcomes, public survivor count,
 * and lawfully observed weapon hints on surviving opponents.
 */
export function updateEnemyEconomyAfterRound(
  tracker: LiveEnemyEconomyTracker,
  info: EnemyEconomyRoundOutcome,
): LiveEnemyEconomyRead {
  const reset = info.nextRound === 1 || info.nextRound === 16 || (info.nextRound >= 31 && (info.nextRound - 31) % 3 === 0);
  if (reset) {
    resetEnemyEconomyTracker(tracker, info.nextRound, info.opponentDefendingNext);
    return tracker.read;
  }

  const prevTier = tracker.read.tier;
  const estSpend = SPEND_BY_TIER[prevTier] * (1 - Math.min(0.65, info.survivingEnemyCount * 0.12));
  const afterBuyCash = Math.max(0, tracker.estimatedAvgCash - estSpend);

  let nextLossStreak: number;
  let income: number;
  if (info.opponentWon) {
    nextLossStreak = 0;
    const objWin = /defused|detonated/i.test(info.reason);
    income = (objWin ? 3500 : 3250) + 250;
  } else {
    nextLossStreak = tracker.opponentLossStreak + 1;
    const timedOutSave = info.opponentAttacked && /expired/i.test(info.reason) && info.survivingEnemyCount > 0;
    const baseLoss = timedOutSave ? 400 : Math.min(3400, 1400 + Math.max(1, nextLossStreak) * 500);
    const plantBonus = info.opponentAttacked && info.bombPlanted ? 450 : 0;
    income = baseLoss + plantBonus + 120;
  }

  tracker.opponentLossStreak = nextLossStreak;
  tracker.estimatedAvgCash = Math.max(800, Math.min(16000, afterBuyCash + income));
  tracker.survivingEnemies = info.survivingEnemyCount;

  let survivingSnipers = 0;
  let survivingRifles = 0;
  for (const hint of info.survivingObservedHints) {
    if (hint === 'sniper') survivingSnipers++;
    else if (hint === 'rifle' || hint === 'suppressed') survivingRifles++;
  }
  tracker.survivingSnipers = survivingSnipers;
  tracker.survivingRifles = survivingRifles;
  tracker.lastRoundKnownWeapons = { ...tracker.roundObservedWeapons };
  tracker.roundObservedWeapons = {};

  tracker.read = computeRead(
    tracker.estimatedAvgCash,
    info.nextRound,
    info.opponentDefendingNext,
    survivingSnipers,
    survivingRifles,
    info.ownAvgCash,
    tracker.roundObservedWeapons,
  );
  return tracker.read;
}
