import type { ChampionKit, PlayerCard } from './types';

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function playerCardCombatPower(player: PlayerCard, avatar: ChampionKit): number {
  const { lan, tf, clu, sta, flx } = player.stats;
  const score = player.ovr * 0.35 + lan * 0.20 + tf * 0.20 + clu * 0.10 + sta * 0.10 + flx * 0.05;
  const preferredRole = player.preferredRole ?? player.role;
  const isPlayablePrimary = Boolean(
    (player.playableRoles && player.playableRoles.includes(avatar.primaryRole)) ||
    preferredRole === avatar.primaryRole
  );
  const isPlayableSecondary = Boolean(
    avatar.secondaryRole && (
      (player.playableRoles && player.playableRoles.includes(avatar.secondaryRole)) ||
      preferredRole === avatar.secondaryRole
    )
  );
  const roleFit = isPlayablePrimary ? 0.025
    : isPlayableSecondary ? 0.01
      : -0.05 * (1 - clamp(flx, 1, 99) / 200);
  const signatureFit = player.signatureChampions.includes(avatar.name) ? 0.025 : 0;
  return clamp(score / 100 + roleFit + signatureFit, 0.25, 1.05);
}

export function createRatedAvatar(player: PlayerCard, avatar: ChampionKit): ChampionKit {
  const power = playerCardCombatPower(player, avatar);
  const damageFactor = 0.78 + 0.30 * power;
  const skillFactor = 0.80 + 0.29 * power;
  return {
    ...avatar,
    hp: Math.round(avatar.hp * (0.80 + 0.27 * power)),
    ad: Math.round(avatar.ad * damageFactor),
    armor: Math.round(avatar.armor * (0.85 + 0.20 * power)),
    mr: Math.round(avatar.mr * (0.85 + 0.20 * power)),
    aspd: avatar.aspd * (0.92 + 0.15 * power),
    skill1: { ...avatar.skill1, damage: avatar.skill1.damage * skillFactor },
    skill2: { ...avatar.skill2, damage: avatar.skill2.damage * skillFactor },
    ultimate: { ...avatar.ultimate, damage: avatar.ultimate.damage * skillFactor }
  };
}
