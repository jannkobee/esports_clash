import test from 'node:test';
import assert from 'node:assert/strict';
import { passiveGoldPerSecond } from './economyRules.ts';
import { ALL_ITEMS, BOOTS } from './itemsData.ts';

test('elite farming can fund six completed items near minute 15 while weak farming cannot', () => {
  const sixMarksmanItems = ALL_ITEMS.filter(item => item.suitableRoles.includes('Marksman')
    && (item.tier === 'Legendary' || item.tier === 'Mythic'))
    .sort((a, b) => a.cost - b.cost).slice(0, 6);
  assert.equal(sixMarksmanItems.length, 6);
  const fullBuildCost = sixMarksmanItems.reduce((sum, item) => sum + item.cost, BOOTS.cost);
  assert.ok(1500 + passiveGoldPerSecond(95) * 900 >= fullBuildCost);
  assert.ok(1500 + passiveGoldPerSecond(25) * 900 < fullBuildCost);
});
