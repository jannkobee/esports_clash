// Dedicated procedural visual ability animation renderer for all playable avatars.
// Every avatar has unique, remarkable, high-visibility animations for Skill 1, Skill 2, and Ultimate.
export type SkillSlot = 'skill1' | 'skill2' | 'ultimate';

export type Motif = 'sun' | 'arrow' | 'orb' | 'shotgun' | 'blades' | 'shadow' | 'wind'
  | 'wolf' | 'feathers' | 'wings' | 'bear' | 'roots' | 'grave' | 'ember'
  | 'lightning' | 'boulder' | 'void' | 'elements' | 'ash' | 'mist'
  | 'music' | 'souls' | 'quake' | 'hook' | 'gravity' | 'grapple'
  | 'relic' | 'broadside' | 'cask' | 'lantern'
  | 'arsenal' | 'paint' | 'hammer' | 'fist' | 'rocket' | 'faerie' | 'lasso' | 'quill' | 'wisp';

export const AVATAR_ANIMATION_MOTIFS: Record<string, Motif> = {
  Solana: 'sun', Astra: 'arrow', Kyumi: 'orb', Buck: 'shotgun',
  Valkira: 'blades', Kage: 'shadow', Kazemaru: 'wind', Kindra: 'wolf',
  Cora: 'feathers', Renn: 'wings', Sylla: 'bear', Tequoia: 'roots',
  Zal: 'grave', Xin: 'ember', Raijin: 'lightning', Kaolin: 'boulder',
  Inai: 'void', Veyara: 'elements', Cinderlock: 'ash', Solenne: 'mist',
  Croakwell: 'music', Soulscourge: 'souls', Stonewake: 'quake',
  Mirehook: 'hook', Nullweaver: 'gravity', Voltgrip: 'grapple',
  Aetherbolt: 'relic', Corsara: 'broadside', Brewmaw: 'cask', Wraithhook: 'lantern',
  Kaelen: 'arsenal', Hweilin: 'paint', Jaxon: 'hammer', Valerie: 'fist',
  Jinxy: 'rocket', Paxi: 'faerie', Batrix: 'lasso', Quillback: 'quill', Aetheris: 'wisp',
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
  const radius = state.radius * (0.45 + p * 0.7);
  const fade = Math.max(0, 1 - p);
  const angle = Math.atan2(y - sourceY, x - sourceX);
  const dist = Math.hypot(x - sourceX, y - sourceY);

  ctx.save();
  ctx.globalAlpha = Math.min(1, fade * 1.35);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = ultimate ? 4.5 : 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = ultimate ? 24 : 16;

  // Utility drawing primitives for high-fidelity ability visual motifs
  const strokeLine = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };

  const drawRing = (cx: number, cy: number, r: number, start = 0, end = Math.PI * 2) => {
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, r), start, end); ctx.stroke();
  };

  const drawFillCircle = (cx: number, cy: number, r: number, col = color) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const drawSpoke = (cx: number, cy: number, a: number, r1: number, r2: number) => {
    strokeLine(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
  };

  const drawBeam = (x1: number, y1: number, x2: number, y2: number, w: number, glowColor = '#ffffff') => {
    ctx.save();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = w * 0.5;
    ctx.shadowBlur = 20;
    strokeLine(x1, y1, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    strokeLine(x1, y1, x2, y2);
    ctx.restore();
  };

  const drawLightning = (x1: number, y1: number, x2: number, y2: number, segs = 7, jitter = 14) => {
    const lDist = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / lDist;
    const ny = (x2 - x1) / lDist;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segs; i++) {
      const frac = i / segs;
      const jVal = ((i % 2 === 0 ? 1 : -1) * jitter) * (1 - Math.abs(frac - 0.5) * 0.6);
      ctx.lineTo(x1 + (x2 - x1) * frac + nx * jVal, y1 + (y2 - y1) * frac + ny * jVal);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  // Helper: Detailed metallic Shuriken
  const drawShurikenGraphic = (cx: number, cy: number, r: number, rot: number, shurikenColor: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = shurikenColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * (r * 0.35), Math.sin(a + Math.PI / 4) * (r * 0.35));
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Inner center brass/steel ring
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Helper: Feather Quill Blade
  const drawFeatherQuill = (cx: number, cy: number, len: number, rot: number, quillColor: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = quillColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(len * 0.5, 0);
    ctx.quadraticCurveTo(len * 0.1, -len * 0.22, -len * 0.5, 0);
    ctx.quadraticCurveTo(len * 0.1, len * 0.22, len * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Quill rachis central spine
    strokeLine(-len * 0.5, 0, len * 0.5, 0);
    ctx.restore();
  };

  // Helper: Living Oak Tree
  const drawLivingOakTree = (cx: number, cy: number, treeR: number) => {
    // Wood Trunk
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 3, cy, 6, treeR * 0.85);
    // Leafy Canopy
    ctx.fillStyle = '#16a34a';
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, treeR * 0.7, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 6, treeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4, cy - 6, treeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  };

  // Helper: Faceted Jade Boulder
  const drawFacetedBoulder = (cx: number, cy: number, bR: number, rot: number, bColor: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = bColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const sides = 6;
    for (let i = 0; i < sides; i++) {
      const a = (i * Math.PI * 2) / sides;
      const vx = Math.cos(a) * bR;
      const vy = Math.sin(a) * bR;
      if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Internal facets
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    strokeLine(-bR * 0.5, -bR * 0.5, bR * 0.5, bR * 0.5);
    strokeLine(bR * 0.5, -bR * 0.5, -bR * 0.5, bR * 0.5);
    ctx.restore();
  };

  // Helper: Ethereal Wolf Head Silhouette
  const drawWolfHead = (cx: number, cy: number, rot: number, sz: number, wColor: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = wColor;
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sz * 0.8, 0); // Snout
    ctx.lineTo(sz * 0.2, -sz * 0.45); // Forehead
    ctx.lineTo(0, -sz * 0.9); // Ear tip
    ctx.lineTo(-sz * 0.3, -sz * 0.4); // Back of head
    ctx.lineTo(-sz * 0.7, 0); // Neck
    ctx.lineTo(-sz * 0.2, sz * 0.4); // Jaw
    ctx.lineTo(sz * 0.4, sz * 0.15); // Lower muzzle
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Glowing spirit eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sz * 0.15, -sz * 0.15, sz * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  switch (motif) {
    // -------------------------------------------------------------
    // 1. SOLANA (Leona) - Solar Vanguard
    // -------------------------------------------------------------
    case 'sun':
      if (slot === 'skill1') {
        // Solar Shieldbash: Radiant golden heater shield slam with solar shockwave
        const shieldR = radius * 0.7;
        ctx.save();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - shieldR * 0.7, y - shieldR * 0.6);
        ctx.lineTo(x + shieldR * 0.7, y - shieldR * 0.6);
        ctx.lineTo(x + shieldR * 0.5, y + shieldR * 0.3);
        ctx.lineTo(x, y + shieldR * 0.85);
        ctx.lineTo(x - shieldR * 0.5, y + shieldR * 0.3);
        ctx.closePath();
        ctx.stroke();
        // Solar emblem in center of shield
        drawFillCircle(x, y, shieldR * 0.28, '#fbbf24');
        for (let i = 0; i < 8; i++) drawSpoke(x, y, i * Math.PI / 4 + p * 2, shieldR * 0.3, shieldR * 0.6);
        // Stun concussion arc
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3.5;
        drawRing(x, y, radius * (0.8 + p * 0.4), angle - 0.9, angle + 0.9);
        ctx.restore();
      } else if (slot === 'skill2') {
        // Zenith Lance: Piercing golden solar lance beam shooting from caster to target
        drawBeam(sourceX, sourceY - 14, x, y - 12, 6, '#fef08a');
        // Golden diamond spearhead at tip
        const lanceAngle = Math.atan2(y - 12 - (sourceY - 14), x - sourceX);
        ctx.save();
        ctx.translate(x, y - 12);
        ctx.rotate(lanceAngle);
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(22, 0); ctx.lineTo(-14, -11); ctx.lineTo(-4, 0); ctx.lineTo(-14, 11);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        // Radiating solar root rings on target
        drawRing(x, y, radius * 0.55);
        for (let i = 0; i < 6; i++) drawSpoke(x, y, i * Math.PI / 3 + p * 4, radius * 0.2, radius * 0.8);
      } else {
        // Daybreak Flare: Towering celestial solar pillar dropping from the sky
        ctx.save();
        const beamTopY = y - 280;
        const grad = typeof ctx.createLinearGradient === 'function' ? ctx.createLinearGradient(x, beamTopY, x, y) : null;
        if (grad && typeof grad.addColorStop === 'function') {
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.1)');
          grad.addColorStop(0.7, 'rgba(251, 191, 36, 0.7)');
          grad.addColorStop(1, '#ffffff');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.65)';
        }
        ctx.fillRect(x - 22, beamTopY, 44, y - beamTopY);
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3.5;
        strokeLine(x - 22, beamTopY, x - 22, y); strokeLine(x + 22, beamTopY, x + 22, y);
        // Blinding solar mandala ground scorch rings
        drawRing(x, y, radius * 1.05);
        drawRing(x, y, radius * 0.65);
        for (let i = 0; i < 12; i++) {
          const sa = i * Math.PI / 6 + p * 2;
          drawSpoke(x, y, sa, radius * 0.45, radius * 1.4);
          drawFillCircle(x + Math.cos(sa) * radius * 0.85, y + Math.sin(sa) * radius * 0.85, 4, '#fef08a');
        }
        ctx.restore();
      }
      break;

    // -------------------------------------------------------------
    // 2. ASTRA (Ashe) - Frost Sovereign
    // -------------------------------------------------------------
    case 'arrow':
      if (slot === 'skill1') {
        // Volley Cone: 7 frost arrows fanning out with glacial trails
        for (let i = -3; i <= 3; i++) {
          const a = angle + i * 0.16;
          const aDist = radius * 1.15;
          const tx = sourceX + Math.cos(a) * aDist;
          const ty = (sourceY - 14) + Math.sin(a) * aDist;
          drawBeam(sourceX, sourceY - 14, tx, ty, 2.5, '#bae6fd');
          // Crystal arrowhead
          ctx.save();
          ctx.translate(tx, ty); ctx.rotate(a);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(10, 0); ctx.lineTo(-8, -5); ctx.lineTo(-3, 0); ctx.lineTo(-8, 5);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      } else if (slot === 'skill2') {
        // Frost Flurry: Whirling blizzard with 6 spinning crystalline snowflakes
        for (let i = 0; i < 6; i++) {
          const sa = i * Math.PI / 3 + p * 5;
          const sDist = radius * 0.7;
          const sx = x + Math.cos(sa) * sDist;
          const sy = y + Math.sin(sa) * sDist;
          // Hexagonal snowflake crystal
          for (let b = 0; b < 6; b++) {
            const ba = b * Math.PI / 3 + p * 2;
            strokeLine(sx, sy, sx + Math.cos(ba) * 10, sy + Math.sin(ba) * 10);
            strokeLine(sx + Math.cos(ba) * 6, sy + Math.sin(ba) * 6, sx + Math.cos(ba + 0.5) * 8, sy + Math.sin(ba + 0.5) * 8);
          }
        }
        drawRing(x, y, radius * 0.85, p * 4, p * 4 + Math.PI * 1.6);
      } else {
        // Enchanted Crystal Comet: Giant flying ice hawk arrow supernova
        drawBeam(sourceX, sourceY - 14, x, y - 12, 9, '#e0f2fe');
        // Supernova ice crystal explosion: 12 flying jagged ice crystal shards
        for (let i = 0; i < 12; i++) {
          const ca = i * Math.PI / 6 + p * 2;
          const cDist = radius * (0.4 + p * 0.9);
          const cx = x + Math.cos(ca) * cDist;
          const cy = y + Math.sin(ca) * cDist;
          ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx, cy + 8); ctx.lineTo(cx - 6, cy);
          ctx.closePath(); ctx.fill();
        }
        drawRing(x, y, radius * 1.25);
      }
      break;

    // -------------------------------------------------------------
    // 3. KYUMI (Ahri) - Nine-Tailed Spirit
    // -------------------------------------------------------------
    case 'orb':
      if (slot === 'skill1') {
        // Orb of Illusion: Cyan & magenta spirit fox orb with looping trail
        drawFillCircle(x, y, 14, '#ffffff');
        ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 3;
        drawRing(x, y, 18, -p * 6, -p * 6 + Math.PI * 1.6);
        ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2.5;
        drawRing(x, y, 24, p * 6, p * 6 + Math.PI * 1.6);
        // Foxfire ribbons
        for (let i = 0; i < 3; i++) {
          const fa = i * Math.PI * 2 / 3 + p * 8;
          drawFillCircle(x + Math.cos(fa) * 28, y + Math.sin(fa) * 20, 5, '#ec4899');
        }
      } else if (slot === 'skill2') {
        // Charm of Longing: Radiant hot-pink winged heart pulling victim
        const hSize = radius * 0.8;
        ctx.save();
        ctx.fillStyle = '#f472b6'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + hSize * 0.45);
        ctx.bezierCurveTo(x - hSize * 0.95, y - hSize * 0.4, x - hSize * 0.55, y - hSize * 0.95, x, y - hSize * 0.35);
        ctx.bezierCurveTo(x + hSize * 0.55, y - hSize * 0.95, x + hSize * 0.95, y - hSize * 0.4, x, y + hSize * 0.45);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Angel / spirit wing feathers
        ctx.strokeStyle = '#fbcfe8'; ctx.lineWidth = 2.5;
        strokeLine(x - hSize * 0.8, y - hSize * 0.25, x - hSize * 1.5, y - hSize * 0.7);
        strokeLine(x - hSize * 0.7, y, x - hSize * 1.35, y - szOffset(p));
        strokeLine(x + hSize * 0.8, y - hSize * 0.25, x + hSize * 1.5, y - hSize * 0.7);
        strokeLine(x + hSize * 0.7, y, x + hSize * 1.35, y - szOffset(p));
        ctx.restore();
        drawRing(x, y, radius * 0.9, -p * 3, -p * 3 + Math.PI * 1.4);
      } else {
        // Spirit Rush: Triple spirit dash trails with homing foxfire bolts
        for (let i = 0; i < 3; i++) {
          const a = i * Math.PI * 2 / 3 + p * 5;
          const fx = x + Math.cos(a) * radius * 0.85;
          const fy = y + Math.sin(a) * radius * 0.75;
          drawFillCircle(fx, fy, 8, '#ec4899');
          drawBeam(x, y, fx, fy, 3, '#fbcfe8');
        }
        drawRing(x, y, radius * 1.05);
      }
      break;

    // -------------------------------------------------------------
    // 4. BUCK (Graves) - Boomstick Outlaw
    // -------------------------------------------------------------
    case 'shotgun':
      if (slot === 'skill1') {
        // Powder Keg Blast: Explosive T-shape keg blast with violent shrapnel
        ctx.save();
        ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 7;
        strokeLine(x - radius * 0.95, y, x + radius * 0.95, y);
        strokeLine(x, y - radius * 0.85, x, y + radius * 0.85);
        ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 3;
        strokeLine(x - radius * 0.95, y, x + radius * 0.95, y);
        strokeLine(x, y - radius * 0.85, x, y + radius * 0.85);
        drawRing(x, y, radius * 0.6);
        for (let i = 0; i < 8; i++) {
          const sa = i * Math.PI / 4 + 0.3;
          drawFillCircle(x + Math.cos(sa) * radius * 0.75, y + Math.sin(sa) * radius * 0.75, 4, '#f97316');
        }
        ctx.restore();
      } else if (slot === 'skill2') {
        // Smoke Screen: Billowing tactical dark smog clouds with grenade canister
        for (let i = 0; i < 8; i++) {
          const sa = i * Math.PI / 4 + p * 2;
          const sr = radius * 0.58;
          drawFillCircle(x + Math.cos(sa) * sr, y + Math.sin(sa) * sr * 0.85, radius * 0.48, 'rgba(51, 65, 85, 0.65)');
        }
        // Central canister
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - 6, y - 10, 12, 20);
        drawFillCircle(x, y - 6, 2.5, '#ef4444'); // Blinking red LED
        drawRing(x, y, radius * 0.9);
      } else {
        // Collateral Blast: Wide muzzle flash recoil cone and flying pellets
        for (let i = -4; i <= 4; i++) {
          const ma = angle + i * 0.16;
          drawSpoke(sourceX, sourceY - 14, ma, 16, radius * (0.85 + Math.abs(i) * 0.08));
          drawFillCircle(sourceX + Math.cos(ma) * radius, (sourceY - 14) + Math.sin(ma) * radius, 4.5, '#fbbf24');
        }
        drawRing(x, y, radius * 0.8, angle - 0.95, angle + 0.95);
      }
      break;

    // -------------------------------------------------------------
    // 5. VALKIRA (Ambessa / Diana) - Crescent Warlord
    // -------------------------------------------------------------
    case 'blades':
      if (slot === 'skill1') {
        // Crescent Cleave: Twin sweeping crimson runic blade slashes
        drawRing(x, y, radius * 0.95, -2.4 + p * 3, 0.4 + p * 3);
        drawRing(x, y, radius * 0.7, 0.9 - p * 3, 3.7 - p * 3);
        // Blood bleed droplets flying off blade tips
        for (let i = 0; i < 5; i++) {
          const ba = -1.5 + i * 0.7 + p * 2;
          drawFillCircle(x + Math.cos(ba) * radius * 0.95, y + Math.sin(ba) * radius * 0.8, 4, '#ef4444');
        }
      } else if (slot === 'skill2') {
        // Iron Will Slam / Pale Cascade: Hexagonal rune shield with orbiting lunar orbs
        drawRing(x, y, radius * 0.8);
        for (let i = 0; i < 6; i++) {
          const ha = i * Math.PI / 3;
          strokeLine(x + Math.cos(ha) * radius * 0.8, y + Math.sin(ha) * radius * 0.8,
            x + Math.cos(ha + Math.PI / 3) * radius * 0.8, y + Math.sin(ha + Math.PI / 3) * radius * 0.8);
        }
        // 3 Orbiting lunar orbs
        for (let i = 0; i < 3; i++) {
          const oa = i * Math.PI * 2 / 3 + p * 6;
          drawFillCircle(x + Math.cos(oa) * radius * 0.8, y + Math.sin(oa) * radius * 0.8, 6, '#f1f5f9');
        }
      } else {
        // Executioner's Descent: Guillotine downward greatsword execution & crater
        strokeLine(x, y - radius * 1.4, x, y + radius * 0.4);
        strokeLine(x - radius * 0.75, y - radius * 0.6, x + radius * 0.75, y - radius * 0.6);
        drawRing(x, y, radius * 1.05);
        for (let i = 0; i < 6; i++) drawSpoke(x, y, i * Math.PI / 3, radius * 0.5, radius * 1.35);
      }
      break;

    // -------------------------------------------------------------
    // 6. KAGE (Zed) - Master of Shadows
    // -------------------------------------------------------------
    case 'shadow':
      if (slot === 'skill1') {
        // Razor Shuriken: 3 spinning 4-pointed metallic shurikens
        drawShurikenGraphic(x, y, radius * 0.6, p * 12, '#dc2626');
        drawShurikenGraphic(x - 22, y - 10, radius * 0.4, -p * 12, '#ef4444');
        drawShurikenGraphic(x + 22, y + 10, radius * 0.4, -p * 12, '#ef4444');
      } else if (slot === 'skill2') {
        // Living Shadow: Shadow silhouette clone with smoke tendrils
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(x, y - 24, 8, 0, Math.PI * 2); // Head
        ctx.fill();
        ctx.fillRect(x - 7, y - 16, 14, 22); // Torso
        strokeLine(x - 12, y - 8, x + 12, y - 8); // Arms
        // Glowing red ninja eyes
        drawFillCircle(x - 2.5, y - 24, 1.5, '#ef4444');
        drawFillCircle(x + 2.5, y - 24, 1.5, '#ef4444');
        drawRing(x, y, radius * 0.75, p * 3, p * 3 + Math.PI * 1.5);
      } else {
        // Death Mark: Blood-red Death Mark X with pulsating countdown scythes
        ctx.save();
        ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 6;
        strokeLine(x - radius * 0.8, y - radius * 0.8, x + radius * 0.8, y + radius * 0.8);
        strokeLine(x + radius * 0.8, y - radius * 0.8, x - radius * 0.8, y + radius * 0.8);
        drawRing(x, y, radius * 1.05);
        // Blood drips
        for (let i = 0; i < 4; i++) {
          drawFillCircle(x - radius * 0.4 + i * (radius * 0.28), y + radius * 0.6, 3.5, '#b91c1c');
        }
        ctx.restore();
      }
      break;

    // -------------------------------------------------------------
    // 7. KAZEMARU (Yasuo) - Wandering Tempest
    // -------------------------------------------------------------
    case 'wind':
      if (slot === 'skill1') {
        // Steel Tempest & Tornado: Spiraling cyclone lifting victims with wind streaks
        for (let i = 0; i < 6; i++) {
          const tr = radius * (0.3 + i * 0.16);
          ctx.beginPath();
          ctx.ellipse(x, y - i * 14, tr, tr * 0.35, 0, p * 6 + i, p * 6 + i + Math.PI * 1.6);
          ctx.stroke();
        }
        // Flying leaves / debris
        for (let i = 0; i < 5; i++) {
          const la = i * 1.2 + p * 8;
          drawFillCircle(x + Math.cos(la) * radius * 0.6, y - i * 12 + Math.sin(la) * 8, 2.5, '#38bdf8');
        }
      } else if (slot === 'skill2') {
        // Wind Wall: Shimmering vertical air curtain with ripples
        strokeLine(x, y - radius * 0.95, x, y + radius * 0.95);
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(x - 12, y + i * 18);
          ctx.quadraticCurveTo(x + Math.sin(p * 8 + i) * 16, y + i * 18, x + 12, y + i * 18);
          ctx.stroke();
        }
        drawRing(x, y, radius * 0.6, 0, Math.PI * 2);
      } else {
        // Last Breath: 5 rapid blade slashes suspended in mid-air
        ctx.save();
        ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 4;
        for (let i = 0; i < 5; i++) {
          const ba = (i * Math.PI / 2.5) + p * 3;
          strokeLine(x + Math.cos(ba) * radius * 0.95, y + Math.sin(ba) * radius * 0.85,
            x - Math.cos(ba) * radius * 0.95, y - Math.sin(ba) * radius * 0.85);
        }
        drawRing(x, y, radius * 0.9);
        ctx.restore();
      }
      break;

    // -------------------------------------------------------------
    // 8. KINDRA (Kindred) - Eternal Hunters
    // -------------------------------------------------------------
    case 'wolf':
      if (slot === 'skill1') {
        // Dance of Arrows: Acrobatic vault firing 3 spectral spirit arrows
        for (let i = -1; i <= 1; i++) {
          const a = angle + i * 0.28;
          drawSpoke(sourceX, sourceY - 14, a, radius * 0.2, radius * 1.1);
          drawFillCircle(sourceX + Math.cos(a) * radius * 1.05, (sourceY - 14) + Math.sin(a) * radius * 1.05, 5, '#c084fc');
        }
      } else if (slot === 'skill2') {
        // Wolf's Frenzy: Spiraling spirit wolf jaws circling territory
        drawRing(x, y, radius * 0.9, p * 5, p * 5 + Math.PI * 1.5);
        const wa = p * 7;
        drawWolfHead(x + Math.cos(wa) * radius * 0.65, y + Math.sin(wa) * radius * 0.65, wa + Math.PI / 2, 18, '#581c87');
      } else {
        // Lamb's Respite: Golden-purple sanctuary boundary with celestial runes & Yin-Yang core
        drawRing(x, y, radius * 1.05);
        drawRing(x, y, radius * 0.7);
        for (let i = 0; i < 8; i++) drawSpoke(x, y, i * Math.PI / 4, radius * 0.72, radius * 0.98);
        drawFillCircle(x - 8, y, 6, '#facc15'); // Lamb
        drawFillCircle(x + 8, y, 6, '#a855f7'); // Wolf
      }
      break;

    // -------------------------------------------------------------
    // 9. CORA (Xayah) - Rebel Feather
    // -------------------------------------------------------------
    case 'feathers':
      if (slot === 'skill1') {
        // Double Daggers: Two piercing magenta quill feathers
        for (let i = -1; i <= 1; i += 2) {
          const a = angle + i * 0.16;
          drawFeatherQuill(sourceX + Math.cos(a) * radius * 0.8, (sourceY - 14) + Math.sin(a) * radius * 0.8, 28, a, '#ec4899');
        }
      } else if (slot === 'skill2') {
        // Bladecaller: Recalling all ground feathers back to hands
        drawBeam(sourceX, sourceY - 14, x, y - 12, 4, '#f472b6');
        for (let i = -2; i <= 2; i++) {
          const a = angle + i * 0.32;
          drawFeatherQuill(x + Math.cos(a) * radius * 0.7, y + Math.sin(a) * radius * 0.7, 22, a + Math.PI, '#ec4899');
        }
      } else {
        // Featherstorm: Crescent fan of 5 massive quill blades
        for (let i = -2; i <= 2; i++) {
          const a = angle + i * 0.22;
          drawFeatherQuill(x + Math.cos(a) * radius * 0.65, y + Math.sin(a) * radius * 0.65, 34, a, '#f43f5e');
        }
        drawRing(x, y, radius * 0.85, angle - 0.85, angle + 0.85);
      }
      break;

    // -------------------------------------------------------------
    // 10. RENN (Rakan) - Battle Dancer
    // -------------------------------------------------------------
    case 'wings':
      if (slot === 'skill1') {
        // Grand Entrance: Golden acrobatic knockup ring with floating feathers
        drawRing(x, y, radius * 0.95);
        for (let i = 0; i < 8; i++) {
          const ga = i * Math.PI / 4;
          drawSpoke(x, y, ga, radius * 0.4, radius * 1.2);
          drawFeatherQuill(x + Math.cos(ga) * radius * 0.85, y + Math.sin(ga) * radius * 0.85, 18, ga, '#f59e0b');
        }
      } else if (slot === 'skill2') {
        // Battle Dance: Golden feathered angel wing shield barrier
        drawRing(x, y, radius * 0.8);
        drawBeam(sourceX, sourceY - 14, x, y - 12, 3.5, '#fde047');
        // Angel wings
        ctx.save();
        ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 3;
        strokeLine(x - radius * 0.6, y, x - radius * 1.1, y - 20);
        strokeLine(x + radius * 0.6, y, x + radius * 1.1, y - 20);
        ctx.restore();
      } else {
        // The Quickness: Hypnotic golden halo ribbons and charm notes
        drawRing(x, y, radius * 1.05, -p * 6, -p * 6 + Math.PI * 1.6);
        drawRing(x, y, radius * 0.6, p * 6, p * 6 + Math.PI * 1.6);
        drawFillCircle(x, y, 6, '#fef08a');
      }
      break;

    // -------------------------------------------------------------
    // 11. SYLLA (Lone Druid) - Bear Shaman
    // -------------------------------------------------------------
    case 'bear':
      if (slot === 'skill1') {
        // Summon Spirit Bear: Armored claw swipe grooves & vine roots
        ctx.save();
        ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4;
        for (let i = -1.5; i <= 1.5; i += 1) {
          ctx.beginPath();
          ctx.moveTo(x + i * 12 - 10, y - radius * 0.5);
          ctx.quadraticCurveTo(x + i * 12, y, x + i * 12 + 10, y + radius * 0.6);
          ctx.stroke();
        }
        drawRing(x, y, radius * 0.7);
        ctx.restore();
      } else if (slot === 'skill2') {
        // Savage Roar: 3 expanding emerald sonic roar rings with roaring fangs
        for (let i = 1; i <= 3; i++) drawRing(x, y, radius * (0.32 + i * 0.28));
        // Primal fangs
        strokeLine(x - 12, y - 8, x - 4, y + 6);
        strokeLine(x + 12, y - 8, x + 4, y + 6);
      } else {
        // True Form: Gargantuan Ironclaw Bear transformation paw prints
        drawRing(x, y, radius * 1.25);
        drawRing(x, y, radius * 0.8);
        // Giant Bear Paw in center
        drawFillCircle(x, y, 16, '#15803d');
        for (let i = -2; i <= 1; i++) {
          drawFillCircle(x + i * 10 + 5, y - 22, 6, '#15803d');
        }
      }
      break;

    // -------------------------------------------------------------
    // 12. TEQUOIA (Nature's Prophet) - Nature's Sovereign
    // -------------------------------------------------------------
    case 'roots':
      if (slot === 'skill1') {
        // Sprout: Ring of 8 living oak trees encaging victim
        drawRing(x, y, radius * 0.9);
        for (let i = 0; i < 8; i++) {
          const ta = i * Math.PI / 4;
          const tx = x + Math.cos(ta) * radius * 0.9;
          const ty = y + Math.sin(ta) * radius * 0.9;
          drawLivingOakTree(tx, ty, 14);
        }
      } else if (slot === 'skill2') {
        // Nature's Call: 3 marching wooden treants
        for (let i = -1; i <= 1; i++) {
          const tx = x + i * 26;
          drawLivingOakTree(tx, y, 16);
          // Little walking branch legs
          strokeLine(tx - 4, y + 12, tx - 8, y + 20);
          strokeLine(tx + 4, y + 12, tx + 8, y + 20);
        }
      } else {
        // Wrath of Nature: Bouncing green lightning sphere
        drawRing(x, y, radius * 1.05);
        for (let i = 0; i < 10; i++) drawSpoke(x, y, i * Math.PI / 5 + p * 3, radius * 0.4, radius * 1.35);
        drawFillCircle(x, y, 14, '#22c55e');
      }
      break;

    // -------------------------------------------------------------
    // 13. ZAL (Dazzle) - Shadow Priest
    // -------------------------------------------------------------
    case 'grave':
      if (slot === 'skill1') {
        // Poison Touch: Violet venom spray cone with toxic splash
        for (let i = -2; i <= 2; i++) {
          const va = angle + i * 0.22;
          drawSpoke(sourceX, sourceY - 14, va, 10, radius * 1.05);
          drawFillCircle(sourceX + Math.cos(va) * radius * 1.05, (sourceY - 14) + Math.sin(va) * radius * 1.05, 4.5, '#d946ef');
        }
      } else if (slot === 'skill2') {
        // Shadow Wave: Chaining pink healing lightning
        drawBeam(sourceX, sourceY - 14, x, y - 12, 4, '#f472b6');
        drawRing(x, y, radius * 0.7);
        drawFillCircle(x, y - 12, 8, '#ec4899');
      } else {
        // Shallow Grave: Luminous pink celestial crucifix of immortality
        ctx.save();
        ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 6;
        strokeLine(x, y - radius * 0.75, x, y + radius * 0.75); // Vertical
        strokeLine(x - radius * 0.5, y - radius * 0.25, x + radius * 0.5, y - radius * 0.25); // Horizontal
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
        strokeLine(x, y - radius * 0.75, x, y + radius * 0.75);
        strokeLine(x - radius * 0.5, y - radius * 0.25, x + radius * 0.5, y - radius * 0.25);
        drawRing(x, y - radius * 0.25, radius * 0.45);
        ctx.restore();
      }
      break;

    // -------------------------------------------------------------
    // 14. XIN (Ember Spirit) - Flame Skirmisher
    // -------------------------------------------------------------
    case 'ember':
      if (slot === 'skill1') {
        // Searing Chains: Flaming metallic chain links wrapping around target
        ctx.save();
        ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 5;
        drawRing(x, y, radius * 0.7, 0, Math.PI * 2);
        drawRing(x, y, radius * 0.45, 0, Math.PI * 2);
        // Flying fire embers
        for (let i = 0; i < 6; i++) {
          const ea = i * Math.PI / 3 + p * 6;
          drawFillCircle(x + Math.cos(ea) * radius * 0.8, y + Math.sin(ea) * radius * 0.8, 3.5, '#fef08a');
        }
        ctx.restore();
      } else if (slot === 'skill2') {
        // Sleight of Fist: Fiery starburst circle with hyper-speed slashes
        drawRing(x, y, radius * 0.95);
        ctx.save();
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 4;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + p * 9;
          strokeLine(x + Math.cos(a) * radius * 0.95, y + Math.sin(a) * radius * 0.95,
            x - Math.cos(a) * radius * 0.95, y - Math.sin(a) * radius * 0.95);
        }
        ctx.restore();
      } else {
        // Fire Remnant Dash: Flame statues and rocket dash
        drawBeam(sourceX, sourceY - 14, x, y - 12, 6, '#fbbf24');
        drawRing(x, y, radius * 1.05);
        for (let i = 0; i < 6; i++) drawSpoke(x, y, i * Math.PI / 3 + p * 4, radius * 0.5, radius * 1.35);
      }
      break;

    // -------------------------------------------------------------
    // 15. RAIJIN (Storm Spirit) - Lightning Burst Mage
    // -------------------------------------------------------------
    case 'lightning':
      if (slot === 'skill1') {
        // Static Remnant: Crackling electrical hologram duplicate of Raijin
        drawRing(x, y, radius * 0.75);
        drawLightning(x - 16, y - 16, x + 16, y + 16, 5, 12);
        drawLightning(x + 16, y - 16, x - 16, y + 16, 5, 12);
        drawFillCircle(x, y - 10, 8, '#06b6d4');
      } else if (slot === 'skill2') {
        // Electric Vortex: Crackling plasma tether and inward vortex
        drawLightning(sourceX, sourceY - 14, x, y - 12, 9, 20);
        drawRing(x, y, radius * (0.8 - p * 0.35), p * 6, p * 6 + Math.PI * 1.5);
      } else {
        // Ball Lightning: Supersonic sphere of pure cyan plasma
        drawFillCircle(x, y, radius * 0.55, '#38bdf8');
        drawRing(x, y, radius * 0.8, -p * 8, -p * 8 + Math.PI * 1.5);
        drawRing(x, y, radius * 1.1, p * 8, p * 8 + Math.PI * 1.5);
        for (let i = 0; i < 8; i++) drawSpoke(x, y, i * Math.PI / 4 + p * 5, radius * 0.5, radius * 1.3);
      }
      break;

    // -------------------------------------------------------------
    // 16. KAOLIN (Earth Spirit) - Jade General
    // -------------------------------------------------------------
    case 'boulder':
      if (slot === 'skill1') {
        // Boulder Smash: Giant rolling faceted jade boulder
        drawFacetedBoulder(x, y, radius * 0.65, p * 8, '#059669');
      } else if (slot === 'skill2') {
        // Rolling Boulder: Kaolin curls into a spinning jade shell
        drawFacetedBoulder(x, y, radius * 0.75, p * 10, '#047857');
        drawRing(x, y, radius * 0.95);
      } else {
        // Magnetize: Concentric pulsing magnetic resonance rings
        for (let i = 1; i <= 3; i++) drawRing(x, y, radius * (0.35 + i * 0.32));
      }
      break;

    // -------------------------------------------------------------
    // 17. INAI (Void Spirit) - Void Infiltrator
    // -------------------------------------------------------------
    case 'void':
      if (slot === 'skill1') {
        // Aether Remnant: Floating mystical void eye with pulling gaze beam
        drawRing(x, y, radius * 0.75);
        drawBeam(sourceX, sourceY - 14, x, y - 12, 4, '#c084fc');
        // Eye of the remnant
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        ctx.ellipse(x, y - 10, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y - 10, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (slot === 'skill2') {
        // Dissimilate: Ring of 7 void portals
        for (let i = 0; i < 7; i++) {
          const a = i * Math.PI * 2 / 7;
          drawRing(x + Math.cos(a) * radius * 0.75, y + Math.sin(a) * radius * 0.75, 9);
        }
        drawRing(x, y, radius * 1.05);
      } else {
        // Astral Step: Dimensional rift slash through reality
        ctx.save();
        ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 5;
        strokeLine(sourceX, sourceY - 14, x, y - 12);
        drawRing(x, y, radius * 0.85, p * 5, p * 5 + Math.PI * 1.6);
        for (let i = -2; i <= 2; i++) drawSpoke(x, y, angle + i * 0.4, radius * 0.3, radius * 1.25);
        ctx.restore();
      }
      break;

    // -------------------------------------------------------------
    // 18. VEYARA (Qiyana) - Elemental Assassin
    // -------------------------------------------------------------
    case 'elements':
      if (slot === 'skill1') {
        // Prism Hurl: Spinning tri-color Ohmlat ring blade
        drawRing(x, y, radius * 0.85, p * 6, p * 6 + Math.PI * 1.6);
        for (let i = 0; i < 3; i++) {
          const a = i * Math.PI * 2 / 3 + p * 6;
          drawSpoke(x, y, a, radius * 0.2, radius * 0.95);
          drawFillCircle(x + Math.cos(a) * radius * 0.85, y + Math.sin(a) * radius * 0.85, 5,
            i === 0 ? '#38bdf8' : i === 1 ? '#ea580c' : '#22c55e');
        }
      } else if (slot === 'skill2') {
        // Facet Dash: Gathering elemental terrain crystals in a crown
        for (let i = 0; i < 3; i++) {
          const a = i * Math.PI * 2 / 3 + p * 4;
          drawFillCircle(x + Math.cos(a) * radius * 0.65, y + Math.sin(a) * radius * 0.65, 7, '#fde047');
        }
        drawRing(x, y, radius * 0.75);
      } else {
        // Crownfall Surge: Sweeping elemental shockwave across walls & river
        drawRing(x, y, radius * 1.25);
        drawRing(x, y, radius * 0.8);
        for (let i = 0; i < 8; i++) drawSpoke(x, y, i * Math.PI / 4, radius * 0.6, radius * 1.4);
      }
      break;

    // -------------------------------------------------------------
    // 19. CINDERLOCK (Locke) - Ash Exorcist
    // -------------------------------------------------------------
    case 'ash':
      if (slot === 'skill1') {
        // Cinder Spikes: Fan of 5 glowing molten iron nails
        for (let i = -2; i <= 2; i++) {
          const na = angle + i * 0.18;
          drawSpoke(x, y, na, radius * 0.15, radius * 1.05);
          drawFillCircle(x + Math.cos(na) * radius * 1.05, y + Math.sin(na) * radius * 1.05, 4, '#fb923c');
        }
      } else if (slot === 'skill2') {
        // Ash Rush: Blazing ash ground trail dash
        drawBeam(sourceX, sourceY - 14, x, y - 12, 5, '#fb923c');
        drawRing(x, y, radius * 0.7);
      } else {
        // Cinder Verdict: Sacred ritual circle with 4 rising fire pillars
        drawRing(x, y, radius * 1.05);
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          drawFillCircle(x + Math.cos(a) * radius * 0.75, y + Math.sin(a) * radius * 0.75, 10, '#f97316');
        }
      }
      break;

    // -------------------------------------------------------------
    // 20. SOLENNE (Senna) - Relic Cannon Support
    // -------------------------------------------------------------
    case 'mist':
      if (slot === 'skill1') {
        // Dusk Lance: Piercing dual shadow/light beam
        drawBeam(sourceX, sourceY - 14, x, y - 12, 8, '#f8fafc');
        drawRing(x, y, radius * 0.6);
      } else if (slot === 'skill2') {
        // Mistbind: Creeping dark mist root tendrils
        drawRing(x, y, radius * 0.85, p * 4, p * 4 + Math.PI * 1.5);
        for (let i = 0; i < 6; i++) drawSpoke(x, y, i * Math.PI / 3, radius * 0.3, radius * 0.95);
      } else {
        // Daybreak Veil: Full-screen colossal beam of relic light with shield wings
        drawBeam(sourceX, sourceY - 14, x, y - 12, 18, '#ffffff');
        drawRing(x, y, radius * 1.3);
      }
      break;

    // -------------------------------------------------------------
    // 21. CROAKWELL (Largo) - Marsh Minstrel
    // -------------------------------------------------------------
    case 'music':
      if (slot === 'skill1') {
        // Ribbon Lash: Long elastic frog tongue pulling victim
        if (dist > 15) {
          ctx.save();
          ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(sourceX, sourceY - 14);
          ctx.quadraticCurveTo((sourceX + x) / 2, Math.min(sourceY, y) - 26, x, y - 12);
          ctx.stroke();
          // Tongue suction cup tip
          drawFillCircle(x, y - 12, 8, '#db2777');
          ctx.restore();
        }
        drawRing(x, y, radius * 0.7);
      } else if (slot === 'skill2') {
        // Bogbeat: Rhythmic green pond ripple waves
        for (let i = 1; i <= 3; i++) drawRing(x, y, radius * (0.32 + i * 0.28));
      } else {
        // Marsh Anthem: Luminous musical staff with floating melodies
        drawRing(x, y, radius * 1.05);
        ctx.font = '24px system-ui, serif';
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5 - p * 2;
          ctx.fillText(i % 2 ? '♫' : '♪', x + Math.cos(a) * radius, y + Math.sin(a) * radius - 8);
        }
      }
      break;

    // -------------------------------------------------------------
    // 22. SOULSCOURGE (Shadow Fiend) - Soul Nuker
    // -------------------------------------------------------------
    case 'souls':
      if (slot === 'skill1') {
        // Gloom Raze: Abyssal dark soul geyser eruption
        drawRing(x, y, radius * 0.8);
        ctx.save();
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.ellipse(x, y, radius * 0.6, radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 6; i++) drawSpoke(x, y, i * Math.PI / 3 + p * 3, radius * 0.2, radius * 1.15);
        ctx.restore();
      } else if (slot === 'skill2') {
        // Soul Draw: Inward soul harvesting vortex
        drawRing(x, y, radius * (1 - p * 0.4));
        for (let i = 0; i < 5; i++) drawSpoke(x, y, i * Math.PI * 2 / 5 + p * 4, radius * 0.9, radius * 0.2);
      } else {
        // Dirge Wave: Concentric screaming soul nova
        drawRing(x, y, radius * 1.15);
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI / 8 + p * 0.8;
          drawSpoke(x, y, a, radius * 0.2, radius * 1.3);
          drawFillCircle(x + Math.cos(a) * radius, y + Math.sin(a) * radius, 5, '#fb7185');
        }
      }
      break;

    // -------------------------------------------------------------
    // 23. STONEWAKE (Earthshaker) - Faultline Warden
    // -------------------------------------------------------------
    case 'quake':
      if (slot === 'skill1') {
        // Faultline: Linear rock ridge across lane with jagged craggy spires
        strokeLine(sourceX, sourceY - 14, x, y - 12);
        for (let i = -3; i <= 3; i++) {
          const rx = sourceX + (x - sourceX) * (0.5 + i * 0.15);
          strokeLine(rx, y - 28, rx, y + 6);
          drawFillCircle(rx, y - 12, 4, '#ca8a04');
        }
      } else if (slot === 'skill2') {
        // Runic Maul: Heavy totem ground smash & seismic crack
        drawRing(x, y, radius * 0.85);
        for (let i = 0; i < 6; i++) drawSpoke(x, y, i * Math.PI / 3, radius * 0.35, radius * 1.25);
      } else {
        // Quake Chorus: Seismic echo slam shockwaves reverberating
        drawRing(x, y, radius * 1.25);
        drawRing(x, y, radius * 0.85);
        drawRing(x, y, radius * 0.5);
        for (let i = 0; i < 12; i++) drawSpoke(x, y, i * Math.PI / 6, radius * 0.7, radius * 1.5);
      }
      break;

    case 'hook':
      strokeLine(sourceX, sourceY - 15, x, y - 12);
      drawRing(x, y - 12, slot === 'ultimate' ? radius * 0.85 : 11);
      for (let i = 0; i < (ultimate ? 8 : 3); i++) drawSpoke(x, y, i * Math.PI / (ultimate ? 4 : 1.5), radius * 0.3, radius);
      break;
    case 'gravity':
      for (let i = 0; i < 4; i++) drawRing(x, y, radius * (0.25 + i * 0.22) * (1 - p * 0.35));
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + p * 4;
        drawFillCircle(x + Math.cos(a) * radius * 0.7, y + Math.sin(a) * radius * 0.7, 4);
      }
      break;
    case 'grapple':
      drawLightning(sourceX, sourceY - 16, x, y - 15, ultimate ? 11 : 6, 10);
      drawRing(x, y, radius * (ultimate ? 1.2 : 0.55));
      if (slot === 'skill2') drawFillCircle(x, y - 15, 12, '#fef08a');
      break;
    case 'relic':
      drawBeam(sourceX, sourceY - 14, x, y - 14, ultimate ? 15 : 5, '#e0f2fe');
      drawRing(x, y, radius * (ultimate ? 1.1 : 0.45));
      for (let i = 0; i < 4; i++) drawSpoke(x, y, i * Math.PI / 2 + p, 4, radius * 0.8);
      break;
    case 'broadside':
      for (let i = -3; i <= 3; i++) {
        const spread = slot === 'ultimate' ? 25 : 9;
        strokeLine(sourceX, sourceY - 15, x, y + i * spread);
        drawFillCircle(x, y + i * spread, ultimate ? 7 : 3);
      }
      break;
    case 'cask':
      drawRing(x, y, radius * (ultimate ? 1.25 : 0.85));
      drawFillCircle(x, y - 10, 13, '#a16207');
      for (let i = 0; i < 8; i++) drawSpoke(x, y, i * Math.PI / 4, radius * 0.2, radius * (ultimate ? 1.3 : 0.95));
      break;
    case 'lantern':
      strokeLine(sourceX, sourceY - 16, x, y - 16);
      drawRing(x, y, radius * (ultimate ? 1.2 : 0.65));
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 + p;
        drawFillCircle(x + Math.cos(a) * radius, y + Math.sin(a) * radius, 5, '#5eead4');
      }
      break;

    case 'arsenal':
      drawRing(x, y, radius * (ultimate ? 1.3 : 0.8));
      drawFillCircle(x, y, ultimate ? 18 : 10, '#f59e0b');
      // Draw orbiting Pyra (amber flame) and Surge (electric cyan) essence spheres
      for (let i = 0; i < (ultimate ? 6 : 2); i++) {
        const a = (i * Math.PI * 2) / (ultimate ? 6 : 2) + p * 4;
        const color = i % 2 === 0 ? '#f97316' : '#06b6d4';
        drawFillCircle(x + Math.cos(a) * radius * 0.75, y + Math.sin(a) * radius * 0.75, 6, color);
      }
      if (ultimate) {
        drawBeam(x, y - radius * 1.4, x, y + radius * 0.5, 14, '#fef08a');
      }
      break;

    case 'paint':
      for (let i = 0; i < 4; i++) {
        const rad = radius * (0.3 + i * 0.25);
        drawRing(x, y, rad);
        drawFillCircle(x + Math.cos(p * 4 + i) * rad, y + Math.sin(p * 4 + i) * rad, 5, i % 2 === 0 ? '#06b6d4' : '#a855f7');
      }
      break;

    case 'hammer':
      drawBeam(sourceX, sourceY - 14, x, y - 14, ultimate ? 14 : 7, '#38bdf8');
      drawRing(x, y, radius * (ultimate ? 1.2 : 0.7));
      for (let i = 0; i < 6; i++) drawSpoke(x, y, (i * Math.PI) / 3, radius * 0.2, radius * 1.1);
      break;

    case 'fist':
      strokeLine(sourceX, sourceY - 15, x, y - 15);
      drawFillCircle(x, y - 15, ultimate ? 18 : 10, '#ec4899');
      drawRing(x, y - 15, radius * (ultimate ? 1.25 : 0.75));
      for (let i = 0; i < 8; i++) drawSpoke(x, y - 15, (i * Math.PI) / 4, 6, radius * 0.9);
      break;

    case 'rocket':
      strokeLine(sourceX, sourceY - 14, x, y - 14);
      drawFillCircle(x, y - 14, ultimate ? 16 : 8, '#f43f5e');
      drawRing(x, y - 14, radius * (ultimate ? 1.35 : 0.8));
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + p * 2;
        drawFillCircle(x + Math.cos(a) * radius * 0.6, y - 14 + Math.sin(a) * radius * 0.6, 4, '#38bdf8');
      }
      break;

    case 'faerie':
      drawRing(x, y, radius * (ultimate ? 1.3 : 0.7));
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 + p * 4;
        drawFillCircle(x + Math.cos(a) * radius * 0.8, y + Math.sin(a) * radius * 0.8, 6, '#34d399');
      }
      break;

    case 'lasso':
      drawBeam(sourceX, sourceY - 15, x, y - 15, 6, '#f97316');
      drawRing(x, y, radius * (ultimate ? 1.1 : 0.6));
      for (let i = 0; i < 4; i++) drawSpoke(x, y, (i * Math.PI) / 2 + p * 3, radius * 0.2, radius * 0.85);
      break;

    case 'quill':
      drawRing(x, y, radius * (ultimate ? 1.2 : 0.75));
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        strokeLine(x, y, x + Math.cos(a) * radius, y + Math.sin(a) * radius);
        drawFillCircle(x + Math.cos(a) * radius, y + Math.sin(a) * radius, 3, '#84cc16');
      }
      break;

    case 'wisp':
      drawRing(x, y, radius * 0.5);
      drawRing(x, y, radius * (ultimate ? 1.25 : 0.85));
      drawFillCircle(x, y, ultimate ? 14 : 8, '#ffffff');
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 + p * 5;
        drawFillCircle(x + Math.cos(a) * radius * 0.75, y + Math.sin(a) * radius * 0.75, 4, '#38bdf8');
      }
      break;
  }

  ctx.restore();
}

function szOffset(p: number): number {
  return Math.sin(p * Math.PI * 4) * 8;
}
