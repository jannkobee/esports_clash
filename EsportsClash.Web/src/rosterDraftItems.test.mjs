import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUniqueLineups, isChampionAvailable } from './draftRules.ts';
import { getItemPurchasePlan } from './itemStrategy.ts';
import { RESEARCHED_PLAYERS } from './rosterResearch.ts';
import { ADDITIONAL_CHAMPIONS } from './additionalChampions.ts';

test('a picked avatar cannot be assigned to another player or the other team', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, preferredRole: 'Mage', signatureChampions: [] }));
  const avatars = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: `Avatar ${i}`, primaryRole: 'Mage' }));
  const selections = { p0: 'c2', p1: 'c2', p2: 'c3', p3: 'c4', p4: 'c5' };
  assert.equal(isChampionAvailable('c2', 'p1', selections, []), false);
  const { blue, red } = buildUniqueLineups(players.slice(0, 5), players.slice(5), avatars, selections, ['c0', 'c1']);
  const all = [...blue, ...red].map(pick => pick.champion.id);
  assert.equal(new Set(all).size, 10);
  assert.ok(!all.includes('c0') && !all.includes('c1'));
});

test('component credit completes an item and a full inventory can replace a starter', () => {
  const item = (id, tier, cost, stats) => ({ id, tier, cost, stats, suitableRoles: ['Marksman'] });
  const starter = item('starter', 'Starting', 500, { ad: 10 });
  const bow = item('item_recurve_bow', 'Component', 700, { aspd: 0.2 });
  const harpoon = item('item_kraken_slayer', 'Legendary', 3100, { ad: 45, aspd: 0.35 });
  const filler = Array.from({ length: 5 }, (_, i) => item(`filler${i}`, 'Legendary', 1000, { ad: 24 }));
  const completion = getItemPurchasePlan('Marksman', [starter, bow], 2400, 'Astra', [starter, bow, harpoon]);
  assert.equal(completion?.item.id, 'item_kraken_slayer');
  assert.equal(completion?.goldCost, 2400);
  assert.deepEqual(completion?.removed.map(i => i.id), ['item_recurve_bow']);
  const vest = item('item_chain_vest', 'Component', 800, { armor: 40 });
  const wand = item('item_blasting_wand', 'Component', 850, { ap: 45 });
  const stasis = { ...item('item_zhonyas', 'Legendary', 3000, { ap: 80, armor: 45 }), suitableRoles: ['Mage'] };
  const combined = getItemPurchasePlan('Mage', [vest, wand], 1350, 'Kyumi', [vest, wand, stasis]);
  assert.equal(combined?.goldCost, 1350);
  assert.deepEqual(combined?.removed.map(i => i.id), ['item_chain_vest', 'item_blasting_wand']);
  const replacement = getItemPurchasePlan('Marksman', [starter, ...filler], 2900, 'Astra', [starter, ...filler, harpoon]);
  assert.equal(replacement?.reason, 'replace');
  assert.equal(replacement?.goldCost, 2900);
  assert.deepEqual(replacement?.removed.map(i => i.id), ['starter']);
});

test('research pool has 50 distinct inspirations and all requested avatars', () => {
  assert.equal(RESEARCHED_PLAYERS.length, 50);
  assert.equal(new Set(RESEARCHED_PLAYERS.map(p => p[0])).size, 50);
  assert.ok(RESEARCHED_PLAYERS.some(p => p[1] === 'Cardrel' && p[0] === 'Caedrel'));
  assert.deepEqual(ADDITIONAL_CHAMPIONS.map(c => c.name), ['Veyara', 'Cinderlock', 'Solenne', 'Croakwell', 'Soulscourge', 'Stonewake',
    'Mirehook', 'Nullweaver', 'Voltgrip', 'Aetherbolt', 'Corsara', 'Brewmaw', 'Wraithhook']);
});
