import type {LiveGrenadeKind} from './fpsLiveGrenades.ts';

/**
 * Why a grenade is thrown. Utility exists to accomplish a tactical intention, not to be consumed:
 * each throw records the objective it serves, one primary purpose and any secondary purposes, and is
 * judged afterwards against that purpose (docs/fps-utility-purposes-20261117.md, owner reference).
 * Purposes are descriptive and decision-side only; they never change aim, spread, damage or reaction.
 */
export type FpsUtilityPurpose =
  // Control
  | 'VISION_DENIAL' | 'AREA_DENIAL' | 'MAP_CONTROL' | 'CHOKE_CONTROL' | 'TERRITORY_RECOVERY'
  // Protection
  | 'CROSSING_PROTECTION' | 'ENTRY_SUPPORT' | 'TEAMMATE_PROTECTION' | 'RETREAT_PROTECTION' | 'ANTI_AWP' | 'ANTI_RUSH' | 'ANTI_AGGRESSION' | 'ANTI_ECO'
  // Combat
  | 'ENEMY_BLINDING' | 'ENEMY_DISPLACEMENT' | 'ENEMY_DAMAGE' | 'ENEMY_FINISHING' | 'ENEMY_ISOLATION' | 'CROSSFIRE_DISRUPTION' | 'TRADE_DENIAL' | 'ENGAGEMENT_PREPARATION'
  // Information
  | 'INFORMATION_GATHERING' | 'INFORMATION_DENIAL' | 'DECEPTION' | 'DISTRACTION' | 'REACTION_TESTING' | 'ROTATION_MANIPULATION'
  // Timing
  | 'DELAY' | 'TEMPO_DISRUPTION' | 'TIMING_ADVANTAGE' | 'REINFORCEMENT_DENIAL' | 'ROTATION_PROTECTION'
  // Objective
  | 'EXECUTE_SUPPORT' | 'RETAKE_SUPPORT' | 'PLANT_PROTECTION' | 'PLANT_DENIAL' | 'DEFUSE_PROTECTION' | 'DEFUSE_DENIAL' | 'BOMB_RECOVERY' | 'BOMB_RECOVERY_DENIAL' | 'POST_PLANT_CONTROL'
  // Counter-utility
  | 'SMOKE_CLEARING' | 'FIRE_EXTINGUISHING' | 'UTILITY_BAITING' | 'UTILITY_EXHAUSTION'
  // Economy
  | 'EQUIPMENT_RECOVERY' | 'EQUIPMENT_DENIAL' | 'SAVE_PROTECTION' | 'HUNT_SUPPORT';

/** Round phases from the reference's side/phase tables (T and CT share the names that apply to them). */
export type FpsUtilityRoundPhase = 'opening' | 'default' | 'mid-round' | 'pre-execute' | 'execute' | 'post-plant' | 'retake' | 'clutch' | 'save' | 'post-round';

export interface FpsUtilityIntent {
  grenade: LiveGrenadeKind;
  objective: string;
  primary: FpsUtilityPurpose;
  secondary: FpsUtilityPurpose[];
  phase: FpsUtilityRoundPhase;
}

/** What the thrower lawfully knows when deciding to throw (own team's information only). */
export interface FpsUtilityThrowContext {
  kind: LiveGrenadeKind;
  attacking: boolean;
  phase: FpsUtilityRoundPhase;
  /** The planned smoke this throw belongs to, if any. */
  plannedSmoke?: 'opening' | 'execute' | 'control';
  /** A believed (seen/reported) enemy within a few metres of the target. */
  enemyAtTarget: boolean;
  sniperAtTarget: boolean;
  lowHpEnemyAtTarget: boolean;
  /** A teammate is about to take a fight through/near the target. */
  teammateEngaging: boolean;
  retreating: boolean;
  fireAtTarget: boolean;
  enemySmokeAtTarget: boolean;
  bombNearTarget: boolean;
  /** Heard or seen: an opponent working the device (plant or defuse). */
  opponentOnObjective: boolean;
  /** This team is working the device near the target. */
  ownTeamOnObjective: boolean;
  wonRound?: boolean;
}

const intent = (ctx: FpsUtilityThrowContext, objective: string, primary: FpsUtilityPurpose, ...secondary: (FpsUtilityPurpose | false)[]): FpsUtilityIntent =>
  ({grenade: ctx.kind, objective, primary, secondary: [...new Set(secondary.filter((s): s is FpsUtilityPurpose => !!s && s !== primary))], phase: ctx.phase});

/** Read the purpose of a throw from the situation that produced it. A grenade may serve several purposes. */
export function classifyFpsUtilityThrow(ctx: FpsUtilityThrowContext): FpsUtilityIntent {
  const {kind, attacking: t} = ctx;
  if (ctx.phase === 'post-round') {
    return ctx.wonRound ? intent(ctx, 'Punish players saving equipment', 'HUNT_SUPPORT', kind === 'he' && 'ENEMY_DAMAGE')
      : intent(ctx, 'Preserve equipment for the next round', 'SAVE_PROTECTION', kind === 'smoke' ? 'VISION_DENIAL' : kind === 'flash' && 'ENEMY_BLINDING');
  }
  if (kind === 'smoke') {
    if (ctx.fireAtTarget) return intent(ctx, 'Put out the fire blocking the route', 'FIRE_EXTINGUISHING', 'TERRITORY_RECOVERY');
    if (ctx.retreating) return intent(ctx, 'Break sight while falling back', 'RETREAT_PROTECTION', 'VISION_DENIAL');
    if (ctx.phase === 'post-plant' && ctx.bombNearTarget) return t ? intent(ctx, 'Hide the device and split the retake', 'POST_PLANT_CONTROL', 'INFORMATION_DENIAL', 'ENEMY_ISOLATION')
      : intent(ctx, 'Cover the defuse', ctx.ownTeamOnObjective ? 'DEFUSE_PROTECTION' : 'RETAKE_SUPPORT', 'VISION_DENIAL');
    if (ctx.phase === 'retake') return intent(ctx, 'Isolate post-plant positions for the retake', 'RETAKE_SUPPORT', 'ENEMY_ISOLATION', 'CROSSFIRE_DISRUPTION');
    if (t && ctx.ownTeamOnObjective) return intent(ctx, 'Conceal the plant', 'PLANT_PROTECTION', 'VISION_DENIAL');
    if (ctx.plannedSmoke === 'execute') return intent(ctx, 'Block defensive positions for the site hit', 'EXECUTE_SUPPORT', 'VISION_DENIAL', ctx.sniperAtTarget && 'ANTI_AWP', 'CROSSFIRE_DISRUPTION', 'REINFORCEMENT_DENIAL');
    if (ctx.plannedSmoke === 'opening') return t ? intent(ctx, 'Take early map control without an opening pick', 'MAP_CONTROL', 'CROSSING_PROTECTION', ctx.sniperAtTarget && 'ANTI_AWP', 'VISION_DENIAL')
      : intent(ctx, 'Discourage an early push through the choke', 'ANTI_RUSH', 'VISION_DENIAL', 'DELAY', 'CHOKE_CONTROL', 'INFORMATION_DENIAL');
    if (ctx.plannedSmoke === 'control') return t ? intent(ctx, 'Cross the contested lane', 'CROSSING_PROTECTION', 'MAP_CONTROL', 'VISION_DENIAL')
      : intent(ctx, 'Stall the push through the middle', 'DELAY', 'ANTI_RUSH', 'VISION_DENIAL', 'CHOKE_CONTROL');
    if (ctx.sniperAtTarget) return intent(ctx, 'Take the sniper\'s angle away', 'ANTI_AWP', 'VISION_DENIAL', 'CROSSING_PROTECTION');
    if (ctx.enemyAtTarget) return t ? intent(ctx, 'Cut a defender off from support', 'ENEMY_ISOLATION', 'VISION_DENIAL', 'CROSSFIRE_DISRUPTION')
      : intent(ctx, 'Buy time until help arrives', 'DELAY', 'VISION_DENIAL', 'ANTI_RUSH');
    return intent(ctx, 'Deny sight of the area', 'VISION_DENIAL', t ? 'CROSSING_PROTECTION' : 'INFORMATION_DENIAL');
  }
  if (kind === 'flash') {
    if (ctx.retreating) return intent(ctx, 'Blind pursuers while disengaging', 'RETREAT_PROTECTION', 'ENEMY_BLINDING');
    if (ctx.phase === 'post-plant' && t && ctx.opponentOnObjective) return intent(ctx, 'Stop the defuse', 'DEFUSE_DENIAL', 'ENEMY_BLINDING');
    if (ctx.phase === 'retake' || (ctx.phase === 'post-plant' && !t)) return intent(ctx, 'Blind post-plant positions for the retake', 'RETAKE_SUPPORT', 'ENEMY_BLINDING', ctx.teammateEngaging && 'ENTRY_SUPPORT');
    if (t && (ctx.phase === 'execute' || ctx.phase === 'pre-execute')) return intent(ctx, 'Blind the site for the entry', 'EXECUTE_SUPPORT', 'ENTRY_SUPPORT', 'ENEMY_BLINDING');
    if (ctx.sniperAtTarget) return intent(ctx, 'Blind the sniper to cross or challenge', 'ANTI_AWP', 'ENEMY_BLINDING', 'CROSSING_PROTECTION');
    if (ctx.teammateEngaging) return intent(ctx, 'Set up a teammate\'s peek', 'ENTRY_SUPPORT', 'ENEMY_BLINDING', 'ENGAGEMENT_PREPARATION');
    if (!t && ctx.enemyAtTarget && (ctx.phase === 'opening' || ctx.phase === 'default')) return intent(ctx, 'Blind the early push', 'ANTI_RUSH', 'ENEMY_BLINDING', 'DELAY');
    if (ctx.enemyAtTarget) return intent(ctx, 'Win the next duel against a blinded enemy', 'ENEMY_BLINDING', 'ENGAGEMENT_PREPARATION');
    return intent(ctx, 'Peek for information behind a flash', 'INFORMATION_GATHERING', 'ENEMY_BLINDING');
  }
  if (kind === 'incendiary') {
    if (ctx.phase === 'post-plant' && t && (ctx.opponentOnObjective || ctx.bombNearTarget)) return intent(ctx, 'Deny the defuse', 'DEFUSE_DENIAL', 'AREA_DENIAL', 'DELAY');
    if (ctx.phase === 'retake' || (ctx.phase === 'post-plant' && !t)) return intent(ctx, 'Burn attackers out of post-plant spots', 'RETAKE_SUPPORT', 'ENEMY_DISPLACEMENT', 'AREA_DENIAL');
    if (!t && ctx.opponentOnObjective) return intent(ctx, 'Burn the plant spot', 'PLANT_DENIAL', 'AREA_DENIAL');
    if (ctx.retreating) return intent(ctx, 'Burn the chase route', 'RETREAT_PROTECTION', 'AREA_DENIAL');
    if (t && (ctx.phase === 'execute' || ctx.phase === 'pre-execute')) return intent(ctx, 'Clear defenders out of site positions', 'EXECUTE_SUPPORT', 'ENEMY_DISPLACEMENT', 'AREA_DENIAL');
    if (!t && (ctx.phase === 'opening' || ctx.enemyAtTarget)) return intent(ctx, 'Make the choke costly to cross', 'ANTI_RUSH', 'DELAY', 'AREA_DENIAL', 'CHOKE_CONTROL');
    if (ctx.enemyAtTarget) return intent(ctx, 'Force a hidden enemy out of position', 'ENEMY_DISPLACEMENT', 'AREA_DENIAL', 'ENEMY_DAMAGE');
    return intent(ctx, 'Deny the area', 'AREA_DENIAL', 'DELAY');
  }
  // HE
  if (ctx.enemySmokeAtTarget) return intent(ctx, 'Open a window through the smoke', 'SMOKE_CLEARING', ctx.enemyAtTarget && 'ENEMY_DAMAGE');
  if (ctx.lowHpEnemyAtTarget) return intent(ctx, 'Finish a weakened enemy', 'ENEMY_FINISHING', 'ENEMY_DAMAGE');
  if (ctx.phase === 'post-plant' && t && ctx.opponentOnObjective) return intent(ctx, 'Damage the defuser', 'DEFUSE_DENIAL', 'ENEMY_DAMAGE');
  if (!t && ctx.opponentOnObjective) return intent(ctx, 'Damage the planter', 'PLANT_DENIAL', 'ENEMY_DAMAGE');
  if (t && (ctx.phase === 'execute' || ctx.phase === 'pre-execute')) return intent(ctx, 'Weaken defenders before the entry', 'EXECUTE_SUPPORT', 'ENEMY_DAMAGE', 'ENGAGEMENT_PREPARATION');
  if (!t && ctx.phase === 'opening' && ctx.enemyAtTarget) return intent(ctx, 'Punish the grouped rush', 'ANTI_RUSH', 'ENEMY_DAMAGE');
  if (ctx.enemyAtTarget) return intent(ctx, 'Soften the enemy before the duel', 'ENEMY_DAMAGE', 'ENGAGEMENT_PREPARATION');
  return intent(ctx, 'Damage an expected position', 'ENEMY_DAMAGE');
}

/** Judging a throw against its purpose once it has gone off (the reference's outcome evaluation). */
export interface FpsUtilityOutcome {
  /** Metres from where it was meant to land (smokes and fire) when known. */
  landingError?: number;
  enemiesBlinded?: number;
  alliesBlinded?: number;
  enemiesTurnedAway?: number;
  enemiesDisplaced?: number;
  enemyDamage?: number;
  allyDamage?: number;
  ignited?: boolean;
  smokesDisturbed?: number;
  /** A teammate damaged an opponent while that opponent was blinded by this flash. */
  teammateUsedOpening?: boolean;
  /** Whether the throw achieved what its purpose needs. */
  achieved: boolean;
}

export function judgeFpsUtilityOutcome(intent: FpsUtilityIntent, o: Omit<FpsUtilityOutcome, 'achieved'>): FpsUtilityOutcome {
  let achieved: boolean;
  switch (intent.grenade) {
    case 'smoke': achieved = (o.landingError ?? 0) <= 3.8; break;
    case 'flash': achieved = (o.enemiesBlinded ?? 0) > 0 || (o.enemiesTurnedAway ?? 0) > 0 || ((intent.primary === 'RETREAT_PROTECTION' || intent.primary === 'INFORMATION_GATHERING') && (o.enemiesDisplaced ?? 0) > 0 && (o.alliesBlinded ?? 0) === 0 && (o.landingError ?? 0) <= 3.0); break;
    case 'incendiary': achieved = !!o.ignited && (o.landingError ?? 0) <= 3.5; break;
    default: achieved = intent.primary === 'SMOKE_CLEARING'
      ? (o.smokesDisturbed ?? 0) > 0
      : (o.enemyDamage ?? 0) >= 12 || (o.enemiesDisplaced ?? 0) > 0;
  }
  if ((o.alliesBlinded ?? 0) > 0 && intent.grenade === 'flash' && !(o.enemiesBlinded ?? 0) && !(o.enemiesTurnedAway ?? 0)) achieved = false;
  return {...o, achieved};
}

export const FPS_UTILITY_PURPOSE_LABELS: Partial<Record<FpsUtilityPurpose, string>> = {
  ANTI_AWP: 'anti-AWP', ANTI_RUSH: 'anti-rush', EXECUTE_SUPPORT: 'execute', RETAKE_SUPPORT: 'retake', CROSSING_PROTECTION: 'crossing',
  MAP_CONTROL: 'map control', DELAY: 'delay', ENTRY_SUPPORT: 'entry', RETREAT_PROTECTION: 'retreat', POST_PLANT_CONTROL: 'post-plant',
  DEFUSE_DENIAL: 'defuse denial', DEFUSE_PROTECTION: 'defuse cover', PLANT_PROTECTION: 'plant cover', PLANT_DENIAL: 'plant denial',
  SMOKE_CLEARING: 'smoke clear', FIRE_EXTINGUISHING: 'extinguish', ENEMY_FINISHING: 'finishing', ENEMY_ISOLATION: 'isolation',
  SAVE_PROTECTION: 'save', HUNT_SUPPORT: 'hunt', INFORMATION_GATHERING: 'info', ENEMY_BLINDING: 'blind', ENEMY_DAMAGE: 'damage',
  ENEMY_DISPLACEMENT: 'displace', AREA_DENIAL: 'area denial', VISION_DENIAL: 'vision denial',
};
