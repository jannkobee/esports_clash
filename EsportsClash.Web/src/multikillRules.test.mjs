import test from 'node:test';
import assert from 'node:assert/strict';
import { nextMultikillCount } from './multikillRules.ts';

test('multi kills require successive kills within three seconds', () => {
  assert.equal(nextMultikillCount(1, 2.5), 2);
  assert.equal(nextMultikillCount(2, 3), 3);
  assert.equal(nextMultikillCount(2, 7), 1);
  assert.equal(nextMultikillCount(4, 1), 5);
});
