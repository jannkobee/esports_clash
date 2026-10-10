import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKGROUND_MUSIC_BPM,
  BACKGROUND_MUSIC_LOOP_STEPS,
  BACKGROUND_MUSIC_STEPS_PER_BAR,
  getBackgroundMusicStep,
} from './backgroundMusic.ts';

test('background score is a deterministic 16-bar loop with changing harmony', () => {
  assert.equal(BACKGROUND_MUSIC_BPM, 84);
  assert.equal(BACKGROUND_MUSIC_LOOP_STEPS, 128);
  assert.deepEqual(getBackgroundMusicStep(0), getBackgroundMusicStep(BACKGROUND_MUSIC_LOOP_STEPS));
  assert.deepEqual(
    getBackgroundMusicStep(7).chordNotes,
    getBackgroundMusicStep(8).chordNotes,
  );
  assert.notDeepEqual(
    getBackgroundMusicStep(0).chordNotes,
    getBackgroundMusicStep(4 * BACKGROUND_MUSIC_STEPS_PER_BAR).chordNotes,
  );
  assert.equal(getBackgroundMusicStep(0).startsBar, true);
  assert.equal(getBackgroundMusicStep(1).startsBar, false);
});

test('background score schedules bass only on the first and third beats', () => {
  assert.notEqual(getBackgroundMusicStep(0).bassNote, null);
  assert.equal(getBackgroundMusicStep(2).bassNote, null);
  assert.notEqual(getBackgroundMusicStep(4).bassNote, null);
  assert.equal(getBackgroundMusicStep(6).bassNote, null);
  for (let index = 0; index < BACKGROUND_MUSIC_LOOP_STEPS; index++) {
    const step = getBackgroundMusicStep(index);
    assert.ok(step.chordNotes.every(note => Number.isFinite(note) && note >= 35 && note <= 80));
    assert.ok(Number.isFinite(step.arpeggioNote) && step.arpeggioNote >= 47 && step.arpeggioNote <= 92);
  }
});
