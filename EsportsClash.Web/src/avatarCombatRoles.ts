import type { AramChampionUnit, AvatarCombatType, AvatarCombatTypeStrength, ChampionKit } from './types';
import { BLACK_HOLE_RADIUS } from './blackHoleCounterplay.ts';

export const AVATAR_COMBAT_TYPES: AvatarCombatType[] = [
  'Carry', 'Support', 'Nuker', 'Disabler', 'Jungler', 'Durable', 'Escape', 'Pusher', 'Initiator'
];

export type AvatarCombatProfile = Record<AvatarCombatType, AvatarCombatTypeStrength>;

// These are tendencies used by the AI and the avatar dossier, never bonus combat stats.
export function getAvatarCombatProfile(champion: ChampionKit): AvatarCombatProfile {
  const role = champion.primaryRole;
  const secondary = champion.secondaryRole;
  const controlText = `${champion.skill1.desc} ${champion.skill2.desc} ${champion.ultimate.desc}`;
  const hasControl = /stun|knock|root|snare|pull|fear|silence|taunt|charm|interrupt/i.test(controlText);
  const profile: AvatarCombatProfile = {
    Carry: role === 'Marksman' ? 3 : role === 'Assassin' || role === 'Fighter' ? 2 : 0,
    Support: role === 'Support' ? 3 : secondary === 'Support' ? 1 : 0,
    Nuker: role === 'Mage' ? 3 : role === 'Assassin' ? 2 : champion.ultimate.damage >= 400 ? 1 : 0,
    Disabler: hasControl ? (role === 'Support' || role === 'Tank' ? 2 : 1) : 0,
    Jungler: role === 'Fighter' || role === 'Assassin' ? 2 : role === 'Tank' ? 1 : 0,
    Durable: role === 'Tank' ? 3 : role === 'Fighter' ? 2 : 0,
    Escape: role === 'Assassin' ? 2 : /dash|blink|leap|escape/i.test(controlText) ? 1 : 0,
    Pusher: role === 'Marksman' || role === 'Mage' ? 2 : role === 'Fighter' ? 1 : 0,
    Initiator: /initiator|vanguard|engage|catch/i.test(champion.archetype) ? 2 : role === 'Tank' ? 1 : 0
  };
  return { ...profile, ...champion.combatRoles };
}

export interface AreaControlProfile { radius: number; center: 'self' | 'target'; }

// Mirror the hit geometry of these existing ultimate implementations.
const AREA_CONTROL_ULTIMATES: Record<string, AreaControlProfile> = {
  Stonewake: { radius: 155, center: 'self' },
  Nullweaver: { radius: BLACK_HOLE_RADIUS, center: 'target' },
  Solana: { radius: 80, center: 'target' },
  Soulscourge: { radius: 115, center: 'self' },
  Veyara: { radius: 115, center: 'target' },
  Kaolin: { radius: 100, center: 'self' }
};

export function getAreaControlProfile(champion: ChampionKit): AreaControlProfile | undefined {
  const areaProfile = AREA_CONTROL_ULTIMATES[champion.name];
  return areaProfile && getAvatarCombatProfile(champion).Disabler >= 1 ? areaProfile : undefined;
}

export function countAreaControlTargets(
  caster: AramChampionUnit,
  target: AramChampionUnit,
  enemies: AramChampionUnit[],
  profile: AreaControlProfile
): number {
  const center = profile.center === 'self' ? caster : target;
  return enemies.filter(enemy => enemy.isAlive
    && Math.hypot(enemy.x - center.x, enemy.y - center.y) <= profile.radius).length;
}

export function chooseAreaControlTarget(
  caster: AramChampionUnit,
  enemies: AramChampionUnit[],
  castRange: number,
  profile: AreaControlProfile
): AramChampionUnit | undefined {
  return enemies.filter(enemy => enemy.isAlive
    && Math.hypot(enemy.x - caster.x, enemy.y - caster.y) <= castRange)
    .sort((a, b) => {
      const hitDifference = countAreaControlTargets(caster, b, enemies, profile)
        - countAreaControlTargets(caster, a, enemies, profile);
      return hitDifference || Math.hypot(a.x - caster.x, a.y - caster.y)
        - Math.hypot(b.x - caster.x, b.y - caster.y);
    })[0];
}

export function chooseOpeningControlTarget(
  caster: AramChampionUnit,
  enemies: AramChampionUnit[],
  castRange: number
): AramChampionUnit | undefined {
  if (caster.champion.name !== 'Stonewake' && caster.champion.name !== 'Nullweaver') return undefined;
  const countHits = (target: AramChampionUnit) => enemies.filter(enemy => enemy.isAlive && (
    caster.champion.name === 'Stonewake'
      ? Math.abs(enemy.y - target.y) < 32 && Math.abs(enemy.x - target.x) < 90
      : Math.hypot(enemy.x - target.x, enemy.y - target.y) <= 42
  )).length;
  const candidates = enemies.filter(enemy => enemy.isAlive
    && Math.hypot(enemy.x - caster.x, enemy.y - caster.y) <= castRange);
  const best = candidates.sort((a, b) => countHits(b) - countHits(a)
    || Math.hypot(a.x - caster.x, a.y - caster.y) - Math.hypot(b.x - caster.x, b.y - caster.y))[0];
  return best && countHits(best) >= 2 ? best : undefined;
}

export function shouldCommitAreaControlUltimate(
  caster: AramChampionUnit,
  target: AramChampionUnit,
  enemies: AramChampionUnit[],
  allies: AramChampionUnit[],
  profile: AreaControlProfile
): boolean {
  const hits = countAreaControlTargets(caster, target, enemies, profile);
  if (hits === 0) return false;
  const iq = caster.player.stats.iq;
  const teamfight = caster.player.stats.tf;
  const composure = caster.player.stats.clu ?? 70;
  const tactical = iq * 0.45 + teamfight * 0.4 + composure * 0.15;
  const nearbyFollowup = allies.some(ally => ally.id !== caster.id && ally.isAlive
    && Math.hypot(ally.x - caster.x, ally.y - caster.y) <= 250);
  const emergencyPeel = allies.some(ally => ally.id !== caster.id && ally.isAlive
    && (ally.champion.primaryRole === 'Marksman' || ally.champion.primaryRole === 'Mage')
    && ally.hp / ally.maxHp < 0.4
    && Math.hypot(ally.x - target.x, ally.y - target.y) <= 140);
  if (emergencyPeel) return true;
  if (tactical >= 70) return hits >= 2 && (nearbyFollowup || hits >= 3 || caster.hp / caster.maxHp < 0.4);
  if (tactical >= 50) return hits >= 2 || (hits === 1 && caster.hp / caster.maxHp < 0.3);
  return hits >= 1 && (caster.hp / caster.maxHp < 0.7 || target.hp / target.maxHp < 0.5);
}
