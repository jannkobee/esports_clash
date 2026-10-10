import type { AramChampionUnit } from './types';

export const BLACK_HOLE_RADIUS = 105;

type Fighter = Pick<AramChampionUnit, 'id' | 'x' | 'y' | 'hp' | 'maxHp' | 'mana' | 'level' | 'cdUlt' | 'blackHole' | 'champion' | 'player'>;

export function threatensBlackHole(enemy: Fighter): boolean {
  return enemy.champion.name === 'Nullweaver' && enemy.level >= 6 && enemy.cdUlt <= 0
    && enemy.mana >= 100 && !enemy.blackHole && enemy.hp > 0;
}

export function shouldSpreadForBlackHole(unit: Fighter, enemy: Fighter, ally: Fighter): boolean {
  return unit.player.stats.iq >= 70 && unit.player.stats.tf >= 60 && threatensBlackHole(enemy)
    && Math.hypot(unit.x - enemy.x, unit.y - enemy.y) <= 240
    && Math.hypot(unit.x - ally.x, unit.y - ally.y) < 100;
}

export function shouldSaveBlackHoleInterrupt(unit: Fighter, target: Fighter): boolean {
  return unit.player.stats.iq >= 72 && unit.player.stats.tf >= 65 && threatensBlackHole(target)
    && target.hp / target.maxHp > 0.38 && unit.hp / unit.maxHp > 0.45;
}
