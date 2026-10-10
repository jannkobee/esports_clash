import test from 'node:test';
import assert from 'node:assert/strict';
import { ADDITIONAL_CHAMPIONS } from './additionalChampions.ts';
import { ALL_ITEMS } from './itemsData.ts';
import { chooseTeamfightTarget } from './combatDecision.ts';

test('Cinderbloom is verified as a melee assassin avatar with 50 melee attack range', () => {
  const cinderbloom = ADDITIONAL_CHAMPIONS.find(c => c.id === 'c_locke');
  assert.ok(cinderbloom, 'Cinderbloom avatar exists');
  assert.equal(cinderbloom.name, 'Cinderbloom');
  assert.equal(cinderbloom.range, 1.4, 'Melee range in champion kit definition');
  assert.equal(cinderbloom.primaryRole, 'Assassin');
  assert.ok(cinderbloom.passiveDesc.includes('melee strikes'), 'Passive reflects melee identity');
});

test('Target stickiness hysteresis prevents target-fluttering between two equidistant enemies', () => {
  const unit = {
    id: 'hero_1',
    team: 'blue',
    x: 200,
    y: 350,
    traitFocusId: 'enemy_a', // previously engaged enemy_a
    player: { stats: { tf: 70, lan: 60 } },
    champion: { name: 'Cinderbloom', ad: 70, primaryRole: 'Assassin' }
  };

  // enemy_b is slightly closer (180px) than enemy_a (184px)
  const enemies = [
    { id: 'enemy_a', isAlive: true, x: 384, y: 350, hp: 500, maxHp: 1000, champion: { armor: 40, mr: 30 } },
    { id: 'enemy_b', isAlive: true, x: 380, y: 350, hp: 500, maxHp: 1000, champion: { armor: 40, mr: 30 } }
  ];

  const chosen = chooseTeamfightTarget(unit, enemies, [], 50);
  assert.equal(chosen.id, 'enemy_a', 'Stickiness bonus (+1.4) maintains target focus on enemy_a instead of fluttering to enemy_b');
});

test('New Support items exist with correct stats, passives, and gold economy values', () => {
  const supportItems = [
    'item_echoes_of_helia',
    'item_shurelyas',
    'item_knights_vow',
    'item_locket',
    'item_ardent_censer',
    'item_redemption'
  ];

  for (const itemId of supportItems) {
    const item = ALL_ITEMS.find(it => it.id === itemId);
    assert.ok(item, `Support item ${itemId} exists in ALL_ITEMS`);
    assert.ok(item.cost >= 1400 && item.cost <= 1800, `Balanced support gold cost for ${item.id} (${item.cost})`);
    assert.ok(item.passiveDesc && item.passiveName, 'Has detailed passive rules');
  }
});

test('New Ability Haste and Ability Amp (AP, AD, Lethality) items exist with appropriate scaling stats', () => {
  const hasteAndAmpItems = [
    'item_black_cleaver',
    'item_shojin',
    'item_navori',
    'item_cosmic_drive',
    'item_ghostblade',
    'item_duskblade',
    'item_serpents_fang',
    'item_shadowflame',
    'item_horizon_focus'
  ];

  for (const itemId of hasteAndAmpItems) {
    const item = ALL_ITEMS.find(it => it.id === itemId);
    assert.ok(item, `Item ${itemId} exists in ALL_ITEMS`);
    assert.equal(item.tier, 'Legendary');
    assert.ok(item.stats.haste || item.stats.lethality || item.stats.magicPen, 'Item grants Haste, Lethality or Magic Pen');
  }

  const ghostblade = ALL_ITEMS.find(it => it.id === 'item_ghostblade');
  assert.equal(ghostblade.stats.lethality, 18, 'Ghostblade grants 18 Lethality');
  assert.equal(ghostblade.stats.haste, 15, 'Ghostblade grants 15 Haste');

  const shojin = ALL_ITEMS.find(it => it.id === 'item_shojin');
  assert.equal(shojin.stats.haste, 30, 'Shojin grants 30 Haste');
  assert.equal(shojin.stats.hp, 300, 'Shojin grants 300 HP');

  const shadowflame = ALL_ITEMS.find(it => it.id === 'item_shadowflame');
  assert.equal(shadowflame.stats.magicPen, 18, 'Shadowflame grants 18 Magic Penetration');
  assert.equal(shadowflame.stats.ap, 90, 'Shadowflame grants 90 AP');
});

test('Lethality formulas scale armor penetration with champion level', () => {
  const calcLethalityArmorPen = (lethality, level) => lethality * (0.6 + (0.4 * level) / 18);

  const lvl1Pen = calcLethalityArmorPen(18, 1);
  const lvl9Pen = calcLethalityArmorPen(18, 9);
  const lvl18Pen = calcLethalityArmorPen(18, 18);

  assert.equal(Number(lvl1Pen.toFixed(1)), 11.2, 'Lvl 1 provides 11.2 armor penetration');
  assert.equal(Number(lvl9Pen.toFixed(1)), 14.4, 'Lvl 9 provides 14.4 armor penetration');
  assert.equal(lvl18Pen, 18, 'Lvl 18 provides 100% full lethality armor ignore');
});
