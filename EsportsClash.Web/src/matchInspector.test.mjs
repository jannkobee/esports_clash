import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchInsights, recordAbilityCast, recordSkillshot, recordManaBlock,
  recordBlackHoleInterrupt, recordPaxiJaunt } from './matchInspector.ts';

const actor = { id: 'paxi_1', team: 'blue', player: { name: 'Cardrel' }, champion: { name: 'Paxi', displayName: 'Fizzlewing' } };

test('match insights retain cast, hit, mana, and Jaunt counts with a scrub-ready timeline', () => {
  const insights = createMatchInsights();
  recordAbilityCast(insights, actor, 'skill2', 72.2);
  recordSkillshot(insights, actor, false, 73);
  recordSkillshot(insights, actor, true, 73.4);
  recordManaBlock(insights, actor, 'ultimate', 74, 28);
  recordManaBlock(insights, actor, 'ultimate', 75, 20);
  recordManaBlock(insights, actor, 'ultimate', 80, 15);
  recordPaxiJaunt(insights, actor, 81, 'escape');
  recordBlackHoleInterrupt(insights, actor, 82);
  const stats = insights.players[actor.id];
  assert.equal(stats.casts.skill2, 1);
  assert.equal(stats.skillshotsHit, 1);
  assert.equal(stats.skillshotsFired, 1);
  assert.equal(stats.manaBlocks, 2);
  assert.equal(stats.escapeJaunts, 1);
  assert.equal(stats.blackHoleInterrupts, 1);
  assert.ok(insights.timeline.some(event => event.kind === 'mana' && event.second === 74));
  assert.ok(insights.timeline.some(event => event.text === 'Cardrel (Fizzlewing) cast Skill 2'));
});
