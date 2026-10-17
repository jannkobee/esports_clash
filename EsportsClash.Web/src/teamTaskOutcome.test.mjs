import test from 'node:test';
import assert from 'node:assert/strict';
import { captureTeamTaskSnapshot, summarizeTeamTaskOutcome, validTeamTaskOutcome } from './teamTaskOutcome.ts';
const start = () => ({ second: 120, ownDeaths: 0, enemyDeaths: 0, ownStructureHp: 10000,
  enemyStructureHp: 10000, ownEconomy: 10000, enemyEconomy: 10000, ownHealth: 5, enemyHealth: 5,
  dragonBalance: 0, siegeBalance: 0, ownNexusAlive: true, enemyNexusAlive: true });
const task = () => ({ horizonSeconds: 30, campGold: 0, waveGold: 0, structureDamage: 0,
  deaths: 0, campClears: 0, minionKills: 0, firstCompletionSeconds: null, reward: 0 });

test('team target distinguishes lost towers and allied deaths despite equal personal farm credit', () => {
  const base = start(), end = { ...base, second: 150 };
  const unchanged = summarizeTeamTaskOutcome(base, end, task());
  const towerLoss = summarizeTeamTaskOutcome(base, { ...end, ownStructureHp: 9546 }, task());
  const death = summarizeTeamTaskOutcome(base, { ...end, ownDeaths: 1 }, task());
  assert.equal(unchanged.reward, 0); assert.ok(towerLoss.reward < -.06);
  assert.equal(death.ownDeaths, 1); assert.ok(death.reward < -.5);
  const respawned = summarizeTeamTaskOutcome(base, { ...end, ownDeaths: 1, ownHealth: 5 }, task());
  assert.equal(respawned.reward, death.reward);
  assert.ok(validTeamTaskOutcome(towerLoss));
  assert.equal(validTeamTaskOutcome({ ...towerLoss, reward: 1 }), false);
});

test('balanced passive income and purchases do not manufacture team value; finished nexus dominates', () => {
  const base = start(), end = { ...base, second: 150, ownEconomy: 11000, enemyEconomy: 11000 };
  assert.equal(summarizeTeamTaskOutcome(base, end, task()).reward, 0);
  assert.equal(summarizeTeamTaskOutcome(base, { ...end, ownDeaths: 5, enemyNexusAlive: false }, task()).reward, 1);
  assert.equal(summarizeTeamTaskOutcome(base, { ...end, enemyDeaths: 5, ownNexusAlive: false }, task()).reward, -1);
  const unit = { team: 'blue', deaths: 0, isAlive: true, hp: 100, maxHp: 100,
    gold: 1000, items: [], boots: { cost: 300 } };
  const input = { second: 120, team: 'blue', champions: [unit], structures: [], siegeUnits: [] };
  const before = captureTeamTaskSnapshot(input);
  const purchased = captureTeamTaskSnapshot({ ...input, champions: [{ ...unit, gold: 500, items: [{ cost: 500 }] }] });
  assert.equal(before.ownEconomy, purchased.ownEconomy);
});

test('team labels reject mismatched horizons, missing metrics and impossible death counters', () => {
  const base = start(), end = { ...base, second: 150 };
  assert.equal(summarizeTeamTaskOutcome(base, { ...end, ownDeaths: -1 }, task()), undefined);
  assert.equal(summarizeTeamTaskOutcome(base, end, { ...task(), horizonSeconds: 8 }), undefined);
  assert.equal(summarizeTeamTaskOutcome(base, end, { ...task(), deaths: 1, reward: -1 }), undefined);
  assert.equal(summarizeTeamTaskOutcome(base, { ...end, enemyEconomy: NaN }, task()), undefined);
  assert.equal(summarizeTeamTaskOutcome(base, { ...end, ownHealth: undefined }, task()), undefined);
});
