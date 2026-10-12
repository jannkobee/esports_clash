import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONALITIES, applyMoodEvent, decayMood, deriveTeamPsychology, normalizePlayerPersonality, personalityActionDelta } from './playerPersonality.ts';

const card = (id, primaryPersonality, secondaryPersonality = 'cold_as_ice') => ({ id, name: id, personality: 'legacy', badges: ['Aggro Diver'], primaryPersonality, secondaryPersonality, stats: { iq: 80, tf: 80, clu: 80 } });

test('the unified catalog contains 30 functional personality definitions', () => {
  assert.equal(Object.keys(PERSONALITIES).length, 30);
  assert.ok(Object.values(PERSONALITIES).every(p => p.description && p.compatible.length && Object.keys(p.preferences).length));
});

test('normalization assigns two distinct personalities and removes legacy playstyle badges', () => {
  const normalized = normalizePlayerPersonality(card('alpha', 'igl', 'loyalist'));
  assert.equal(normalized.primaryPersonality, 'igl');
  assert.equal(normalized.secondaryPersonality, 'loyalist');
  assert.deepEqual(normalized.badges, []);
});

test('mood events are deduplicated and decay back toward a short-match baseline', () => {
  const player = card('tilt', 'short_fuse');
  const state = { mood: { confidence: 50, excitement: 30, frustration: 10, composure: 70, trust: 60 }, recentWins: 0, recentLosses: 0, processedEventIds: [] };
  const loss = applyMoodEvent(state, 'death:1', 'death', [player.primaryPersonality]);
  assert.ok(loss.mood.frustration > state.mood.frustration);
  assert.deepEqual(applyMoodEvent(loss, 'death:1', 'death', [player.primaryPersonality]), loss);
  assert.ok(decayMood(loss, [player.primaryPersonality], 30).mood.frustration < loss.mood.frustration);
});

test('personality, mood, and weighted leadership derive stable team psychology', () => {
  const igl = { id: 'igl', player: card('igl', 'igl'), psychology: { mood: { confidence: 80, excitement: 50, frustration: 8, composure: 80, trust: 82 }, recentWins: 2, recentLosses: 0, processedEventIds: [] }, relationships: {} };
  const loyalist = { id: 'loyal', player: card('loyal', 'loyalist'), psychology: { mood: { confidence: 70, excitement: 45, frustration: 12, composure: 70, trust: 75 }, recentWins: 1, recentLosses: 0, processedEventIds: [] }, relationships: { igl: { trust: 80, cooperation: 82, rivalry: 5, leadershipRespect: 88 } } };
  const team = deriveTeamPsychology([igl, loyalist]);
  assert.equal(team.iglId, 'igl');
  assert.ok(team.cohesion > 60);
  assert.ok(personalityActionDelta(igl.player, igl.psychology, 'engage', team) > 0);
});
