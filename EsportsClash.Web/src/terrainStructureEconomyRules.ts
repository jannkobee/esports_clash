import type { AramChampionUnit, LaneMinion, LaneStructure } from './types.ts';
import { ARENA_WIDTH, DRAGON_X, laneY, ROCK_TERRAIN } from './arenaRules.ts';

// ============================================================================
// PHASE 7: TERRAIN MECHANICS, MOBILITY & STRUCTURE DEPTH (Items 5–9, 40, 60–62)
// ============================================================================

export const HIGHGROUND_BLUE_MAX_X = 500;
export const HIGHGROUND_RED_MIN_X = ARENA_WIDTH - 500; // 2300
export const HIGHGROUND_UPHILL_DAMAGE_MULTIPLIER = 0.85; // -15% uphill glancing penalty
export const THIN_WALL_MAX_THICKNESS = 68;
export const WALL_SLAM_BONUS_STUN = 0.55;
export const WALL_SLAM_BONUS_DAMAGE = 65;
export const HOMEGUARD_DURATION_SECONDS = 5.0;
export const HOMEGUARD_MAX_SPEED_BONUS = 0.65; // +65% decaying over 5s

export interface BossPortalGate {
  id: string;
  pitId: 'dragon_pit' | 'golem_pit';
  team: 'blue' | 'red';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  expiresAt: number;
  usedByIds: string[];
}

export interface AlcovePocket {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
}

export interface BaseGate {
  id: string;
  team: 'blue' | 'red';
  side: 'north' | 'south';
  x: number;
  y: number;
  radius: number;
}

export const MID_ALCOVES: readonly AlcovePocket[] = [
  { id: 'alcove_north', name: 'North River Alcove', x: DRAGON_X, y: laneY(DRAGON_X) - 195, radius: 48 },
  { id: 'alcove_south', name: 'South River Alcove', x: DRAGON_X, y: laneY(DRAGON_X) + 195, radius: 48 },
];

export const BASE_GATES: readonly BaseGate[] = [
  { id: 'gate_blue_north', team: 'blue', side: 'north', x: 470, y: laneY(470) - 155, radius: 42 },
  { id: 'gate_blue_south', team: 'blue', side: 'south', x: 470, y: laneY(470) + 155, radius: 42 },
  { id: 'gate_red_north', team: 'red', side: 'north', x: ARENA_WIDTH - 470, y: laneY(ARENA_WIDTH - 470) - 155, radius: 42 },
  { id: 'gate_red_south', team: 'red', side: 'south', x: ARENA_WIDTH - 470, y: laneY(ARENA_WIDTH - 470) + 155, radius: 42 },
];

export function isOnHighgroundPlatform(point: { x: number; y: number }): 'blue' | 'red' | null {
  if (point.x <= HIGHGROUND_BLUE_MAX_X) return 'blue';
  if (point.x >= HIGHGROUND_RED_MIN_X) return 'red';
  return null;
}

/**
 * Item 5: Highground Base Ramp Elevation Advantage (+15% uphill glancing damage reduction when
 * a low-ground attacker strikes a defender on their highground platform without allied highground vision).
 */
export function getHighgroundElevationDamageMultiplier(
  attacker: { x: number; y: number; team: 'blue' | 'red' },
  target: { x: number; y: number; team: 'blue' | 'red' },
  alliedHighgroundSpotter = false,
): number {
  const attackerHg = isOnHighgroundPlatform(attacker);
  const targetHg = isOnHighgroundPlatform(target);
  if (targetHg && targetHg === target.team && attackerHg !== targetHg && !alliedHighgroundSpotter) {
    return HIGHGROUND_UPHILL_DAMAGE_MULTIPLIER;
  }
  return 1.0;
}

/**
 * Item 6: Thin vs. Thick Wall Dash Passability Rules.
 * If a dash endpoint clears >55% of a thin rock boulder (diameter <= 68px), it vaults across cleanly;
 * if the rock is a thick wall (diameter > 68px), it stops in front of the rock.
 */
export function evaluateWallDashPassability(
  start: { x: number; y: number },
  target: { x: number; y: number },
  rocks: readonly { x: number; y: number; radius: number }[] = ROCK_TERRAIN,
): { canVault: boolean; landingPoint: { x: number; y: number }; vaultedRock?: { x: number; y: number; radius: number } } {
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return { canVault: true, landingPoint: { ...target } };

  for (const rock of rocks) {
    const dTarget = Math.hypot(target.x - rock.x, target.y - rock.y);
    if (dTarget < rock.radius + 10) {
      const diameter = rock.radius * 2;
      const dirX = dx / dist;
      const dirY = dy / dist;
      const proj = (rock.x - start.x) * dirX + (rock.y - start.y) * dirY;
      // Thin wall: if dash reaches past the rock center, vault across to the far side
      if (diameter <= THIN_WALL_MAX_THICKNESS && dist >= proj) {
        return {
          canVault: true,
          landingPoint: {
            x: rock.x + dirX * (rock.radius + 14),
            y: rock.y + dirY * (rock.radius + 14),
          },
          vaultedRock: rock,
        };
      }
      // Thick wall: clamp before the wall face
      return {
        canVault: false,
        landingPoint: {
          x: rock.x - dirX * (rock.radius + 14),
          y: rock.y - dirY * (rock.radius + 14),
        },
      };
    }
  }
  return { canVault: true, landingPoint: { ...target } };
}

/**
 * Item 7: Wall-Slam Stun Interaction for Knockbacks.
 * Checks if a knockback trajectory slams the victim into an impassable rock boulder.
 */
export function checkWallSlamCollision(
  start: { x: number; y: number },
  rawEnd: { x: number; y: number },
  rocks: readonly { x: number; y: number; radius: number }[] = ROCK_TERRAIN,
): { slammed: boolean; bonusStun: number; bonusDamage: number; impactPoint: { x: number; y: number } } {
  for (const rock of rocks) {
    const dEnd = Math.hypot(rawEnd.x - rock.x, rawEnd.y - rock.y);
    if (dEnd <= rock.radius + 13) {
      const dx = rawEnd.x - start.x;
      const dy = rawEnd.y - start.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      return {
        slammed: true,
        bonusStun: WALL_SLAM_BONUS_STUN,
        bonusDamage: WALL_SLAM_BONUS_DAMAGE,
        impactPoint: {
          x: rock.x - (dx / len) * (rock.radius + 14),
          y: rock.y - (dy / len) * (rock.radius + 14),
        },
      };
    }
  }
  return { slammed: false, bonusStun: 0, bonusDamage: 0, impactPoint: rawEnd };
}

/**
 * Item 8: Chokepoint Funnel Detection (160px River / Pit Mouths).
 */
export function isInsideTacticalChokepoint(point: { x: number; y: number }): boolean {
  const center = laneY(DRAGON_X);
  const inNorthRiverMouth = Math.abs(point.x - DRAGON_X) <= 80 && Math.abs(point.y - (center - 195)) <= 75;
  const inSouthRiverMouth = Math.abs(point.x - DRAGON_X) <= 80 && Math.abs(point.y - (center + 195)) <= 75;
  const inDragonPitMouth = Math.abs(point.x - DRAGON_X) <= 80 && Math.abs(point.y - 365) <= 60;
  const inGolemPitMouth = Math.abs(point.x - DRAGON_X) <= 80 && Math.abs(point.y - 1075) <= 60;
  return inNorthRiverMouth || inSouthRiverMouth || inDragonPitMouth || inGolemPitMouth;
}

/**
 * Item 60: Base Gate Pass-Through Speed Bonus for Allied Champions.
 */
export function isPassingAlliedBaseGate(unit: { team: 'blue' | 'red'; x: number; y: number }): boolean {
  return BASE_GATES.some(
    gate => gate.team === unit.team && Math.hypot(unit.x - gate.x, unit.y - gate.y) <= gate.radius,
  );
}

/**
 * Item 61: Homeguard Fountain Speed Multiplier (+65% decaying over 5s).
 */
export function getHomeguardSpeedMultiplier(homeguardRemaining = 0): number {
  if (homeguardRemaining <= 0) return 1.0;
  const progress = Math.max(0, Math.min(1, homeguardRemaining / HOMEGUARD_DURATION_SECONDS));
  return 1 + HOMEGUARD_MAX_SPEED_BONUS * progress;
}

// ============================================================================
// PHASE 8: STRUCTURES, DESTRUCTION & WAVES (Items 43, 44, 45, 46, 52)
// ============================================================================

export const TURRET_PLATE_MAX = 5;
export const TURRET_PLATE_GOLD = 125;
export const TURRET_PLATING_FALL_SECOND = 8 * 60; // 8:00
export const BACKDOOR_DAMAGE_MULTIPLIER = 0.34; // 66% damage reduction without nearby minions
export const BACKDOOR_MINION_RADIUS = 360;
export const MINION_AGGRO_CALL_FOR_HELP_RADIUS = 220;
export const MINION_AGGRO_DURATION = 2.5;

export type StructureDamageState = 'pristine' | 'cracked' | 'critical' | 'rubble';

/**
 * Item 43: Turret Bulwark Plating (5 plates at 80%, 60%, 40%, 20%, 0% HP before 8:00).
 * Returns how many plates remain intact on an outer turret at a given HP fraction and game time.
 */
export function getTurretPlatesRemaining(
  structure: Pick<LaneStructure, 'type' | 'hp' | 'maxHp' | 'isAlive'>,
  matchSecond: number,
): number {
  if (!structure.isAlive || structure.type !== 'outer_tower' || matchSecond >= TURRET_PLATING_FALL_SECOND) {
    return 0;
  }
  const ratio = Math.max(0, Math.min(1, structure.hp / Math.max(1, structure.maxHp)));
  return Math.max(1, Math.ceil(ratio * TURRET_PLATE_MAX));
}

/**
 * Item 44: Backdoor Protection (66% damage reduction when no allied minion/siege golem is within 360px of enemy structure).
 */
export function hasStructureBackdoorProtection(
  structure: Pick<LaneStructure, 'team' | 'x' | 'y' | 'isAlive'>,
  minions: readonly Pick<LaneMinion, 'team' | 'x' | 'y' | 'isAlive'>[],
): boolean {
  if (!structure.isAlive) return false;
  const enemyMinionNearby = minions.some(
    m =>
      m.isAlive &&
      m.team !== structure.team &&
      Math.hypot(m.x - structure.x, m.y - structure.y) <= BACKDOOR_MINION_RADIUS,
  );
  return !enemyMinionNearby;
}

/**
 * Item 45: Progressive Turret Damage States ('pristine' | 'cracked' | 'critical' | 'rubble').
 */
export function getStructureDamageState(structure: Pick<LaneStructure, 'hp' | 'maxHp' | 'isAlive'>): StructureDamageState {
  if (!structure.isAlive || structure.hp <= 0) return 'rubble';
  const ratio = structure.hp / Math.max(1, structure.maxHp);
  if (ratio > 0.66) return 'pristine';
  if (ratio > 0.33) return 'cracked';
  return 'critical';
}

/**
 * Item 52: Minion Aggro Call-for-Help Rule.
 * Returns enemy lane minions within 220px that should retaliate when `attacker` basic-attacks `victimChampion`.
 */
export function findRetaliatingEnemyMinions<T extends Pick<LaneMinion, 'id' | 'team' | 'x' | 'y' | 'isAlive'>>(
  attacker: Pick<AramChampionUnit, 'team' | 'x' | 'y'>,
  victimChampion: Pick<AramChampionUnit, 'team' | 'x' | 'y'>,
  minions: readonly T[],
): T[] {
  if (attacker.team === victimChampion.team) return [];
  return minions.filter(
    m =>
      m.isAlive &&
      m.team === victimChampion.team &&
      (Math.hypot(m.x - attacker.x, m.y - attacker.y) <= MINION_AGGRO_CALL_FOR_HELP_RADIUS ||
        Math.hypot(m.x - victimChampion.x, m.y - victimChampion.y) <= MINION_AGGRO_CALL_FOR_HELP_RADIUS),
  );
}

// ============================================================================
// PHASE 9: ECONOMY & COMEBACK MECHANICS (Items 55, 56, 57, 58)
// ============================================================================

export const OBJECTIVE_BOUNTY_GOLD_DEFICIT = 2500;
export const OBJECTIVE_BOUNTY_REWARD_GOLD = 250;
export const RELIC_HOT_DURATION_SECONDS = 4.0;
export const RELIC_HOT_HP_PER_SECOND = 22;
export const RELIC_HOT_MANA_PER_SECOND = 12;

export interface ActiveRelicHealingZone {
  id: string;
  team: 'blue' | 'red';
  x: number;
  y: number;
  radius: number;
  expiresAt: number;
}

/**
 * Item 55: Champion Kill Streak Shutdown Bounties (+150g to +600g).
 */
export function getStreakShutdownBountyGold(consecutiveKills: number): number {
  if (consecutiveKills < 3) return 0;
  if (consecutiveKills === 3) return 150;
  if (consecutiveKills === 4) return 250;
  if (consecutiveKills === 5) return 400;
  return 600;
}

/**
 * Item 56: Objective Bounties for Trailing Team (> 2.5k Gold Deficit after 4:00).
 */
export function isObjectiveBountyActiveForTeam(
  team: 'blue' | 'red',
  blueTotalGold: number,
  redTotalGold: number,
  matchSecond: number,
): boolean {
  if (matchSecond < 240) return false;
  const deficit = team === 'blue' ? redTotalGold - blueTotalGold : blueTotalGold - redTotalGold;
  return deficit >= OBJECTIVE_BOUNTY_GOLD_DEFICIT;
}

/**
 * Item 57: Assist Gold Pool & Proximity XP Sharing Formula.
 */
export function calculateAssistGoldShare(baseKillGold: number, assisterCount: number): number {
  if (assisterCount <= 0) return 0;
  const pool = Math.round(baseKillGold * 0.5);
  return Math.round(pool / assisterCount);
}

export function calculateProximityXpShare(baseXp: number, nearbyAllyCount: number): number {
  if (nearbyAllyCount <= 1) return baseXp;
  return Math.round((baseXp * 1.24) / nearbyAllyCount);
}

/**
 * Renders Phase 7, 8, and 9 Overlays on the 3D Tactical Canvas:
 * - Post-Boss Hex-Portal Gates inside Dragon/Golem pits (Item 40)
 * - Base Gates & Mid Alcove tactical markers (Items 9 & 60)
 * - Turret Bulwark Plate pips, Backdoor Shield icon, & Rubble/Cracked state badges (Items 43, 44, 45)
 * - Champion Shutdown Bounty tags & Objective Bounty indicator (Items 55 & 56)
 * - Enhanced Health Relic 4s HoT Healing Zones (Item 58)
 */
export function drawTerrainStructureEconomyOverlay(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, h: number) => { x: number; y: number },
  zoom: number,
  matchSecond: number,
  structures: readonly LaneStructure[],
  minions: readonly LaneMinion[],
  champions: readonly AramChampionUnit[],
  streakMap: Record<string, number>,
  portalGates: readonly BossPortalGate[],
  relicZones: readonly ActiveRelicHealingZone[],
): void {
  ctx.save();

  // 1. Base Gates (Item 60)
  for (const gate of BASE_GATES) {
    const p = project(gate.x, gate.y, 6);
    const color = gate.team === 'blue' ? 'rgba(56, 189, 248, 0.42)' : 'rgba(244, 63, 94, 0.42)';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 14, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Post-Boss Hex-Portal Gates (Item 40)
  for (const portal of portalGates) {
    if (matchSecond >= portal.expiresAt) continue;
    const p = project(portal.fromX, portal.fromY, 10);
    const color = portal.team === 'blue' ? '#38bdf8' : '#f43f5e';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌀 PORTAL', p.x, p.y + 3);
    ctx.restore();
  }

  // 3. Enhanced Health Relic 4s HoT Zones (Item 58)
  for (const zone of relicZones) {
    if (matchSecond >= zone.expiresAt) continue;
    const p = project(zone.x, zone.y, 3);
    const r = zone.radius * 0.35 * Math.sqrt(zoom);
    ctx.save();
    ctx.strokeStyle = '#34d399';
    ctx.fillStyle = 'rgba(52, 211, 153, 0.14)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 4. Structure Bulwark Plates, Backdoor Protection Shield, & Rubble Plinths (Items 43, 44, 45)
  for (const st of structures) {
    const state = getStructureDamageState(st);
    if (state === 'rubble') {
      const p = project(st.x, st.y, 4);
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 18, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const headP = project(st.x, st.y, 64);
    const plates = getTurretPlatesRemaining(st, matchSecond);
    if (plates > 0) {
      const pipW = 6;
      const gap = 2;
      const totalW = TURRET_PLATE_MAX * pipW + (TURRET_PLATE_MAX - 1) * gap;
      const sx = headP.x - totalW / 2;
      ctx.save();
      for (let i = 0; i < TURRET_PLATE_MAX; i++) {
        ctx.fillStyle = i < plates ? '#fbbf24' : 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(sx + i * (pipW + gap), headP.y - 16, pipW, 3.5);
      }
      ctx.restore();
    }

    // Backdoor protection indicator when an enemy champion is near the structure without minions
    const enemyChampNearby = champions.some(
      c => c.isAlive && c.team !== st.team && Math.hypot(c.x - st.x, c.y - st.y) <= 280,
    );
    if (enemyChampNearby && hasStructureBackdoorProtection(st, minions)) {
      ctx.save();
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛡️ BACKDOOR -66%', headP.x, headP.y - 22);
      ctx.restore();
    }
  }

  // 5. Champion Kill Streak Shutdown Bounty Tags (Item 55)
  for (const unit of champions) {
    if (!unit.isAlive) continue;
    const streak = streakMap[unit.id] ?? 0;
    const bounty = getStreakShutdownBountyGold(streak);
    if (bounty <= 0) continue;
    const headP = project(unit.x, unit.y, 76);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(headP.x - 28, headP.y - 24, 56, 14, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`💰 +${bounty}g`, headP.x, headP.y - 14);
    ctx.restore();
  }

  ctx.restore();
}

