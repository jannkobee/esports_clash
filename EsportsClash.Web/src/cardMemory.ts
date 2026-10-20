export interface CardLessons {
  /** Punishment against fighting while down in net worth or levels (0 to 1). */
  gappedDiscipline: number;
  /** Punishment against engaging while outnumbered (0 to 1). */
  numericalDiscipline: number;
  /** Punishment against overstaying or suicidal tower dives with low HP (0 to 1). */
  survivalPatience: number;
}

export interface CardComboMastery {
  attempts: number;
  executions: number;
  hitRate: number;
  lethalFinishes: number;
  masteryLevel: number; // 0 to 5
}

export interface CardMatchMemory {
  version: 1;
  cardId: string;
  matchesPlayed: number;
  processedMatchIds: string[];
  lessons: CardLessons;
  comboMasteries: Record<string, CardComboMastery>;
}

export interface CardComboEvent {
  avatar: string;
  attempt?: boolean;
  hit: boolean;
  lethal: boolean;
  targetId?: string;
  comboId?: string;
}

export interface CardMatchFeedback {
  matchId?: string;
  cardId: string;
  deathsGapped?: number;
  deathsOutnumbered?: number;
  deathsReckless?: number;
  gappedSurvived?: number;
  combos?: CardComboEvent[];
  cardIq?: number;
  personality?: string;
}

const STORAGE_KEY = 'esports-clash-card-memories';
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

export function calculateUnitNetWorth(u: { gold: number; items?: { cost?: number }[]; boots?: { cost?: number } }): number {
  const itemsCost = (u.items ?? []).reduce((sum, item) => sum + (item?.cost ?? 0), 0);
  const bootsCost = u.boots?.cost ?? 0;
  return (Number.isFinite(u.gold) ? u.gold : 0) + itemsCost + bootsCost;
}

export const createDefaultCardMemory = (cardId: string): CardMatchMemory => ({
  version: 1,
  cardId,
  matchesPlayed: 0,
  processedMatchIds: [],
  lessons: {
    gappedDiscipline: 0,
    numericalDiscipline: 0,
    survivalPatience: 0,
  },
  comboMasteries: {},
});

/** Memory loading handles missing storage, unparseable JSON, or corrupted numeric ranges safely. */
export function loadCardMemories(): Record<string, CardMatchMemory> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, CardMatchMemory> = {};
    for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const mem = entry as Partial<CardMatchMemory>;
      const lessons = mem.lessons ?? { gappedDiscipline: 0, numericalDiscipline: 0, survivalPatience: 0 };
      const rawCombos = (mem.comboMasteries && typeof mem.comboMasteries === 'object') ? mem.comboMasteries : {};
      const comboMasteries: Record<string, CardComboMastery> = {};
      for (const [avatar, c] of Object.entries(rawCombos as Record<string, unknown>)) {
        if (!c || typeof c !== 'object') continue;
        const combo = c as Partial<CardComboMastery>;
        const executions = Math.max(0, Math.floor(Number(combo.executions) || 0));
        const attempts = Math.max(executions, Math.floor(Number(combo.attempts) || executions));
        comboMasteries[avatar] = {
          attempts,
          executions,
          hitRate: attempts > 0 ? clamp(executions / attempts) : 0,
          lethalFinishes: Math.max(0, Math.floor(Number(combo.lethalFinishes) || 0)),
          masteryLevel: Math.max(0, Math.min(5, Math.floor(Number(combo.masteryLevel) || 0))),
        };
      }
      result[id] = {
        version: 1,
        cardId: id,
        matchesPlayed: Math.max(0, Math.floor(Number(mem.matchesPlayed) || 0)),
        processedMatchIds: Array.isArray(mem.processedMatchIds) ? mem.processedMatchIds.filter(x => typeof x === 'string').slice(-50) : [],
        lessons: {
          gappedDiscipline: clamp(Number(lessons.gappedDiscipline) || 0),
          numericalDiscipline: clamp(Number(lessons.numericalDiscipline) || 0),
          survivalPatience: clamp(Number(lessons.survivalPatience) || 0),
        },
        comboMasteries,
      };
    }
    return result;
  } catch {
    return {};
  }
}

export function saveCardMemories(memories: Record<string, CardMatchMemory>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  } catch {
    // Storage quota or sandboxed context protection
  }
}

export function getCardMemory(cardId: string): CardMatchMemory {
  const all = loadCardMemories();
  return all[cardId] ?? createDefaultCardMemory(cardId);
}

/** Determine mastery tier from total successful executions. */
export function calculateMasteryTier(executions: number): number {
  if (executions >= 80) return 5;
  if (executions >= 50) return 4;
  if (executions >= 30) return 3;
  if (executions >= 15) return 2;
  if (executions >= 5) return 1;
  return 0;
}

/**
 * Updates a card's persistent memory ledger after match conclusions or significant encounters.
 * Incorporates card IQ (high IQ cards absorb lessons faster), personality resistance,
 * separate combo attempts vs successes, and idempotent match deduplication.
 */
export function recordCardMatchExperience(
  memory: CardMatchMemory,
  feedback: CardMatchFeedback
): CardMatchMemory {
  // Idempotency: avoid recording the same match repeatedly
  if (feedback.matchId && memory.processedMatchIds.includes(feedback.matchId)) {
    return memory;
  }

  const iq = feedback.cardIq ?? 75;
  // High IQ (>= 75) absorbs discipline faster; lower IQ needs more repetitions
  const iqFactor = clamp(iq / 75, 0.6, 1.6);

  // Personality modifier: Aggressive personalities retain more stubborn instincts
  const isAggressivePersonality = /^(solo_carry|dive_master|coinflip_king|assassin_instinct|hyper_aggressive)$/.test(
    feedback.personality ?? ''
  );
  const personalityResistance = isAggressivePersonality ? 0.7 : 1.0;

  const learnStep = 0.12 * iqFactor * personalityResistance;

  const deathsGapped = feedback.deathsGapped ?? 0;
  const deathsOutnumbered = feedback.deathsOutnumbered ?? 0;
  const deathsReckless = feedback.deathsReckless ?? 0;
  const gappedSurvived = feedback.gappedSurvived ?? 0;

  // Penalties increase discipline (bounded 0 to 1)
  const nextGapped = clamp(
    memory.lessons.gappedDiscipline + deathsGapped * learnStep - gappedSurvived * 0.04
  );
  const nextNumerical = clamp(
    memory.lessons.numericalDiscipline + deathsOutnumbered * learnStep
  );
  const nextPatience = clamp(
    memory.lessons.survivalPatience + deathsReckless * learnStep
  );

  const updatedMasteries = { ...memory.comboMasteries };
  if (feedback.combos && feedback.combos.length > 0) {
    for (const combo of feedback.combos) {
      const existing = updatedMasteries[combo.avatar] ?? {
        attempts: 0,
        executions: 0,
        hitRate: 0,
        lethalFinishes: 0,
        masteryLevel: 0,
      };
      const newAttempts = existing.attempts + 1;
      const newExecutions = existing.executions + (combo.hit ? 1 : 0);
      const newLethal = existing.lethalFinishes + (combo.lethal ? 1 : 0);
      const newHitRate = clamp(newExecutions / Math.max(1, newAttempts));
      const newTier = calculateMasteryTier(newExecutions);

      updatedMasteries[combo.avatar] = {
        attempts: newAttempts,
        executions: newExecutions,
        hitRate: newHitRate,
        lethalFinishes: newLethal,
        masteryLevel: newTier,
      };
    }
  }

  const nextProcessed = feedback.matchId
    ? [...memory.processedMatchIds.filter(id => id !== feedback.matchId), feedback.matchId].slice(-50)
    : memory.processedMatchIds;

  return {
    version: 1,
    cardId: memory.cardId,
    matchesPlayed: memory.matchesPlayed + 1,
    processedMatchIds: nextProcessed,
    lessons: {
      gappedDiscipline: nextGapped,
      numericalDiscipline: nextNumerical,
      survivalPatience: nextPatience,
    },
    comboMasteries: updatedMasteries,
  };
}
