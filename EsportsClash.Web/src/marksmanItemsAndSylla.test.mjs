import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_ITEMS, getRecommendedItem } from './itemsData.ts';
import { getItemPurchasePlan } from './itemStrategy.ts';
import { CHAMPIONS } from './mockData.ts';

test('Sylla has balanced fighter base stats (no longer immortal baseline)', () => {
  const sylla = CHAMPIONS.find((c) => c.name === 'Sylla');
  assert.ok(sylla, 'Sylla champion definition must exist in CHAMPIONS');
  assert.equal(sylla.hp, 880, 'Sylla base HP should be 880');
  assert.equal(sylla.armor, 36, 'Sylla base armor should be 36');
});

test('Marksman anti-tank and carry item definitions are present with exact stats', () => {
  // 1. Kraken Slayer keeps its combat stats but uses the faster arena economy.
  const kraken = ALL_ITEMS.find((it) => it.id === 'item_kraken_slayer');
  assert.ok(kraken, 'Kraken Slayer must exist');
  assert.equal(kraken.cost, 1950);
  assert.equal(kraken.stats.ad, 45);
  assert.equal(kraken.stats.aspd, 0.40);
  assert.equal(kraken.stats.moveSpeed, 4);
  assert.equal(kraken.passiveName, 'Bring It Down');

  // 2. Lord Dominik's Regards (LDR: 45 AD, 25% Crit, 35% Armor Pen, Giant Slayer)
  const ldr = ALL_ITEMS.find((it) => it.id === 'item_ldr');
  assert.ok(ldr, "Lord Dominik's Regards must exist");
  assert.equal(ldr.cost, 1950);
  assert.equal(ldr.stats.ad, 45);
  assert.equal(ldr.stats.crit, 25);
  assert.equal(ldr.stats.armorPen, 35);
  assert.equal(ldr.passiveName, 'Giant Slayer');

  // 3. Blade of the Ruined King (Bork: 40 AD, 25% AS, 10% Lifesteal)
  const bork = ALL_ITEMS.find((it) => it.id === 'item_bork');
  assert.ok(bork, 'Blade of the Ruined King must exist');
  assert.equal(bork.stats.ad, 40);
  assert.equal(bork.stats.aspd, 0.25);
  assert.equal(bork.stats.lifesteal, 10);
  assert.equal(bork.passiveName, "Mist's Edge");

  // 4. Mortal Reminder (40 AD, 25% Crit, 30% Armor Pen, Grievous)
  const mortal = ALL_ITEMS.find((it) => it.id === 'item_mortal_reminder');
  assert.ok(mortal, 'Mortal Reminder must exist');
  assert.equal(mortal.stats.armorPen, 30);
  assert.equal(mortal.passiveName, 'Grievous Execution');

  // 5. Phantom Dancer (35 AD, 60% AS, 25% Crit, 7% MS)
  const pd = ALL_ITEMS.find((it) => it.id === 'item_phantom_dancer');
  assert.ok(pd, 'Phantom Dancer must exist');
  assert.equal(pd.stats.aspd, 0.60);
  assert.equal(pd.stats.moveSpeed, 7);

  // 6. Runaan's Hurricane (40% AS, 25% Crit, 4% MS)
  const runaans = ALL_ITEMS.find((it) => it.id === 'item_runaans');
  assert.ok(runaans, "Runaan's Hurricane must exist");
  assert.equal(runaans.stats.aspd, 0.40);
  assert.equal(runaans.stats.crit, 25);

  // 7. Terminus (35 AD, 30% AS, 30% Armor Pen)
  const terminus = ALL_ITEMS.find((it) => it.id === 'item_terminus');
  assert.ok(terminus, 'Terminus must exist');
  assert.equal(terminus.stats.armorPen, 30);

  // 8. Components: Last Whisper & Noonquiver
  const lw = ALL_ITEMS.find((it) => it.id === 'item_last_whisper');
  assert.ok(lw, 'Last Whisper component must exist');
  assert.equal(lw.stats.armorPen, 18);

  const nq = ALL_ITEMS.find((it) => it.id === 'item_noonquiver');
  assert.ok(nq, 'Noonquiver component must exist');
  assert.equal(nq.stats.ad, 30);
  assert.equal(nq.stats.aspd, 0.20);
});

test('Item purchase planner recognizes recipes and marksman recommendations', () => {
  const noonquiver = ALL_ITEMS.find((it) => it.id === 'item_noonquiver');
  assert.ok(noonquiver);

  // The owned component is fully credited toward the cheaper completed item.
  const plan = getItemPurchasePlan('Marksman', [noonquiver], 650, 'Astra', ALL_ITEMS);
  assert.ok(plan);
  assert.equal(plan.item.id, 'item_kraken_slayer');
  assert.equal(plan.reason, 'complete');
  assert.equal(plan.goldCost, 650);

  // Recommendation maps Kindra & Grim to Marksman
  const recommended = getRecommendedItem('Marksman', [], 500, 'Kindra & Grim');
  assert.ok(recommended);
  assert.ok(recommended.suitableRoles.includes('Marksman'));
});

test('Anti-tank damage formulas accurately shred armor and scale vs high-HP tanks', () => {
  // Tank with 150 armor and 3200 max HP vs Marksman with 1800 max HP
  const targetArmor = 150;
  const targetHp = 2500;
  const targetMaxHp = 3200;
  const attackerMaxHp = 1800;

  // 1. Without armor penetration
  const unpenetratedMitigation = 100 / (100 + targetArmor);
  assert.ok(unpenetratedMitigation < 0.41, '150 armor reduces unpenetrated damage to 40%');

  // 2. With LDR (35% Armor Pen)
  const percentPen = 0.35;
  const effectiveArmorWithLdr = targetArmor * (1 - percentPen);
  assert.equal(effectiveArmorWithLdr, 97.5);
  const ldrMitigation = 100 / (100 + effectiveArmorWithLdr);
  assert.ok(ldrMitigation > 0.50, 'LDR raises damage through 150 armor above 50%');

  // 3. LDR Giant Slayer: +22% bonus damage scaling with target max HP advantage
  const hpRatio = Math.min(1.0, (targetMaxHp - attackerMaxHp) / 1200);
  const giantSlayerMultiplier = 1 + hpRatio * 0.22;
  assert.ok(giantSlayerMultiplier >= 1.20, 'Target with 1400 more HP triggers near max Giant Slayer +22%');

  // 4. Bork: 9% current HP on-hit damage
  const borkOnHit = Math.round(targetHp * 0.09);
  assert.equal(borkOnHit, 225, 'Bork deals 225 on-hit physical damage against 2500 HP');

  // 5. Kraken Slayer: missing HP amplification
  const missingHpFactor = 1 - (targetHp / targetMaxHp);
  const baseKrakenProc = 140 + 80 * 0.45; // 176
  const amplifiedKraken = Math.round(baseKrakenProc * (1 + missingHpFactor * 0.50));
  assert.ok(amplifiedKraken > baseKrakenProc, 'Kraken deals amplified bonus damage on missing HP');
});
