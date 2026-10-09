import type { AramChampionUnit } from './types';
import { isCrowdControlSkill, shouldHoldSkillForChainStun } from './skillRangeRules.ts';

type Fighter = AramChampionUnit;

const distance = (a: Fighter, b: Fighter) => Math.hypot(a.x - b.x, a.y - b.y);
const health = (unit: Fighter) => unit.hp / unit.maxHp;

export function isUnitVisibleTo(target: Fighter, observer: Fighter): boolean {
  if (!target.isAlive) return false;
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

// IQ improves decisions, while TF and LAN still govern execution and mechanics.
export function chooseTeamfightTarget(unit: Fighter, enemies: Fighter[], allies: Fighter[], range: number): Fighter | undefined {
  const iq = Math.max(1, Math.min(99, unit.player.stats.iq)) / 99;
  const execution = Math.max(1, Math.min(99, unit.player.stats.tf)) / 99;
  const carry = allies.find(a => a.id !== unit.id && (a.champion.primaryRole === 'Marksman' || a.champion.primaryRole === 'Mage') && distance(unit, a) < 240);
  return enemies.filter(e => e.isAlive && isUnitVisibleTo(e, unit)).reduce<Fighter | undefined>((best, enemy) => {
    const score = (candidate: Fighter) => {
      const dist = distance(unit, candidate);
      const reachable = dist <= range * 2.2;
      const lowHp = 1 - health(candidate);
      const vulnerable = candidate.champion.primaryRole === 'Marksman' || candidate.champion.primaryRole === 'Mage';
      const peeling = carry && distance(carry, candidate) < 150;
      const isStunned = (candidate.stunTimer ?? 0) > 0 || (candidate.knockupTimer ?? 0) > 0;
      return -dist / Math.max(60, range) * (1.8 - iq * 0.7)
        + (reachable ? lowHp * 2.3 * iq * (0.6 + execution * 0.4) : 0)
        + (reachable && vulnerable && unit.champion.primaryRole === 'Assassin' ? 1.3 * iq : 0)
        + (reachable && isStunned ? 1.5 * iq * (0.5 + execution * 0.5) : 0)
        + (peeling && (unit.champion.primaryRole === 'Tank' || unit.champion.primaryRole === 'Support') ? 1.6 * iq * (0.6 + execution * 0.4) : 0);
    };
    return !best || score(enemy) > score(best) ? enemy : best;
  }, undefined);
}

export function shouldUseUltimate(unit: Fighter, target: Fighter, enemies: Fighter[], allies: Fighter[], ultRange: number = 320): boolean {
  if (unit.level < 6 || unit.mana < 100 || unit.cdUlt > 0) return false;
  if (distance(unit, target) > ultRange) return false;

  // Chain stun evaluation for CC Ultimates
  if (isCrowdControlSkill(unit.champion.name, 'ultimate')) {
    const targetStun = target.stunTimer ?? 0;
    if (shouldHoldSkillForChainStun(unit.player.stats.iq, unit.player.stats.tf, unit.teamChemistry ?? 10, targetStun, true)) {
      return false; // Hold until current CC nears completion to execute perfect chain stun
    }
  }

  const iq = unit.player.stats.iq;
  const nearbyEnemies = enemies.filter(e => e.isAlive && distance(e, target) < 100).length;
  const nearbyAllies = allies.filter(a => a.isAlive && distance(a, unit) < 220).length;
  const urgent = health(unit) < 0.42 || health(target) < 0.34;
  const teamfight = nearbyEnemies >= 2 || (nearbyAllies >= 2 && enemies.some(e => e.isAlive && distance(e, unit) < 220));
  if (iq >= 70 && target.hp <= unit.champion.ad * 0.8 && nearbyEnemies < 2) return false;
  // Low IQ spends an available ultimate quickly; high IQ saves it for a kill,
  // a threatened life, or a real fight. It will still cast in a prolonged duel.
  const duelWindow = health(target) < 0.65 && health(unit) < 0.8;
  return iq < 45 || urgent || teamfight || duelWindow;
}

export function shouldUseSkill(unit: Fighter, target: Fighter, enemies: Fighter[], range: number): boolean {
  if (unit.cd1 > 0 || unit.mana < 45 || distance(unit, target) > range) return false;

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
  if (unit.cd2 > 0 || unit.mana < 35 || distance(unit, target) > range) return false;

  // Chain stun evaluation for CC Skill 2 (e.g. Raijin Electric Vortex)
  if (isCrowdControlSkill(unit.champion.name, 'skill2')) {
    const targetStun = target.stunTimer ?? 0;
    if (shouldHoldSkillForChainStun(unit.player.stats.iq, unit.player.stats.tf, unit.teamChemistry ?? 10, targetStun, true)) {
      return false; // High IQ/Chemistry player holds to chain CC without wasteful overlap
    }
  }

  const iq = unit.player.stats.iq;
  if (iq < 45) return true;
  const teamfight = enemies.filter(e => e.isAlive && distance(e, unit) < 180).length >= 2;
  const threatened = health(unit) < 0.6;
  const allyNeedsHelp = allies.some(a => a.id !== unit.id && a.isAlive && health(a) < 0.55 && distance(a, unit) < 180);
  const canFinish = unit.champion.skill2.damage >= target.hp && target.hp > unit.champion.ad * 0.8;
  if (unit.champion.skill2.damage === 0) return teamfight || threatened || allyNeedsHelp;
  if (target.hp <= unit.champion.ad * 0.8 && !teamfight) return false;
  return teamfight || threatened || canFinish || unit.mana >= (iq >= 80 ? 65 : 45);
}

export function shouldContestBoss(unit: Fighter, allies: Fighter[], enemies: Fighter[], bossHpRatio: number, matchTime: number): boolean {
  const iq = unit.player.stats.iq;
  const healthyAllies = allies.filter(a => a.isAlive && health(a) > 0.5 && distance(a, unit) < 400).length;
  const nearbyEnemies = enemies.filter(e => e.isAlive && distance(e, unit) < 280).length;
  const canStart = matchTime > 90 && iq >= 80 && healthyAllies >= 3 && nearbyEnemies === 0;
  return iq >= 65 && health(unit) > 0.55 && healthyAllies >= 2 && nearbyEnemies <= healthyAllies
    && (canStart || bossHpRatio < (iq >= 85 ? 0.8 : 0.5));
}
