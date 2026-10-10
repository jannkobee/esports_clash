import type { AramChampionUnit } from './types';

type Combatant = Pick<AramChampionUnit, 'id' | 'x' | 'y' | 'hp' | 'maxHp' | 'shield' | 'isAlive' | 'stunTimer' | 'cd1' | 'cd2' | 'cdUlt' | 'level' | 'mana' | 'champion' | 'player'>;

const distance = (a: Combatant, b: Combatant) => Math.hypot(a.x - b.x, a.y - b.y);
const pressure = (unit: Combatant) => {
  const attacks = unit.champion.ad * unit.champion.aspd * 3;
  const first = unit.cd1 <= 1 && unit.mana >= 45 ? unit.champion.skill1.damage * 0.55 : 0;
  const second = unit.cd2 <= 1 && unit.mana >= 35 ? unit.champion.skill2.damage * 0.4 : 0;
  const ultimate = unit.level >= 6 && unit.cdUlt <= 1 && unit.mana >= 100
    ? unit.champion.ultimate.damage * 0.35 : 0;
  return attacks + first + second + ultimate;
};

/** Compare the next few seconds of real available damage with survival and help. */
export function shouldRetreatLosingFight(unit: Combatant, allies: Combatant[], enemies: Combatant[]): boolean {
  const threats = enemies.filter(enemy => enemy.isAlive && distance(unit, enemy) <= 250);
  if (threats.length === 0) return false;
  const helpers = allies.filter(ally => ally.id !== unit.id && ally.isAlive && distance(unit, ally) <= 235);
  const reachable = threats.filter(enemy => distance(unit, enemy) <= (unit.champion.range * 45 + 85));
  const lowestTarget = reachable.sort((a, b) => a.hp + a.shield - b.hp - b.shield)[0];
  const alliedDamage = helpers.reduce((sum, ally) => sum + pressure(ally) * 0.48, 0);
  const incoming = threats.reduce((sum, enemy) => sum + pressure(enemy) * (enemy.stunTimer > 0.4 ? 0.3 : 0.72), 0);
  const availableHp = unit.hp + unit.shield;
  const targetHp = lowestTarget ? lowestTarget.hp + lowestTarget.shield : Infinity;
  const canFinish = targetHp <= (pressure(unit) + alliedDamage) * 0.85;
  const iq = unit.player.stats.iq;
  const margin = iq >= 75 ? 0.84 : iq >= 50 ? 0.94 : 1.06;
  return !canFinish && (availableHp < incoming * margin
    || (threats.length > helpers.length + 1 && unit.hp / unit.maxHp < 0.7)
    || (!lowestTarget && unit.hp / unit.maxHp < 0.55));
}
