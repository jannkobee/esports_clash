import test from 'node:test';
import assert from 'node:assert/strict';
import { settlePackPurchase } from './packEconomy.ts';

test('paid packs reduce coins even when every pull upgrades a duplicate', () => {
  assert.deepEqual(settlePackPurchase(3500, 1800, 5), { balance: 1700, duplicateUpgrades: 5 });
  assert.deepEqual(settlePackPurchase(3500, 600, 3), { balance: 2900, duplicateUpgrades: 3 });
  assert.deepEqual(settlePackPurchase(3500, 0, 3), { balance: 3500, duplicateUpgrades: 3 });
  assert.equal(settlePackPurchase(500, 600, 0), null);
});
