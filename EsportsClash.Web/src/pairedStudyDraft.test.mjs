import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PLAYERS, CHAMPIONS } from './mockData.ts';
import { buildPairedStudyDraft, pairedScoutAfter } from './pairedStudyDraft.ts';

test('broader drafts preserve legacy fixtures and cover every card without mutating identities or stats', () => {
  const before = JSON.stringify([INITIAL_PLAYERS, CHAMPIONS]);
  const legacy = buildPairedStudyDraft(INITIAL_PLAYERS, CHAMPIONS, 0);
  assert.deepEqual(legacy.map(x => x.player), INITIAL_PLAYERS.slice(0, 10));
  assert.deepEqual(legacy.map(x => x.champion), [CHAMPIONS.find(x => x.name === 'Kaelen'), ...CHAMPIONS.filter(x => x.name !== 'Kaelen').slice(0, 9)]);
  assert.deepEqual(buildPairedStudyDraft(INITIAL_PLAYERS, CHAMPIONS, 1).map(x => x.champion), CHAMPIONS.slice(10, 20));
  const covered = new Set();
  for (let draft = 2; draft < 10; draft++) {
    const lineup = buildPairedStudyDraft(INITIAL_PLAYERS, CHAMPIONS, draft);
    assert.deepEqual(lineup, buildPairedStudyDraft(INITIAL_PLAYERS, CHAMPIONS, draft));
    assert.equal(new Set(lineup.map(x => x.player.id)).size, 10);
    assert.equal(new Set(lineup.map(x => x.champion.id)).size, 10);
    for (const { player, champion } of lineup) {
      covered.add(player.id); assert.ok(INITIAL_PLAYERS.includes(player)); assert.ok(CHAMPIONS.includes(champion));
    }
  }
  assert.equal(covered.size, INITIAL_PLAYERS.length);
  assert.equal(JSON.stringify([INITIAL_PLAYERS, CHAMPIONS]), before);
  for (const draft of [-1, .5, 10, NaN]) assert.throws(() => buildPairedStudyDraft(INITIAL_PLAYERS, CHAMPIONS, draft));
});

test('later scouting is bounded and cannot enable exploration before the existing 120-second boundary', () => {
  for (const value of [null, '', '0', '-1', '119', 'Infinity', 'NaN', '901']) assert.equal(pairedScoutAfter(value), 120);
  for (const value of [120, 360, 600, 900]) assert.equal(pairedScoutAfter(String(value)), value);
});
