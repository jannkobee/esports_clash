import type { AramChampionUnit, LaneStructure } from './types.ts';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BARRACKS_X,
  DRAGON_X,
  INNER_TOWER_X,
  NEXUS_TOWER_X,
  NEXUS_X,
  OUTER_TOWER_X,
  WELL_X,
  laneY,
  type ArenaMapProfile,
  ACTIVE_MAP_PROFILE,
} from './arenaLayout.ts';

// ============================================================================
// PHASE 10: DYNAMIC EVENTS & BROADCAST EXTRAS (Items 67, 68, 69, 70, 71, 74)
// ============================================================================

export const OVERTIME_CONVERGENCE_SECOND = 18 * 60; // 18:00
export const SUPPLY_DROP_SECONDS: readonly number[] = [6 * 60, 11 * 60]; // 6:00 and 11:00
export const SUPPLY_DROP_RADIUS = 135;
export const SUPPLY_DROP_CAPTURE_SECONDS = 3.0;
export const SUPPLY_DROP_GOLD_REWARD = 150;
export const SUPPLY_DROP_SHIELD_REWARD = 180;
export const MULTIKILL_WINDOW_SECONDS = 10.0;

export interface FirstBloodRecord {
  killerId: string;
  killerName: string;
  victimName: string;
  team: 'blue' | 'red';
  second: number;
  x: number;
  y: number;
}

export interface MultiKillTracker {
  count: number;
  lastKillAt: number;
  lastBannerCount?: number;
}

export interface CelestialSupplyDrop {
  id: string;
  spawnIndex: number;
  x: number;
  y: number;
  radius: number;
  spawnedAt: number;
  active: boolean;
  capturingTeam?: 'blue' | 'red';
  captureProgress: number;
  claimedByTeam?: 'blue' | 'red';
  claimedAt?: number;
}

export interface ObjectivePipAlert {
  bossId: string;
  bossName: string;
  x: number;
  y: number;
  hpFraction: number;
  blueCount: number;
  redCount: number;
  contested: boolean;
}

/**
 * Item 68: Multi-Kill Escalation Label (2 = Double Kill -> 5 = Pentakill).
 */
export function recordChampionKillForMultiKill(
  trackerMap: Record<string, MultiKillTracker>,
  killerId: string,
  matchSecond: number,
): { count: number; label: string | null } {
  const prev = trackerMap[killerId];
  const count = prev && matchSecond - prev.lastKillAt <= MULTIKILL_WINDOW_SECONDS ? Math.min(5, prev.count + 1) : 1;
  trackerMap[killerId] = { count, lastKillAt: matchSecond, lastBannerCount: count };
  const label =
    count === 2
      ? 'DOUBLE KILL!'
      : count === 3
        ? 'TRIPLE KILL!'
        : count === 4
          ? 'QUADRA KILL!'
          : count >= 5
            ? '🔥 PENTAKILL!'
            : null;
  return { count, label };
}

/**
 * Item 69: Checks whether an entire 5-champion team is simultaneously wiped (ACE).
 */
export function checkTeamAce(
  champions: readonly Pick<AramChampionUnit, 'team' | 'isAlive'>[],
  victimTeam: 'blue' | 'red',
): boolean {
  const teamUnits = champions.filter(c => c.team === victimTeam);
  return teamUnits.length > 0 && teamUnits.every(c => !c.isAlive);
}

/**
 * Item 70: Sudden-Death / Overtime Arena Convergence (18:00+).
 */
export function isOvertimeConvergenceActive(matchSecond: number): boolean {
  return matchSecond >= OVERTIME_CONVERGENCE_SECOND;
}

export function getOvertimeStructureDamageMultiplier(matchSecond: number): number {
  return isOvertimeConvergenceActive(matchSecond) ? 1.35 : 1.0;
}

/**
 * Item 71: Steps the Contested Celestial Supply Drop at Mid-Plaza (6:00 and 11:00).
 */
export function stepCelestialSupplyDrop(
  current: CelestialSupplyDrop | null,
  spawnedIndices: Set<number>,
  champions: readonly AramChampionUnit[],
  matchSecond: number,
  dt: number,
): { next: CelestialSupplyDrop | null; spawnedNow: boolean; claimedBy?: 'blue' | 'red' } {
  let drop = current;
  let spawnedNow = false;

  for (let i = 0; i < SUPPLY_DROP_SECONDS.length; i++) {
    const triggerSec = SUPPLY_DROP_SECONDS[i];
    if (matchSecond >= triggerSec && !spawnedIndices.has(i) && (!drop || !drop.active)) {
      spawnedIndices.add(i);
      drop = {
        id: `supply_drop_${i}`,
        spawnIndex: i,
        x: DRAGON_X,
        y: laneY(DRAGON_X),
        radius: SUPPLY_DROP_RADIUS,
        spawnedAt: matchSecond,
        active: true,
        captureProgress: 0,
      };
      spawnedNow = true;
      break;
    }
  }

  if (!drop || !drop.active) {
    return { next: drop, spawnedNow };
  }

  const inZone = champions.filter(
    c => c.isAlive && Math.hypot(c.x - drop!.x, c.y - drop!.y) <= drop!.radius,
  );
  const blueIn = inZone.filter(c => c.team === 'blue').length;
  const redIn = inZone.filter(c => c.team === 'red').length;

  if (blueIn > redIn) {
    if (drop.capturingTeam !== 'blue') {
      drop.capturingTeam = 'blue';
      drop.captureProgress = 0;
    }
    drop.captureProgress += dt;
  } else if (redIn > blueIn) {
    if (drop.capturingTeam !== 'red') {
      drop.capturingTeam = 'red';
      drop.captureProgress = 0;
    }
    drop.captureProgress += dt;
  } else if (blueIn === 0 && redIn === 0) {
    drop.captureProgress = Math.max(0, drop.captureProgress - dt * 0.5);
  }

  if (drop.captureProgress >= SUPPLY_DROP_CAPTURE_SECONDS && drop.capturingTeam) {
    const winner = drop.capturingTeam;
    drop.active = false;
    drop.claimedByTeam = winner;
    drop.claimedAt = matchSecond;
    return { next: drop, spawnedNow, claimedBy: winner };
  }

  return { next: drop, spawnedNow };
}

/**
 * Item 74: Picture-in-Picture (PiP) Objective Alert Window when a boss is engaged off-camera.
 */
export function computeObjectivePipAlert(
  dragon: { id: string; name: string; x: number; y: number; hp: number; maxHp: number; isAlive: boolean },
  golem: { id: string; name: string; x: number; y: number; hp: number; maxHp: number; isAlive: boolean } | undefined,
  champions: readonly Pick<AramChampionUnit, 'team' | 'x' | 'y' | 'isAlive'>[],
  cameraCenter: { x: number; y: number },
): ObjectivePipAlert | null {
  const candidates = [dragon, ...(golem ? [golem] : [])].filter(
    b => b.isAlive && b.hp < b.maxHp * 0.99,
  );
  if (candidates.length === 0) return null;

  const boss = candidates[0];
  const distFromCam = Math.hypot(boss.x - cameraCenter.x, boss.y - cameraCenter.y);
  if (distFromCam < 280) return null; // Already centered in main camera view

  const nearChamps = champions.filter(
    c => c.isAlive && Math.hypot(c.x - boss.x, c.y - boss.y) <= 320,
  );
  const blueCount = nearChamps.filter(c => c.team === 'blue').length;
  const redCount = nearChamps.filter(c => c.team === 'red').length;

  return {
    bossId: boss.id,
    bossName: boss.name,
    x: boss.x,
    y: boss.y,
    hpFraction: Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.maxHp))),
    blueCount,
    redCount,
    contested: blueCount > 0 && redCount > 0,
  };
}

// ============================================================================
// PHASE 11: ATMOSPHERE, AUDIO & EFFECTS (Items 11, 65, 66, 77, 79–84)
// ============================================================================

export type ArenaLightingPresetId = 'daylight' | 'dusk' | 'overcast';

export interface ArenaLightingPreset {
  id: ArenaLightingPresetId;
  label: string;
  tintColor: string;
  vignetteAlpha: number;
}

export const ARENA_LIGHTING_PRESETS: Record<ArenaLightingPresetId, ArenaLightingPreset> = {
  daylight: {
    id: 'daylight',
    label: 'High-Noon Daylight',
    tintColor: 'rgba(255, 251, 235, 0.0)',
    vignetteAlpha: 0.12,
  },
  dusk: {
    id: 'dusk',
    label: 'Golden Dusk',
    tintColor: 'rgba(251, 146, 60, 0.08)',
    vignetteAlpha: 0.22,
  },
  overcast: {
    id: 'overcast',
    label: 'Storm Overcast',
    tintColor: 'rgba(56, 189, 248, 0.07)',
    vignetteAlpha: 0.2,
  },
};

export interface ScorchDecal {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  createdAt: number;
  expiresAt: number;
}

export interface WaterRippleRing {
  id: string;
  x: number;
  y: number;
  createdAt: number;
  expiresAt: number;
}

/**
 * Item 77: Frustum Culling Policy for 2D/3D Tactical Overlay Entities.
 */
export function shouldCullOffscreenPoint(
  worldPoint: { x: number; y: number },
  viewport: { x: number; y: number; halfW: number; halfH: number },
  margin = 180,
): boolean {
  return (
    Math.abs(worldPoint.x - viewport.x) > viewport.halfW + margin ||
    Math.abs(worldPoint.y - viewport.y) > viewport.halfH + margin
  );
}

/**
 * Item 79 & 84: Dynamic Combat Ducking, Spatial Audio Zones, & Crowd Excitement Mix.
 */
export function computeSpatialAudioMix(
  cameraCenter: { x: number; y: number },
  champions: readonly Pick<AramChampionUnit, 'x' | 'y' | 'isAlive' | 'combatTimer'>[],
  activeMultiKillCount = 0,
): {
  riverAmbientGain: number;
  forestAmbientGain: number;
  combatDuckingFactor: number;
  crowdExcitement: number;
} {
  const distToRiver = Math.abs(cameraCenter.x - DRAGON_X);
  const riverAmbientGain = Math.max(0, Math.min(1, 1 - distToRiver / 600));
  const distToLane = Math.abs(cameraCenter.y - laneY(cameraCenter.x));
  const forestAmbientGain = Math.max(0, Math.min(1, distToLane / 450));

  const fightingChamps = champions.filter(
    c => c.isAlive && (c.combatTimer ?? 0) > 0 && Math.hypot(c.x - cameraCenter.x, c.y - cameraCenter.y) <= 550,
  ).length;
  const combatDuckingFactor = fightingChamps >= 4 ? 0.45 : fightingChamps >= 2 ? 0.68 : 1.0;
  const crowdExcitement = Math.min(1, fightingChamps * 0.14 + Math.max(0, activeMultiKillCount - 1) * 0.25);

  return { riverAmbientGain, forestAmbientGain, combatDuckingFactor, crowdExcitement };
}

/**
 * Item 81: Checks if a champion is walking in the shallow river channel (outside the dry stone bridge).
 */
export function isWalkingInRiverWater(unit: { x: number; y: number; vx?: number; vy?: number }): boolean {
  const inRiverX = Math.abs(unit.x - DRAGON_X) <= 135;
  const onStoneBridge = Math.abs(unit.y - laneY(unit.x)) <= 165;
  const moving = Math.hypot(unit.vx ?? 0, unit.vy ?? 0) > 8;
  return inRiverX && !onStoneBridge && moving;
}

// ============================================================================
// PHASE 12: ML, BALANCE & RELEASE (Items 85, 86, 88, 89)
// ============================================================================

export type BroadcastCameraPresetId = 'broadcast' | 'tactical_high' | 'action_close';

export interface BroadcastCameraPreset {
  id: BroadcastCameraPresetId;
  label: string;
  zoom: number;
}

export const BROADCAST_CAMERA_PRESETS: Record<BroadcastCameraPresetId, BroadcastCameraPreset> = {
  broadcast: { id: 'broadcast', label: 'Broadcast (2.65×)', zoom: 2.65 },
  tactical_high: { id: 'tactical_high', label: 'Tactical High (1.85×)', zoom: 1.85 },
  action_close: { id: 'action_close', label: 'Action Close (3.25×)', zoom: 3.25 },
};

/**
 * Item 85: Spatial Influence Grid Summary (computes Blue vs Red territorial control across 7x3 arena cells).
 */
export function computeInfluenceHeatmapCells(
  champions: readonly Pick<AramChampionUnit, 'team' | 'x' | 'y' | 'isAlive'>[],
  structures: readonly Pick<LaneStructure, 'team' | 'x' | 'y' | 'isAlive'>[],
): { x: number; y: number; width: number; height: number; netBlueControl: number }[] {
  const cols = 7;
  const rows = 3;
  const cellW = ARENA_WIDTH / cols;
  const cellH = ARENA_HEIGHT / rows;
  const cells: { x: number; y: number; width: number; height: number; netBlueControl: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cellW;
      const cy = (r + 0.5) * cellH;
      let score = 0;
      for (const u of champions) {
        if (!u.isAlive) continue;
        const d = Math.hypot(u.x - cx, u.y - cy);
        if (d <= 550) {
          const weight = 1 - d / 550;
          score += u.team === 'blue' ? weight : -weight;
        }
      }
      for (const s of structures) {
        if (!s.isAlive) continue;
        const d = Math.hypot(s.x - cx, s.y - cy);
        if (d <= 500) {
          const weight = (1 - d / 500) * 1.25;
          score += s.team === 'blue' ? weight : -weight;
        }
      }
      cells.push({
        x: c * cellW,
        y: r * cellH,
        width: cellW,
        height: cellH,
        netBlueControl: Math.max(-1, Math.min(1, score / 2.5)),
      });
    }
  }
  return cells;
}

/**
 * Item 86: Builds transferable waypoint observation descriptors for Phase 5–10 battlefield objects
 * without mutating the frozen 224-input actor v3 schema.
 */
export function buildBattlefieldWaypointDescriptors(
  scuttlers: readonly { id: string; x: number; y: number; isAlive: boolean }[],
  plants: readonly { id: string; kind: string; x: number; y: number; isAlive: boolean }[],
  supplyDrop: CelestialSupplyDrop | null,
): { id: string; x: number; y: number; kind: 'waypoint'; healing?: boolean; epic?: boolean }[] {
  const waypoints: { id: string; x: number; y: number; kind: 'waypoint'; healing?: boolean; epic?: boolean }[] = [];
  for (const s of scuttlers) {
    if (s.isAlive) waypoints.push({ id: `map:${s.id}`, x: s.x, y: s.y, kind: 'waypoint' });
  }
  for (const p of plants) {
    if (p.isAlive) {
      waypoints.push({
        id: `map:${p.id}`,
        x: p.x,
        y: p.y,
        kind: 'waypoint',
        healing: p.kind === 'honeyfruit',
      });
    }
  }
  if (supplyDrop?.active) {
    waypoints.push({
      id: `map:${supplyDrop.id}`,
      x: supplyDrop.x,
      y: supplyDrop.y,
      kind: 'waypoint',
      epic: true,
    });
  }
  return waypoints;
}

/**
 * Item 88: Automated East-West Symmetry & Balance Audit for `straight-v4`.
 */
export function auditArenaSymmetryAndBalance(profile: ArenaMapProfile = ACTIVE_MAP_PROFILE): {
  symmetric: boolean;
  maxAsymmetryPx: number;
  checkedPairs: number;
} {
  let maxAsymmetryPx = 0;
  let checkedPairs = 0;

  const checkMirrorX = (blueX: number, redX: number) => {
    const diff = Math.abs(blueX + redX - ARENA_WIDTH);
    maxAsymmetryPx = Math.max(maxAsymmetryPx, diff);
    checkedPairs++;
  };

  checkMirrorX(WELL_X.blue, WELL_X.red);
  checkMirrorX(NEXUS_X.blue, NEXUS_X.red);
  checkMirrorX(BARRACKS_X.blue, BARRACKS_X.red);
  checkMirrorX(NEXUS_TOWER_X.blue, NEXUS_TOWER_X.red);
  checkMirrorX(INNER_TOWER_X.blue, INNER_TOWER_X.red);
  checkMirrorX(OUTER_TOWER_X.blue, OUTER_TOWER_X.red);

  // Check regular camps mirror across x = 1400 (either same y or point-reflected y across ARENA_HEIGHT)
  const leftCamps = profile.campRings.filter(c => c.x < DRAGON_X);
  for (const left of leftCamps) {
    const right = profile.campRings.find(
      c =>
        c.x > DRAGON_X &&
        (Math.abs(c.y - left.y) <= 1 || Math.abs(c.y + left.y - ARENA_HEIGHT) <= 1) &&
        c.radius === left.radius,
    );
    if (!right) {
      maxAsymmetryPx = Math.max(maxAsymmetryPx, 999);
    } else {
      checkMirrorX(left.x, right.x);
    }
  }

  return {
    symmetric: maxAsymmetryPx === 0,
    maxAsymmetryPx,
    checkedPairs,
  };
}

/**
 * Renders Phase 10, 11, and 12 Overlays on the 3D Tactical Canvas:
 * - First Blood Mid-Plaza Trophy Insignia (Item 67)
 * - Celestial Supply Drop Capture Ring at Mid-Plaza (Item 71)
 * - Overtime Convergence Ring at 18:00+ (Item 70)
 * - Persistent Ultimate Scorch Decals & River Footstep Water Ripples (Items 66 & 81)
 * - DEV Spatial Influence Heatmap when `showDebugOverlay` is active (Item 85)
 */
export function drawDynamicEventsAtmosphereOverlay(
  ctx: CanvasRenderingContext2D,
  project: (x: number, y: number, h: number) => { x: number; y: number },
  zoom: number,
  matchSecond: number,
  firstBlood: FirstBloodRecord | null,
  supplyDrop: CelestialSupplyDrop | null,
  scorchDecals: readonly ScorchDecal[],
  waterRipples: readonly WaterRippleRing[],
  showDebugHeatmap: boolean,
  champions: readonly AramChampionUnit[],
  structures: readonly LaneStructure[],
): void {
  ctx.save();

  // 1. DEV Spatial Influence Heatmap (Item 85)
  if (showDebugHeatmap) {
    const cells = computeInfluenceHeatmapCells(champions, structures);
    for (const cell of cells) {
      if (Math.abs(cell.netBlueControl) < 0.08) continue;
      const p = project(cell.x + cell.width / 2, cell.y + cell.height / 2, 2);
      ctx.save();
      ctx.fillStyle =
        cell.netBlueControl > 0
          ? `rgba(56, 189, 248, ${Math.min(0.22, Math.abs(cell.netBlueControl) * 0.22)})`
          : `rgba(244, 63, 94, ${Math.min(0.22, Math.abs(cell.netBlueControl) * 0.22)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 44 * Math.sqrt(zoom), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 2. First Blood Mid-Plaza Trophy Insignia (Item 67)
  if (firstBlood) {
    const p = project(DRAGON_X, laneY(DRAGON_X), 2);
    const color = firstBlood.team === 'blue' ? '#38bdf8' : '#f43f5e';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 24 * Math.sqrt(zoom), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🩸 FB: ${firstBlood.killerName}`, p.x, p.y + 24 * Math.sqrt(zoom) + 11);
    ctx.restore();
  }

  // 3. Celestial Supply Drop Capture Ring at Mid-Plaza (Item 71)
  if (supplyDrop?.active) {
    const p = project(supplyDrop.x, supplyDrop.y, 6);
    const r = supplyDrop.radius * 0.36 * Math.sqrt(zoom);
    const progress = Math.max(0, Math.min(1, supplyDrop.captureProgress / SUPPLY_DROP_CAPTURE_SECONDS));
    const color =
      supplyDrop.capturingTeam === 'blue'
        ? '#38bdf8'
        : supplyDrop.capturingTeam === 'red'
          ? '#f43f5e'
          : '#fbbf24';

    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (progress > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
    }

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☄️ SUPPLY CACHE', p.x, p.y - 6);
    ctx.restore();
  }

  // 4. Persistent Ultimate Scorch Decals (Item 66)
  for (const decal of scorchDecals) {
    if (matchSecond >= decal.expiresAt) continue;
    const p = project(decal.x, decal.y, 2);
    const alpha = Math.max(0.1, Math.min(0.45, (decal.expiresAt - matchSecond) / 6));
    const r = decal.radius * 0.32 * Math.sqrt(zoom);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = decal.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 5. River Footstep Water Ripples (Item 81)
  for (const ripple of waterRipples) {
    if (matchSecond >= ripple.expiresAt) continue;
    const age = matchSecond - ripple.createdAt;
    const duration = Math.max(0.1, ripple.expiresAt - ripple.createdAt);
    const t = Math.max(0, Math.min(1, age / duration));
    const p = project(ripple.x, ripple.y, 2);
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.48;
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 6 + t * 18, 4 + t * 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 6. Overtime Convergence Warning Ring at 18:00+ (Item 70)
  if (isOvertimeConvergenceActive(matchSecond)) {
    const p = project(DRAGON_X, laneY(DRAGON_X), 8);
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 220 * Math.sqrt(zoom), 130 * Math.sqrt(zoom), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
