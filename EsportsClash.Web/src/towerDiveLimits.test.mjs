import test from 'node:test';
import assert from 'node:assert/strict';
import { assessTowerDiveRisk, getTurretPerimeterHoldPoint, isBushSafeFromTowers } from './towerDiveRules.ts';

const champion = (role = 'Fighter') => ({ name: 'Valen', primaryRole: role, ad: 160, aspd: 1,
  skill1: { damage: 180 }, skill2: { damage: 120 }, ultimate: { damage: 300 } });
const unit = (overrides = {}) => ({ id: 'blue', team: 'blue', isAlive: true, hp: 1400, maxHp: 1800, shield: 0,
  x: 1220, y: 360, champion: champion(), player: { stats: { iq: 72 }, personality: 'cold_as_ice' },
  cd1: 0, cd2: 0, cdUlt: 0, mana: 100, level: 10, ...overrides });
const tower = { id: 'r_t3', team: 'red', type: 'nexus_tower', x: 1300, y: 360, range: 135, ad: 220, isAlive: true };

test('a coordinated low-health-target dive can commit through real turret risk', () => {
  const result = assessTowerDiveRisk({ diver: unit(), target: unit({ id: 'red', team: 'red', hp: 180, maxHp: 1800, x: 1280 }),
    tower, alliedMinionsUnderTower: 2, defendersUnderTower: 1, attackersUnderTower: 3, takingTurretFire: false });
  assert.equal(result.shouldCommit, true);
  assert.ok(result.expectedEliminationSeconds < result.expectedSurvivalSeconds);
});

test('an unwinnable dive is declined without installing an abort or evacuation state', () => {
  const result = assessTowerDiveRisk({ diver: unit({ hp: 180, shield: 0, x: 1260 }),
    target: unit({ id: 'red', team: 'red', hp: 1700, maxHp: 1800, x: 1300 }), tower,
    alliedMinionsUnderTower: 0, defendersUnderTower: 3, attackersUnderTower: 1, takingTurretFire: true });
  assert.equal(result.shouldCommit, false);
  assert.match(result.reason, /survival|pressured/);
});

test('normal terrain-aware retreat helpers still reject turret death-trap bushes', () => {
  assert.equal(isBushSafeFromTowers({ x: 1310, y: 360 }, [tower]), false);
  assert.deepEqual(getTurretPerimeterHoldPoint({ x: 1240, y: 360, team: 'blue' }, tower), { x: 1137, y: 360 });
});

test('Nexus multishot risk is not divided among five attackers or hidden behind minions', () => {
  const nexus = { ...tower, id: 'r_nexus', type: 'nexus', x: 2365, range: 190, ad: 85 };
  const input = { diver: unit({ x: 2300 }), target: unit({ team: 'red', x: 2370 }), tower: nexus,
    alliedMinionsUnderTower: 0, defendersUnderTower: 1, attackersUnderTower: 5, takingTurretFire: false };
  const a = assessTowerDiveRisk(input);
  const b = assessTowerDiveRisk({ ...input, alliedMinionsUnderTower: 20 });
  assert.equal(a.expectedSurvivalSeconds, b.expectedSurvivalSeconds);
  assert.equal(assessTowerDiveRisk({ ...input, target: unit({ team: 'red', x: 2520 }) }).shouldCommit, false);
});
