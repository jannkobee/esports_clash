import test from 'node:test';
import assert from 'node:assert/strict';
import { matchEconomyPhase, passiveGoldPerSecond } from './economyRules.ts';
import { ALL_ITEMS, BOOTS } from './itemsData.ts';

test('8 to 10 minutes is late game and 11 minutes begins super late game without forcing a match to last', () => {
  assert.equal(matchEconomyPhase(7 * 60 + 59), 'Mid game');
  assert.equal(matchEconomyPhase(8 * 60), 'Late game');
  assert.equal(matchEconomyPhase(10 * 60 + 59), 'Late game');
  assert.equal(matchEconomyPhase(11 * 60), 'Super late game');
  assert.equal(matchEconomyPhase(13 * 60), 'Super late game');
});

test('skilled farming can reach 3 to 4 items by 8 to 10 minutes and 5 to 6 by minute 12', () => {
  const sixMarksmanItems = ALL_ITEMS.filter(item => item.suitableRoles.includes('Marksman')
    && (item.tier === 'Legendary' || item.tier === 'Mythic'))
    .sort((a, b) => a.cost - b.cost).slice(0, 6);
  assert.equal(sixMarksmanItems.length, 6);
  const fullBuildCost = sixMarksmanItems.reduce((sum, item) => sum + item.cost, BOOTS.cost);
  const threeItemCost = sixMarksmanItems.slice(0, 3).reduce((sum, item) => sum + item.cost, BOOTS.cost);
  const fourItemCost = sixMarksmanItems.slice(0, 4).reduce((sum, item) => sum + item.cost, BOOTS.cost);
  const eliteAt8 = 1500 + passiveGoldPerSecond(95) * 480;
  const eliteAt10 = 1500 + passiveGoldPerSecond(95) * 600 + 150 * 10;
  const eliteAt12 = 1500 + passiveGoldPerSecond(95) * 720 + 200 * 12;
  const weakAt12 = 1500 + passiveGoldPerSecond(25) * 720 + 80 * 12;
  assert.ok(eliteAt8 >= threeItemCost);
  assert.ok(eliteAt10 >= fourItemCost);
  assert.ok(eliteAt12 >= fullBuildCost);
  assert.ok(weakAt12 < fullBuildCost);
});
