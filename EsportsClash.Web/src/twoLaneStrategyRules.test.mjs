import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TWO_LANE_STRATEGIES,
  assignSquadTwoLaneRoles,
  getTwoLaneFormationY,
  evaluateDynamicLaneRotation,
} from './twoLaneStrategyRules.ts';
import { topLaneY, botLaneY } from './arenaLayout.ts';

function createMockChampion(id, team, role = 'solo', iq = 75, hp = 1000) {
  return {
    id,
    team,
    assignedLane: undefined,
    tacticalRole: role,
    x: 300,
    y: 720,
    hp,
    maxHp: hp,
    player: {
      id: `p_${id}`,
      name: `Player_${id}`,
      stats: { iq, lan: 75, tf: 75, clu: 75, sta: 75, flx: 75 },
    },
    champion: {
      id: `c_${id}`,
      name: `Champion_${id}`,
      primaryRole: 'Fighter',
      hp,
      ad: 80,
      armor: 30,
      mr: 30,
      aspd: 1.0,
    },
  };
}

test('twoLaneStrategy: descriptors define distinct squad distributions', () => {
  assert.equal(TWO_LANE_STRATEGIES.standard_2_3.topCount, 2);
  assert.equal(TWO_LANE_STRATEGIES.standard_2_3.botCount, 3);
  assert.equal(TWO_LANE_STRATEGIES.heavy_top_3_2.topCount, 3);
  assert.equal(TWO_LANE_STRATEGIES.heavy_top_3_2.botCount, 2);
  assert.equal(TWO_LANE_STRATEGIES.flex_roam_2_2_1.roamCount, 1);
});

test('twoLaneStrategy: assignSquadTwoLaneRoles distributes 5 team members correctly', () => {
  const team = [0, 1, 2, 3, 4].map(i => createMockChampion(`champ_${i}`, 'blue'));

  // Standard 2-3
  assignSquadTwoLaneRoles(team, 'standard_2_3');
  assert.equal(team[0].assignedLane, 'top');
  assert.equal(team[1].assignedLane, 'top');
  assert.equal(team[2].assignedLane, 'bot');
  assert.equal(team[3].assignedLane, 'bot');
  assert.equal(team[4].assignedLane, 'bot');
  assert.equal(team[1].tacticalRole, 'roam');

  // Heavy Top 3-2
  assignSquadTwoLaneRoles(team, 'heavy_top_3_2');
  assert.equal(team[0].assignedLane, 'top');
  assert.equal(team[1].assignedLane, 'top');
  assert.equal(team[2].assignedLane, 'top');
  assert.equal(team[3].assignedLane, 'bot');
  assert.equal(team[4].assignedLane, 'bot');

  // Flex Roam 2-2-1
  assignSquadTwoLaneRoles(team, 'flex_roam_2_2_1');
  assert.equal(team[0].assignedLane, 'top');
  assert.equal(team[1].assignedLane, 'top');
  assert.equal(team[2].assignedLane, undefined); // roamer floats
  assert.equal(team[2].tacticalRole, 'roam');
  assert.equal(team[3].assignedLane, 'bot');
  assert.equal(team[4].assignedLane, 'bot');
});

test('twoLaneStrategy: getTwoLaneFormationY places units in lanes, never on the center axis', () => {
  const x = 1400;
  const topExpectedCenter = topLaneY(x); // 270
  const botExpectedCenter = botLaneY(x); // 1170

  const yTop0 = getTwoLaneFormationY(0, 'blue', x, 'top');
  const yTop1 = getTwoLaneFormationY(1, 'blue', x, 'top');
  const yBot0 = getTwoLaneFormationY(2, 'blue', x, 'bot');
  const yBot1 = getTwoLaneFormationY(3, 'blue', x, 'bot');

  assert.ok(Math.abs(yTop0 - topExpectedCenter) < 40, 'Top units sit near topLaneY');
  assert.ok(Math.abs(yTop1 - topExpectedCenter) < 40, 'Top units sit near topLaneY');
  assert.ok(Math.abs(yBot0 - botExpectedCenter) < 40, 'Bot units sit near botLaneY');
  assert.ok(Math.abs(yBot1 - botExpectedCenter) < 40, 'Bot units sit near botLaneY');

  // Must not sit at 720 (center river)
  assert.ok(Math.abs(yTop0 - 720) > 300, 'Top units must never sit at 720');
  assert.ok(Math.abs(yBot0 - 720) > 300, 'Bot units must never sit at 720');
});

test('twoLaneStrategy: evaluateDynamicLaneRotation rotates roamer to Dragon Embermaw when active', () => {
  const roamer = createMockChampion('roam_1', 'blue', 'roam', 88);
  roamer.assignedLane = 'bot';
  roamer.y = 1170;

  const structures = [
    { id: 'b_top_t1', team: 'blue', lane: 'top', type: 'outer_tower', isAlive: true, hp: 4000, maxHp: 4000 },
    { id: 'r_top_t1', team: 'red', lane: 'top', type: 'outer_tower', isAlive: true, hp: 4000, maxHp: 4000 },
  ];

  // Dragon Embermaw active in Top Pit
  const dragon = { isAlive: true, spawnTimer: 0, x: 1400, y: 115 };
  const rotation = evaluateDynamicLaneRotation({
    unit: roamer,
    structures,
    dragon,
    gameSecond: 180,
  });

  assert.equal(rotation.shouldRotate, true);
  assert.equal(rotation.targetLane, 'top');
  assert.equal(rotation.reason, 'contest_dragon_embermaw');
});

test('twoLaneStrategy keeps a roamer assigned to a threatened tower while Embermaw is active', () => {
  const unit = createMockChampion('roam_defender', 'blue', 'roam', 88);
  unit.assignedLane = 'top';
  const tower = { id: 'b_bot_t2', team: 'blue', lane: 'bot', type: 'inner_tower', isAlive: true, hp: 900, maxHp: 4000 };
  const params = { unit, structures: [tower], dragon: { isAlive: true, spawnTimer: 0, x: 1400, y: 115 }, gameSecond: 180 };
  assert.deepEqual(evaluateDynamicLaneRotation(params), { shouldRotate: true, targetLane: 'bot', reason: 'defend_threatened_tower' });
  unit.assignedLane = 'bot';
  assert.deepEqual(evaluateDynamicLaneRotation(params), { shouldRotate: false, targetLane: 'bot', reason: 'defend_threatened_tower' });
  tower.isAlive = false;
  assert.deepEqual(evaluateDynamicLaneRotation(params), { shouldRotate: true, targetLane: 'top', reason: 'contest_dragon_embermaw' });
});

test('twoLaneStrategy: evaluateDynamicLaneRotation rotates to breach remaining outer tower when lane is cleared', () => {
  const roamer = createMockChampion('roam_2', 'blue', 'roam', 85);
  roamer.assignedLane = 'top';
  roamer.y = 270;

  // Red Top outer tower is destroyed, but Red Bot outer tower is alive
  const structures = [
    { id: 'b_top_t1', team: 'blue', lane: 'top', type: 'outer_tower', isAlive: true, hp: 4000, maxHp: 4000 },
    { id: 'r_top_t1', team: 'red', lane: 'top', type: 'outer_tower', isAlive: false, hp: 0, maxHp: 4000 },
    { id: 'r_bot_t1', team: 'red', lane: 'bot', type: 'outer_tower', isAlive: true, hp: 4000, maxHp: 4000 },
  ];

  const rotation = evaluateDynamicLaneRotation({
    unit: roamer,
    structures,
    gameSecond: 200,
  });

  assert.equal(rotation.shouldRotate, true);
  assert.equal(rotation.targetLane, 'bot');
  assert.equal(rotation.reason, 'rotate_to_breach_other_lane');
});

