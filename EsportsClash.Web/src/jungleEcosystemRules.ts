import type { AramChampionUnit } from './types.ts';
import { DRAGON_X, laneY } from './arenaRules.ts';

export type JungleBuffKind = 'blue' | 'red' | 'wolf' | 'gromp';

export interface ChampionJungleBuffState {
  blueUntil: number;
  redUntil: number;
  wolfUntil: number;
  grompUntil: number;
}

export interface PackMinionState {
  id: string;
  offsetX: number;
  offsetY: number;
  hpThreshold: number;
  alive: boolean;
}

export interface RiverScuttler {
  id: string;
  name: string;
  riverSide: 'north' | 'south';
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  patrolMinY: number;
  patrolMaxY: number;
  patrolDir: 1 | -1;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  respawnTimer: number;
  shrineTeam?: 'blue' | 'red';
  shrineExpiresAt?: number;
}

export type JunglePlantKind = 'blast_cone' | 'scryer_bloom' | 'honeyfruit';

export interface JunglePlant {
  id: string;
  kind: JunglePlantKind;
  name: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  isAlive: boolean;
  respawnTimer: number;
  lastTriggeredAt?: number;
  lastTriggeredByTeam?: 'blue' | 'red';
}

export interface StolenCampMarker {
  id: string;
  campId: string;
  campName: string;
  homeTeam: 'blue' | 'red';
  stolenByTeam: 'blue' | 'red';
  stolenByPlayer: string;
  x: number;
  y: number;
  stolenAt: number;
  expiresAt: number;
}

export const BUFF_DURATION_SECONDS = 65;
export const TRANSFERRED_BUFF_MIN_SECONDS = 35;
export const SCUTTLER_RESPAWN_SECONDS = 75;
export const SCUTTLER_SHRINE_DURATION = 65;
export const SCUTTLER_SHRINE_RADIUS = 125;

/**
 * Item 22: Multi-Creep Camp Composition (Alpha Monster + 2 Mini Pack Minions).
 * Computes the two mini-minions that accompany a regular camp based on its current HP fraction.
 */
export function getCampPackMinions(camp: { id: string; x: number; y: number; hp: number; maxHp: number; isAlive: boolean }): PackMinionState[] {
  if (!camp.isAlive || camp.id === 'j_siege_golem' || camp.id === 'dragon') return [];
  const ratio = camp.hp / Math.max(1, camp.maxHp);
  return [
    {
      id: `${camp.id}_mini_1`,
      offsetX: -26,
      offsetY: 16,
      hpThreshold: 0.33,
      alive: ratio > 0.33,
    },
    {
      id: `${camp.id}_mini_2`,
      offsetX: 26,
      offsetY: 16,
      hpThreshold: 0.66,
      alive: ratio > 0.66,
    },
  ];
}

/**
 * Item 23: Maps a camp type to its specific JungleBuffKind.
 */
export function getBuffKindForCampType(campType: string): JungleBuffKind {
  if (campType === 'golem') return 'blue';
  if (campType === 'raptor') return 'red';
  if (campType === 'wolf') return 'wolf';
  return 'gromp';
}

/**
 * Item 24: Transfers active jungle buffs from a slain victim to the killer champion.
 */
export function transferJungleBuffsOnTakedown(
  buffMap: Record<string, ChampionJungleBuffState>,
  victimId: string,
  killerId: string,
  matchSecond: number,
): JungleBuffKind[] {
  const victimBuffs = buffMap[victimId];
  if (!victimBuffs) return [];
  const killerBuffs = (buffMap[killerId] ??= { blueUntil: 0, redUntil: 0, wolfUntil: 0, grompUntil: 0 });
  const transferred: JungleBuffKind[] = [];

  for (const kind of ['blue', 'red', 'wolf', 'gromp'] as const) {
    const key = `${kind}Until` as keyof ChampionJungleBuffState;
    if (victimBuffs[key] > matchSecond) {
      const remaining = victimBuffs[key] - matchSecond;
      killerBuffs[key] = Math.max(killerBuffs[key], matchSecond + Math.max(TRANSFERRED_BUFF_MIN_SECONDS, remaining));
      victimBuffs[key] = 0;
      transferred.push(kind);
    }
  }
  return transferred;
}

/**
 * Item 26: Creates initial North & South River Scuttler Crabs.
 */
export function createInitialRiverScuttlers(): RiverScuttler[] {
  const center = laneY(DRAGON_X);
  return [
    {
      id: 'scuttler_north',
      name: 'North River Scuttler',
      riverSide: 'north',
      x: DRAGON_X,
      y: center - 210,
      homeX: DRAGON_X,
      homeY: center - 210,
      patrolMinY: center - 265,
      patrolMaxY: center - 155,
      patrolDir: 1,
      hp: 850,
      maxHp: 850,
      isAlive: true,
      respawnTimer: 0,
    },
    {
      id: 'scuttler_south',
      name: 'South River Scuttler',
      riverSide: 'south',
      x: DRAGON_X,
      y: center + 210,
      homeX: DRAGON_X,
      homeY: center + 210,
      patrolMinY: center + 155,
      patrolMaxY: center + 265,
      patrolDir: -1,
      hp: 850,
      maxHp: 850,
      isAlive: true,
      respawnTimer: 0,
    },
  ];
}

/**
 * Steps River Scuttler patrol and shrine state (Item 26).
 */
export function stepRiverScuttlers(
  scuttlers: RiverScuttler[],
  champions: readonly AramChampionUnit[],
  matchSecond: number,
  dt: number,
): { slainBy?: { scuttler: RiverScuttler; killer: AramChampionUnit } } {
  let slainBy: { scuttler: RiverScuttler; killer: AramChampionUnit } | undefined;

  for (const s of scuttlers) {
    if (s.shrineExpiresAt && matchSecond >= s.shrineExpiresAt) {
      s.shrineTeam = undefined;
      s.shrineExpiresAt = undefined;
    }

    if (!s.isAlive) {
      s.respawnTimer -= dt;
      if (s.respawnTimer <= 0) {
        s.isAlive = true;
        s.maxHp = Math.round(850 * (1 + Math.min(1.0, Math.max(0, (matchSecond - 60) / 60) * 0.08)));
        s.hp = s.maxHp;
        s.x = s.homeX;
        s.y = s.homeY;
      }
      continue;
    }

    // Peaceful patrol along the river channel; flees slightly faster when damaged
    const fleeBoost = s.hp < s.maxHp ? 1.45 : 1.0;
    s.y += s.patrolDir * 38 * fleeBoost * dt;
    if (s.y >= s.patrolMaxY) {
      s.y = s.patrolMaxY;
      s.patrolDir = -1;
    } else if (s.y <= s.patrolMinY) {
      s.y = s.patrolMinY;
      s.patrolDir = 1;
    }

    // When a nearby champion is out of enemy champion combat and within 120px of Scuttler in the river, they chip it down
    const attacker = champions.find(
      c =>
        c.isAlive &&
        !c.isRecalling &&
        Math.hypot(c.x - s.x, c.y - s.y) <= 125 &&
        !champions.some(e => e.isAlive && e.team !== c.team && Math.hypot(e.x - c.x, e.y - c.y) <= 260),
    );
    if (attacker) {
      s.hp = Math.max(0, s.hp - (95 + attacker.level * 12) * dt);
      if (s.hp <= 0) {
        s.isAlive = false;
        s.respawnTimer = SCUTTLER_RESPAWN_SECONDS;
        s.shrineTeam = attacker.team;
        s.shrineExpiresAt = matchSecond + SCUTTLER_SHRINE_DURATION;
        slainBy = { scuttler: s, killer: attacker };
      }
    }
  }

  return { slainBy };
}

/**
 * Item 27: Creates initial Interactive Jungle Plants (Blast Cones, Scryer's Blooms, Honeyfruits).
 */
export function createInitialJunglePlants(): JunglePlant[] {
  const center = laneY(DRAGON_X);
  return [
    // Blast Cones outside Dragon & Siege Golem Pit back/flank walls
    {
      id: 'plant_blast_dragon_west',
      kind: 'blast_cone',
      name: 'Blast Cone',
      x: DRAGON_X - 155,
      y: 265,
      targetX: DRAGON_X - 35,
      targetY: 240,
      isAlive: true,
      respawnTimer: 0,
    },
    {
      id: 'plant_blast_dragon_east',
      kind: 'blast_cone',
      name: 'Blast Cone',
      x: DRAGON_X + 155,
      y: 265,
      targetX: DRAGON_X + 35,
      targetY: 240,
      isAlive: true,
      respawnTimer: 0,
    },
    {
      id: 'plant_blast_golem_west',
      kind: 'blast_cone',
      name: 'Blast Cone',
      x: DRAGON_X - 155,
      y: 1175,
      targetX: DRAGON_X - 35,
      targetY: 1200,
      isAlive: true,
      respawnTimer: 0,
    },
    {
      id: 'plant_blast_golem_east',
      kind: 'blast_cone',
      name: 'Blast Cone',
      x: DRAGON_X + 155,
      y: 1175,
      targetX: DRAGON_X + 35,
      targetY: 1200,
      isAlive: true,
      respawnTimer: 0,
    },
    // Scryer's Blooms near river entrances pointing at epic pits
    {
      id: 'plant_scryer_north',
      kind: 'scryer_bloom',
      name: "Scryer's Bloom",
      x: DRAGON_X - 190,
      y: 445,
      targetX: DRAGON_X,
      targetY: 240,
      isAlive: true,
      respawnTimer: 0,
    },
    {
      id: 'plant_scryer_south',
      kind: 'scryer_bloom',
      name: "Scryer's Bloom",
      x: DRAGON_X + 190,
      y: 995,
      targetX: DRAGON_X,
      targetY: 1200,
      isAlive: true,
      respawnTimer: 0,
    },
    // Honeyfruits on river banks
    {
      id: 'plant_honey_north',
      kind: 'honeyfruit',
      name: 'Honeyfruit',
      x: DRAGON_X + 115,
      y: center - 185,
      isAlive: true,
      respawnTimer: 0,
    },
    {
      id: 'plant_honey_south',
      kind: 'honeyfruit',
      name: 'Honeyfruit',
      x: DRAGON_X - 115,
      y: center + 185,
      isAlive: true,
      respawnTimer: 0,
    },
  ];
}

/**
 * Item 28: Camp Level Scaling by Game Minute.
 * Scales camp HP, AD, Gold, and XP upon respawn so mid/late-game camps stay rewarding and durable.
 */
export function scaleCampStatsByMinute(
  base: { maxHp: number; ad: number; gold: number; xp: number },
  matchSecond: number,
): { maxHp: number; ad: number; gold: number; xp: number } {
  const minutesPastTwo = Math.max(0, (matchSecond - 120) / 60);
  const hpMult = 1 + Math.min(1.1, minutesPastTwo * 0.11);
  const adMult = 1 + Math.min(0.8, minutesPastTwo * 0.08);
  const goldMult = 1 + Math.min(0.6, minutesPastTwo * 0.06);
  const xpMult = 1 + Math.min(0.9, minutesPastTwo * 0.09);

  return {
    maxHp: Math.round(base.maxHp * hpMult),
    ad: Math.round(base.ad * adMult),
    gold: Math.round(base.gold * goldMult),
    xp: Math.round(base.xp * xpMult),
  };
}

/**
 * Item 29: Smite / Jungle Execute Spell Damage & Eligibility.
 * Returns Primal Smite true damage (450 -> 800 based on level).
 */
export function getPrimalSmiteDamage(level: number): number {
  const clamped = Math.max(1, Math.min(18, level));
  return Math.round(450 + ((clamped - 1) / 17) * 350);
}

export function isJungleSmiteSpecialist(unit: Pick<AramChampionUnit, 'champion' | 'player'>): boolean {
  const role = unit.champion.primaryRole;
  const combatJungler = (unit.champion.combatRoles?.Jungler ?? 0) >= 1;
  return combatJungler || role === 'Assassin' || role === 'Fighter' || (unit.player?.stats?.clu ?? 60) >= 82;
}

/**
 * Item 30: Counter-Jungling Detection.
 * Checks if a camp on one team's half of the map was cleared by the opposing team.
 */
export function checkCounterJungleSteal(
  camp: { id: string; name: string; x: number; y: number; type: string },
  killer: Pick<AramChampionUnit, 'team' | 'player'>,
  matchSecond: number,
): StolenCampMarker | null {
  if (camp.type === 'siege_golem' || Math.abs(camp.x - DRAGON_X) < 120) return null;
  const homeTeam: 'blue' | 'red' = camp.x < DRAGON_X ? 'blue' : 'red';
  if (killer.team === homeTeam) return null;

  return {
    id: `stolen_${camp.id}_${Math.round(matchSecond)}`,
    campId: camp.id,
    campName: camp.name,
    homeTeam,
    stolenByTeam: killer.team,
    stolenByPlayer: killer.player.name,
    x: camp.x,
    y: camp.y,
    stolenAt: matchSecond,
    expiresAt: matchSecond + 18,
  };
}

/**
 * Renders Phase 5 Jungle Ecosystem visuals on the 3D Tactical Canvas:
 * - Multi-Creep Pack Minions around living camps (Item 22)
 * - Distinct Under-Foot Jungle Buff Aura Rings (Blue/Red/Wolf/Gromp) (Item 23)
 * - Roaming River Scuttler Crabs & River Speed Shrines (Item 26)
 * - Interactive Jungle Plants (Blast Cone, Scryer's Bloom, Honeyfruit) (Item 27)
 * - Counter-Jungled Stolen Camp Alert Badges (Item 30)
 */
export function drawJungleEcosystemOverlay(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, h: number) => { x: number; y: number },
  zoom: number,
  matchSecond: number,
  champions: readonly AramChampionUnit[],
  camps: readonly { id: string; x: number; y: number; hp: number; maxHp: number; isAlive: boolean; type: string }[],
  buffStates: Record<string, ChampionJungleBuffState>,
  scuttlers: readonly RiverScuttler[],
  plants: readonly JunglePlant[],
  stolenMarkers: readonly StolenCampMarker[],
): void {
  ctx.save();

  // 1. River Scuttler Speed Shrines & Living Scuttler Crabs (Item 26)
  for (const scuttler of scuttlers) {
    if (scuttler.shrineTeam && scuttler.shrineExpiresAt && matchSecond < scuttler.shrineExpiresAt) {
      const p = project(scuttler.homeX, scuttler.homeY, 3);
      const r = SCUTTLER_SHRINE_RADIUS * 0.36 * Math.sqrt(zoom);
      const color = scuttler.shrineTeam === 'blue' ? '#38bdf8' : '#f43f5e';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = scuttler.shrineTeam === 'blue' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(244, 63, 94, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = 'bold 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🦀 SPEED SHRINE', p.x, p.y + 3);
      ctx.restore();
    }

    if (scuttler.isAlive) {
      const p = project(scuttler.x, scuttler.y, 12);
      ctx.save();
      ctx.fillStyle = '#2dd4bf';
      ctx.strokeStyle = '#0f766e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (scuttler.hp < scuttler.maxHp) {
        const ratio = Math.max(0, scuttler.hp / scuttler.maxHp);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(p.x - 14, p.y - 14, 28, 4);
        ctx.fillStyle = '#2dd4bf';
        ctx.fillRect(p.x - 14, p.y - 14, 28 * ratio, 4);
      }
      ctx.restore();
    }
  }

  // 2. Interactive Jungle Plants (Blast Cone, Scryer's Bloom, Honeyfruit) (Item 27)
  for (const plant of plants) {
    if (!plant.isAlive) continue;
    const p = project(plant.x, plant.y, 10);
    const color =
      plant.kind === 'blast_cone' ? '#ef4444' : plant.kind === 'scryer_bloom' ? '#38bdf8' : '#4ade80';
    const icon =
      plant.kind === 'blast_cone' ? '💥' : plant.kind === 'scryer_bloom' ? '👁' : '🍈';
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(icon, p.x, p.y + 3.5);
    ctx.restore();
  }

  // 3. Multi-Creep Camp Pack Minions (Item 22)
  for (const camp of camps) {
    const pack = getCampPackMinions(camp);
    for (const mini of pack) {
      if (!mini.alive) continue;
      const p = project(camp.x + mini.offsetX, camp.y + mini.offsetY, 14);
      ctx.save();
      ctx.fillStyle = camp.type === 'golem' ? '#38bdf8' : camp.type === 'raptor' ? '#fb923c' : camp.type === 'wolf' ? '#a855f7' : '#10b981';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // 4. Distinct Champion Under-Foot Buff Aura Rings (Item 23)
  for (const unit of champions) {
    if (!unit.isAlive) continue;
    const state = buffStates[unit.id];
    if (!state) continue;
    const activeBuffs: { color: string; radiusOffset: number }[] = [];
    if (state.blueUntil > matchSecond) activeBuffs.push({ color: '#38bdf8', radiusOffset: 0 });
    if (state.redUntil > matchSecond) activeBuffs.push({ color: '#fb923c', radiusOffset: 4 });
    if (state.wolfUntil > matchSecond) activeBuffs.push({ color: '#a855f7', radiusOffset: 8 });
    if (state.grompUntil > matchSecond) activeBuffs.push({ color: '#10b981', radiusOffset: 12 });
    if (activeBuffs.length === 0) continue;

    const p = project(unit.x, unit.y, 3);
    for (const buff of activeBuffs) {
      ctx.save();
      ctx.strokeStyle = buff.color;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 4]);
      ctx.lineDashOffset = -matchSecond * 16;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 18 + buff.radiusOffset, 11 + buff.radiusOffset * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 5. Counter-Jungling Stolen Camp Alert Markers (Item 30)
  for (const marker of stolenMarkers) {
    if (matchSecond >= marker.expiresAt) continue;
    const p = project(marker.x, marker.y, 28);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(p.x - 52, p.y - 10, 104, 18, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠️ STOLEN (${marker.stolenByPlayer})`, p.x, p.y + 2);
    ctx.restore();
  }

  ctx.restore();
}

