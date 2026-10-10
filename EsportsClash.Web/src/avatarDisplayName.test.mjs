import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarDisplayName } from './avatarDisplayName.ts';
import { CHAMPIONS, INITIAL_PLAYERS } from './mockData.ts';

test('every avatar has a distinct parody display name without changing internal identifiers', () => {
  const displayNames = CHAMPIONS.map(avatar => avatar.displayName);

  assert.ok(CHAMPIONS.length > 0);
  assert.ok(displayNames.every(name => name.trim().length > 0));
  assert.equal(new Set(displayNames).size, displayNames.length);
  assert.ok(CHAMPIONS.every(avatar => avatar.displayName !== avatar.name));
  assert.equal(CHAMPIONS.find(avatar => avatar.id === 'c_invoker')?.name, 'Kaelen');
  assert.equal(CHAMPIONS.find(avatar => avatar.id === 'c_io')?.name, 'Aetheris');
  assert.equal(CHAMPIONS.find(avatar => avatar.id === 'c_puck')?.name, 'Paxi');
});

test('display-name lookup updates avatar signatures but preserves player-card identities', () => {
  assert.equal(avatarDisplayName('Kaelen', CHAMPIONS), 'Arsenaldo');
  assert.equal(avatarDisplayName('Paxi', CHAMPIONS), 'Fizzlewing');
  assert.equal(avatarDisplayName('unlisted-avatar', CHAMPIONS), 'unlisted-avatar');
  assert.ok(INITIAL_PLAYERS.some(player => player.name === 'Cardrel'));
});
