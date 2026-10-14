import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFightCommitment } from './decisionCommitment.ts';
import { perceiveChampions } from './decisionPerception.ts';
import { runSimulationSlice, shouldPublishHud } from './simulationPresentation.ts';

test('commitment extraction matches risk-based arbitration across all flags', () => {
  for (const state of [undefined, 'fight', 'retreat', 'cover']) for (let flags = 0; flags < 128; flags++) {
    const bits = Array.from({ length: 7 }, (_, i) => !!(flags & (1 << i)));
    const [dangerous, nearby, inWell, followUp, lowHealth, losingFight, active] = bits;
    const timer = active ? 0.2 : 0;
    let expected = dangerous, committedState = state, nextTimer = timer;
    if (state === 'retreat' && timer > 0 && nearby && !inWell && !followUp) expected = true;
    else if (state === 'fight' && timer > 0 && !lowHealth && !losingFight) expected = false;
    if (expected && state !== 'retreat') { committedState = 'retreat'; nextTimer = 0.45; }
    else if (!expected && state !== 'fight' && nearby) { committedState = 'fight'; nextTimer = 0.35; }
    else if (!nearby) committedState = undefined;
    assert.deepEqual(resolveFightCommitment({ committedState: state, timer, dangerous,
      enemyCount: nearby ? 1 : 0, inWell, followUp, lowHealth, losingFight }),
    { dangerous: expected, committedState, timer: nextTimer });
  }
});

test('perception preserves visibility, roster order, unavailable allies and live mutations', () => {
  const unit = { id: 'self', team: 'blue', isAlive: true, x: 0, y: 0 };
  const ally = { ...unit, id: 'ally', isRecalling: true };
  const enemy = { ...unit, id: 'enemy', team: 'red', x: 100, isInBush: true, currentBushId: 'bush' };
  const roster = [unit, ally, enemy];
  assert.equal(perceiveChampions(unit, roster, []).enemies.length, 0);
  const visible = perceiveChampions(unit, roster, [{ team: 'blue', bushId: 'bush' }]);
  assert.deepEqual(visible.enemies, [enemy]);
  assert.deepEqual(visible.allies, [unit, ally]);
  assert.deepEqual(visible.localAllies, [unit]);
  enemy.isAlive = false;
  assert.equal(perceiveChampions(unit, roster, [{ team: 'blue', bushId: 'bush' }]).enemies.length, 0);
});

test('HUD publications are bounded independently of simulation speed; final flush works', () => {
  const clock = { current: -Infinity };
  let publications = 0;
  for (let ms = 0; ms < 1000; ms++) if (shouldPublishHud(clock, ms)) publications++;
  assert.equal(publications, 10);
  assert.equal(shouldPublishHud(clock, 999, true), true);
});

test('batch slice yields between whole ticks and stops immediately on victory', () => {
  let ticks = 0, time = 0;
  assert.equal(runSimulationSlice(120, () => { ticks++; time += 3; }, () => false, () => time, 8), 3);
  assert.equal(ticks, 3);
  assert.equal(runSimulationSlice(120, () => ticks++, () => ticks === 5, () => time, 8), 2);
  assert.equal(runSimulationSlice(12, () => ticks++, () => false, () => time), 12);
});
