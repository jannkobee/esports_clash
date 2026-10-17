import test from 'node:test';
import assert from 'node:assert/strict';
import { isInsideHealingWell, isInsideEnemyWellBeam, isUnsafeWellChase, capBaseLaneAdvance } from './baseSafetyRules.ts';
import { chooseTeamfightTarget } from './combatDecision.ts';
import { laneAdvanceLimit, isTeamfightApproachSafe } from './teamTempoRules.ts';
import { resolveFightCommitment } from './decisionCommitment.ts';

test('well chase and lane overshoot decisions are mirrored and preserve legal Nexus approach', () => {
  for (const team of ['blue', 'red']) {
    const enemy = team === 'blue' ? 'red' : 'blue';
    const mirror = x => team === 'blue' ? x : 2600 - x;
    const actor = { team, x: mirror(2350), y: 380 };
    const target = { team: enemy, x: mirror(2500), y: 380 };
    assert.equal(isInsideHealingWell(enemy, target), true);
    assert.equal(isInsideEnemyWellBeam(team, target), true);
    assert.equal(isUnsafeWellChase(actor, target, 200), true);
    assert.equal(isTeamfightApproachSafe(actor, target, []), false);
    assert.equal(isTeamfightApproachSafe(actor, { x: mirror(2365), y: 380 }, []), true);
    assert.equal(isUnsafeWellChase(actor, { ...target, x: mirror(2440) }, 100), false);
    const limit = laneAdvanceLimit({ team, waveCount: 0, exposedNexus: true, objectiveFight: false, attackRange: 50 });
    assert.ok(Number.isFinite(limit));
    assert.equal(limit, mirror(2320));
    assert.equal(capBaseLaneAdvance(team, mirror(2000), 50), mirror(2000));
    assert.equal(laneAdvanceLimit({ team, waveCount: 10, waveFrontX: mirror(2540),
      structureX: mirror(2365), structureRange: 190, exposedNexus: false, objectiveFight: false,
      structureApproachUnsafe: true }), mirror(2147));
  }
});

test('a five-player chase does not acquire healing-well defenders even with channel follow-up', () => {
  const actor = { id: 'a', team: 'blue', x: 2350, y: 380, hp: 1000, maxHp: 1000, isAlive: true,
    cd1: 0, cd2: 0, cdUlt: 0, level: 6, mana: 100,
    player: { stats: { iq: 99, tf: 99 }, primaryPersonality: 'overconfident' },
    champion: { name: 'test', primaryRole: 'Fighter', ad: 200, skill1: { damage: 100 }, skill2: { damage: 100 } } };
  const enemies = Array.from({ length: 5 }, (_, i) => ({ ...actor, id: `e${i}`, team: 'red', x: 2500, hp: 10 }));
  const allies = [{ ...actor, id: 'channel', blackHole: { x: 2500, y: 380 } }];
  assert.equal(chooseTeamfightTarget(actor, enemies, allies, 100), undefined);
});

test('actual lethal environment interrupts fight commitment through ordinary retreat arbitration', () => {
  const result = resolveFightCommitment({ committedState: 'fight', timer: 1, dangerous: false,
    enemyCount: 5, inWell: false, followUp: true, lowHealth: false, losingFight: false, lethalEnvironment: true });
  assert.equal(result.dangerous, true);
  assert.equal(result.committedState, 'retreat');
  assert.equal(result.timer, .45);
});
