import type { LiveDefenseSetup, LiveTacticArchetype } from './fpsLiveTactics.ts';

/**
 * Data-driven plays. Every tactical branch that used to test an archetype or setup name reads a
 * field here instead. The seven archetypes and six defense setups are the seed plays and reproduce
 * the previous behaviour exactly (each field is the constant the old branch used); learned variants
 * change only these bounded fields, so every play stays executable with the map's authored routes,
 * holds and lineups. Plays change decisions only, never aim, spread, damage or reaction.
 *
 * Thresholds compare against the round's seeded `roundVariant` in [0, 1).
 */
export interface LiveAttackPlay {
  id:string;name:string;
  /** Formation template this play descends from (also what history/telemetry record). */
  family:LiveTacticArchetype;
  /** Target site; 'any' picks one at random at round start. */
  site:'A'|'B'|'any';
  /** Sell the other site first (opening smoke/flash/noise there). */
  fake:boolean;
  /** roundVariant below this: fast rush (skip opening utility, early commit). */
  rushBelow:number;
  /** roundVariant below this: a rush sends only one execute smoke. */
  rushSmokeBelow:number;
  /** roundVariant below this: open through Mid instead of the site lane. */
  midOpenBelow:number;
  /** roundVariant above this (with 2+ teammates on a lane): a default pick also probes Mid. */
  defaultMidAbove:number;
  /** roundVariant below this: the opening goes to the fake site. */
  fakeOpenBelow:number;
  /** roundVariant at/above this: the fake also smokes the fake choke. */
  fakeSmokeAbove:number;
  /** roundVariant below this: the lurker holds its lane during the utility phase. */
  lurkerHoldBelow:number;
  /** Seconds into the live round during which the fake is sold. */
  fakeWindow:number;
  /** Selection weight multiplier on pistol rounds. */
  pistolWeight:number;
}

export interface LiveDefensePlay {
  id:string;name:string;family:LiveDefenseSetup;
  /** Site stacked by the first `stackSlots` slots; undefined spreads 3 A / 2 B. */
  stack?:'A'|'B';stackSlots:number;
  /** CT flex holds the Mid window at the start. */
  flexMid:boolean;
  /** CT flex counts as a Mid holder in the opening orientation (includes Mid pushes). */
  flexMidOrientation:boolean;
  /** B anchor plays the apartment/gallery hold. */
  anchorGallery:boolean;
  /** Spillway rotator holds Control Deck heaven (and is homed to B when not stacking). */
  rotatorDeck:boolean;
  /** Slots 3-4 take an early aggressive lane pair (with an early HE). */
  aggressivePair:boolean;
  /** Slots 2 and 4 take a brief Mid/underpass push. */
  midPushPair:boolean;
  /** roundVariant below this: hold without opening utility. */
  quietOpenBelow:number;
  /** roundVariant below this: the Mid pushers really go Mid. */
  midPushBelow:number;
}

const ATTACK_DEFAULTS={fake:false,rushBelow:0,rushSmokeBelow:0,midOpenBelow:0,defaultMidAbove:2,fakeOpenBelow:0,fakeSmokeAbove:2,lurkerHoldBelow:.65,fakeWindow:26,pistolWeight:1};
/** Seed plays: exactly the constants the archetype branches used. */
export const LIVE_SEED_ATTACK_PLAYS:Readonly<Record<LiveTacticArchetype,LiveAttackPlay>>=Object.freeze({
  rush_a:{...ATTACK_DEFAULTS,id:'seed:rush_a',name:'Rush A',family:'rush_a',site:'A',rushBelow:.55,rushSmokeBelow:.45,lurkerHoldBelow:0,pistolWeight:2},
  rush_b:{...ATTACK_DEFAULTS,id:'seed:rush_b',name:'Rush B',family:'rush_b',site:'B',rushBelow:.55,rushSmokeBelow:.45,lurkerHoldBelow:0,pistolWeight:2},
  default_pick:{...ATTACK_DEFAULTS,id:'seed:default_pick',name:'Default pick',family:'default_pick',site:'any',defaultMidAbove:.78},
  split_a:{...ATTACK_DEFAULTS,id:'seed:split_a',name:'Split A',family:'split_a',site:'A',midOpenBelow:.6},
  split_b:{...ATTACK_DEFAULTS,id:'seed:split_b',name:'Split B',family:'split_b',site:'B',midOpenBelow:.6},
  fake_execute:{...ATTACK_DEFAULTS,id:'seed:fake_execute',name:'Fake execute',family:'fake_execute',site:'any',fake:true,fakeOpenBelow:.65,fakeSmokeAbove:.65},
  mid_control:{...ATTACK_DEFAULTS,id:'seed:mid_control',name:'Mid control',family:'mid_control',site:'any',midOpenBelow:1},
});
const DEFENSE_DEFAULTS={stackSlots:4,flexMid:false,flexMidOrientation:false,anchorGallery:false,rotatorDeck:false,aggressivePair:false,midPushPair:false,quietOpenBelow:0,midPushBelow:0};
export const LIVE_SEED_DEFENSE_PLAYS:Readonly<Record<LiveDefenseSetup,LiveDefensePlay>>=Object.freeze({
  standard:{...DEFENSE_DEFAULTS,id:'seed:standard',name:'Standard',family:'standard',flexMid:true,flexMidOrientation:true,anchorGallery:true,rotatorDeck:true,quietOpenBelow:.28},
  stack_a:{...DEFENSE_DEFAULTS,id:'seed:stack_a',name:'Stack A',family:'stack_a',stack:'A'},
  stack_b:{...DEFENSE_DEFAULTS,id:'seed:stack_b',name:'Stack B',family:'stack_b',stack:'B',anchorGallery:true},
  aggressive_banana:{...DEFENSE_DEFAULTS,id:'seed:aggressive_banana',name:'Aggressive lane',family:'aggressive_banana',aggressivePair:true},
  mid_push:{...DEFENSE_DEFAULTS,id:'seed:mid_push',name:'Mid push',family:'mid_push',flexMidOrientation:true,midPushPair:true,midPushBelow:.55},
  retake_setup:{...DEFENSE_DEFAULTS,id:'seed:retake_setup',name:'Retake setup',family:'retake_setup',flexMid:true,flexMidOrientation:true,rotatorDeck:true},
});
export const liveSeedAttackPlay=(family:LiveTacticArchetype):LiveAttackPlay=>({...LIVE_SEED_ATTACK_PLAYS[family]});
export const liveSeedDefensePlay=(family:LiveDefenseSetup):LiveDefensePlay=>({...LIVE_SEED_DEFENSE_PLAYS[family]});
