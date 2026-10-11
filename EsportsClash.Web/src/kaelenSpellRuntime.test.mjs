import test from 'node:test';
import assert from 'node:assert/strict';
import { KAELEN_COMBOS, KAELEN_INVOKED_SPELLS, chooseKaelenCombo, nextKaelenRecipeOrb, appendKaelenOrb, getKaelenInvokedSpell } from './kaelenAbilities.ts';
import { advanceKaelenCast, kaelenCastLifetime, kaelenCastPosition } from './kaelenSpellRuntime.ts';
import { drawKaelenSpell } from './kaelenSpellVisuals.ts';
const spell = id => KAELEN_INVOKED_SPELLS.find(s => s.id === id);
const cast = id => ({ spellId: id, origin: { x: 100, y: 380 }, aim: { x: 300, y: 380 }, elapsed: 0, hitIds: [], resolved: false });
const enemy = (id, x, y = 380) => ({ id, x, y, isAlive: true });

test('AI builds every intended recipe from any previous three-orb queue within three gathers', () => {
  for (const a of ['ice', 'wind', 'fire']) for (const b of ['ice', 'wind', 'fire']) for (const c of ['ice', 'wind', 'fire']) {
    for (const s of KAELEN_INVOKED_SPELLS) {
      let orbs = [a,b,c];
      for (let i = 0; i < 3 && getKaelenInvokedSpell(orbs)?.id !== s.id; i++) orbs = appendKaelenOrb(orbs, nextKaelenRecipeOrb(orbs, s.recipe));
      assert.equal(getKaelenInvokedSpell(orbs)?.id, s.id);
    }
  }
});

test('all ten recipes have full targeting, timing, mana, and combo descriptions', () => {
  for (const s of KAELEN_INVOKED_SPELLS) {
    assert.ok(s.description.length > 70, s.id);
    assert.ok(s.comboTip.length > 25, s.id);
    assert.ok(s.mana >= 25 && s.mana <= 35);
    assert.ok(s.radius > 0 && kaelenCastLifetime(s) > 0);
    assert.ok(KAELEN_COMBOS.some(combo => combo.spells.includes(s.id)), s.id);
  }
});
test('meteor is delayed, dodgeable, and resolves once at its original ground point', () => {
  const s = spell('solar-pike'), effect = cast(s.id), target = enemy('a', 300);
  assert.deepEqual(advanceKaelenCast(effect, s, 0.5, [target]), []);
  target.x = 500;
  assert.deepEqual(advanceKaelenCast(effect, s, 0.3, [target]), []);
  target.x = 300;
  assert.deepEqual(advanceKaelenCast(effect, s, 0.1, [target]), []);
  const hit = cast(s.id);
  assert.deepEqual(advanceKaelenCast(hit, s, 0.8, [target]).map(e => e.id), ['a']);
  assert.deepEqual(advanceKaelenCast(hit, s, 0.1, [target]), []);
});
test('snowball grows, sweeps across fast steps, and never hits one enemy twice', () => {
  const s = spell('rime-gale'), effect = cast(s.id), targets = [enemy('a', 150), enemy('b', 230), enemy('off', 250, 500)];
  assert.equal(kaelenCastPosition(effect, s).radius, 22);
  assert.deepEqual(advanceKaelenCast(effect, s, 0.7, targets).map(e => e.id), ['a', 'b']);
  assert.ok(kaelenCastPosition(effect, s).radius > 22);
  assert.deepEqual(advanceKaelenCast(effect, s, 0.2, targets), []);
  advanceKaelenCast(effect, s, 5, targets);
  assert.equal(kaelenCastPosition(effect, s).radius, 48);
  assert.equal(kaelenCastPosition(effect, s).x, 460);
});
test('invoked effects cannot hit dead, untargetable, or stasis avatars', () => {
  for (const s of KAELEN_INVOKED_SPELLS) {
    const effect = cast(s.id);
    const targets = [{ ...enemy('dead', 300), isAlive: false }, { ...enemy('gold', 300), zhonyaActive: true }, { ...enemy('hidden', 300), untargetableTimer: 1 }];
    assert.deepEqual(advanceKaelenCast(effect, s, 2, targets), [], s.id);
  }
});
test('combo selection reacts to divers and clusters and respects per-spell cooldowns', () => {
  const state = { healthFraction: 1, enemyDistance: 220, clusteredEnemies: 1, cycle: 0, cooldowns: {} };
  assert.equal(chooseKaelenCombo(state).id, 'meteor');
  assert.equal(chooseKaelenCombo({ ...state, clusteredEnemies: 3 }).id, 'snowball');
  assert.equal(chooseKaelenCombo({ ...state, clusteredEnemies: 3, cycle: 1 }).id, 'tempest');
  assert.equal(chooseKaelenCombo({ ...state, healthFraction: 0.5, enemyDistance: 90 }).id, 'peel');
  const cooldowns = Object.fromEntries(KAELEN_INVOKED_SPELLS.map(s => [s.id, 1]));
  assert.equal(chooseKaelenCombo({ ...state, cooldowns }), undefined);
});
test('all invoked visual motifs render safely during windup, impact and expiry', () => {
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  for (const s of KAELEN_INVOKED_SPELLS) for (const elapsed of [0, 0.4, 0.9, 1.8]) {
    drawKaelenSpell(ctx, { ...cast(s.id), elapsed }, 0.8);
  }
});
