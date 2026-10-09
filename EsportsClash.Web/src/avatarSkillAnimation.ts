// Original canvas motion cues for each playable avatar. Basis references are kept in
// the roster data; the shapes here are drawn locally rather than using game assets.
export type SkillSlot = 'skill1' | 'skill2' | 'ultimate';

type Motif = 'sun' | 'arrow' | 'orb' | 'shotgun' | 'blades' | 'shadow' | 'wind'
  | 'wolf' | 'feathers' | 'wings' | 'bear' | 'roots' | 'grave' | 'ember'
  | 'lightning' | 'boulder' | 'void' | 'elements' | 'ash' | 'mist'
  | 'music' | 'souls' | 'quake';

export const AVATAR_ANIMATION_MOTIFS: Record<string, Motif> = {
  Solana: 'sun', Astra: 'arrow', Kyumi: 'orb', Buck: 'shotgun',
  Valkira: 'blades', Kage: 'shadow', Kazemaru: 'wind', Kindra: 'wolf',
  Cora: 'feathers', Renn: 'wings', Sylla: 'bear', Tequoia: 'roots',
  Zal: 'grave', Xin: 'ember', Raijin: 'lightning', Kaolin: 'boulder',
  Inai: 'void', Veyara: 'elements', Cinderlock: 'ash', Solenne: 'mist',
  Croakwell: 'music', Soulscourge: 'souls', Stonewake: 'quake',
};

export interface AvatarAnimationState {
  avatarName: string;
  slot: SkillSlot;
  x: number;
  y: number;
  sourceX: number;
  sourceY: number;
  radius: number;
  progress: number;
  color: string;
}

export function drawAvatarSkillAnimation(ctx: CanvasRenderingContext2D, state: AvatarAnimationState): void {
  const motif = AVATAR_ANIMATION_MOTIFS[state.avatarName];
  if (!motif) return;
  const { x, y, sourceX, sourceY, slot, color } = state;
  const p = Math.max(0, Math.min(1, state.progress));
  const ultimate = slot === 'ultimate';
  const radius = state.radius * (0.35 + p * 0.72);
  const fade = 1 - p;
  const angle = Math.atan2(y - sourceY, x - sourceX);
  ctx.save();
  ctx.globalAlpha = Math.min(1, fade * 1.25);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = ultimate ? 5 : 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = ultimate ? 24 : 16;

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  const ring = (r: number, start = 0, end = Math.PI * 2) => {
    ctx.beginPath(); ctx.arc(x, y, r, start, end); ctx.stroke();
  };
  const spoke = (a: number, from: number, to: number) =>
    line(x + Math.cos(a) * from, y + Math.sin(a) * from,
      x + Math.cos(a) * to, y + Math.sin(a) * to);
  const beam = (width: number) => {
    if (Math.hypot(x - sourceX, y - sourceY) < 12) return;
    ctx.save();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = width;
    ctx.shadowBlur = 18;
    line(sourceX, sourceY - 15, x, y - 12);
    ctx.restore();
    ctx.lineWidth = width * 1.8;
    line(sourceX, sourceY - 15, x, y - 12);
  };

  switch (motif) {
    case 'sun':
      ring(radius * 0.72);
      for (let i = 0; i < 10; i++) spoke(i * Math.PI / 5, radius * 0.8, radius * 1.2);
      if (slot === 'skill2') beam(3);
      break;
    case 'arrow':
      if (slot !== 'skill2') beam(ultimate ? 5 : 2);
      for (let i = -2; i <= 2; i++) {
        const a = angle + i * 0.24;
        spoke(a, radius * 0.24, radius);
        const tipX = x + Math.cos(a) * radius;
        const tipY = y + Math.sin(a) * radius;
        line(tipX, tipY, tipX - Math.cos(a - 0.6) * 12, tipY - Math.sin(a - 0.6) * 12);
      }
      break;
    case 'orb':
      ring(radius * 0.8, -Math.PI * 0.6 + p * 2, Math.PI * 0.6 + p * 2);
      ring(radius * 0.5, Math.PI * 0.4 - p * 2, Math.PI * 1.6 - p * 2);
      for (let i = 0; i < 3; i++) spoke(i * Math.PI * 2 / 3 + p * 4, radius * 0.5, radius);
      break;
    case 'shotgun':
      for (let i = -3; i <= 3; i++) spoke(angle + i * 0.16, 10, radius * (0.7 + Math.abs(i) * 0.07));
      if (ultimate) ring(radius * 0.6, angle - 0.8, angle + 0.8);
      break;
    case 'blades':
      ring(radius * 0.8, -2.4 + p * 3, 0.5 + p * 3);
      ring(radius * 0.65, 0.8 - p * 3, 3.7 - p * 3);
      for (let i = 0; i < 4; i++) spoke(i * Math.PI / 2 + p * 3, radius * 0.6, radius * 1.05);
      break;
    case 'shadow':
      for (let i = -1; i <= 1; i++) {
        const offset = i * 12;
        line(sourceX + offset, sourceY - 28, x + offset + 10 * p, y - 22);
      }
      ring(radius * 0.6, p * 4, p * 4 + Math.PI * 1.3);
      break;
    case 'wind':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - radius, y - 17 + i * 14);
        ctx.quadraticCurveTo(x + radius * (p - 0.4), y - 35 + i * 14,
          x + radius, y - 16 + i * 14);
        ctx.stroke();
      }
      break;
    case 'wolf':
      ring(radius * 0.8, p * 3, p * 3 + Math.PI * 1.5);
      for (let i = 0; i < 2; i++) {
        const a = i * Math.PI + p * 5;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * radius * 0.6,
          y + Math.sin(a) * radius * 0.6, 7, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'feathers':
    case 'wings':
      for (let i = -3; i <= 3; i++) {
        const a = angle + i * 0.23;
        const length = radius * (1 - Math.abs(i) * 0.1);
        spoke(a, radius * 0.2, length);
        if (motif === 'feathers') {
          const fx = x + Math.cos(a) * length;
          const fy = y + Math.sin(a) * length;
          line(fx, fy, fx - 10 * Math.cos(a - 0.7), fy - 10 * Math.sin(a - 0.7));
        }
      }
      if (motif === 'wings') ring(radius * 0.55, -2.9, -0.25);
      break;
    case 'bear':
      ring(radius * 0.55);
      for (let i = -2; i <= 2; i++) spoke(-Math.PI / 2 + i * 0.38, radius * 0.4, radius);
      if (ultimate) ring(radius * 1.1);
      break;
    case 'roots':
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7;
        spoke(a, radius * 0.2, radius * 0.85);
        const bx = x + Math.cos(a) * radius * 0.68;
        const by = y + Math.sin(a) * radius * 0.68;
        line(bx, by, bx + Math.cos(a + 0.7) * 12, by + Math.sin(a + 0.7) * 12);
      }
      break;
    case 'grave':
      ring(radius * 0.75);
      line(x, y - radius * 0.55, x, y + radius * 0.55);
      line(x - radius * 0.35, y - radius * 0.16, x + radius * 0.35, y - radius * 0.16);
      break;
    case 'ember':
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 + p * 5;
        ring(radius * (0.55 + i * 0.08), a, a + 0.75);
      }
      beam(2);
      break;
    case 'lightning':
      for (let i = -2; i <= 2; i++) {
        const a = angle + i * 0.5;
        const ex = x + Math.cos(a) * radius;
        const ey = y + Math.sin(a) * radius;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + (ex - x) * 0.4 + 10, y + (ey - y) * 0.4);
        ctx.lineTo(x + (ex - x) * 0.6 - 8, y + (ey - y) * 0.6);
        ctx.lineTo(ex, ey); ctx.stroke();
      }
      break;
    case 'boulder':
    case 'quake':
      for (let i = -2; i <= 2; i++) {
        const offset = i * 14;
        ctx.beginPath();
        ctx.moveTo(sourceX, sourceY + offset);
        ctx.lineTo(x - radius * 0.4, y + offset - 8);
        ctx.lineTo(x, y + offset + 7);
        ctx.lineTo(x + radius * 0.7, y + offset - 7);
        ctx.stroke();
      }
      if (motif === 'quake' || ultimate) ring(radius * 0.9);
      break;
    case 'void':
      ring(radius * 0.75, p * 6, p * 6 + Math.PI * 1.65);
      ring(radius * 0.45, -p * 5, -p * 5 + Math.PI * 1.6);
      if (slot === 'skill2') beam(2);
      break;
    case 'elements':
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + p * 2;
        ctx.strokeStyle = ['#38bdf8', '#a3e635', '#fbbf24'][i];
        ring(radius * (0.65 + i * 0.1), a, a + 1.55);
      }
      if (ultimate) ring(radius * 1.12);
      break;
    case 'ash':
      for (let i = -2; i <= 2; i++) spoke(angle + i * 0.18, radius * 0.15, radius);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + p * 2;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * radius * 0.7,
          y + Math.sin(a) * radius * 0.7, 3 + p * 2, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'mist':
      beam(ultimate ? 12 : 4);
      ctx.strokeStyle = '#9fffe8';
      ring(radius * 0.7, p * 4, p * 4 + Math.PI * 1.5);
      ring(radius, -p * 3, -p * 3 + Math.PI * 1.25);
      break;
    case 'music':
      for (let i = 0; i < 3; i++) ring(radius * (0.4 + i * 0.3));
      ctx.font = `${ultimate ? 28 : 20}px system-ui`;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 - p * 2;
        ctx.fillText(i % 2 ? '♫' : '♪', x + Math.cos(a) * radius,
          y + Math.sin(a) * radius - 8);
      }
      break;
    case 'souls':
      for (let i = 0; i < (ultimate ? 12 : 6); i++) {
        const a = i * Math.PI * 2 / (ultimate ? 12 : 6) + p * 0.8;
        spoke(a, radius * 0.18, radius * 1.1);
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * radius,
          y + Math.sin(a) * radius, 4, 0, Math.PI * 2); ctx.fill();
      }
      ring(radius * 0.5);
      break;
  }
  ctx.restore();
}
