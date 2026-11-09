import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarDisplayName } from './avatarDisplayName.ts';
import { AVATAR_IDENTITIES, getAvatarIdentity } from './avatarIdentity.ts';
import { CHAMPIONS, INITIAL_PLAYERS } from './mockData.ts';

test('every avatar has a distinct original display name without changing internal identifiers', () => {
  const displayNames = CHAMPIONS.map(avatar => avatar.displayName);

  assert.ok(CHAMPIONS.length > 0);
  assert.ok(displayNames.every(name => name.trim().length > 0));
  assert.equal(new Set(displayNames).size, displayNames.length);
  assert.equal(new Set(CHAMPIONS.map(avatar => avatar.title)).size, CHAMPIONS.length);
  assert.ok(CHAMPIONS.every(avatar => avatar.displayName !== avatar.name));
  assert.equal(AVATAR_IDENTITIES.length, CHAMPIONS.length);
  assert.ok(CHAMPIONS.every(avatar => {
    const identity = getAvatarIdentity(avatar.name);
    return identity?.displayName === avatar.displayName && identity.title === avatar.title;
  }));
  assert.equal(CHAMPIONS.find(avatar => avatar.id === 'c_invoker')?.name, 'Kaelen');
  assert.equal(CHAMPIONS.find(avatar => avatar.id === 'c_io')?.name, 'Aetheris');
  assert.equal(CHAMPIONS.find(avatar => avatar.id === 'c_puck')?.name, 'Paxi');
});

test('display-name lookup updates avatar signatures but preserves player-card identities', () => {
  assert.equal(avatarDisplayName('Kaelen', CHAMPIONS), 'Mirelle Vane');
  assert.equal(avatarDisplayName('Paxi', CHAMPIONS), 'Lulla Faespring');
  assert.equal(getAvatarIdentity('Kaelen')?.title, 'The Atelier Prodigy');
  assert.equal(getAvatarIdentity('Skybreaker')?.title, 'The Airspace Duchess');
  assert.equal(avatarDisplayName('unlisted-avatar', CHAMPIONS), 'unlisted-avatar');
  assert.ok(INITIAL_PLAYERS.some(player => player.name === 'Cardrel'));
  for (const alias of ['Zypoo', 'd4nk', 'p1mple', 'M0cke', 'flopz', 'Spl1t', 'SneakBro', 'Fisha'])
    assert.ok(INITIAL_PLAYERS.some(player => player.name === alias), alias);
});
