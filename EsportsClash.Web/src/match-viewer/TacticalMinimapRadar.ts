import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  LANE_Y,
  laneY,
  DRAGON_X,
  NEXUS_X,
  BARRACKS_X,
  NEXUS_TOWER_X,
  INNER_TOWER_X,
  OUTER_TOWER_X,
} from '../arenaLayout.ts';
import { CAMP_ROCK_RINGS, ARAM_BUSHES } from '../arenaRules.ts';
import type { LaneStructure, AramChampionUnit, LaneMinion } from '../types.ts';

export interface MinimapCamp {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  isAlive: boolean;
  hp?: number;
  maxHp?: number;
  color?: string;
  respawnTimer?: number;
}

export interface MinimapBoss {
  x: number;
  y: number;
  isAlive: boolean;
  hp?: number;
  maxHp?: number;
  respawnTimer?: number;
}

export interface MinimapViewport {
  camX: number;
  camY: number;
  halfW: number;
  halfH: number;
}

export interface MinimapRect {
  Mw: number;
  Mh: number;
  mx: number;
  my: number;
}

export interface MinimapRadarOptions {
  ctx: CanvasRenderingContext2D;
  rect: MinimapRect;
  viewport: MinimapViewport;
  structures: readonly LaneStructure[];
  champions: readonly AramChampionUnit[];
  minions: readonly LaneMinion[];
  camps: readonly MinimapCamp[];
  dragon: MinimapBoss;
  matchTime: number;
}

/**
 * World-space coordinate to radar normalized coordinates converter.
 */
export function worldToRadar(
  worldX: number,
  worldY: number,
  radarWidth: number = 280
): { rx: number; ry: number; scale: number } {
  const scale = radarWidth / ARENA_WIDTH;
  return {
    rx: worldX * scale,
    ry: worldY * scale,
    scale,
  };
}

/**
 * High-fidelity 3D Spectator Tactical Radar for EsportsClash.
 * Synchronizes with the updated turret spacing (540, 820, 1120 / 1480, 1780, 2060),
 * all 8 jungle camps, Dragon Embermaw pit, Siege Golem Gravemarch pit, river wildlife,
 * active lane minion waves, and authoritative structures.
 */
export function drawTacticalMinimapRadar(options: MinimapRadarOptions): void {
  const { ctx, rect, viewport, structures, champions, minions, camps, dragon, matchTime } = options;

  const Mw = 280;
  const Mh = (Mw * ARENA_HEIGHT) / ARENA_WIDTH; // 144px at 2600x1440
  const scale = Mw / ARENA_WIDTH; // 0.1

  ctx.save();
  ctx.translate(rect.mx, rect.my);
  ctx.scale(rect.Mw / Mw, rect.Mh / Mh);

  // 1. Radar Glassmorphism Container & Frame
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(8, 14, 26, 0.94)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, Mw, Mh, 8);
  } else {
    ctx.rect(0, 0, Mw, Mh);
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  // Outer Glowing Neon Border
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Clip content inside the rounded container
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, Mw, Mh, 8);
  } else {
    ctx.rect(0, 0, Mw, Mh);
  }
  ctx.clip();

  // 2. Tactical Topography — Arena Stadium Field
  // Outer forest floor terrain
  const arenaGrad = ctx.createRadialGradient(Mw / 2, Mh / 2, 20, Mw / 2, Mh / 2, Mw / 1.5);
  arenaGrad.addColorStop(0, '#162820');
  arenaGrad.addColorStop(0.65, '#0e1c16');
  arenaGrad.addColorStop(1, '#08100d');
  ctx.fillStyle = arenaGrad;
  ctx.fillRect(0, 0, Mw, Mh);

  // Subtle Tactical Grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  for (let gx = 26; gx < Mw; gx += 26) {
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, Mh);
  }
  for (let gy = 24; gy < Mh; gy += 24) {
    ctx.moveTo(0, gy);
    ctx.lineTo(Mw, gy);
  }
  ctx.stroke();

  // Arena Stadium Oval Perimeter
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(Mw / 2, Mh / 2, Mw * 0.47, Mh * 0.44, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Base Raised Highground Platforms
  // Blue Base Platform (Left)
  ctx.fillStyle = 'rgba(14, 116, 144, 0.3)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(NEXUS_X.blue * scale + 10, laneY(NEXUS_X.blue) * scale, 34, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Red Base Platform (Right)
  ctx.fillStyle = 'rgba(190, 18, 60, 0.28)';
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(NEXUS_X.red * scale - 10, laneY(NEXUS_X.red) * scale, 34, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Paved Central Stone Highway / Lane (slanted along the vector from Blue Nexus to Red Nexus)
  const x1 = NEXUS_X.blue * scale;
  const y1 = laneY(NEXUS_X.blue) * scale;
  const x2 = NEXUS_X.red * scale;
  const y2 = laneY(NEXUS_X.red) * scale;
  const roadWidth = 26;
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
  ctx.lineWidth = roadWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Lane Edge Curbs
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const nx = -Math.sin(angle) * (roadWidth / 2);
  const ny = Math.cos(angle) * (roadWidth / 2);
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1 + nx, y1 + ny);
  ctx.lineTo(x2 + nx, y2 + ny);
  ctx.moveTo(x1 - nx, y1 - ny);
  ctx.lineTo(x2 - nx, y2 - ny);
  ctx.stroke();

  // Subtle Centerline Dash
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.25)';
  ctx.lineWidth = 0.75;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Central River Channel (x = 1300, 360px wide buffer)
  const riverX = DRAGON_X * scale; // 130
  const riverHalfW = (360 * scale) / 2; // 18
  const riverGrad = ctx.createLinearGradient(riverX - riverHalfW, 0, riverX + riverHalfW, 0);
  riverGrad.addColorStop(0, 'rgba(6, 182, 212, 0.05)');
  riverGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.22)');
  riverGrad.addColorStop(1, 'rgba(6, 182, 212, 0.05)');
  ctx.fillStyle = riverGrad;
  ctx.fillRect(riverX - riverHalfW, 0, riverHalfW * 2, Mh);

  // River Shorelines
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(riverX - riverHalfW, 6);
  ctx.lineTo(riverX - riverHalfW, Mh - 6);
  ctx.moveTo(riverX + riverHalfW, 6);
  ctx.lineTo(riverX + riverHalfW, Mh - 6);
  ctx.stroke();

  // River Amber Frog Marker (env_critter_river_frog)
  // Perched on granite riverbed boulder near central river crossing
  const frogPulse = 0.5 + 0.5 * Math.sin(matchTime * 3.5);
  ctx.fillStyle = `rgba(245, 158, 11, ${0.4 + 0.4 * frogPulse})`;
  ctx.beginPath();
  ctx.arc(riverX, laneY(DRAGON_X) * scale - 18, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Tactical Brush Patches (ARAM_BUSHES)
  ctx.fillStyle = 'rgba(16, 185, 129, 0.32)';
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
  ctx.lineWidth = 0.75;
  ctx.setLineDash([2, 1.5]);
  for (const b of ARAM_BUSHES) {
    const bx = b.x * scale;
    const by = b.y * scale;
    const bw = (b.width * scale) / 2;
    const bh = (b.height * scale) / 2;
    ctx.beginPath();
    ctx.ellipse(bx, by, Math.max(3, bw), Math.max(2, bh), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 3. Boss Pits: Dragon Embermaw (North) & Siege Golem Gravemarch (South)
  // Dragon Embermaw Pit (x = 1300, y = 246)
  const dX = dragon.x * scale;
  const dY = dragon.y * scale;
  ctx.fillStyle = dragon.isAlive ? 'rgba(239, 68, 68, 0.35)' : 'rgba(71, 85, 105, 0.25)';
  ctx.strokeStyle = dragon.isAlive ? '#ef4444' : '#64748b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(dX, dY, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (dragon.isAlive) {
    // Pulsing Dragon Core
    const dPulse = 0.75 + 0.25 * Math.sin(matchTime * 4);
    ctx.fillStyle = '#f97316';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(dX, dY, 4.2 * dPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Mini Dragon Glyph
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('D', dX, dY + 0.5);
  } else {
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('✕', dX, dY);
  }

  // Siege Golem Gravemarch Pit (South Boss Pit)
  const golemCamp = camps.find((c) => c.type === 'siege_golem');
  const gX = (golemCamp?.x ?? DRAGON_X) * scale;
  const gY = (golemCamp?.y ?? 1155) * scale;
  const isGolemAlive = !!golemCamp?.isAlive;

  ctx.fillStyle = isGolemAlive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(71, 85, 105, 0.25)';
  ctx.strokeStyle = isGolemAlive ? '#10b981' : '#64748b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(gX, gY, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (isGolemAlive) {
    const gPulse = 0.75 + 0.25 * Math.sin(matchTime * 3);
    ctx.fillStyle = '#34d399';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(gX, gY, 4 * gPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#064e3b';
    ctx.fillText('G', gX, gY + 0.5);
  } else {
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('✕', gX, gY);
  }

  // 4. All 8 Jungle Camps (4 North, 4 South)
  for (const camp of camps) {
    if (camp.type === 'siege_golem') continue; // Handled as epic pit above
    const cx = camp.x * scale;
    const cy = camp.y * scale;

    const isBuff = camp.type === 'blue_buff' || camp.type === 'red_buff';
    const campColor =
      camp.type === 'blue_buff'
        ? '#38bdf8'
        : camp.type === 'red_buff'
        ? '#fb7185'
        : camp.type === 'wolves'
        ? '#c084fc'
        : '#34d399';

    if (camp.isAlive) {
      ctx.fillStyle = campColor;
      ctx.shadowColor = campColor;
      ctx.shadowBlur = isBuff ? 4 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, isBuff ? 3.5 : 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Bright inner core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Slain / Respawning state: dimmed dashed ring
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([1.5, 1.5]);
      ctx.beginPath();
      ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 5. Authoritative Lane Structures (Outer, Inner, Nexus Spire, Barracks, Nexus)
  for (const st of structures) {
    const sx = st.x * scale;
    const sy = st.y * scale;
    const teamColor = st.team === 'blue' ? '#38bdf8' : '#f43f5e';
    const teamCore = st.team === 'blue' ? '#e0f2fe' : '#ffe4e6';

    if (st.isAlive) {
      if (st.type === 'nexus') {
        // Grand Diamond Nexus Core
        ctx.fillStyle = teamColor;
        ctx.shadowColor = teamColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 5.5);
        ctx.lineTo(sx + 5.5, sy);
        ctx.lineTo(sx, sy + 5.5);
        ctx.lineTo(sx - 5.5, sy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Nexus Inner Diamond
        ctx.fillStyle = teamCore;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 2.5);
        ctx.lineTo(sx + 2.5, sy);
        ctx.lineTo(sx, sy + 2.5);
        ctx.lineTo(sx - 2.5, sy);
        ctx.closePath();
        ctx.fill();
      } else if (st.type === 'barracks') {
        // Gatehouse Barracks (3 per base)
        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.rect(sx - 2, sy - 2, 4, 4);
        ctx.fill();

        ctx.strokeStyle = teamCore;
        ctx.lineWidth = 0.6;
        ctx.strokeRect(sx - 2, sy - 2, 4, 4);
      } else {
        // Defensive Turret Spire (Outer / Inner / Nexus Spire)
        const isOuter = Math.abs(st.x - OUTER_TOWER_X[st.team]) < 10;
        const isInner = Math.abs(st.x - INNER_TOWER_X[st.team]) < 10;
        const radius = isOuter ? 3.8 : isInner ? 3.5 : 3.2;

        ctx.fillStyle = teamColor;
        ctx.shadowColor = teamColor;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Turret Apex Crystal Core
        ctx.fillStyle = teamCore;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Destroyed Structure Marker: Dimmed Tactical Cross '✖'
      ctx.strokeStyle = st.team === 'blue' ? 'rgba(56, 189, 248, 0.35)' : 'rgba(244, 63, 94, 0.35)';
      ctx.lineWidth = 1.2;
      const sz = st.type === 'nexus' ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(sx - sz, sy - sz);
      ctx.lineTo(sx + sz, sy + sz);
      ctx.moveTo(sx + sz, sy - sz);
      ctx.lineTo(sx - sz, sy + sz);
      ctx.stroke();
    }
  }

  // 6. Lane Minion Waves (Micro Tactical Dots)
  for (const m of minions) {
    if (!m.isAlive) continue;
    const mx = m.x * scale;
    const my = m.y * scale;

    if (m.type === 'cannon' || m.siegeGolem) {
      // Golden Siege Cannon or Super Minion
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Standard Melee / Caster Minion
      ctx.fillStyle = m.team === 'blue' ? '#38bdf8' : '#f87171';
      ctx.beginPath();
      ctx.arc(mx, my, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 7. Champions (High-Contrast Hero Tokens with Health Arc & Monogram)
  for (const c of champions) {
    if (!c.isAlive) continue;
    const cx = c.x * scale;
    const cy = c.y * scale;
    const teamColor = c.team === 'blue' ? '#22d3ee' : '#f43f5e';
    const hpRatio = Math.max(0, Math.min(1, c.hp / Math.max(1, c.maxHp)));

    // Outer Team Halo
    ctx.fillStyle = teamColor;
    ctx.shadowColor = teamColor;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dark Inner Disc
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
    ctx.fill();

    // Health Arc around Hero Rim
    ctx.strokeStyle = hpRatio > 0.4 ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio);
    ctx.stroke();

    // Hero Monogram Initial (First letter of player or champion name)
    const initial = (c.player?.name?.[0] ?? c.champion?.name?.[0] ?? c.champion?.id?.[0] ?? 'C').toUpperCase();
    ctx.font = 'bold 5.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(initial, cx, cy + 0.3);
  }

  // 8. Camera Viewport Frustum (Golden Spectator Viewfinder)
  const vx = Math.max(0, viewport.camX - viewport.halfW) * scale;
  const vy = Math.max(0, viewport.camY - viewport.halfH) * scale;
  const vw = Math.min(Mw - vx, viewport.halfW * 2 * scale);
  const vh = Math.min(Mh - vy, viewport.halfH * 2 * scale);

  ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(vx, vy, vw, vh, 2);
  } else {
    ctx.rect(vx, vy, vw, vh);
  }
  ctx.fill();
  ctx.stroke();

  // Viewport Center Crosshair
  const cCamX = viewport.camX * scale;
  const cCamY = viewport.camY * scale;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cCamX - 3, cCamY);
  ctx.lineTo(cCamX + 3, cCamY);
  ctx.moveTo(cCamX, cCamY - 3);
  ctx.lineTo(cCamX, cCamY + 3);
  ctx.stroke();

  // 9. Spectator HUD Chrome & Live Tactical Header
  // Top header gradient banner
  const headerGrad = ctx.createLinearGradient(0, 0, 0, 16);
  headerGrad.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
  headerGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, Mw, 16);

  // Live pulsing indicator
  const livePulse = 0.5 + 0.5 * Math.sin(matchTime * 5);
  ctx.fillStyle = `rgba(34, 197, 94, ${livePulse})`;
  ctx.beginPath();
  ctx.arc(8, 8, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Radar Title
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('TAC-RADAR // ARENA 3D', 14, 8);

  // Structure Scoreboard in Header
  const isTower = (type: string) => type === 'outer_tower' || type === 'inner_tower' || type === 'nexus_tower';
  const blueTowers = structures.filter((s) => s.team === 'blue' && isTower(s.type) && s.isAlive).length;
  const blueBarracks = structures.filter((s) => s.team === 'blue' && s.type === 'barracks' && s.isAlive).length;
  const redTowers = structures.filter((s) => s.team === 'red' && isTower(s.type) && s.isAlive).length;
  const redBarracks = structures.filter((s) => s.team === 'red' && s.type === 'barracks' && s.isAlive).length;

  ctx.textAlign = 'right';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`${blueTowers}T ${blueBarracks}B`, Mw - 54, 8);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(':', Mw - 49, 8);
  ctx.fillStyle = '#f43f5e';
  ctx.fillText(`${redTowers}T ${redBarracks}B`, Mw - 8, 8);

  ctx.restore(); // End clipping
  ctx.restore(); // End translation & scaling
}

