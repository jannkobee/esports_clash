import type { ChampionKit, ChampionSkill } from './types';
import { CAST_TYPE_DETAILS, CAST_TYPE_LABELS, getAbilityCastType, type CastSlot } from './abilityCastTypes.ts';
import { getAbilityRatios, skill1ManaCost, ultimateManaCost } from './abilityRules.ts';
import { abilityCooldownMultiplier, abilityDamageMultiplier, LEVEL_CAP } from './skillProgression.ts';
import { getSkillCastRange, getSkillCrowdControlDuration, isCrowdControlSkill } from './skillRangeRules.ts';

export type AbilityDisplaySlot = 'skill1' | 'skill2' | 'ultimate';
export type AbilityMovementKind = 'Dash' | 'Leap' | 'Roll' | 'Teleport' | 'Charge' | 'Forced Movement';

export interface AbilityMovementPresentation {
  kind: AbilityMovementKind;
  distance: number;
  duration: number;
  detail: string;
}

export interface AbilityPresentation {
  slot: AbilityDisplaySlot;
  key: string;
  name: string;
  shortDescription: string;
  detailedDescription: string;
  castType: string;
  castTypeDetail: string;
  range: number;
  geometry: string;
  damage?: { type: ChampionSkill['damageType']; base: number; atRank: number; adPercent: number; apPercent: number };
  cooldown: number;
  manaCost: number;
  rank: number;
  maxRank: number;
  crowdControl?: { duration: number; detail: string };
  movement?: AbilityMovementPresentation;
  visualDescription?:string;
  counterplay?:string;
}

const motion = (kind: AbilityMovementKind, distance: number, duration: number, detail: string): AbilityMovementPresentation =>
  ({ kind, distance, duration, detail });

// This registry intentionally names only authored movement states. A missing
// entry means the ability has no independently simulated caster movement.
const MOVEMENT_PRESENTATION: Record<string, AbilityMovementPresentation> = {
  'Renn:skill1': motion('Leap', 270, .75, 'Travels visibly and stops on enemy contact.'),
  'Renn:skill2': motion('Dash', 247, .65, 'Dashes to the selected nearby ally while shielding.'),
  'Renn:ultimate': motion('Dash', 418, 1.1, 'Rushes through enemies and records each hit once.'),
  'Solana:skill2': motion('Dash', 288, .72, 'Zenith Lance travels visibly and stuns only when the dash reaches its valid endpoint.'),
  'Kaolin:skill2': motion('Roll', 292, .8, 'Rolls over simulation time and stops on the first enemy collision.'),
  'Cinderlock:skill1': motion('Dash', 280, .7, 'The opening-stage lunge travels to a valid target over time before its ignite and finisher stages.'),
  'Cinderbloom:skill1': motion('Dash', 280, .7, 'The opening-stage lunge travels to a valid target over time before its ignite and finisher stages.'),
  'Raijin:ultimate': motion('Dash', 320, .75, 'Transforms into a visible lightning ball, travels to the legal ground destination and reforms at the actual stopping point. Each enemy can be hit once.'),
  'Stonebranch:skill2': motion('Leap', 315, .9, 'Canopy Bound travels over time and lands with its authored area impact.'),
  'Paxi:skill1': motion('Teleport', 700, 0, 'Illusory Orb travels first; the later Jaunt relocation is a genuine teleport.'),
  'Inai:skill2': motion('Teleport', 0, 0, 'The authored void relocation resolves instantly at the legal target position.'),
  'Kage:skill2': motion('Teleport', 0, 0, 'The authored shadow relocation resolves instantly at the legal target position.'),
  'Veyara:skill2': motion('Dash', 273, .7, 'Facet Dash travels visibly to a valid target and strikes on arrival.'),
  'Valerie:skill1': motion('Charge', 250, .65, 'Vault Breaker Punch travels visibly and lands its knock-up and damage on contact.'),
  'Jaxon:skill2': motion('Leap', 250, .65, 'Thundering Leap travels visibly and resolves its ground impact on contact.'),
  'Brewmaw:skill2': motion('Dash', 198, .55, 'Barrel Rush travels visibly and resolves its knock-up and damage on contact.'),
  'Aetherbolt:skill2': motion('Teleport', 74, 0, 'Phase Skip is an authored instant sidestep, not a simulated dash.'),
  'Raijin:skill2': motion('Forced Movement', 0, 1.4, 'Electric Vortex pulls the tethered target over its active duration.'),
  'Mirehook:skill1': motion('Forced Movement', 0, 1.1, 'The hook pull moves its struck target toward the caster over time.'),
  'Voltgrip:skill1': motion('Forced Movement', 0, 1.1, 'The hook pull moves its struck target toward the caster over time.'),
  'Wraithhook:skill1': motion('Forced Movement', 0, 1.1, 'The hook pull moves its struck target toward the caster over time.'),
};

const presentationCache = new Map<string, AbilityPresentation>();

const geometryFor = (castType: ReturnType<typeof getAbilityCastType>) => {
  if (castType === 'unit') return 'Unit-targeted effect; the target must remain eligible at resolution.';
  if (castType === 'point_or_unit') return 'Unit or authored ground point; movement remains within the legal cast range.';
  if (castType === 'area') return 'Authored line, cone, circle, zone, or projectile geometry from the live executor.';
  if (castType === 'toggle') return 'Persistent self-state while the authored toggle remains active.';
  return 'Self-centered or no-target effect using the live executor geometry.';
};

const manaFor = (champion: ChampionKit, slot: AbilityDisplaySlot, rank: number) => {
  if (slot === 'skill1') return skill1ManaCost({ champion });
  if (slot === 'skill2') return 35;
  return ultimateManaCost({ champion, level: rank === 4 ? 18 : rank === 3 ? 16 : rank === 2 ? 11 : 6 });
};

const previewLevelFor = (slot: AbilityDisplaySlot, rank: number) => {
  if (slot === 'ultimate') return [6, 11, 16, 18][Math.max(0, rank - 1)] ?? 18;
  const milestones = slot === 'skill1' ? [1, 4, 7, 9, 12, 14, 17] : [2, 5, 8, 10, 13, 15, 18];
  return milestones[Math.max(0, rank - 1)] ?? LEVEL_CAP;
};

/**
 * Shared UI-facing ability facts. Live execution remains in AramMatchView;
 * this adapter reads its authored skill, cast-type, range and progression rules
 * instead of maintaining a second set of tooltip numbers.
 */
export function getAbilityPresentation(champion: ChampionKit, slot: AbilityDisplaySlot, rank = 1): AbilityPresentation {
  if(champion.abilityRuleset){
    const skill=champion[slot];
    return {slot,key:`${champion.id}:${slot}`,name:skill.name,shortDescription:skill.desc,detailedDescription:skill.desc,
      castType:'Authored geometry',castTypeDetail:'Validated by the original effect handler; resources, setup and counterplay are described below.',
      range:150,geometry:'See ability geometry and setup requirements',cooldown:skill.cooldown,
      manaCost:slot==='skill1'?30:slot==='skill2'?35:80,rank:1,maxRank:1};
  }
  const maxRank = slot === 'ultimate' ? 4 : 7;
  const safeRank = Math.max(1, Math.min(maxRank, rank));
  const cacheKey = `${champion.id}:${slot}:${safeRank}`;
  const cached = presentationCache.get(cacheKey);
  if (cached) return cached;
  const skill = champion[slot];
  const level = previewLevelFor(slot, safeRank);
  const castType = getAbilityCastType(champion.name, slot as CastSlot);
  const ratios = getAbilityRatios(champion, skill);
  const damage = skill.damage > 0 ? {
    type: skill.damageType,
    base: skill.damage,
    atRank: Math.round(skill.damage * abilityDamageMultiplier(level, slot)),
    adPercent: ratios.adPercent,
    apPercent: ratios.apPercent,
  } : undefined;
  const ccDuration = isCrowdControlSkill(champion.name, slot as CastSlot)
    ? getSkillCrowdControlDuration(champion.name, slot as CastSlot) : 0;
  const movement = MOVEMENT_PRESENTATION[`${champion.name}:${slot}`];
  const damageSentence = damage
    ? `At rank ${safeRank}, its authored base damage is ${damage.atRank} ${damage.type.toLowerCase()} damage before defenses, plus +${damage.adPercent}% bonus AD and +${damage.apPercent}% bonus AP when applicable.`
    : 'It has no authored direct damage value in the shared champion kit.';
  const ccSentence = ccDuration > 0 ? ` Its authored crowd-control duration is ${ccDuration.toFixed(1)} seconds.` : '';
  const movementSentence = movement ? ` ${movement.kind}: ${movement.detail}` : '';
  const presentation: AbilityPresentation = {
    slot,
    key: `${champion.id}:${slot}`,
    name: skill.name,
    shortDescription: skill.desc,
    detailedDescription: `${skill.desc} ${CAST_TYPE_DETAILS[castType]} ${damageSentence}${ccSentence}${movementSentence}`,
    castType: CAST_TYPE_LABELS[castType],
    castTypeDetail: CAST_TYPE_DETAILS[castType],
    range: getSkillCastRange(champion.name, slot, champion.range),
    geometry: geometryFor(castType),
    damage,
    cooldown: Number((skill.cooldown * abilityCooldownMultiplier(level, slot)).toFixed(1)),
    manaCost: manaFor(champion, slot, safeRank),
    rank: safeRank,
    maxRank,
    crowdControl: ccDuration > 0 ? { duration: ccDuration, detail: 'Duration is applied by the live crowd-control runtime on a valid hit.' } : undefined,
    movement,
    ...(champion.id==='c_raijin'?{
      visualDescription:slot==='skill1'?'A blue electrical double remains where Voltaire cast. Its armed outline brightens; lightning erupts only when an enemy triggers it.':slot==='skill2'?'A lightning tether connects Voltaire to the victim. Electrical coils surround the victim as they are pulled inward.':'The standing model and orbiting drums disappear into a bright, rotating lightning sphere. A short electric wake follows its actual path; the normal model returns immediately when travel ends.',
      counterplay:slot==='skill1'?'Stay outside the trigger circle, or move away before the double arms.':slot==='skill2'?'Keep outside its short 120-unit cast range.':'Spread away from the flight path. Terrain and hard control can stop travel; the form itself grants no immunity.',
    }:{}),
  };
  presentationCache.set(cacheKey, presentation);
  return presentation;
}

export function abilityCompactSummary(presentation: AbilityPresentation): string {
  const damage = presentation.damage
    ? `${presentation.damage.type} ${presentation.damage.atRank} (+${presentation.damage.adPercent}% AD, +${presentation.damage.apPercent}% AP)`
    : 'Utility';
  return `${presentation.castType} · ${damage} · ${presentation.cooldown}s CD · ${presentation.manaCost} mana · ${presentation.range} range`;
}
