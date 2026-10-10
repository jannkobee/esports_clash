import test from 'node:test';
import assert from 'node:assert/strict';
import { creatureAttackPose, creatureFacingScale, faceTargetLikeAvatar } from './creatureAnimation.ts';

test('creatures use the avatar-style flip and keep full width while facing', () => {
  const left = faceTargetLikeAvatar(1, -100);
  assert.equal(left, -1);
  assert.equal(creatureFacingScale(left), -1);
  assert.equal(faceTargetLikeAvatar(left, 1), left);
  const right = faceTargetLikeAvatar(left, 100);
  assert.equal(right, 1);
  assert.equal(creatureFacingScale(right), 1);
  assert.equal(Math.abs(creatureFacingScale(0)), 1);
});

test('attack pose rises after a real attack and ends before the next cooldown', () => {
  const windup = creatureAttackPose(1.31, 1.35);
  const strike = creatureAttackPose(1.08, 1.35);
  assert.ok(windup.windup > 0 && windup.strike === 0);
  assert.ok(strike.strike > 0 && strike.windup === 0);
  assert.deepEqual(creatureAttackPose(0.5, 1.35), { windup: 0, strike: 0 });
});
