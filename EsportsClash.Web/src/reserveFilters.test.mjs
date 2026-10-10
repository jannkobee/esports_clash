import test from 'node:test';
import assert from 'node:assert/strict';
import { filterReserveCards } from './reserveFilters.ts';

const cards = [
  { name: 'M0cke', realName: 'miCKe', preferredRole: 'Marksman', origin: 'Dota2', tier: 'Diamond', ovr: 92 },
  { name: 'd4nk', realName: 'donk', preferredRole: 'Assassin', origin: 'CS', tier: 'Diamond', ovr: 94 },
  { name: 'Cardrel', realName: 'Caedrel', preferredRole: 'Fighter', origin: 'LoL', tier: 'Diamond', ovr: 90 }
];
const defaults = { query: '', role: 'all', origin: 'all', tier: 'all', sort: 'rating' };

test('reserve filters combine role, game, tier and visible player name', () => {
  assert.deepEqual(filterReserveCards(cards, defaults).map(card => card.name), ['d4nk', 'M0cke', 'Cardrel']);
  assert.deepEqual(filterReserveCards(cards, { ...defaults, role: 'Marksman', origin: 'Dota2', tier: 'Diamond', query: 'm0cke' })
    .map(card => card.name), ['M0cke']);
  assert.deepEqual(filterReserveCards(cards, { ...defaults, sort: 'name' }).map(card => card.name),
    ['Cardrel', 'd4nk', 'M0cke']);
  assert.equal(filterReserveCards(cards, { ...defaults, query: 'miCKe' }).length, 0);
});
