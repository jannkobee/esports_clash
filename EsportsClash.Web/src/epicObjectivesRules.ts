import type { AramChampionUnit, LaneMinion } from './types.ts';

export type DragonElement = 'infernal' | 'mountain' | 'ocean' | 'cloud';

export interface TeamDragonSoulState {
  stacks: DragonElement[];
  soulElement?: DragonElement;
  elderUntil?: number;
}

export interface ElementalDragonSpec {
  element: DragonElement;
  name: string;
  badge: string;
  color: string;
  soulName: string;
}

export const DRAGON_ELEMENTS: readonly DragonElement[] = ['infernal', 'mountain', 'ocean', 'cloud'];

export const ELEMENTAL_DRAGON_SPECS: Record<DragonElement, ElementalDragonSpec> = {
  infernal: {
    element: 'infernal',
    name: 'Infernal Embermaw',
    badge: '🔥 INFERNAL',
    color: '#f97316',
    soulName: 'Infernal Soul',
  },
  mountain: {
    element: 'mountain',
    name: 'Mountain Terra-Drake',
    badge: '🪨 MOUNTAIN',
    color: '#d97706',
    soulName: 'Mountain Soul',
  },
  ocean: {
    element: 'ocean',
    name: 'Ocean Tide-Drake',
    badge: '🌊 OCEAN',
    color: '#06b6d4',
    soulName: 'Ocean Soul',
  },
  cloud: {
    element: 'cloud',
    name: 'Cloud Tempest-Drake',
    badge: '🌪️ CLOUD',
    color: '#a855f7',
    soulName: 'Cloud Soul',
  },
};

export const ELDER_DRAGON_MINUTE_SECOND = 14 * 60; // 14:00
export const ELDER_EXECUTE_THRESHOLD = 0.15; // < 15% HP
export const ELDER_BUFF_DURATION = 90;
export const SIEGE_BANNER_AURA_RADIUS = 210;
export const SIEGE_BANNER_DAMAGE_REDUCTION = 0.25;
export const PIT_PULL_OUT_MAX_RADIUS = 175;

/**
 * Item 31: Deterministic elemental dragon rotation based on total dragons slain in the match.
 */
export function getDragonElementForIndex(totalDragonsSlain: number): DragonElement {
  return DRAGON_ELEMENTS[Math.max(0, totalDragonsSlain) % DRAGON_ELEMENTS.length];
}

/**
 * Item 32: Returns the active elemental arena accent after the 2nd dragon is slain.
 */
export function getActiveArenaElementalAccent(
  totalDragonsSlain: number,
  blueStacks: readonly DragonElement[],
  redStacks: readonly DragonElement[],
): ElementalDragonSpec | null {
  if (totalDragonsSlain < 2) return null;
  const combined = [...blueStacks, ...redStacks];
  const dominant = combined[combined.length - 1] ?? getDragonElementForIndex(totalDragonsSlain);
  return ELEMENTAL_DRAGON_SPECS[dominant];
}

/**
 * Item 33: Determines whether the next Dragon spawn should be the Elder Dragon Sovereign
 * (when either team has 4 Dragon stacks / Dragon Soul OR match time >= 14:00).
 */
export function shouldSpawnElderDragon(
  matchSecond: number,
  blueStacksCount: number,
  redStacksCount: number,
): boolean {
  return matchSecond >= ELDER_DRAGON_MINUTE_SECOND || blueStacksCount >= 4 || redStacksCount >= 4;
}

/**
 * Records a Dragon kill for a team, updating Elemental Stacks, Dragon Soul (at 4 stacks), or Elder Buff (Items 31 & 33).
 */
export function recordTeamDragonSlain(
  state: TeamDragonSoulState,
  element: DragonElement,
  isElder: boolean,
  matchSecond: number,
): { gainedSoul: boolean; gainedElder: boolean } {
  if (isElder) {
    state.elderUntil = matchSecond + ELDER_BUFF_DURATION;
    return { gainedSoul: false, gainedElder: true };
  }
  state.stacks.push(element);
  let gainedSoul = false;
  if (state.stacks.length >= 4 && !state.soulElement) {
    state.soulElement = element;
    gainedSoul = true;
  }
  return { gainedSoul, gainedElder: false };
}

/**
 * Item 33: Checks if an attack from an Elder-buffed attacker triggers Elder Execute (< 15% post-mitigation HP).
 */
export function shouldTriggerElderExecute(
  attackerTeamState: TeamDragonSoulState | undefined,
  matchSecond: number,
  targetHp: number,
  targetMaxHp: number,
): boolean {
  if (!attackerTeamState?.elderUntil || matchSecond >= attackerTeamState.elderUntil) return false;
  if (targetHp <= 0 || targetMaxHp <= 0) return false;
  return targetHp / targetMaxHp <= ELDER_EXECUTE_THRESHOLD;
}

/**
 * Item 34: Multi-Phase Dragon Boss Combat Phase (`1`: Normal, `2`: Wing Gust `< 65%`, `3`: Tail Sweep Enrage `< 35%`).
 */
export function getDragonCombatPhase(hp: number, maxHp: number): 1 | 2 | 3 {
  const ratio = hp / Math.max(1, maxHp);
  if (ratio <= 0.35) return 3;
  if (ratio <= 0.65) return 2;
  return 1;
}

/**
 * Item 35: Siege Golem Vulnerable Rear Crystal Core multiplier (+22% bonus damage when attacking from behind).
 */
export function getSiegeGolemRearCoreMultiplier(
  attacker: { x: number; y: number },
  golem: { x: number; y: number; facingX?: number },
): number {
  const facing = golem.facingX ?? 1;
  const relativeX = (attacker.x - golem.x) * Math.sign(facing || 1);
  // Attacker is behind the Golem's facing direction
  if (relativeX < -12) {
    return 1.22;
  }
  return 1.0;
}

/**
 * Item 37: Summoned Siege Golem Banner Aura (+25% nearby allied minion damage reduction).
 */
export function getMinionBannerDamageMultiplier(
  targetMinion: Pick<LaneMinion, 'team' | 'x' | 'y' | 'siegeGolem'>,
  allMinions: readonly Pick<LaneMinion, 'team' | 'x' | 'y' | 'isAlive' | 'siegeGolem'>[],
): number {
  if (targetMinion.siegeGolem) return 1.0;
  const nearAlliedSiegeGolem = allMinions.some(
    m =>
      m.isAlive &&
      m.siegeGolem &&
      m.team === targetMinion.team &&
      Math.hypot(m.x - targetMinion.x, m.y - targetMinion.y) <= SIEGE_BANNER_AURA_RADIUS,
  );
  return nearAlliedSiegeGolem ? 1 - SIEGE_BANNER_DAMAGE_REDUCTION : 1.0;
}

/**
 * Item 38: Pit Pull-Out Reset Check.
 * Returns true if an epic boss has been pulled beyond `PIT_PULL_OUT_MAX_RADIUS` (175px) from its pit center.
 */
export function isBossPulledOutsidePit(
  boss: { x: number; y: number },
  pitCenter: { x: number; y: number },
): boolean {
  return Math.hypot(boss.x - pitCenter.x, boss.y - pitCenter.y) > PIT_PULL_OUT_MAX_RADIUS;
}

/**
 * Renders Phase 6 Epic Objective & Elemental Overlays on the 3D Tactical Canvas:
 * - Elemental Pit Floor Accent Ring & Dragon Element Badge (Items 31 & 32)
 * - Elder Dragon Sovereign Crown & Execute Threshold Indicator (Item 33)
 * - Siege Golem Vulnerable Rear Core Indicator & Summoned Siege Golem Banner Aura Ring (Items 35 & 37)
 */
export function drawEpicObjectivesOverlay(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, h: number) => { x: number; y: number },
  zoom: number,
  matchSecond: number,
  dragon: { x: number; y: number; hp: number; maxHp: number; isAlive: boolean },
  currentElement: DragonElement,
  isElderDragon: boolean,
  minions: readonly LaneMinion[],
  champions: readonly AramChampionUnit[],
  teamDragonStates: { blue: TeamDragonSoulState; red: TeamDragonSoulState },
): void {
  ctx.save();

  // 1. Dragon Pit Elemental Ring & Phase Badge (Items 31, 32, 33, 34)
  if (dragon.isAlive) {
    const spec = ELEMENTAL_DRAGON_SPECS[currentElement];
    const p = project(dragon.x, dragon.y, 4);
    const headP = project(dragon.x, dragon.y, 82);
    const r = 68 * Math.sqrt(zoom);
    const color = isElderDragon ? '#facc15' : spec.color;
    const phase = getDragonCombatPhase(dragon.hp, dragon.maxHp);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = isElderDragon ? 2.8 : 2.0;
    ctx.setLineDash([8, 5]);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Element / Elder badge above Dragon
    const badgeText = isElderDragon ? '👑 ELDER SOVEREIGN' : `${spec.badge}${phase > 1 ? ` · P${phase}` : ''}`;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(headP.x - 54, headP.y - 22, 108, 16, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, headP.x, headP.y - 11);
    ctx.restore();
  }

  // 2. Summoned Siege Golem Vanguard Banner Aura Ring (Item 37)
  for (const m of minions) {
    if (!m.isAlive || !m.siegeGolem) continue;
    const p = project(m.x, m.y, 4);
    const auraR = SIEGE_BANNER_AURA_RADIUS * 0.34 * Math.sqrt(zoom);
    const color = m.team === 'blue' ? '#38bdf8' : '#f43f5e';
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.fillStyle = m.team === 'blue' ? 'rgba(56, 189, 248, 0.09)' : 'rgba(244, 63, 94, 0.09)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, auraR, auraR * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛡️ SIEGE BANNER (-25% DMG)', p.x, p.y + auraR * 0.62 + 11);
    ctx.restore();
  }

  // 3. Dragon Soul & Elder Aspect Crown Aura on Champions (Items 31 & 33)
  for (const unit of champions) {
    if (!unit.isAlive) continue;
    const teamState = teamDragonStates[unit.team];
    const hasElder = Boolean(teamState.elderUntil && matchSecond < teamState.elderUntil);
    const soul = teamState.soulElement ? ELEMENTAL_DRAGON_SPECS[teamState.soulElement] : null;
    if (!hasElder && !soul) continue;

    const p = project(unit.x, unit.y, 2);
    ctx.save();
    ctx.strokeStyle = hasElder ? '#facc15' : soul!.color;
    ctx.lineWidth = hasElder ? 2.6 : 1.8;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 24, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

