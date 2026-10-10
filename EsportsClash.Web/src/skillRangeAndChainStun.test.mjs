import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEX_SIZE,
  getSkillCastRange,
  isCrowdControlSkill,
  shouldHoldSkillForChainStun,
  applyChainStun
} from './skillRangeRules.ts';
import { shouldUseSecondSkill, shouldUseSkill, shouldUseUltimate } from './combatDecision.ts';

function createUnit(champName, iq, tf, teamChemistry = 10, distanceX = 0, currentStun = 0) {
  return {
    id: `unit_${champName}_${iq}`,
    x: distanceX,
    y: 0,
    hp: 1000,
    maxHp: 1000,
    mana: 100,
    level: 6,
    cd1: 0,
    cd2: 0,
    cdUlt: 0,
    stunTimer: currentStun,
    teamChemistry,
    champion: {
      name: champName,
      ad: 70,
      primaryRole: 'Mage',
      skill1: { name: 'Skill 1', damage: 120, cooldown: 8 },
      skill2: { name: 'Skill 2', damage: 120, cooldown: 10 },
      ultimate: { name: 'Ultimate', damage: 300, cooldown: 60 }
    },
    player: {
      stats: {
        iq,
        tf,
        lan: 70,
        mech: 70
      }
    }
  };
}

test('HEX_SIZE is 45px and Raijin Electric Vortex is strictly restricted to 2-3 hexes (120px)', () => {
  assert.equal(HEX_SIZE, 45);

  const vortexRange = getSkillCastRange('Raijin', 'skill2', 165);
  // Must be between 2 hexes (90px) and 3 hexes (135px) to impose close-range danger
  assert.ok(vortexRange >= 2 * HEX_SIZE, 'Vortex range must be at least 2 hexes');
  assert.ok(vortexRange <= 3 * HEX_SIZE, 'Vortex range must not exceed 3 hexes');
  assert.equal(vortexRange, 120);

  // Solana melee bash is ~65px (under 1.5 hexes)
  assert.equal(getSkillCastRange('Solana', 'skill1', 50), 65);
  // Kaolin melee smash is 75px
  assert.equal(getSkillCastRange('Kaolin', 'skill1', 50), 75);
  // Astra global lane comet is 550px
  assert.equal(getSkillCastRange('Astra', 'ultimate', 180), 550);
});

test('Paxi Illusory Orb and Raijin Ball Lightning use ground-target travel ranges', () => {
  assert.equal(getSkillCastRange('Paxi', 'skill1', 165), 700);
  assert.equal(getSkillCastRange('Raijin', 'ultimate', 165), 320);
});

test('Raijin cannot cast Electric Vortex when target is at basic attack distance (145px) beyond Vortex range (120px)', () => {
  const raijin = createUnit('Raijin', 80, 80, 15, 0);
  const target = createUnit('Dummy', 50, 50, 10, 145); // 145px away: within 165 attack range, but outside 120 vortex range!
  const vortexRange = getSkillCastRange('Raijin', 'skill2', 165);

  assert.equal(vortexRange, 120);
  // At 145px, shouldUseSecondSkill must reject the cast due to distance
  const canCastFar = shouldUseSecondSkill(raijin, target, [target], [raijin], vortexRange);
  assert.equal(canCastFar, false, 'Cannot cast Electric Vortex outside 120px');

  // Once Raijin steps closer to 110px (within 120px), Electric Vortex is authorized!
  target.x = 110;
  const canCastClose = shouldUseSecondSkill(raijin, target, [target], [raijin], vortexRange);
  assert.equal(canCastClose, true, 'Can cast Electric Vortex when within 2-3 hexes danger zone');
});

test('coordinated players hold CC when target has significant stun remaining, and fire when stun nears expiry', () => {
  // High coordination: IQ 85, TF 80, Chemistry 15 -> score: 85*0.45 + 80*0.35 + 15*1.5 = 88.75 >= 58
  const highIq = 85;
  const highTf = 80;
  const teamChem = 15;

  // Target has 1.2s stun left -> coordinated player holds!
  const holdForFreshStun = shouldHoldSkillForChainStun(highIq, highTf, teamChem, 1.2, true);
  assert.equal(holdForFreshStun, true, 'Coordinated player must hold CC when target is already heavily stunned');

  // Target stun drops to 0.25s (near expiry) -> coordinated player does not hold; executes chain stun!
  const holdForExpiringStun = shouldHoldSkillForChainStun(highIq, highTf, teamChem, 0.25, true);
  assert.equal(holdForExpiringStun, false, 'Coordinated player releases CC when target stun is <= 0.35s');

  // Target has no stun -> does not hold
  const holdForNoStun = shouldHoldSkillForChainStun(highIq, highTf, teamChem, 0, true);
  assert.equal(holdForNoStun, false);
});

test('low IQ and low chemistry players do not hold CC and overlap wastefully', () => {
  // Low coordination: IQ 25, TF 25, Chemistry 5 -> score: 25*0.45 + 25*0.35 + 5*1.5 = 27.5 < 58
  const lowIq = 25;
  const lowTf = 25;
  const lowChem = 5;

  // Low IQ player panic-casts immediately even if target has 1.5s stun remaining!
  const lowHold = shouldHoldSkillForChainStun(lowIq, lowTf, lowChem, 1.5, true);
  assert.equal(lowHold, false, 'Uncoordinated player does not hold CC and panic overlaps');
});

test('applyChainStun seamlessly extends lockdown for coordinated teams and caps at 3.5s', () => {
  // Coordinated caster chaining onto a target with 0.3s stun remaining
  const chainedResult = applyChainStun(0.3, 1.4, 85, 80, 15);
  assert.equal(chainedResult.isChainStun, true);
  assert.equal(Math.round(chainedResult.finalDuration * 10) / 10, 1.7);

  // Maximum CC lock is capped at 3.5s
  const maxCapResult = applyChainStun(2.8, 1.5, 85, 80, 15);
  assert.equal(maxCapResult.isChainStun, true);
  assert.equal(maxCapResult.finalDuration, 3.5);

  // Uncoordinated caster (IQ 20, TF 20, Chem 0) overlaps and wastes the duration
  const uncoordResult = applyChainStun(1.0, 1.2, 20, 20, 0);
  assert.equal(uncoordResult.isChainStun, false);
  assert.equal(uncoordResult.finalDuration, 1.2); // Math.max(1.0, 1.2) - didn't stack to 2.2!
});
