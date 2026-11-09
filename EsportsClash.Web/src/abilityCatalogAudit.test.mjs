import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAMPIONS} from './testFixtures/historicalCatalog.mjs';
import { auditAbilityCatalog, buildAbilityAuditMatrix } from './abilityCatalogAudit.ts';

test('historical fixture: ability catalog accounts for every champion, standard slot, passive, invoked spell, and declared movement state', () => {
  const audit = auditAbilityCatalog(CHAMPIONS);
  assert.equal(audit.avatars, 45);
  assert.equal(audit.standardActives, 135);
  assert.equal(audit.passives, 45);
  assert.equal(audit.invokedAbilities, 10);
  assert.equal(audit.documentedActives, 135);
  assert.deepEqual(audit.missingDescriptions, []);
  assert.equal(audit.movementAbilities.length, 20);
  assert.deepEqual(
    audit.movementAbilities.filter(ability => ability.kind === 'Dash').map(ability => `${ability.champion}:${ability.slot}`).sort(),
    ['Brewmaw:skill2', 'Cinderbloom:skill1', 'Raijin:ultimate', 'Renn:skill2', 'Renn:ultimate', 'Solana:skill2', 'Veyara:skill2'].sort(),
  );
  assert.ok(audit.movementAbilities.some(ability => ability.champion === 'Jaxon' && ability.kind === 'Leap'));
  assert.ok(audit.movementAbilities.some(ability => ability.champion === 'Valerie' && ability.kind === 'Charge'));
  assert.ok(audit.movementAbilities.some(ability => ability.champion === 'Paxi' && ability.kind === 'Teleport'));
});

test('historical fixture: ability audit matrix inventories standard, passive, and invoked executors without duplicating combat data', () => {
  const matrix = buildAbilityAuditMatrix(CHAMPIONS);
  assert.equal(matrix.length, 190);
  assert.equal(matrix.filter(entry => entry.kind === 'standard-active').length, 135);
  assert.equal(matrix.filter(entry => entry.kind === 'passive').length, 45);
  assert.equal(matrix.filter(entry => entry.kind === 'invoked').length, 10);
  assert.equal(new Set(matrix.map(entry => entry.id)).size, matrix.length);
  assert.ok(matrix.every(entry => entry.description.trim().length >= 12));
  assert.ok(matrix.some(entry => entry.name === 'Vault Breaker Punch' && entry.movement === 'Charge'));
  assert.ok(matrix.some(entry => entry.name === 'Rimeball Roll' && entry.runtimeExecutor.includes('castKaelenInvokedSpell')));
  assert.ok(matrix.filter(entry => entry.movement).every(entry => entry.status === 'requires-live-verification'));
});
