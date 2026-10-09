import test from 'node:test';
import assert from 'node:assert/strict';
import { getTeamKillScore, getTeamTotalGold, getTowersAliveCount, getTeamNames } from './scoreboardRules.ts';

test('header kill score matches the sum of player kill records', () => {
  const units = [
    { team: 'blue', kills: 2, deaths: 1 },
    { team: 'blue', kills: 0, deaths: 0 },
    { team: 'red', kills: 1, deaths: 2 },
  ];
  assert.deepEqual(getTeamKillScore(units), { blue: 2, red: 1 });
  units[0].kills = 3;
  assert.deepEqual(getTeamKillScore(units), { blue: 3, red: 1 });
  units[2].deaths += 1; // A neutral death is not a champion kill.
  assert.deepEqual(getTeamKillScore(units), { blue: 3, red: 1 });
});

test('team total gold starts at 7,500 for a five-player roster and tracks income', () => {
  const blueRoster = [
    { team: 'blue', gold: 500, items: [{ cost: 500 }, { cost: 500 }] },
    { team: 'blue', gold: 600, items: [{ cost: 900 }] },
    { team: 'blue', gold: 1500, items: [] },
    { team: 'blue', gold: 0, items: [{ cost: 1500 }] },
    { team: 'blue', gold: 700, items: [{ cost: 800 }] },
  ];
  assert.equal(getTeamTotalGold(blueRoster, 'blue'), 7500);

  // Farming passive income or minion kill
  blueRoster[0].gold += 300;
  assert.equal(getTeamTotalGold(blueRoster, 'blue'), 7800);

  // Purchasing an item swaps gold into equipment value with zero loss
  blueRoster[0].gold -= 800;
  blueRoster[0].items.push({ cost: 800 });
  assert.equal(getTeamTotalGold(blueRoster, 'blue'), 7800);
  blueRoster[0].gold -= 450;
  blueRoster[0].boots = { cost: 450 };
  assert.equal(getTeamTotalGold(blueRoster, 'blue'), 7800);
});

test('structure counter reflects remaining alive towers accurately', () => {
  const structures = [
    { team: 'blue', type: 'outer_tower', isAlive: true },
    { team: 'blue', type: 'inner_tower', isAlive: true },
    { team: 'blue', type: 'nexus_tower', isAlive: true },
    { team: 'blue', type: 'barracks', isAlive: true },
    { team: 'red', type: 'outer_tower', isAlive: false },
    { team: 'red', type: 'inner_tower', isAlive: true },
    { team: 'red', type: 'nexus_tower', isAlive: true },
  ];
  assert.equal(getTowersAliveCount(structures, 'blue'), 3);
  assert.equal(getTowersAliveCount(structures, 'red'), 2);
});

test('team names correctly match draft names without hardcoded mismatches', () => {
  assert.deepEqual(getTeamNames({}), {
    blue: 'T-CHIBI SQUAD',
    red: 'RIVAL CHIBI SQUAD',
  });
  assert.deepEqual(getTeamNames({ opponentName: 'Rival Chibi Squad' }), {
    blue: 'T-CHIBI SQUAD',
    red: 'Rival Chibi Squad',
  });
});

test('neutral executions do not award team kills, preserving exact KDA synchronization', () => {
  const blueUnits = [
    { team: 'blue', kills: 0, deaths: 0, assists: 0 },
    { team: 'blue', kills: 0, deaths: 0, assists: 0 },
  ];
  const redUnits = [
    { team: 'red', kills: 0, deaths: 0, assists: 0 },
    { team: 'red', kills: 0, deaths: 0, assists: 0 },
  ];
  const allUnits = [...blueUnits, ...redUnits];

  // Red executed by blue turret - no champion killer
  redUnits[0].deaths += 1;
  assert.deepEqual(getTeamKillScore(allUnits), { blue: 0, red: 0 });

  // Blue champion kills red champion with ally assist
  blueUnits[0].kills += 1;
  blueUnits[1].assists += 1;
  redUnits[1].deaths += 1;
  assert.deepEqual(getTeamKillScore(allUnits), { blue: 1, red: 0 });
});
