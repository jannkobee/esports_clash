// Camp positions are map knowledge. Vision reveals current monsters and enemies,
// but a farming route does not require first walking into the camp's sight range.
export function chooseKnownJungleCamp<T extends {
  type: string; isAlive: boolean; x: number; y: number; homeX?: number; homeY?: number;
}>(camps: readonly T[], actor: {
  x: number; y: number; team: 'blue' | 'red'; hpFraction: number;
  iq: number; jungleStrength: number; gameSeconds: number;
  nearbyEnemyCount: number; nearestLaneEnemyDistance: number;
  urgentStructurePush: boolean;
  role?: string;
  supportStrength?: number;
  teamObjective?: boolean;
}): T | undefined {
  if (actor.gameSeconds < 45 || actor.hpFraction < 0.62 || actor.iq < 52
    || actor.nearbyEnemyCount > 0 || actor.nearestLaneEnemyDistance < 230
    || actor.urgentStructurePush) return undefined;

  if (!actor.teamObjective && (actor.role === 'Support' || (actor.supportStrength ?? 0) >= 2)) return undefined;

  if (!actor.teamObjective && actor.jungleStrength === 0
    && actor.role !== 'Marksman' && actor.role !== 'Mage' && actor.role !== 'Carry') return undefined;

  if (!actor.teamObjective && actor.jungleStrength === 0
    && (actor.iq < 76 || actor.nearestLaneEnemyDistance < 320)) return undefined;

  const maxRoute = actor.teamObjective ? 720
    : actor.jungleStrength >= 2 ? 560 : actor.jungleStrength >= 1 ? 420 : 300;
  return camps.filter(camp => camp.isAlive && camp.type !== 'siege_golem')
    .map(camp => {
      const homeX = camp.homeX ?? camp.x;
      const homeY = camp.homeY ?? camp.y;
      const distance = Math.hypot(homeX - actor.x, homeY - actor.y);
      const ownHalf = actor.team === 'blue' ? homeX < 1000 : homeX > 1000;
      // An enemy camp is still an option, but only after moving into its half.
      const canInvade = ownHalf || (actor.team === 'blue' ? actor.x > 900 : actor.x < 1100);
      return { camp, distance, score: distance + (ownHalf ? 0 : 85), canInvade };
    })
    .filter(candidate => candidate.distance <= maxRoute && candidate.canInvade)
    .sort((a, b) => a.score - b.score)[0]?.camp;
}

export function shouldStartPostRecallCampObjective(input: {
  recentlyRecalledAllies: number;
  livingAllies: number;
  healthyAllies: number;
  campAvailable: boolean;
  activeThreat: boolean;
  activePush: boolean;
}): boolean {
  return input.recentlyRecalledAllies >= 2 && input.livingAllies >= 3
    && input.healthyAllies >= 2 && input.campAvailable
    && !input.activeThreat && !input.activePush;
}

export function choosePostRecallTeamCamp<T extends {
  id: string; type: string; isAlive: boolean; x: number; y: number; homeX?: number; homeY?: number;
}>(camps: readonly T[], team: 'blue' | 'red', members: readonly { x: number; y: number }[]): T | undefined {
  if (members.length < 2) return undefined;

  return camps.filter(camp => {
    const homeX = camp.homeX ?? camp.x;
    const ownHalf = team === 'blue' ? homeX < 1000 : homeX > 1000;
    return camp.isAlive && camp.type !== 'siege_golem' && ownHalf;
  }).map(camp => {
    const homeX = camp.homeX ?? camp.x;
    const homeY = camp.homeY ?? camp.y;
    const routes = members.map(member => Math.hypot(homeX - member.x, homeY - member.y));
    return {
      camp,
      longestRoute: Math.max(...routes),
      averageRoute: routes.reduce((sum, route) => sum + route, 0) / routes.length,
    };
  }).filter(candidate => candidate.longestRoute <= 720)
    .sort((a, b) => a.averageRoute - b.averageRoute || a.camp.id.localeCompare(b.camp.id))[0]?.camp;
}

export function shareJungleCampRewards(
  goldReward: number, xpReward: number, contributorIds: readonly string[], killerId: string
): { id: string; gold: number; xp: number }[] {
  const participants = [...new Set([...contributorIds, killerId])];
  const goldShare = Math.floor(goldReward / participants.length);
  const xpShare = Math.floor(xpReward / participants.length);
  return participants.map(id => ({
    id,
    gold: goldShare + (id === killerId ? goldReward - goldShare * participants.length : 0),
    xp: xpShare + (id === killerId ? xpReward - xpShare * participants.length : 0),
  }));
}

export function shouldFocusExposedNexus(nexus: {
  isAlive: boolean; hp: number; maxHp: number;
}, exposed: boolean, iq: number, coachMacro: number): boolean {
  if (!nexus.isAlive || !exposed || nexus.maxHp <= 0) return false;
  const recognitionThreshold = 0.30 + Math.max(0, Math.min(100, iq)) * 0.0009
    + Math.max(0, Math.min(20, coachMacro)) * 0.001;
  return nexus.hp / nexus.maxHp <= recognitionThreshold;
}

// A recent won fight creates a short siege window. Better macro readers keep
// the call longer, while anyone still backs away when the push is unsafe.
export function shouldPressWonFight(input: {
  secondsSinceTeamKill: number; aliveAllies: number; aliveEnemies: number;
  healthFraction: number; nearestStructureDistance: number;
  iq: number; coachMacro: number; losingFight: boolean;
}): boolean {
  const { secondsSinceTeamKill, aliveAllies, aliveEnemies, healthFraction,
    nearestStructureDistance, iq, coachMacro, losingFight } = input;
  if (losingFight || aliveAllies < 2 || aliveAllies <= aliveEnemies
    || nearestStructureDistance > 900 || secondsSinceTeamKill < 0) return false;
  const strongRead = iq >= 72 || coachMacro >= 13;
  if (healthFraction < (strongRead ? 0.35 : 0.48)) return false;
  if (aliveEnemies > 1 && aliveAllies < aliveEnemies + 2) return false;
  return secondsSinceTeamKill <= (strongRead ? 18 : 12);
}
export function neutralAttackRange(championRange: number, epic = false): number {
  return Math.min(championRange, epic ? 145 : 130);
}
