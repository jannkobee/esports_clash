export type BattlefieldTeam = 'blue' | 'red';
export type BarracksModelKind = 'melee' | 'ranged' | 'catapult';
export type LaneMinionModelKind = 'melee' | 'caster' | 'cannon';

export const BATTLEFIELD_MODEL_METRICS = {
  nexus: { scale: 2.05, healthWidth: 108, healthY: -96 },
  tower: { scale: 1.28, healthWidth: 58, healthY: -78 },
  barracks: { scale: 1.18, healthWidth: 64, healthY: -72 },
  meleeMinion: { scale: 0.98, healthWidth: 22, healthY: -29 },
  casterMinion: { scale: 1.02, healthWidth: 22, healthY: -31 },
  cannonMinion: { scale: 1.14, healthWidth: 30, healthY: -30 },
} as const;

function palette(team: BattlefieldTeam) {
  return team === 'blue'
    ? { glow: '#38bdf8', bright: '#bae6fd', deep: '#075985', cloth: '#1d4ed8' }
    : { glow: '#fb7185', bright: '#ffe4e6', deep: '#9f1239', cloth: '#be123c' };
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x + width / 2, y);
  ctx.lineTo(x, y + height / 2);
  ctx.lineTo(x - width / 2, y);
  ctx.closePath();
}

export function drawNexusStructure(
  ctx: CanvasRenderingContext2D,
  team: BattlefieldTeam,
  time: number,
  sealed: boolean
): void {
  const colors = palette(team);
  const scale = BATTLEFIELD_MODEL_METRICS.nexus.scale;
  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
  ctx.beginPath(); ctx.ellipse(0, 19, 42, 15, 0, 0, Math.PI * 2); ctx.fill();

  const base = ctx.createLinearGradient(0, -10, 0, 28);
  base.addColorStop(0, '#64748b'); base.addColorStop(0.36, '#334155'); base.addColorStop(1, '#111827');
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.ellipse(0, 13, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.ellipse(0, 8, 27, 11, 0, 0, Math.PI * 2); ctx.fill();

  for (let pylon = 0; pylon < 4; pylon++) {
    const a = pylon * Math.PI / 2 + Math.PI / 4;
    const px = Math.cos(a) * 29;
    const py = Math.sin(a) * 12 + 5;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(px - 4, py + 7); ctx.lineTo(px - 2.5, py - 8); ctx.lineTo(px + 2.5, py - 8); ctx.lineTo(px + 4, py + 7);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = colors.glow; ctx.lineWidth = 0.9; ctx.stroke();
  }

  ctx.strokeStyle = colors.deep; ctx.lineWidth = 4.5; ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.arc(0, 2, 23, time * -0.45, time * -0.45 + Math.PI * 1.55); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.glow; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 2, 23, time * -0.45, time * -0.45 + Math.PI * 1.55); ctx.stroke();

  for (let emitter = 0; emitter < 6; emitter++) {
    const a = time * 1.7 + emitter * Math.PI / 3;
    const ex = Math.cos(a) * 37;
    const ey = Math.sin(a) * 15;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.shadowColor = colors.glow; ctx.shadowBlur = 8;
    ctx.fillStyle = colors.glow; drawDiamond(ctx, 0, 0, 5.5, 10); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(-15, 7); ctx.lineTo(-10, -18); ctx.lineTo(0, -25); ctx.lineTo(10, -18); ctx.lineTo(15, 7);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1; ctx.stroke();

  const crystal = ctx.createLinearGradient(-8, -30, 10, 22);
  crystal.addColorStop(0, '#ffffff'); crystal.addColorStop(0.28, colors.bright);
  crystal.addColorStop(0.62, colors.glow); crystal.addColorStop(1, colors.deep);
  ctx.shadowColor = colors.glow; ctx.shadowBlur = 15 + Math.sin(time * 3) * 3;
  ctx.fillStyle = crystal;
  ctx.beginPath();
  ctx.moveTo(0, -34); ctx.lineTo(13, -8); ctx.lineTo(8, 19); ctx.lineTo(0, 26); ctx.lineTo(-8, 19); ctx.lineTo(-13, -8);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = colors.bright; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 20); ctx.lineTo(-8, 16); ctx.lineTo(-11, -7); ctx.closePath(); ctx.fill();

  if (sealed) {
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.8; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.arc(0, 0, 43, -time * 0.8, Math.PI * 2 - time * 0.8); ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + time * 0.35;
      ctx.fillStyle = '#fef08a'; drawDiamond(ctx, Math.cos(a) * 43, Math.sin(a) * 19, 4, 7); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawTowerStructure(
  ctx: CanvasRenderingContext2D,
  team: BattlefieldTeam,
  time: number,
  targetOffset?: { x: number; y: number }
): void {
  const colors = palette(team);
  const scale = BATTLEFIELD_MODEL_METRICS.tower.scale;
  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
  ctx.beginPath(); ctx.ellipse(0, 11, 27, 9, 0, 0, Math.PI * 2); ctx.fill();
  const base = ctx.createLinearGradient(0, -5, 0, 18);
  base.addColorStop(0, '#64748b'); base.addColorStop(0.45, '#334155'); base.addColorStop(1, '#111827');
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.moveTo(-24, 12); ctx.lineTo(-19, 1); ctx.lineTo(19, 1); ctx.lineTo(24, 12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.stroke();

  ctx.fillStyle = '#273449';
  ctx.beginPath(); ctx.moveTo(-15, 3); ctx.lineTo(-11, -36); ctx.lineTo(11, -36); ctx.lineTo(15, 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#64748b'; ctx.stroke();
  ctx.fillStyle = '#111827';
  ctx.beginPath(); ctx.moveTo(-15, 3); ctx.lineTo(-11, -36); ctx.lineTo(-4, -31); ctx.lineTo(-5, 3); ctx.closePath(); ctx.fill();

  for (const side of [-1, 1]) {
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(side * 12, -28); ctx.lineTo(side * 19, 2); ctx.lineTo(side * 12, 5); ctx.lineTo(side * 7, -25);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = colors.cloth;
    ctx.beginPath(); ctx.moveTo(side * 12, -20); ctx.lineTo(side * 22, -17); ctx.lineTo(side * 14, -6); ctx.closePath(); ctx.fill();
  }

  ctx.fillStyle = '#0f172a'; ctx.fillRect(-18, -42, 36, 8);
  ctx.fillStyle = '#475569';
  for (let tooth = -2; tooth <= 2; tooth++) ctx.fillRect(tooth * 7 - 2.5, -48, 5, 8);
  ctx.strokeStyle = colors.glow; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-17, -39); ctx.lineTo(17, -39); ctx.stroke();

  const crystalY = -52 + Math.sin(time * 3.2) * 1.5;
  const crystal = ctx.createLinearGradient(-7, crystalY - 12, 7, crystalY + 12);
  crystal.addColorStop(0, '#ffffff'); crystal.addColorStop(0.35, colors.bright); crystal.addColorStop(1, colors.deep);
  ctx.shadowColor = colors.glow; ctx.shadowBlur = 13;
  ctx.fillStyle = crystal; drawDiamond(ctx, 0, crystalY, 15, 25); ctx.fill();
  ctx.strokeStyle = colors.glow; ctx.lineWidth = 1; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  if (targetOffset) {
    ctx.save();
    ctx.strokeStyle = team === 'blue' ? '#00f2ff' : '#ff0055';
    ctx.shadowColor = colors.glow; ctx.shadowBlur = 7; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -67); ctx.lineTo(targetOffset.x, targetOffset.y); ctx.stroke();
    ctx.restore();
  }
}

export function drawBarracksStructure(
  ctx: CanvasRenderingContext2D,
  team: BattlefieldTeam,
  kind: BarracksModelKind,
  time: number
): void {
  const colors = palette(team);
  const scale = BATTLEFIELD_MODEL_METRICS.barracks.scale;
  ctx.save(); ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.52)';
  ctx.beginPath(); ctx.ellipse(0, 18, 31, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.roundRect(-29, 8, 58, 15, 4); ctx.fill();
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1; ctx.stroke();
  const wall = ctx.createLinearGradient(-22, -28, 22, 17);
  wall.addColorStop(0, '#64748b'); wall.addColorStop(0.5, '#334155'); wall.addColorStop(1, '#1e293b');
  ctx.fillStyle = wall; ctx.beginPath(); ctx.roundRect(-24, -25, 48, 38, 3); ctx.fill();
  ctx.strokeStyle = colors.glow; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.strokeStyle = 'rgba(203,213,225,0.35)'; ctx.lineWidth = 0.7;
  for (let y = -18; y <= 6; y += 8) {
    ctx.beginPath(); ctx.moveTo(-22, y); ctx.lineTo(22, y); ctx.stroke();
  }

  if (kind === 'melee') {
    ctx.fillStyle = '#451a03'; ctx.fillRect(-18, -1, 36, 14);
    const forge = ctx.createRadialGradient(0, 5, 1, 0, 5, 13);
    forge.addColorStop(0, '#fef08a'); forge.addColorStop(0.45, '#f97316'); forge.addColorStop(1, '#7c2d12');
    ctx.fillStyle = forge; ctx.beginPath(); ctx.roundRect(-13, 0, 26, 10, 3); ctx.fill();
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-16, -19); ctx.lineTo(14, 8); ctx.moveTo(16, -19); ctx.lineTo(-14, 8); ctx.stroke();
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-18, -21); ctx.lineTo(-12, -15); ctx.moveTo(18, -21); ctx.lineTo(12, -15); ctx.stroke();
  } else if (kind === 'ranged') {
    ctx.fillStyle = '#1e293b'; ctx.fillRect(-17, -36, 34, 13);
    for (const x of [-14, 0, 14]) ctx.fillRect(x - 4, -42, 8, 8);
    ctx.fillStyle = colors.glow; ctx.fillRect(-3, -32, 6, 11);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-14, -15); ctx.quadraticCurveTo(10, -2, -14, 11); ctx.stroke();
    ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-14, -15); ctx.lineTo(-14, 11); ctx.moveTo(-14, -2); ctx.lineTo(18, -2); ctx.stroke();
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.moveTo(18, -2); ctx.lineTo(11, -6); ctx.lineTo(11, 2); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = '#78350f'; ctx.fillRect(-20, 4, 40, 7);
    ctx.fillStyle = '#422006';
    for (const x of [-15, 15]) { ctx.beginPath(); ctx.arc(x, 13, 8, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2;
    for (const x of [-15, 15]) { ctx.beginPath(); ctx.arc(x, 13, 5, 0, Math.PI * 2); ctx.stroke(); }
    const armAngle = -1.05 + Math.sin(time * 0.7) * 0.04;
    ctx.save(); ctx.translate(-7, 5); ctx.rotate(armAngle);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(29, 0); ctx.stroke();
    ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(31, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-8, 5); ctx.lineTo(6, -23); ctx.lineTo(17, 5); ctx.stroke();
  }

  ctx.fillStyle = colors.glow; ctx.shadowColor = colors.glow; ctx.shadowBlur = 7;
  ctx.beginPath(); ctx.arc(0, -28, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawLaneMinionModel(
  ctx: CanvasRenderingContext2D,
  team: BattlefieldTeam,
  kind: LaneMinionModelKind,
  time: number,
  attackTimer: number
): void {
  const colors = palette(team);
  const facing = team === 'blue' ? 1 : -1;
  const metric = kind === 'cannon' ? BATTLEFIELD_MODEL_METRICS.cannonMinion
    : kind === 'caster' ? BATTLEFIELD_MODEL_METRICS.casterMinion : BATTLEFIELD_MODEL_METRICS.meleeMinion;
  ctx.save(); ctx.scale(metric.scale * facing, metric.scale);
  const bob = Math.sin(time * 7 + (kind === 'caster' ? 1.2 : 0)) * 0.55;
  ctx.translate(0, bob);

  if (kind === 'cannon') {
    // A compact arc-launcher cart: familiar siege readability, but with an
    // original shielded crawler silhouette and a living ember operator.
    const armKick = Math.max(0, Math.min(1, attackTimer * 2.4));
    ctx.fillStyle = '#1c1917';
    for (const wheel of [{ x: -10, y: 3, r: 5 }, { x: 9, y: 3, r: 5.5 }]) {
      ctx.beginPath(); ctx.arc(wheel.x, wheel.y, wheel.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#78716c'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = '#44403c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(wheel.x - 3.5, wheel.y); ctx.lineTo(wheel.x + 3.5, wheel.y);
      ctx.moveTo(wheel.x, wheel.y - 3.5); ctx.lineTo(wheel.x, wheel.y + 3.5); ctx.stroke();
    }
    const chassis = ctx.createLinearGradient(0, -12, 0, 3);
    chassis.addColorStop(0, '#64748b'); chassis.addColorStop(0.45, colors.deep); chassis.addColorStop(1, '#172033');
    ctx.fillStyle = chassis; ctx.beginPath(); ctx.roundRect(-14, -11, 27, 13, 3); ctx.fill();
    ctx.strokeStyle = colors.bright; ctx.lineWidth = 0.8; ctx.stroke();

    ctx.fillStyle = colors.cloth;
    ctx.beginPath(); ctx.moveTo(11, -10); ctx.lineTo(18, -6); ctx.lineTo(18, 3); ctx.lineTo(12, 1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = colors.glow; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = colors.bright; drawDiamond(ctx, 14.5, -4, 3, 5); ctx.fill();

    ctx.save();
    ctx.translate(-7, -7);
    ctx.rotate(-0.9 - armKick * 0.22);
    ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, 0); ctx.stroke();
    ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(25, 0, 4.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.shadowColor = colors.glow; ctx.shadowBlur = 6;
    ctx.fillStyle = colors.glow; ctx.beginPath(); ctx.arc(25, 0, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#78716c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-9, -7); ctx.lineTo(2, -22); ctx.lineTo(8, -8); ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-6, -17); ctx.lineTo(-1, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = colors.bright; ctx.beginPath(); ctx.arc(-5.5, -12.5, 1.2, 0, Math.PI * 2); ctx.fill();
  } else {
    const stride = Math.sin(time * 8) * 1.5;
    const action = Math.max(0, Math.min(1, attackTimer * 2.5));
    ctx.strokeStyle = '#273449'; ctx.lineWidth = 2.7;
    ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(-4 + stride, 6); ctx.moveTo(3, -1); ctx.lineTo(4 - stride, 6); ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.roundRect(-7 + stride, 4.5, 7, 3.5, 1); ctx.fill();
    ctx.beginPath(); ctx.roundRect(0 - stride, 4.5, 7, 3.5, 1); ctx.fill();

    if (kind === 'caster') {
      const robe = ctx.createLinearGradient(-8, -17, 8, 4);
      robe.addColorStop(0, colors.bright); robe.addColorStop(0.35, colors.cloth); robe.addColorStop(1, colors.deep);
      ctx.fillStyle = robe;
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(9, 4); ctx.lineTo(2, 3); ctx.lineTo(0, 7); ctx.lineTo(-2, 3); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = colors.glow; ctx.lineWidth = 0.8; ctx.stroke();

      // Deep angular hood and a single horizontal light slit give the caster
      // its own masked arcane-servitor identity.
      ctx.fillStyle = '#111827';
      ctx.beginPath(); ctx.moveTo(-6, -17); ctx.lineTo(0, -24); ctx.lineTo(6, -17); ctx.lineTo(4.5, -11); ctx.lineTo(-4.5, -11); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = colors.cloth; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.shadowColor = colors.glow; ctx.shadowBlur = 5;
      ctx.strokeStyle = colors.bright; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(-2.8, -16); ctx.lineTo(2.8, -16); ctx.stroke();

      const staffX = 8 - action * 1.5;
      ctx.shadowBlur = 0; ctx.strokeStyle = '#5b3a29'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(staffX, 4); ctx.lineTo(staffX + 2, -22); ctx.stroke();
      ctx.strokeStyle = colors.glow; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(staffX + 2, -22, 4.2, -Math.PI * 0.72, Math.PI * 0.72); ctx.stroke();
      ctx.shadowColor = colors.glow; ctx.shadowBlur = 8 + action * 5;
      ctx.fillStyle = colors.bright; drawDiamond(ctx, staffX + 2.4, -22, 3.2, 5.8); ctx.fill(); ctx.shadowBlur = 0;
    } else {
      const armor = ctx.createLinearGradient(-7, -16, 7, 2);
      armor.addColorStop(0, '#cbd5e1'); armor.addColorStop(0.38, colors.cloth); armor.addColorStop(1, colors.deep);
      ctx.fillStyle = armor; ctx.beginPath(); ctx.roundRect(-7, -15, 14, 17, 3); ctx.fill();
      ctx.strokeStyle = colors.bright; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.beginPath(); ctx.moveTo(-8, -13); ctx.lineTo(-12, -9); ctx.lineTo(-8, -5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -13); ctx.lineTo(12, -9); ctx.lineTo(8, -5); ctx.closePath(); ctx.fill();

      // Faceted sallet, swept-back crest, and cyclops visor distinguish these
      // wardlings from other games' round-horned lane troops.
      ctx.fillStyle = '#334155';
      ctx.beginPath(); ctx.moveTo(-6, -19); ctx.lineTo(-3, -24); ctx.lineTo(4, -23); ctx.lineTo(7, -18); ctx.lineTo(4, -13); ctx.lineTo(-5, -13); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = colors.cloth;
      ctx.beginPath(); ctx.moveTo(-3, -23); ctx.lineTo(-10, -25); ctx.lineTo(-5, -20); ctx.closePath(); ctx.fill();
      ctx.shadowColor = colors.glow; ctx.shadowBlur = 4;
      ctx.fillStyle = colors.bright; ctx.fillRect(1, -19, 3.8, 1.4); ctx.shadowBlur = 0;

      ctx.save(); ctx.translate(7, -10); ctx.rotate(-0.55 - action * 0.45);
      ctx.strokeStyle = '#dbeafe'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(13, -7); ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath(); ctx.moveTo(13, -7); ctx.lineTo(10, -2); ctx.lineTo(17, -9); ctx.lineTo(12, -11); ctx.closePath(); ctx.fill();
      ctx.restore();

      ctx.fillStyle = colors.cloth; ctx.strokeStyle = colors.bright; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-13, -14); ctx.lineTo(-7, -16); ctx.lineTo(-6, 0); ctx.lineTo(-13, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = colors.bright; drawDiamond(ctx, -9.5, -7.5, 3, 5); ctx.fill();
    }
  }
  ctx.restore();
}
