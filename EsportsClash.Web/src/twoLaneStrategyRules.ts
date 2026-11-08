import { topLaneY, botLaneY, ARENA_WIDTH } from './arenaLayout.ts';
import type { AramChampionUnit, LaneStructure } from './types.ts';

export type TwoLaneSquadStrategy = 'standard_2_3' | 'heavy_top_3_2' | 'flex_roam_2_2_1';

export interface StrategyDescriptor {
  id: TwoLaneSquadStrategy;
  label: string;
  topCount: number;
  botCount: number;
  roamCount: number;
  description: string;
}

export const TWO_LANE_STRATEGIES: Record<TwoLaneSquadStrategy, StrategyDescriptor> = {
  standard_2_3: {
    id: 'standard_2_3',
    label: '2 Top / 3 Bot (Standard)',
    topCount: 2,
    botCount: 3,
    roamCount: 0,
    description: 'Solo Tank + Roaming Fighter Top; Mage + Marksman + Support Bot heavy push.',
  },
  heavy_top_3_2: {
    id: 'heavy_top_3_2',
    label: '3 Top / 2 Bot (Inverted)',
    topCount: 3,
    botCount: 2,
    roamCount: 0,
    description: 'Aggressive 3-man Top lane pressure toward Dragon pit; Duo Marksman/Support Bot.',
  },
  flex_roam_2_2_1: {
    id: 'flex_roam_2_2_1',
    label: '2-2-1 Flex Roam',
    topCount: 2,
    botCount: 2,
    roamCount: 1,
    description: 'Duo Top + Duo Bot; 1 dedicated Roamer floats between river objectives and outer towers.',
  },
};

/**
 * Assigns lanes and tactical roles to a team of champions according to the chosen strategy.
 */
export function assignSquadTwoLaneRoles(
  teamChampions: AramChampionUnit[],
  strategy: TwoLaneSquadStrategy = 'standard_2_3'
): void {
  teamChampions.forEach((u, teamIdx) => {
    if (strategy === 'heavy_top_3_2') {
      u.assignedLane = teamIdx < 3 ? 'top' : 'bot';
      u.tacticalRole = teamIdx === 0 ? 'solo' : 'duo';
    } else if (strategy === 'flex_roam_2_2_1') {
      if (teamIdx < 2) {
        u.assignedLane = 'top';
        u.tacticalRole = teamIdx === 0 ? 'solo' : 'duo';
      } else if (teamIdx === 2) {
        u.assignedLane = undefined; // roamer floats
        u.tacticalRole = 'roam';
      } else {
        u.assignedLane = 'bot';
        u.tacticalRole = 'duo';
      }
    } else {
      // standard_2_3
      u.assignedLane = teamIdx < 2 ? 'top' : 'bot';
      u.tacticalRole = teamIdx === 0 ? 'solo' : teamIdx === 1 ? 'roam' : 'duo';
    }
  });
}

/**
 * Calculates champion formation Y coordinate along the curved top or bottom lane.
 */
export function getTwoLaneFormationY(
  index: number,
  team: 'blue' | 'red' = 'blue',
  x?: number,
  lane?: 'top' | 'bot'
): number {
  const targetX = x ?? (team === 'blue' ? 235 : 2565);
  const assignedLane: 'top' | 'bot' = lane ?? (index < 2 ? 'top' : 'bot');
  const centerY = assignedLane === 'top' ? topLaneY(targetX) : botLaneY(targetX);
  const laneIndex = assignedLane === 'top' ? index : Math.max(0, index - 2);
  const offset = (laneIndex - 0.5) * 28;
  return centerY + offset;
}

/**
 * Evaluates dynamic lane rotation for a champion in a 2-lane stadium match:
 * - Roamers collapse to active Dragon Embermaw (Top Pit, 1400, 115) or Siege Golem (Bot Pit, 1400, 1325).
 * - When an outer tower is destroyed in one lane, roamers and flexible laners rotate to assist the remaining lane.
 * - Base defense calls override lane assignments to protect endangered Barracks.
 */
export function evaluateDynamicLaneRotation(params: {
  unit: AramChampionUnit;
  structures: readonly LaneStructure[];
  dragon?: { isAlive: boolean; spawnTimer: number; x: number; y: number };
  siegeGolem?: { isAlive: boolean; x: number; y: number };
  gameSecond: number;
}): { shouldRotate: boolean; targetLane: 'top' | 'bot'; reason: string } {
  const { unit, structures, dragon, siegeGolem, gameSecond } = params;
  const currentLane: 'top' | 'bot' = unit.assignedLane ?? (unit.y < 720 ? 'top' : 'bot');

  // Keep defense priority after the unit joins the threatened lane.
  const alliedThreatenedTower = structures.find(
    s => s.isAlive && s.team === unit.team && s.lane && s.hp / s.maxHp < 0.35
  );
  if (alliedThreatenedTower?.lane) {
    return { shouldRotate: alliedThreatenedTower.lane !== currentLane, targetLane: alliedThreatenedTower.lane, reason: 'defend_threatened_tower' };
  }

  // Roamer / Flexible rotation to live or imminent objectives
  const isRoamer = unit.tacticalRole === 'roam' || unit.player.stats.iq >= 82;
  if (isRoamer) {
    if (dragon?.isAlive || (dragon && dragon.spawnTimer <= 15)) {
      if (currentLane !== 'top') {
        return { shouldRotate: true, targetLane: 'top', reason: 'contest_dragon_embermaw' };
      }
    } else if (siegeGolem?.isAlive) {
      if (currentLane !== 'bot') {
        return { shouldRotate: true, targetLane: 'bot', reason: 'contest_siege_golem' };
      }
    }
  }

  // Cross-Lane Breach Opportunity:
  // If enemy outer tower in unit's lane is destroyed, but enemy outer tower in opposite lane is still standing,
  // high IQ or roaming units rotate to breach the remaining lane.
  const myLaneOuterDead = !structures.some(
    s => s.isAlive && s.team !== unit.team && s.lane === currentLane && s.type === 'outer_tower'
  );
  const otherLane: 'top' | 'bot' = currentLane === 'top' ? 'bot' : 'top';
  const otherLaneOuterAlive = structures.some(
    s => s.isAlive && s.team !== unit.team && s.lane === otherLane && s.type === 'outer_tower'
  );

  if (myLaneOuterDead && otherLaneOuterAlive && isRoamer && gameSecond > 60) {
    return { shouldRotate: true, targetLane: otherLane, reason: 'rotate_to_breach_other_lane' };
  }

  return { shouldRotate: false, targetLane: currentLane, reason: 'hold_current_lane' };
}

