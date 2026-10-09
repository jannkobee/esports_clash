import test from 'node:test';
import assert from 'node:assert/strict';
import { ADDITIONAL_CHAMPIONS } from './additionalChampions.ts';
import { AVATAR_ANIMATION_MOTIFS, drawAvatarSkillAnimation } from './avatarSkillAnimation.ts';

test('every avatar has a distinct animation cue and recreated avatars keep source names out of play', () => {
  assert.equal(Object.keys(AVATAR_ANIMATION_MOTIFS).length, 23);
  assert.equal(new Set(Object.values(AVATAR_ANIMATION_MOTIFS)).size, 23);
  for (const avatar of ADDITIONAL_CHAMPIONS) {
    assert.ok(AVATAR_ANIMATION_MOTIFS[avatar.name], `${avatar.name} has an animation`);
    assert.notEqual(avatar.name, avatar.basis);
  }
});

test('all avatar motifs render through each skill stage without a canvas error', () => {
  const canvas = new Proxy({}, {
    get: (target, key) => key in target ? target[key] : () => {},
    set: (target, key, value) => { target[key] = value; return true; },
  });
  for (const avatarName of Object.keys(AVATAR_ANIMATION_MOTIFS)) {
    for (const slot of ['skill1', 'skill2', 'ultimate']) {
      for (const progress of [0, 0.5, 0.99]) {
        assert.doesNotThrow(() => drawAvatarSkillAnimation(canvas, {
          avatarName, slot, x: 120, y: 80, sourceX: 55, sourceY: 75,
          radius: slot === 'ultimate' ? 94 : 52, progress, color: '#facc15',
        }), `${avatarName} ${slot} at ${progress}`);
      }
    }
  }
});
