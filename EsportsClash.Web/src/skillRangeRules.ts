// src/skillRangeRules.ts
// Skill Cast Ranges & Chain Stun Rules for Esports Clash

import type { AramChampionUnit } from './types';

// Distance constant: 1 hex in bridge arena corresponds to ~45 pixels (melee combat range ~45-50px)
export const HEX_SIZE = 45;

export type SkillSlot = 'skill1' | 'skill2' | 'ultimate';

/**
 * Returns the authentic cast range in pixels for any champion's ability.
 * Close-range high-risk abilities (like Raijin's Electric Vortex) are strictly restricted
 * to 2-3 hexes (90-135px) so champions must close distance and expose themselves to danger.
 */
export function getSkillCastRange(champName: string, slot: SkillSlot, attackRange: number): number {
  switch (champName) {
    case 'Mirehook': return slot === 'skill1' ? 230 : slot === 'skill2' ? 90 : 75;
    case 'Nullweaver': return slot === 'skill1' ? 215 : slot === 'skill2' ? 190 : 220;
    case 'Voltgrip': return slot === 'skill1' ? 255 : slot === 'skill2' ? 75 : 135;
    case 'Aetherbolt': return slot === 'skill1' ? 250 : slot === 'skill2' ? 195 : 430;
    case 'Corsara': return slot === 'skill1' ? 205 : slot === 'skill2' ? 185 : 270;
    case 'Brewmaw': return slot === 'skill1' ? 195 : slot === 'skill2' ? 145 : 210;
    case 'Wraithhook': return slot === 'skill1' ? 245 : slot === 'skill2' ? 175 : 155;
    case 'Raijin':
      // Raijin has 165 basic attack range (~3.7 hexes).
      // Electric Vortex (Skill 2) is a game-changing pull tether and MUST have risk:
      // strictly restricted to 2 to 3 hexes (120px / 2.67 hexes)!
      if (slot === 'skill2') return 120; // 2.67 hexes (between 2 and 3 hexes)
      if (slot === 'skill1') return 110; // Static Remnant trap mine (close range, 2.4 hexes)
      return 320; // Ball Lightning supersonic zip (7.1 hexes)

    case 'Solana':
      if (slot === 'skill1') return 65; // Solar Shieldbash: Point-blank melee bash (1.4 hexes)
      if (slot === 'skill2') return 190; // Zenith Lance: Linear gap-closing spear (4.2 hexes)
      return 260; // Daybreak Flare: Orbital solar flare (5.8 hexes)

    case 'Astra':
      if (slot === 'skill1') return 195; // Volley Cone: Spread frost arrows (4.3 hexes)
      if (slot === 'skill2') return attackRange; // Frost Flurry: Attack speed buff
      return 550; // Enchanted Crystal Comet: Global lane arrow (12 hexes)

    case 'Buck':
      if (slot === 'skill1') return 125; // End of the Line: Explosive canister (2.8 hexes)
      if (slot === 'skill2') return 110; // Concussion Tackle / Smoke: Close-range tackle (2.4 hexes, 2-3 hexes risk!)
      return 220; // Heavy Artillery shell (4.9 hexes)

    case 'Sylla':
      if (slot === 'skill1') return 130; // Spirit Bear entangle
      if (slot === 'skill2') return 115; // Savage Roar: Point-blank fear roar (2.5 hexes, 2-3 hexes risk!)
      return 95; // True Form (close combat)

    case 'Kaolin':
      if (slot === 'skill1') return 75; // Boulder Smash: Melee stone smack (1.7 hexes)
      if (slot === 'skill2') return 220; // Rolling Boulder: Dash roll (4.9 hexes)
      return 130; // Magnetize: Close-range magnetic pulse (2.9 hexes)

    case 'Aurelius':
      if (slot === 'skill1') return 170; // Comet Spear: Linear thrust/throw (3.8 hexes)
      if (slot === 'skill2') return 135; // Shield Vault: Close-range leap stun (3 hexes)
      return 320; // Grand Starfall / Unstoppable Force (7.1 hexes)

    case 'Stonewake':
      if (slot === 'skill1') return 160; // Seismic Shard (3.5 hexes)
      if (slot === 'skill2') return 65; // Thunderclap melee slam (1.4 hexes)
      return 320; // Unstoppable Force avalanche dash (7.1 hexes)

    case 'Cora':
      if (slot === 'skill1') return 195; // Dark Binding snare (4.3 hexes)
      if (slot === 'skill2') return 180; // Tormented Shadow (4.0 hexes)
      return 160; // Soul Shackles tethers (3.5 hexes)

    case 'Kyumi':
      if (slot === 'skill1') return 175; // Spirit Orb (3.9 hexes)
      if (slot === 'skill2') return 145; // Foxfire Charm Catch (3.2 hexes)
      return 240; // Spirit Rush dashes (5.3 hexes)

    case 'Xin':
      if (slot === 'skill1') return 65; // Three Talon Strike melee knockup (1.4 hexes)
      if (slot === 'skill2') return 150; // Wind Becomes Lightning thrust (3.3 hexes)
      return 100; // Crescent Guard sweep (2.2 hexes)

    case 'Kage':
      if (slot === 'skill1') return 175; // Razor Shuriken (3.9 hexes)
      if (slot === 'skill2') return 75; // Shadow Slash melee cut (1.7 hexes)
      return 180; // Death Mark shadow dash (4.0 hexes)

    case 'Kazemaru':
      if (slot === 'skill1') return 95; // Steel Tempest thrust (2.1 hexes)
      if (slot === 'skill2') return 120; // Wind Wall (2.7 hexes)
      return 240; // Last Breath airborne strike (5.3 hexes)

    case 'Solenne':
      if (slot === 'skill1') return 215; // Light Binding (4.8 hexes)
      if (slot === 'skill2') return 200; // Prismatic Barrier (4.4 hexes)
      return 420; // Final Spark giant solar laser (9.3 hexes)

    case 'Balthazar':
      if (slot === 'skill1') return 240; // Rocket Grab hook pull (5.3 hexes)
      if (slot === 'skill2') return 60; // Power Fist melee knockup (1.3 hexes)
      return 140; // Static Field radial EMP (3.1 hexes)

    case 'Croakwell':
      if (slot === 'skill1') return 135; // Tongue Lash whip (3.0 hexes)
      if (slot === 'skill2') return 220; // Abyssal Dive (4.9 hexes)
      return 75; // Devour point-blank swallow (1.7 hexes)

    case 'Renn':
      if (slot === 'skill1') return 160; // Gleaming Quill (3.5 hexes)
      if (slot === 'skill2') return 170; // Grand Entrance dash knockup (3.8 hexes)
      return 120; // The Quickness charm dash (2.7 hexes)

    case 'Valkira':
      if (slot === 'skill1') return 165; // Crescent Strike (3.7 hexes)
      if (slot === 'skill2') return 180; // Lunar Rush (4.0 hexes)
      return 115; // Moonfall close-range pull (2.5 hexes)

    default:
      // Default heuristic: melee skills stay close, ranged skills scale off basic attack range
      if (slot === 'ultimate') return Math.max(attackRange * 1.4, 250);
      if (slot === 'skill1') return Math.max(attackRange, 120);
      return Math.max(attackRange, 110);
  }
}

/**
 * Checks whether a given ability applies Crowd Control (stun, root, tether pull, charm, fear, knockup).
 */
export function isCrowdControlSkill(champName: string, slot: SkillSlot): boolean {
  switch (champName) {
    case 'Mirehook': case 'Voltgrip': case 'Wraithhook': return true;
    case 'Nullweaver': return slot === 'skill1' || slot === 'ultimate';
    case 'Brewmaw': return slot !== 'skill1';
    case 'Corsara': return slot === 'skill2';
    case 'Raijin': return slot === 'skill2'; // Electric Vortex (Stun & Pull)
    case 'Solana': return slot === 'skill1' || slot === 'skill2' || slot === 'ultimate'; // Shieldbash, Zenith, Flare
    case 'Astra': return slot === 'ultimate'; // Crystal Comet
    case 'Kyumi': return slot === 'skill2'; // Foxfire Charm
    case 'Buck': return slot === 'skill2'; // Concussion Tackle
    case 'Sylla': return slot === 'skill2'; // Savage Roar Fear
    case 'Cora': return slot === 'skill1' || slot === 'ultimate'; // Dark Binding, Soul Shackles
    case 'Kaolin': return slot === 'skill1' || slot === 'ultimate'; // Boulder Smash, Magnetize
    case 'Aurelius': return slot === 'skill2' || slot === 'ultimate'; // Shield Vault, Grand Starfall
    case 'Stonewake': return slot === 'ultimate'; // Unstoppable Force
    case 'Xin': return slot === 'skill1'; // Three-Talon Knockup
    case 'Kazemaru': return slot === 'ultimate'; // Last Breath
    case 'Balthazar': return slot === 'skill1' || slot === 'skill2'; // Rocket Grab, Power Fist
    case 'Croakwell': return slot === 'skill1' || slot === 'ultimate'; // Tongue Lash, Devour
    case 'Renn': return slot === 'skill2' || slot === 'ultimate'; // Grand Entrance, Quickness
    case 'Valkira': return slot === 'ultimate'; // Moonfall
    default: return false;
  }
}

/**
 * Returns the base CC duration for a crowd control skill.
 */
export function getSkillCrowdControlDuration(champName: string, slot: SkillSlot): number {
  switch (champName) {
    case 'Raijin': return slot === 'skill2' ? 1.4 : 0;
    case 'Solana': return slot === 'skill1' ? 1.2 : slot === 'skill2' ? 0.8 : 2.0;
    case 'Astra': return slot === 'ultimate' ? 2.5 : 0;
    case 'Kyumi': return slot === 'skill2' ? 1.2 : 0;
    case 'Buck': return slot === 'skill2' ? 0.9 : 0;
    case 'Sylla': return slot === 'skill2' ? 1.4 : 0;
    case 'Cora': return slot === 'skill1' ? 1.5 : slot === 'ultimate' ? 1.8 : 0;
    case 'Kaolin': return slot === 'skill1' ? 1.2 : slot === 'ultimate' ? 1.5 : 0;
    case 'Aurelius': return slot === 'skill2' ? 1.0 : slot === 'ultimate' ? 1.5 : 0;
    case 'Stonewake': return slot === 'ultimate' ? 1.8 : 0;
    case 'Xin': return slot === 'skill1' ? 0.9 : 0;
    case 'Balthazar': return slot === 'skill1' ? 1.0 : slot === 'skill2' ? 0.9 : 0;
    case 'Croakwell': return slot === 'skill1' ? 1.1 : slot === 'ultimate' ? 1.5 : 0;
    case 'Renn': return slot === 'skill2' ? 1.0 : slot === 'ultimate' ? 1.2 : 0;
    case 'Valkira': return slot === 'ultimate' ? 1.2 : 0;
    default: return 0.8;
  }
}

/**
 * Decision logic for CC Layering / Chain Stuns:
 * High IQ and high team chemistry players track remaining CC on the target.
 * If the target has significant CC remaining (> 0.35s), high-IQ players HOLD their CC skill
 * to avoid wasteful overlap. Once remaining CC drops <= 0.35s, they fire immediately to chain CC!
 * Low-IQ / low-chemistry players panic and fire immediately, wasting duration.
 */
export function shouldHoldSkillForChainStun(
  casterIq: number,
  casterTf: number,
  teamChemistry: number,
  targetStunTimer: number,
  isCcSkill: boolean
): boolean {
  if (!isCcSkill || targetStunTimer <= 0) return false;

  // Coordination score: combines individual decision IQ, teamfight execution, and coach/team chemistry
  const coordination = casterIq * 0.45 + casterTf * 0.35 + teamChemistry * 1.5;

  // If player and team are coordinated (score >= 58), they hold CC if target is already locked down
  if (coordination >= 58) {
    // Hold while target has more than 0.35s stun remaining; fire when stun is about to expire!
    return targetStunTimer > 0.35;
  }

  // Low IQ / low chemistry teams do not hold; they overlap and waste CC
  return false;
}

/**
 * Applies crowd control, checking for a successful Chain Stun.
 * If a target is already under CC or recovering (<= 0.35s), a coordinated caster chains
 * the CC, extending the duration rather than overwriting it!
 */
export function applyChainStun(
  currentStunTimer: number,
  newDuration: number,
  casterIq: number,
  casterTf: number,
  teamChemistry: number
): { isChainStun: boolean; finalDuration: number } {
  const coordination = casterIq * 0.45 + casterTf * 0.35 + teamChemistry * 1.5;
  const isTargetAlreadyCc = currentStunTimer > 0;

  if (isTargetAlreadyCc && coordination >= 52) {
    // High IQ & Chemistry: Layer the stun seamlessly (capped at 3.5s max total lockdown)
    const chained = Math.min(3.5, currentStunTimer + newDuration);
    return { isChainStun: true, finalDuration: chained };
  }

  // Low coordination: overlaps or resets, wasting the overlap window
  const uncoordinated = Math.max(currentStunTimer, newDuration);
  return { isChainStun: false, finalDuration: uncoordinated };
}
