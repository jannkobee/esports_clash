import type { AramChampionUnit } from './types';
import { shouldHoldFightPlan, shouldHuntExposedCarry } from './playerTraits.ts';
import { isCrowdControlSkill, shouldHoldSkillForChainStun, getSkillCastRange } from './skillRangeRules.ts';
import { chooseAreaControlTarget, chooseOpeningControlTarget, countAreaControlTargets, getAreaControlProfile, shouldCommitAreaControlUltimate } from './avatarCombatRoles.ts';
import { isSelfOrAllySecondSkill, skill1ManaCost, ultimateManaCost } from './abilityRules.ts';
import { shouldSaveBlackHoleInterrupt } from './blackHoleCounterplay.ts';
import { isObservedCooling, type EnemyCooldownMemory } from './cooldownKnowledge.ts';

type Fighter = AramChampionUnit;

const distance = (a: Fighter, b: Fighter) => Math.hypot(a.x - b.x, a.y - b.y);
const health = (unit: Fighter) => unit.hp / unit.maxHp;

export function isUnitVisibleTo(target: Fighter, observer: Fighter): boolean {
  if (!target.isAlive) return false;
  if ((target.stealthTimer ?? 0) > 0 && distance(target, observer) > 48) return false;
  if (target.isInBush) {
    if (observer.isInBush && observer.currentBushId && observer.currentBushId === target.currentBushId) {
      return true;
    }
    if (distance(target, observer) <= 55) {
      return true;
    }
    if ((target.revealedTimer ?? 0) > 0) {
      return true;
    }
    return false;
  }
  return true;
}

export function isChannelingAbility(unit: Fighter): boolean {
  return Boolean(unit.blackHole || unit.corsaraBarrage || unit.monkeySpin);
}

export function isEnemyCaughtInAlliedChannel(enemy: Fighter, allies: Fighter[]): boolean {
  return allies.some(ally => {
    if (!ally.isAlive) return false;
    if (ally.blackHole) {
      const hole = ally.blackHole;
      return Math.hypot(enemy.x - hole.x, enemy.y - hole.y) <= 130;
    }
    if (ally.corsaraBarrage) {
      const facing = ally.corsaraBarrage.facing === 'right' ? 1 : -1;
      const forward = (enemy.x - ally.x) * facing;
      return forward > 0 && forward <= 280 && Math.abs(enemy.y - ally.y) <= forward * 0.6 + 30;
    }
    if (ally.monkeySpin) {
      return Math.hypot(enemy.x - ally.x, enemy.y - ally.y) <= 125 || (enemy.knockupTimer ?? 0) > 0;
    }
    return false;
  });
}

// IQ improves decisions, while TF and LAN still govern execution and mechanics.
export function chooseTeamfightTarget(
  unit: Fighter,
  enemies: Fighter[],
  allies: Fighter[],
  range: number,
  options?: {
    enemyStructures?: readonly { id: string; team: 'blue' | 'red'; type: string; isAlive: boolean; x: number; y: number; range: number }[];
    alliedMinions?: readonly { x: number; y: number; isAlive: boolean }[];
    cooldownMemory?: EnemyCooldownMemory;
    matchSecond?: number;
  }
): Fighter | undefined {
  const iq = Math.max(1, Math.min(99, unit.player.stats.iq)) / 99;
  const execution = Math.max(1, Math.min(99, unit.player.stats.tf)) / 99;
  const isAggroDiver = unit.player.badges?.some(b => b.toLowerCase().includes('diver')) || unit.player.personality?.toLowerCase().includes('diver');
  // Exclude channeling allies from carry peel; a channeler is leading an aggressive engage, not in distress
  const carry = allies.find(a => a.id !== unit.id && !a.isRecalling && !isChannelingAbility(a) && (a.champion.primaryRole === 'Marksman' || a.champion.primaryRole === 'Mage') && distance(unit, a) < 240);
  const visibleEnemies = enemies.filter(e => e.isAlive && isUnitVisibleTo(e, unit));

  // Under-tower check helper
  const isUnderEnemyTower = (fighter: Fighter) => options?.enemyStructures?.some(
    st => st.isAlive && st.team !== unit.team && Math.hypot(fighter.x - st.x, fighter.y - st.y) <= st.range
  ) ?? false;

  if (unit.player.stats.iq >= 60 && unit.player.stats.tf >= 55) {
    const channeler = visibleEnemies.find(e => (e.blackHole || e.corsaraBarrage || e.monkeySpin) && distance(unit, e) < range * 1.8 && (!isUnderEnemyTower(e) || isAggroDiver));
    if (channeler) return channeler;
  }
  // Follow-Up Engage Priority:
  // When an ally channels an engage ability (Black Hole, Broadside Waltz, Cyclone Dance),
  // ALL living allies within teamfight range commit to the follow-up engage and prioritize
  // enemies trapped or targeted by the channel!
  const alliedChannelers = allies.filter(a => a.isAlive && isChannelingAbility(a));
  if (alliedChannelers.length > 0) {
    const trappedEnemies = visibleEnemies.filter(e => isEnemyCaughtInAlliedChannel(e, alliedChannelers) && distance(unit, e) <= 650);
    if (trappedEnemies.length > 0) {
      trappedEnemies.sort((a, b) => {
        const aVuln = (a.champion.primaryRole === 'Marksman' || a.champion.primaryRole === 'Mage') ? -0.2 : 0;
        const bVuln = (b.champion.primaryRole === 'Marksman' || b.champion.primaryRole === 'Mage') ? -0.2 : 0;
        return (health(a) + aVuln) - (health(b) + bVuln);
      });
      if (shouldHoldFightPlan(unit)) unit.traitFocusId = trappedEnemies[0].id;
      return trappedEnemies[0];
    }
  }
  if (shouldHoldFightPlan(unit) && (unit.iceFocusTimer ?? 0) > 0) {
    const heldTarget = visibleEnemies.find(e => e.id === unit.traitFocusId && distance(unit, e) <= range * 2.2);
    if (heldTarget) return heldTarget;
  }
  if (unit.cd1 <= 0 && unit.mana >= 45 && unit.player.stats.iq >= 65 && unit.player.stats.tf >= 60) {
    const openingTarget = chooseOpeningControlTarget(unit, visibleEnemies,
      getSkillCastRange(unit.champion.name, 'skill1', range));
    if (openingTarget && (!isUnderEnemyTower(openingTarget) || isAggroDiver)) return openingTarget;
  }
  const areaProfile = getAreaControlProfile(unit.champion);
  if (areaProfile && unit.level >= 6 && unit.cdUlt <= 0 && unit.player.stats.iq >= 65) {
    const castRange = getSkillCastRange(unit.champion.name, 'ultimate', range);
    const groupedTarget = chooseAreaControlTarget(unit, visibleEnemies, castRange, areaProfile);
    if (groupedTarget && countAreaControlTargets(unit, groupedTarget, visibleEnemies, areaProfile) >= 2) {
      if (!isUnderEnemyTower(groupedTarget) || isAggroDiver) {
        if (shouldHoldFightPlan(unit)) unit.traitFocusId = groupedTarget.id;
        return groupedTarget;
      }
    }
  }
  const exposedCarry = visibleEnemies
    .filter(e => distance(unit, e) <= range * 2.2 && shouldHuntExposedCarry(unit, e, visibleEnemies) && (!isUnderEnemyTower(e) || isAggroDiver))
    .sort((a, b) => distance(unit, a) - distance(unit, b))[0];
  if (exposedCarry) {
    if (shouldHoldFightPlan(unit)) unit.traitFocusId = exposedCarry.id;
    return exposedCarry;
  }
  const selected = visibleEnemies.reduce<Fighter | undefined>((best, enemy) => {
    const score = (candidate: Fighter) => {
      const dist = distance(unit, candidate);
      const reachable = dist <= range * 2.2;
      const lowHp = 1 - health(candidate);
      const vulnerable = candidate.champion.primaryRole === 'Marksman' || candidate.champion.primaryRole === 'Mage';
      const peeling = carry && distance(carry, candidate) < 150;
      const isStunned = (candidate.stunTimer ?? 0) > 0 || (candidate.knockupTimer ?? 0) > 0;
      const isRecallingFar = candidate.isRecalling && dist > range * 1.25;
      const canInterruptRecall = candidate.isRecalling && dist <= range * 1.25;

      const isClutchActive = !!unit.clutchCommitActive;
      const isCurrentFocus = candidate.id === unit.traitFocusId;

      // Enemy tower danger penalty
      const enemyTower = options?.enemyStructures?.find(
        st => st.isAlive && st.team !== unit.team && Math.hypot(candidate.x - st.x, candidate.y - st.y) <= st.range
      );
      const alliedMinionsUnderTower = enemyTower && options?.alliedMinions
        ? options.alliedMinions.filter(m => m.isAlive && Math.hypot(m.x - enemyTower.x, m.y - enemyTower.y) <= enemyTower.range).length
        : 0;
      const diverRole = unit.champion.primaryRole;
      const isSquishy = diverRole === 'Mage' || diverRole === 'Marksman' || diverRole === 'Support';
      const canDiveUnderTower = isAggroDiver || (alliedMinionsUnderTower >= 2 && lowHp >= 0.78 && health(unit) >= 0.55 && !isSquishy);
      const towerDangerPenalty = enemyTower && !canDiveUnderTower
        ? (3.8 * iq * (isSquishy ? 1.5 : 1.0))
        : 0;
      const observedUltDown = unit.player.stats.iq >= 78 && isObservedCooling(
        options?.cooldownMemory?.[unit.team], candidate.id, 'ultimate', options?.matchSecond ?? 0);
      const spentKeySkill = unit.player.stats.iq >= 86 && isObservedCooling(
        options?.cooldownMemory?.[unit.team], candidate.id, 'skill2', options?.matchSecond ?? 0);

      return -dist / Math.max(60, range) * (1.8 - iq * 0.7)
        - (isRecallingFar ? (5.0 * iq) : 0)
        + (canInterruptRecall ? (2.0 * iq) : 0)
        + (isCurrentFocus && reachable ? 1.4 : 0)
        + (reachable ? lowHp * 2.3 * iq * (0.6 + execution * 0.4) : 0)
        + (reachable && vulnerable && unit.champion.primaryRole === 'Assassin' ? 1.3 * iq : 0)
        + (reachable && lowHp >= 0.55 && isAggroDiver ? 2.6 : 0)
        + (isClutchActive && reachable ? 1.8 : 0)
        + (reachable && isStunned ? 1.5 * iq * (0.5 + execution * 0.5) : 0)
        + (peeling && (unit.champion.primaryRole === 'Tank' || unit.champion.primaryRole === 'Support') ? 1.6 * iq * (0.6 + execution * 0.4) : 0)
        + (reachable && observedUltDown ? 0.95 * iq : 0)
        + (reachable && spentKeySkill ? 0.38 * iq : 0)
        - towerDangerPenalty;
    };
    return !best || score(enemy) > score(best) ? enemy : best;
  }, undefined);
  if (shouldHoldFightPlan(unit)) unit.traitFocusId = selected?.id;
  return selected;
}

export function shouldUseUltimate(unit: Fighter, target: Fighter, enemies: Fighter[], allies: Fighter[], ultRange: number = 320): boolean {
  if (unit.level < 6 || unit.mana < ultimateManaCost(unit) || unit.cdUlt > 0) return false;
  if (distance(unit, target) > ultRange) return false;
  if (unit.champion.name === 'Faelith') return allies.some(ally => ally.isAlive && distance(unit, ally) <= 215
    && ally.hp / ally.maxHp < 0.62 && enemies.some(enemy => enemy.isAlive && distance(enemy, ally) <= 170));
  if (unit.champion.name === 'Oathmute') return enemies.some(enemy => enemy.isAlive && (enemy.blackHole || enemy.corsaraBarrage))
    || enemies.filter(enemy => enemy.isAlive && distance(unit, enemy) <= 260).length >= 2;
  if (unit.champion.name === 'Corsara') {
    const facing = target.x >= unit.x ? 1 : -1;
    const linedUp = enemies.filter(enemy => enemy.isAlive && (enemy.x - unit.x) * facing > 0
      && Math.abs(enemy.x - unit.x) <= 260 && Math.abs(enemy.y - unit.y) <= Math.abs(enemy.x - unit.x) * 0.55 + 24).length;
    return linedUp >= (unit.player.stats.iq >= 70 ? 2 : 1) && unit.hp / unit.maxHp >= 0.4;
  }

  // Chain stun evaluation for CC Ultimates
  if (isCrowdControlSkill(unit.champion.name, 'ultimate')) {
    const targetStun = target.stunTimer ?? 0;
    if (shouldHoldSkillForChainStun(unit.player.stats.iq, unit.player.stats.tf, unit.teamChemistry ?? 10, targetStun, true)) {
      return false; // Hold until current CC nears completion to execute perfect chain stun
    }
  }

  const areaProfile = getAreaControlProfile(unit.champion);
  if (areaProfile) return shouldCommitAreaControlUltimate(unit, target, enemies, allies, areaProfile);

  const iq = unit.player.stats.iq;
  const nearbyEnemies = enemies.filter(e => e.isAlive && distance(e, target) < 100).length;
  const nearbyAllies = allies.filter(a => a.isAlive && distance(a, unit) < 220).length;
  const urgent = health(unit) < 0.42 || health(target) < 0.34;
  const isTargetInAlliedChannel = isEnemyCaughtInAlliedChannel(target, allies);
  const teamfight = nearbyEnemies >= 2 || (nearbyAllies >= 2 && enemies.some(e => e.isAlive && distance(e, unit) < 220)) || isTargetInAlliedChannel;
  if (iq >= 70 && target.hp <= unit.champion.ad * 0.8 && nearbyEnemies < 2 && !isTargetInAlliedChannel) return false;
  // Low IQ spends an available ultimate quickly; high IQ saves it for a kill,
  // a threatened life, or a real fight. It will still cast in a prolonged duel.
  const duelWindow = health(target) < 0.65 && health(unit) < 0.8;
  return iq < 45 || urgent || teamfight || duelWindow || isTargetInAlliedChannel;
}

export function shouldUseSkill(unit: Fighter, target: Fighter, enemies: Fighter[], range: number): boolean {
  if ((unit.cd1 > 0 && !(['Cinderlock', 'Cinderbloom'].includes(unit.champion.name) && unit.cinderQStage)) || unit.mana < skill1ManaCost(unit) || distance(unit, target) > range) return false;
  if (['Cinderlock', 'Cinderbloom'].includes(unit.champion.name) && unit.cinderQStage) return distance(unit, target) <= 125;
  if (isCrowdControlSkill(unit.champion.name, 'skill1') && health(target) > 0.35
    && enemies.some(enemy => distance(unit, enemy) <= range * 1.15 && shouldSaveBlackHoleInterrupt(unit, enemy))) return false;

  // Chain stun evaluation for CC Skill 1
  if (isCrowdControlSkill(unit.champion.name, 'skill1')) {
    const targetStun = target.stunTimer ?? 0;
    if (shouldHoldSkillForChainStun(unit.player.stats.iq, unit.player.stats.tf, unit.teamChemistry ?? 10, targetStun, true)) {
      return false; // High IQ/Chemistry player holds to time chain stun as active CC expires
    }
  }

  const iq = unit.player.stats.iq;
  if (iq < 45) return true;
  const targetCanSurviveAttack = target.hp > unit.champion.ad * 1.25;
  const teamfight = enemies.some(e => e.id !== target.id && e.isAlive && distance(e, target) < 95);
  const canFinish = target.hp <= unit.champion.skill1.damage && targetCanSurviveAttack;
  if (iq >= 80 && unit.level >= 6 && unit.cdUlt <= 0 && unit.mana >= 85
    && !teamfight && health(unit) >= 0.5 && !canFinish) return false;
  return teamfight || health(unit) < 0.5 || targetCanSurviveAttack;
}

export function shouldUseSecondSkill(unit: Fighter, target: Fighter, enemies: Fighter[], allies: Fighter[], range: number): boolean {
  if (unit.cd2 > 0 || unit.mana < 35) return false;
  const utilityCast = isSelfOrAllySecondSkill(unit.champion.name);
  if ((!utilityCast || unit.champion.name === 'Tequoia') && distance(unit, target) > range) return false;
  if (unit.champion.name === 'Oathmute' && (target.blackHole || target.corsaraBarrage)) return true;
  if (isCrowdControlSkill(unit.champion.name, 'skill2') && health(target) > 0.35
    && enemies.some(enemy => distance(unit, enemy) <= range * 1.15 && shouldSaveBlackHoleInterrupt(unit, enemy))) return false;

  // Chain stun evaluation for CC Skill 2 (e.g. Raijin Electric Vortex)
  if (isCrowdControlSkill(unit.champion.name, 'skill2')) {
    const targetStun = target.stunTimer ?? 0;
    if (shouldHoldSkillForChainStun(unit.player.stats.iq, unit.player.stats.tf, unit.teamChemistry ?? 10, targetStun, true)) {
      return false; // High IQ/Chemistry player holds to chain CC without wasteful overlap
    }
  }

  const iq = unit.player.stats.iq;
  if (iq < 45) return true;
  const isTargetInAlliedChannel = isEnemyCaughtInAlliedChannel(target, allies);
  const teamfight = enemies.filter(e => e.isAlive && distance(e, unit) < 180).length >= 2 || isTargetInAlliedChannel;
  const threatened = health(unit) < 0.6;
  const allyNeedsHelp = allies.some(a => a.id !== unit.id && a.isAlive && health(a) < 0.55 && distance(a, unit) < 180);
  if (['Cinderlock', 'Cinderbloom'].includes(unit.champion.name)) return distance(unit, target) < 230 && (health(unit) < 0.8 || teamfight || unit.cd1 <= 0);
  if (unit.champion.name === 'Tequoia') {
    const hostile = enemies.filter(e => e.isAlive && distance(e, target) < 125).length;
    return hostile >= 2 || (teamfight && hostile >= 1);
  }
  if (utilityCast) return threatened || allyNeedsHelp || teamfight;
  const canFinish = unit.champion.skill2.damage >= target.hp && target.hp > unit.champion.ad * 0.8;
  if (unit.champion.skill2.damage === 0) return teamfight || threatened || allyNeedsHelp;
  if (target.hp <= unit.champion.ad * 0.8 && !teamfight) return false;
  return teamfight || threatened || canFinish || unit.mana >= (iq >= 80 ? 65 : 45) || isTargetInAlliedChannel;
}

export function shouldContestBoss(unit: Fighter, allies: Fighter[], enemies: Fighter[], bossHpRatio: number, matchTime: number): boolean {
  const iq = unit.player.stats.iq;
  const healthyAllies = allies.filter(a => a.isAlive && health(a) > 0.5 && distance(a, unit) < 400).length;
  const nearbyEnemies = enemies.filter(e => e.isAlive && distance(e, unit) < 280).length;
  const canStart = matchTime > 90 && iq >= 80 && healthyAllies >= 3 && nearbyEnemies === 0;
  return iq >= 65 && health(unit) > 0.55 && healthyAllies >= 2 && nearbyEnemies <= healthyAllies
    && (canStart || bossHpRatio < (iq >= 85 ? 0.8 : 0.5));
}
