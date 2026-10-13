import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPIONS } from './mockData.ts';
import { auditAbilityCatalog } from './abilityCatalogAudit.ts';

test('ability catalog accounts for every champion, standard slot, passive, invoked spell, and declared movement state', () => {
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
    ['Brewmaw:skill2', 'Cinderbloom:skill1', 'Renn:skill2', 'Renn:ultimate', 'Solana:skill2', 'Veyara:skill2'].sort(),
  );
  assert.ok(audit.movementAbilities.some(ability => ability.champion === 'Jaxon' && ability.kind === 'Leap'));
  assert.ok(audit.movementAbilities.some(ability => ability.champion === 'Valerie' && ability.kind === 'Charge'));
  assert.ok(audit.movementAbilities.some(ability => ability.champion === 'Paxi' && ability.kind === 'Teleport'));
});
