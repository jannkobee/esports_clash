import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPlayerTrait,
  canAggroDive,
  shouldTriggerClutchSurge,
  getClutchSurgeBonuses,
  canAttemptObjectiveSnipe,
  getObjectiveSmiteBonus,
  getOneTapTargetPriority,
  getLaningDemonDamageMultiplier,
  getTenacityMultiplier,
  getUnkillableDodgeChance
} from './playerTraits.ts';

const mockCard = (badges = [], personality = 'Neutral', clu = 85) => ({
  id: 'card_1',
  name: 'TestCard',
  realName: 'TestReal',
  origin: 'LoL',
  role: 'Mid',
  tier: 'Diamond',
  ovr: 88,
  stats: { lan: 85, tf: 85, iq: 85, clu, sta: 85, flx: 85 },
  personality,
  badges,
  signatureChampions: ['Kaelen'],
  morale: 90,
  fatigue: 0,
  level: 10,
  currentXp: 0,
  maxXp: 100,
  avatarSvg: 'faker'
});

const mockChamp = (role = 'Mage') => ({
  id: 'c1',
  name: 'Kaelen',
  title: 'Arsenal',
  primaryRole: role,
  hp: 2000,
  maxHp: 2000,
  mana: 500,
  maxMana: 500,
  ad: 100,
  armor: 40,
  mr: 35,
  aspd: 1.0,
  range: 140,
  moveSpeed: 100,
  primaryColor: '#ef4444',
  accentColor: '#f59e0b',
  skill1: { name: 'S1', desc: '', cooldown: 5, damage: 150, damageType: 'Magic' },
  skill2: { name: 'S2', desc: '', cooldown: 8, damage: 200, damageType: 'Magic' },
  ultimate: { name: 'Ult', desc: '', cooldown: 60, damage: 500, damageType: 'Magic', isUlt: true }
});

const mockUnit = (card, hp = 2000, maxHp = 2000, role = 'Mage') => ({
  id: 'u1',
  player: card,
  champion: mockChamp(role),
  team: 'blue',
  x: 500,
  y: 360,
  vx: 0,
  vy: 0,
  hp,
  maxHp,
  mana: 100,
  shield: 0,
  level: 6,
  xp: 0,
  gold: 1500,
  items: [],
  kills: 0,
  deaths: 0,
  assists: 0,
  cs: 20,
  damageDealt: 0,
  damageTaken: 0,
  isAlive: true,
  respawnTimer: 0,
  attackTimer: 0,
  cd1: 0,
  cd2: 0,
  cdUlt: 0,
  stunTimer: 0,
  charmTimer: 0,
  facing: 'right',
  animState: 'idle',
  animTimer: 0,
  isInBush: false,
  sterakCooldown: 0,
  zhonyaActive: false,
  zhonyaTimer: 0,
  immolateTimer: 0,
  krakenCounter: 0
});

test('hasPlayerTrait accurately identifies badges and personality traits', () => {
  const diver = mockCard(['Aggro Diver']);
  assert.equal(hasPlayerTrait(diver, 'Aggro Diver'), true);
  assert.equal(hasPlayerTrait(diver, 'Clutch King'), false);

  const clutchFromPers = mockCard([], 'Ice-Cold Clutch');
  assert.equal(hasPlayerTrait(clutchFromPers, 'Clutch King'), true);

  const multiTrait = mockCard(['Clutch King', 'Baron Steal', 'Unkillable Demon']);
  assert.equal(hasPlayerTrait(multiTrait, 'Clutch King'), true);
  assert.equal(hasPlayerTrait(multiTrait, 'Baron Steal'), true);
  assert.equal(hasPlayerTrait(multiTrait, 'Unkillable Demon'), true);
});

test('canAggroDive permits aggressive tower dives only when enemy is low and diver is healthy', () => {
  const diverUnit = mockUnit(mockCard(['Aggro Diver']), 1500, 2000);
  const normalUnit = mockUnit(mockCard([]), 1500, 2000);

  const lowEnemy = mockUnit(mockCard([]), 600, 2000); // 30% HP
  const healthyEnemy = mockUnit(mockCard([]), 1800, 2000); // 90% HP

  // Aggro diver dives low enemy near tower (tower dist 200)
  assert.equal(canAggroDive(diverUnit, lowEnemy, 200), true);

  // Aggro diver will not dive healthy enemy
  assert.equal(canAggroDive(diverUnit, healthyEnemy, 200), false);

  // Normal unit never dives under tower
  assert.equal(canAggroDive(normalUnit, lowEnemy, 200), false);

  // Low diver (<30% HP) will not suicide dive
  const lowDiver = mockUnit(mockCard(['Aggro Diver']), 400, 2000); // 20% HP
  assert.equal(canAggroDive(lowDiver, lowEnemy, 200), false);
});

test('Clutch King triggers Clutch Surge at low health in combat with scaling bonuses', () => {
  const clutchUnit = mockUnit(mockCard(['Clutch King'], 'Neutral', 95), 500, 2000); // 25% HP
  const normalUnit = mockUnit(mockCard([]), 500, 2000);

  // Triggers when low HP with nearby enemies
  assert.equal(shouldTriggerClutchSurge(clutchUnit, 2), true);
  // Does not trigger for non-clutch player
  assert.equal(shouldTriggerClutchSurge(normalUnit, 2), false);
  // Does not trigger if no enemies nearby
  assert.equal(shouldTriggerClutchSurge(clutchUnit, 0), false);

  const bonuses = getClutchSurgeBonuses(clutchUnit, true);
  assert.ok(bonuses.shieldAmount > 400, 'Provides substantial survival shield');
  assert.ok(bonuses.aspdMultiplier >= 1.25, 'Provides attack speed burst');
  assert.ok(bonuses.critBonus >= 0.30, 'Provides critical strike surge');
  assert.ok(bonuses.damageMultiplier >= 1.20, 'Provides outnumbered outplay multiplier');
});

test('Baron Steal grants objective execute bonus below threshold', () => {
  const stealer = mockUnit(mockCard(['Baron Steal']));
  const nonStealer = mockUnit(mockCard([]));

  assert.equal(canAttemptObjectiveSnipe(stealer, 0.25, 300), true);
  assert.equal(canAttemptObjectiveSnipe(nonStealer, 0.25, 300), false);

  // Execute damage triggers on boss <= 22% HP
  const executeDmg = getObjectiveSmiteBonus(stealer, 1000, 5200); // ~19%
  assert.ok(executeDmg > 200, 'Smite execute delivers huge true damage burst');

  // No bonus when boss is healthy
  assert.equal(getObjectiveSmiteBonus(stealer, 4000, 5200), 0);
});

test('Specialized traits: One-Tap God, Laning Demon, Ice in Veins, and Unkillable Demon', () => {
  const oneTapUnit = mockUnit(mockCard(['One-Tap God']));
  const squishyTarget = mockUnit(mockCard([]), 2000, 2000, 'Marksman');
  const tankTarget = mockUnit(mockCard([]), 3500, 3500, 'Tank');
  assert.ok(getOneTapTargetPriority(oneTapUnit, squishyTarget) > 200);
  assert.equal(getOneTapTargetPriority(oneTapUnit, tankTarget), 0);

  const laningDemon = mockUnit(mockCard(['Laning Demon']));
  assert.ok(getLaningDemonDamageMultiplier(laningDemon, 'minion', 120) > 1.2);
  assert.equal(getLaningDemonDamageMultiplier(laningDemon, 'minion', 300), 1.0); // Expired late game

  const iceUnit = mockUnit(mockCard(['Ice in Veins']));
  assert.equal(getTenacityMultiplier(iceUnit), 0.60); // 40% reduction

  const unkillableUnit = mockUnit(mockCard(['Unkillable Demon']), 500, 2000); // 25% HP
  assert.equal(getUnkillableDodgeChance(unkillableUnit), 0.35);
});
