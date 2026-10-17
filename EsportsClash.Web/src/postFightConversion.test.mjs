import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePostFightConversion } from './postFightConversion.ts';

const option = (action, available = true, factors = { strategic: .5 }) => ({ action, available, contextKey: action, factors, reason: 'existing gate' });
test('a won fight chooses legal push over optional reset and farm, and never invents conversion', () => {
  assert.equal(choosePostFightConversion({ now: 5, wonFight: true, candidates: [option('farm'), option('reset'), option('push')] }).selected?.value, 'push');
  assert.equal(choosePostFightConversion({ now: 5, wonFight: false, candidates: [option('push')] }).selected, undefined);
});
