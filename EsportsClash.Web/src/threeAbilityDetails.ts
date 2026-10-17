import type * as THREE from 'three';
import type { AbilitySource, AbilitySpell } from './threeAbilityEffects.ts';

type V = [number, number, number];
export type DetailShape = 'ball' | 'shard' | 'beam' | 'cone' | 'ring' | 'box' | 'arc' | 'flame' | 'root' | 'chain' | 'hook';
export interface DetailPainter {
  mesh(shape: DetailShape, color: string, alpha: number, at: V, scale: V, glow?: boolean): THREE.Mesh;
  beam(a: V, b: V, color: string, width: number, alpha: number): THREE.Mesh;
  ring(x: number, y: number, radius: number, color: string, alpha: number, height?: number): THREE.Mesh;
}

const DASH_PALETTES: Record<string, [string, 'wing' | 'stone' | 'fire' | 'electric' | 'leaf' | 'sun' | 'shard']> = {
  renn_vault: ['#f4d195', 'wing'], renn_waltz: ['#ffdbb0', 'wing'], renn_rush: ['#f7bbda', 'wing'],
  kaolin_roll: ['#96d6ba', 'stone'], cinder_lunge: ['#fa9953', 'fire'], raijin_bolt: ['#70ddff', 'electric'],
  canopy_bound: ['#9be7a4', 'leaf'], solana_lance: ['#ffe18d', 'sun'], veyara_dash: ['#c5aeff', 'shard'],
  valerie_punch: ['#ff9dba', 'shard'], jaxon_leap: ['#8acafa', 'electric'], brewmaw_rush: ['#ddb1c2', 'stone'],
};

/** Short afterimages use the current dash direction, never a guessed future destination. */
export function drawDashDetail(p: DetailPainter, unit: AbilitySource, second: number) {
  const dash = unit.dash;
  if (!dash || dash.remaining <= 0 || unit.isAlive === false || dash.startX === undefined || dash.startY === undefined) return;
  const dx = unit.x - dash.startX, dy = unit.y - dash.startY, distance = Math.hypot(dx, dy);
  if (distance < 2) return;
  const [color, style] = DASH_PALETTES[dash.kind] ?? ['#a4d4ef', 'shard'];
  const nx = dx / distance, ny = dy / distance, trail = Math.min(distance, 76), angle = Math.atan2(dy, dx);
  for (let i = 1; i <= 4; i++) {
    const d = trail * i / 4, x = unit.x - nx * d, y = unit.y - ny * d, fade = (1 - i / 5) * .55;
    if (style === 'wing') {
      for (const side of [-1, 1]) {
        const feather = p.mesh('shard', color, fade, [x - ny * side * 12, 22 + i * 2, y + nx * side * 12], [3, 1.2, 13]);
        feather.rotation.set(.2, -angle + side * .7, .3);
      }
    } else if (style === 'stone' || style === 'leaf') {
      const piece = p.mesh('shard', color, fade, [x + ny * Math.sin(i * 3) * 9, 5 + (i % 2) * 6, y - nx * Math.sin(i * 3) * 9],
        style === 'stone' ? [4, 4, 4] : [5, 1, 9], style !== 'stone'); piece.rotation.set(i, second * 3, i * .7);
    } else if (style === 'fire') {
      const fire = p.mesh('flame', color, fade, [x, 11, y], [5, 17, 5]); fire.rotation.y = second * 3 + i;
    } else {
      const height = 22 + Math.sin(second * 18 + i * 3) * (style === 'electric' ? 8 : 2);
      p.beam([x, height, y], [x + nx * 11, height, y + ny * 11], color, style === 'sun' ? 2.3 : 1.4, fade);
      if (style === 'shard') {
        const streak = p.mesh('arc', color, fade, [x, 24, y], [8, 1, 13]); streak.rotation.set(.4, -angle, 0);
      }
    }
  }
}

/** The projectile's existing endpoint controls both chain and hook. Chain links are visual only. */
export function drawHookDetail(p: DetailPainter, x: number, y: number, size: number, angle: number,
  color: string, source?: { readonly x: number; readonly y: number }) {
  if (source) {
    const dx = x - source.x, dy = y - source.y, length = Math.hypot(dx, dy);
    // Bounded ornament density; the base tether always reaches the authoritative endpoint.
    p.beam([source.x, 29, source.y], [x, 27, y], '#65737c', .65, .7);
    const count = Math.min(22, Math.floor(length / 12));
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1), sag = Math.sin(t * Math.PI) * Math.min(9, length * .025);
      const link = p.mesh('chain', '#acbdc3', .72, [source.x + dx * t, 29 - t * 2 - sag, source.y + dy * t], [2.7, 1.55, 2.2]);
      link.rotation.set(i % 2 ? .8 : -.8, -angle, 0);
    }
  }
  const hook = p.mesh('hook', '#d3e1df', .95, [x, 27, y], [size * 1.5, size * 1.5, size * 1.5]);
  hook.rotation.set(0, -angle, 0);
  p.mesh('shard', color, .7, [x, 28, y], [size * .7, size * .7, size * .7]);
}

export function drawPrismFormation(p: DetailPainter, x: number, y: number, age: number, color: string, fade: number) {
  // Warden gameplay creation is immediate, even though its kit contains a .25s delay value.
  const assemble = Math.min(1, Math.max(0, age) / .35);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + age * 2, radius = 28 * (1 - assemble) + 7;
    const facet = p.mesh('shard', color, fade * .8, [x + Math.cos(a) * radius, 10 + assemble * 25, y + Math.sin(a) * radius], [3, 9, 3]);
    facet.rotation.set(.3, a, .2);
    p.beam([x + Math.cos(a) * radius, 7, y + Math.sin(a) * radius], [x, 34, y], color, .7, fade * .35);
  }
}

/** Named spells return false when the general family should handle them. */
export function drawSpellDetail(p: DetailPainter, spell: AbilitySpell, progress: number, second: number,
  fade: number, source?: AbilitySource): boolean {
  const {x, y, color} = spell, radius = Math.max(4, spell.radius), type = spell.type;
  if (type === 'death_mark') {
    for (const side of [-1, 1]) {
      p.beam([x - 13, 53 + side * 12, y], [x + 13, 53 - side * 12, y], color, 1.7, fade);
      const blade = p.mesh('shard', '#e7b5bd', fade * .85, [x + side * 15, 53 - side * 14, y], [3, 9, 1.5]); blade.rotation.z = side * -.75;
    }
    const orbit = p.mesh('arc', color, fade * .6, [x, 30, y], [radius * .65, 1, radius * .65]); orbit.rotation.y = second * 3;
    return true;
  }
  if (type === 'shallow_grave') {
    for (const side of [-1, 1]) {
      p.beam([x + side * 13, 3, y], [x + side * 13, 55, y], color, 1.6, fade * .75);
      p.beam([x + side * 13, 55, y], [x, 67, y], color, 1.6, fade * .75);
    }
    p.mesh('shard', '#f9e2fd', fade, [x, 60, y], [3, 7, 2]); return true;
  }
  if (type === 'spirit_bear') {
    // This event is Entangling Claws at the enemy, not the bear's actual summon location.
    for (let i = -1; i <= 1; i++) {
      const claw = p.mesh('arc', color, fade, [x + i * 10, 22 + i * 2, y], [radius * .55, 1, radius * .22]);
      claw.rotation.set(.9, progress * 3.5 + .4, -.4);
    }
    for (const side of [-1, 1]) {
      const root = p.mesh('root', '#739d62', fade, [x + side * 12, 12, y], [14, 25, 14]); root.rotation.y = second * .5 + side;
    }
    return true;
  }
  if (type === 'paxi_jaunt' || type === 'aether_remnant') {
    for (let i = 0; i < 2; i++) {
      const portal = p.mesh('arc', color, fade * .8, [x, 28, y], [radius * (.45 + i * .22), 1, radius * (.65 + i * .18)]);
      portal.rotation.set(Math.PI / 2, 0, second * (i ? -2 : 2));
    }
    if (type === 'aether_remnant') {
      p.mesh('ball', color, fade * .12, [x, 30, y], [10, 20, 7]);
      p.mesh('shard', '#e6d8ff', fade * .6, [x, 51, y], [5, 7, 5]);
    }
    return true;
  }
  if (type === 'black_hole') {
    p.mesh('ball', '#0d071a', .92 * fade, [x, 23, y], [radius * .24, radius * .24, radius * .24], false);
    for (let i = 0; i < 2; i++) {
      const band = p.mesh('arc', '#b7a1ed', fade * .6, [x, 20 + i * 6, y], [radius * (.46 + i * .25), 1, radius * (.46 + i * .25)]);
      band.rotation.set(.2 + i * .1, second * (i ? -1.6 : 2) + i * 2, .15);
    }
    for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 9; i++) {
      const t = i / 8, a = second * 1.6 + arm * Math.PI * 2 / 3 + t * 4.8, r = radius * (1 - t * .83);
      const shard = p.mesh('shard', color, fade * (.28 + t * .45), [x + Math.cos(a) * r, 9 + t * 16, y + Math.sin(a) * r], [3 - t, 1, 7 - t * 3]);
      shard.rotation.y = -a;
    }
    for (let i = 0; i < 5; i++) {
      const inward = (second * .45 + i / 5) % 1, a = i * 2.4 + second * 1.2, r = radius * (1 - inward * .86);
      const debris = p.mesh('shard', '#847195', fade * (1 - inward), [x + Math.cos(a) * r, 8 + inward * 20, y + Math.sin(a) * r], [4, 3, 4], false);
      debris.rotation.set(second + i, a, inward);
    }
    return true;
  }
  if (type === 'branch_court') {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, px = x + Math.cos(a) * radius * .86, py = y + Math.sin(a) * radius * .86;
      // Spectral guard motifs are spell decoration, never added units or collision bodies.
      p.beam([px, 5, py], [px, 43, py], '#aa8f63', 2.2, fade * .75);
      p.mesh('shard', color, fade * .7, [px, 48, py], [5, 6, 4]);
      const sweep = Math.sin(second * 5 + i) * 10;
      p.beam([px - Math.sin(a) * 16, 32 + sweep, py + Math.cos(a) * 16], [px + Math.sin(a) * 16, 32 - sweep, py - Math.cos(a) * 16], '#f5d989', 1.6, fade * .75);
    }
    return true;
  }
  if (type === 'cyclone_dance') {
    for (let i = 0; i < 3; i++) {
      const a = second * 8 + i * Math.PI * 2 / 3;
      const arc = p.mesh('arc', color, fade * .7, [x, 14 + i * 13, y], [radius * (.55 + i * .18), 1, radius * (.55 + i * .18)]);
      arc.rotation.set(.22, a, .25);
    }
    const a = second * 10;
    p.beam([x - Math.cos(a) * 38, 35, y - Math.sin(a) * 38], [x + Math.cos(a) * 38, 35, y + Math.sin(a) * 38], '#ffe1a0', 2, fade);
    return true;
  }
  if (type === 'broadside_channel' && source?.corsaraBarrage) {
    const direction = source.corsaraBarrage.facing === 'right' ? 1 : -1;
    for (let i = -2; i <= 2; i++) {
      const travel = (second * 210 + (i + 2) * 42) % 260, py = source.y + i / 2 * travel * .55;
      p.beam([source.x + direction * Math.max(0, travel - 26), 28, source.y + i / 2 * Math.max(0, travel - 26) * .55],
        [source.x + direction * travel, 28, py], color, 2.2, .7);
      p.mesh('shard', '#ffe7ad', .9, [source.x + direction * travel, 28, py], [3, 2, 2]);
    }
    const flash = .25 + Math.max(0, Math.sin(second * 25)) * .65;
    p.mesh('shard', '#ffe1ab', flash, [source.x + direction * 17, 31, source.y], [8, 5, 5]); return true;
  }
  return false;
}
