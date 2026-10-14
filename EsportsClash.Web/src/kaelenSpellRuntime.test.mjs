import test from 'node:test';
import assert from 'node:assert/strict';
import { KAELEN_COMBOS, KAELEN_INVOKED_SPELLS, chooseKaelenPlan, nextKaelenRecipeOrb, appendKaelenOrb, getKaelenInvokedSpell } from './kaelenAbilities.ts';
import { advanceKaelenCast, isKaelenZoneActive, kaelenCastLifetime, kaelenCastPosition } from './kaelenSpellRuntime.ts';
import { drawKaelenSpell } from './kaelenSpellVisuals.ts';
const spell = id => KAELEN_INVOKED_SPELLS.find(entry => entry.id === id);
const cast = id => ({ spellId: id, origin: { x: 100, y: 380 }, aim: { x: 300, y: 380 }, elapsed: 0, hitIds: [], resolved: false });
const enemy = (id, x, y = 380) => ({ id, x, y, isAlive: true });

test('all legacy recipes construct from any FIFO state and retain ten unique reworked identities', () => {
  assert.equal(KAELEN_INVOKED_SPELLS.length, 10);
  assert.equal(new Set(KAELEN_INVOKED_SPELLS.map(entry => entry.id)).size, 10);
  assert.equal(new Set(KAELEN_INVOKED_SPELLS.map(entry => entry.name)).size, 10);
  for (const a of ['ice', 'wind', 'fire']) for (const b of ['ice', 'wind', 'fire']) for (const c of ['ice', 'wind', 'fire']) for (const entry of KAELEN_INVOKED_SPELLS) {
    let orbs = [a, b, c];
    for (let step = 0; step < 3 && getKaelenInvokedSpell(orbs)?.id !== entry.id; step++) orbs = appendKaelenOrb(orbs, nextKaelenRecipeOrb(orbs, entry.recipe));
    assert.equal(getKaelenInvokedSpell(orbs)?.id, entry.id);
  }
});

test('spellbook defines bounded utility, control and persistence metadata', () => {
  for (const entry of KAELEN_INVOKED_SPELLS) {
    assert.ok(entry.description.length > 70, entry.id); assert.ok(entry.comboTip.length > 25, entry.id);
    assert.ok(entry.mana >= 25 && entry.mana <= 40); assert.ok(entry.radius > 0 && kaelenCastLifetime(entry) > 0);
    assert.ok(KAELEN_COMBOS.some(combo => combo.spells.includes(entry.id)), entry.id);
  }
  assert.equal(spell('glacier-lock').debuff.maxStacks, 3);
  assert.equal(spell('primal-tempest').targeting, 'ally');
  assert.equal(spell('solar-pike').summon.duration, 12);
  assert.ok(spell('sleetflare').zone.tickInterval > 0);
  assert.equal(spell('glacier-lock').ratios.apRatio, .20);
  assert.equal(spell('sirocco-flare').ratios.apRatio, .25);
});

test('Solar Meteor remains delayed, ground-fixed and zone-bounded', () => {
  const meteor = spell('sirocco-flare'), effect = cast(meteor.id), target = enemy('a', 300);
  assert.deepEqual(advanceKaelenCast(effect, meteor, .5, [target]), []);
  target.x = 500; assert.deepEqual(advanceKaelenCast(effect, meteor, .3, [target]), []);
  target.x = 300; const hit = cast(meteor.id);
  assert.deepEqual(advanceKaelenCast(hit, meteor, .8, [target]).map(entry => entry.id), ['a']);
  assert.ok(isKaelenZoneActive(hit, meteor));
  assert.deepEqual(advanceKaelenCast(hit, meteor, .1, [target]), []);
});

test('Rimeball grows, sweeps fast steps, and never hits an enemy twice', () => {
  const rimeball = spell('whiteout-step'), effect = cast(rimeball.id), targets = [enemy('a', 150), enemy('b', 230), enemy('off', 250, 500)];
  assert.equal(kaelenCastPosition(effect, rimeball).radius, 22);
  assert.deepEqual(advanceKaelenCast(effect, rimeball, .7, targets).map(entry => entry.id), ['a', 'b']);
  assert.ok(kaelenCastPosition(effect, rimeball).radius > 22);
  assert.deepEqual(advanceKaelenCast(effect, rimeball, .2, targets), []);
});

test('plans adapt to threat, resource gates, IQ sequence length and no fixed two-spell cap', () => {
  const base = { healthFraction: 1, enemyDistance: 220, clusteredEnemies: 3, threatenedAllies: 0, objectiveFight: false, defending: false, mana: 300, iq: 94, cooldowns: {}, cycle: 0 };
  const initiation = chooseKaelenPlan(base); assert.equal(initiation.id, 'cataclysm'); assert.ok(initiation.spells.length >= 4);
  const defense = chooseKaelenPlan({ ...base, healthFraction: .45, enemyDistance: 90, clusteredEnemies: 1, threatenedAllies: 2 }); assert.equal(defense.id, 'disengage');
  const lowSkill = chooseKaelenPlan({ ...base, iq: 40 }); assert.ok(lowSkill.spells.length <= 2);
  const cooldowns = Object.fromEntries(KAELEN_INVOKED_SPELLS.map(entry => [entry.id, 1])); assert.equal(chooseKaelenPlan({ ...base, cooldowns }), undefined);
});

test('urgent Conflux protection outranks optional personality plans and falls back only to available spells', () => {
  const context = { healthFraction: .4, enemyDistance: 90, clusteredEnemies: 3, threatenedAllies: 2,
    objectiveFight: true, defending: true, mana: 300, iq: 94, cooldowns: {}, cycle: 0 };
  for (const personality of [['bodyguard'], ['objective_zealot'], ['perfectionist'], []]) {
    for (const cycle of [0, 1]) assert.equal(chooseKaelenPlan({ ...context, personality, cycle }).id, 'disengage');
  }
  const unavailable = KAELEN_COMBOS.find(combo => combo.id === 'disengage').spells;
  const cooldowns = Object.fromEntries(unavailable.map(id => [id, 20]));
  const fallback = chooseKaelenPlan({ ...context, cooldowns });
  assert.ok(fallback);
  assert.ok(fallback.spells.every(id => !unavailable.includes(id)));
});

test('invoked effects reject dead, untargetable and stasis targets and render safely', () => {
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  for (const entry of KAELEN_INVOKED_SPELLS) {
    const targets = [{ ...enemy('dead', 300), isAlive: false }, { ...enemy('gold', 300), zhonyaActive: true }, { ...enemy('hidden', 300), untargetableTimer: 1 }];
    assert.deepEqual(advanceKaelenCast(cast(entry.id), entry, 2, targets), [], entry.id);
    for (const elapsed of [0, .4, .9, 1.8]) drawKaelenSpell(ctx, { ...cast(entry.id), elapsed }, .8);
  }
});
