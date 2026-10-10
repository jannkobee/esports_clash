import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AVATAR_ANIMATION_MOTIFS } from './avatarSkillAnimation.ts';
import { AVATAR_SOUND_ASSETS, getAvatarSkillSoundCue } from './avatarSkillAudio.ts';

test('all playable avatars have three distinct recorded skill cues', () => {
  assert.equal(Object.keys(AVATAR_ANIMATION_MOTIFS).length, 43);
  for (const avatarName of Object.keys(AVATAR_ANIMATION_MOTIFS)) {
    const cues = ['skill1', 'skill2', 'ultimate'].map(slot => getAvatarSkillSoundCue(avatarName, slot));
    assert.ok(cues.every(Boolean), `${avatarName} has all skill cues`);
    assert.equal(new Set(cues.map(cue => cue.sample)).size, 3, `${avatarName} has distinct primary recordings`);
    assert.equal(new Set(cues.map(cue => `${cue.sample}:${cue.accent}:${cue.rate}`)).size, 3);
  }
  assert.equal(getAvatarSkillSoundCue('Unknown', 'skill1'), null);
});

test('all cue recordings are shipped with the game', () => {
  for (const asset of AVATAR_SOUND_ASSETS) {
    const path = fileURLToPath(new URL(`../public/audio/kenney/${asset}.ogg`, import.meta.url));
    assert.ok(existsSync(path), `${asset} is present`);
    assert.equal(readFileSync(path).subarray(0, 4).toString(), 'OggS', `${asset} is an Ogg recording`);
  }
});
