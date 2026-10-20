import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultCardMemory,
  calculateMasteryTier,
  calculateUnitNetWorth,
  loadCardMemories,
  saveCardMemories,
  getCardMemory,
  recordCardMatchExperience,
} from './cardMemory.ts';

test('creates default card memory structure', () => {
  const mem = createDefaultCardMemory('card-faker');
  assert.equal(mem.version, 1);
  assert.equal(mem.cardId, 'card-faker');
  assert.equal(mem.matchesPlayed, 0);
  assert.deepEqual(mem.processedMatchIds, []);
  assert.equal(mem.lessons.gappedDiscipline, 0);
  assert.equal(mem.lessons.numericalDiscipline, 0);
  assert.equal(mem.lessons.survivalPatience, 0);
  assert.deepEqual(mem.comboMasteries, {});
});

test('calculateMasteryTier correctly assigns tiers by execution count', () => {
  assert.equal(calculateMasteryTier(0), 0);
  assert.equal(calculateMasteryTier(4), 0);
  assert.equal(calculateMasteryTier(5), 1);
  assert.equal(calculateMasteryTier(14), 1);
  assert.equal(calculateMasteryTier(15), 2);
  assert.equal(calculateMasteryTier(30), 3);
  assert.equal(calculateMasteryTier(50), 4);
  assert.equal(calculateMasteryTier(80), 5);
  assert.equal(calculateMasteryTier(150), 5);
});

test('calculateUnitNetWorth aggregates unspent gold, items cost and boots cost', () => {
  const unit = {
    gold: 450,
    items: [{ cost: 3200 }, { cost: 1100 }],
    boots: { cost: 300 },
  };
  assert.equal(calculateUnitNetWorth(unit), 450 + 3200 + 1100 + 300);
});

test('recordCardMatchExperience learns faster with high IQ, computes hitRate from attempts, and is idempotent by matchId', () => {
  const start = createDefaultCardMemory('card-rookie');
  
  // High IQ card (IQ 95)
  const highIqMemory = recordCardMatchExperience(start, {
    matchId: 'match-001',
    cardId: 'card-rookie',
    cardIq: 95,
    deathsGapped: 2,
    deathsOutnumbered: 1,
    deathsReckless: 1,
    combos: [
      { avatar: 'Solana', hit: true, lethal: true },
      { avatar: 'Solana', hit: false, lethal: false }, // Missed attempt!
    ],
  });

  assert.equal(highIqMemory.matchesPlayed, 1);
  assert.deepEqual(highIqMemory.processedMatchIds, ['match-001']);

  // Check combos: 1 hit out of 2 attempts => hitRate = 0.5
  const solanaMastery = highIqMemory.comboMasteries['Solana'];
  assert.ok(solanaMastery);
  assert.equal(solanaMastery.attempts, 2);
  assert.equal(solanaMastery.executions, 1);
  assert.equal(solanaMastery.hitRate, 0.5);
  assert.equal(solanaMastery.lethalFinishes, 1);

  // Idempotency: re-running with same matchId does not re-apply experience
  const duplicate = recordCardMatchExperience(highIqMemory, {
    matchId: 'match-001',
    cardId: 'card-rookie',
    deathsGapped: 2,
  });
  assert.equal(duplicate.matchesPlayed, 1);
  assert.equal(duplicate.lessons.gappedDiscipline, highIqMemory.lessons.gappedDiscipline);
});

test('aggressive personalities have personality resistance to immediate passive play', () => {
  const start = createDefaultCardMemory('card-aggressive');
  const normal = recordCardMatchExperience(start, {
    cardId: 'card-aggressive',
    cardIq: 80,
    personality: 'tactician',
    deathsGapped: 2,
  });
  const aggressive = recordCardMatchExperience(start, {
    cardId: 'card-aggressive',
    cardIq: 80,
    personality: 'solo_carry',
    deathsGapped: 2,
  });

  assert.ok(aggressive.lessons.gappedDiscipline < normal.lessons.gappedDiscipline);
});

test('persistence handles mock localStorage safely', () => {
  const fakeStore = {};
  globalThis.localStorage = {
    getItem: (key) => fakeStore[key] ?? null,
    setItem: (key, val) => { fakeStore[key] = String(val); },
  };

  const mem = createDefaultCardMemory('c1');
  mem.lessons.gappedDiscipline = 0.45;
  mem.comboMasteries['Kaolin'] = { attempts: 8, executions: 6, hitRate: 0.75, lethalFinishes: 3, masteryLevel: 1 };

  saveCardMemories({ c1: mem });
  const loaded = loadCardMemories();
  assert.ok(loaded['c1']);
  assert.equal(loaded['c1'].lessons.gappedDiscipline, 0.45);
  assert.equal(loaded['c1'].comboMasteries['Kaolin'].masteryLevel, 1);
  assert.equal(loaded['c1'].comboMasteries['Kaolin'].attempts, 8);
  assert.equal(getCardMemory('c1').cardId, 'c1');
  assert.equal(getCardMemory('unknown').matchesPlayed, 0);
});
