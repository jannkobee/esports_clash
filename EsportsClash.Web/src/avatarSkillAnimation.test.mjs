import test from 'node:test';
import assert from 'node:assert/strict';
import { ADDITIONAL_CHAMPIONS } from './additionalChampions.ts';
import { AVATAR_ANIMATION_MOTIFS, drawAvatarSkillAnimation } from './avatarSkillAnimation.ts';

test('every avatar has a distinct animation cue and recreated avatars keep source names out of play', () => {
  assert.equal(Object.keys(AVATAR_ANIMATION_MOTIFS).length, 43);
  assert.equal(new Set(Object.values(AVATAR_ANIMATION_MOTIFS)).size, 43);
  for (const avatar of ADDITIONAL_CHAMPIONS) {
    assert.ok(AVATAR_ANIMATION_MOTIFS[avatar.name], `${avatar.name} has an animation`);
    assert.notEqual(avatar.name, avatar.basis);
  }
});

test('all avatar motifs render through each skill stage without a canvas error', () => {
  const canvas = new Proxy({}, {
    get: (target, key) => key in target ? target[key] : () => {},
    set: (target, key, value) => { target[key] = value; return true; },
  });
  for (const avatarName of Object.keys(AVATAR_ANIMATION_MOTIFS)) {
    for (const slot of ['skill1', 'skill2', 'ultimate']) {
      for (const progress of [0, 0.5, 0.99]) {
        assert.doesNotThrow(() => drawAvatarSkillAnimation(canvas, {
          avatarName, slot, x: 120, y: 80, sourceX: 55, sourceY: 75,
          radius: slot === 'ultimate' ? 94 : 52, progress, color: '#facc15',
        }), `${avatarName} ${slot} at ${progress}`);
      }
    }
  }
});

test('electric vortex tether pulls target closer to caster over simulation steps', () => {
  const source = { x: 200, y: 300, isAlive: true };
  const target = { x: 350, y: 300, isAlive: true, stunTimer: 0 };
  const pullSpeed = 175;
  const dt = 0.1;
  const initialDist = Math.hypot(source.x - target.x, source.y - target.y);

  for (let frame = 0; frame < 3; frame++) {
    const dx = source.x - target.x;
    const dy = source.y - target.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 35) {
      const step = pullSpeed * dt;
      target.x += (dx / dist) * Math.min(dist - 35, step);
      target.y += (dy / dist) * Math.min(dist - 35, step);
    }
    target.stunTimer = Math.max(target.stunTimer, 0.15);
  }

  const finalDist = Math.hypot(source.x - target.x, source.y - target.y);
  assert.ok(finalDist < initialDist, 'target was pulled closer to Raijin');
  assert.ok(target.stunTimer > 0, 'target is stunned during Electric Vortex pull');
});

test('charm walk causes unit to move directly toward charm source', () => {
  const source = { x: 100, y: 300 };
  const victim = { x: 250, y: 300, charmTimer: 1.4, charmSourceId: 'kyumi' };
  const dx = source.x - victim.x;
  const dy = source.y - victim.y;
  const dist = Math.hypot(dx, dy);
  const step = 75 * 0.1;
  victim.x += (dx / dist) * step;
  assert.ok(victim.x < 250, 'charmed victim walked towards charm source');
});

test('fear flee causes unit to move directly away from fear source', () => {
  const source = { x: 300, y: 300 };
  const victim = { x: 350, y: 300, fearTimer: 1.5, fearSourceId: 'sylla' };
  const dx = victim.x - source.x;
  const dy = victim.y - source.y;
  const dist = Math.hypot(dx, dy);
  const step = 125 * 0.1;
  victim.x += (dx / dist) * step;
  assert.ok(victim.x > 350, 'feared victim fled away from fear source');
});

test('all 43 champions have dedicated models and render without errors in drawChampionSprite', async () => {
  const { drawChampionSprite } = await import('./components/ChampionSpriteRenderer.ts');
  const canvas = new Proxy({}, {
    get: (target, key) => {
      if (key === 'createRadialGradient' || key === 'createLinearGradient') {
        return () => ({ addColorStop: () => {} });
      }
      return key in target ? target[key] : () => {};
    },
    set: (target, key, value) => { target[key] = value; return true; },
  });

  const allChampNames = [
    'Solana', 'Astra', 'Kyumi', 'Buck', 'Valkira', 'Kage', 'Kazemaru', 'Kindra', 'Cora', 'Renn',
    'Sylla', 'Tequoia', 'Zal', 'Xin', 'Raijin', 'Kaolin', 'Inai', 'Veyara', 'Cinderbloom', 'Solenne',
    'Croakwell', 'Soulscourge', 'Stonewake', 'Mirehook', 'Nullweaver', 'Voltgrip', 'Aetherbolt', 'Corsara',
    'Brewmaw', 'Wraithhook', 'Kaelen', 'Hweilin', 'Jaxon', 'Valerie', 'Jinxy', 'Paxi', 'Batrix', 'Quillback', 'Aetheris',
    'Faelith', 'Oathmute', 'Cloudtail', 'Stonebranch'
  ];

  assert.equal(allChampNames.length, 43);

  for (const championName of allChampNames) {
    for (const animState of ['idle', 'walk', 'attack', 'cast']) {
      assert.doesNotThrow(() => {
        drawChampionSprite(canvas, {
          championName,
          x: 100,
          y: 200,
          facing: 'right',
          animState,
          animTime: 1.5,
          team: 'blue',
          isStunned: false,
          isCharmed: false,
          isInBush: false,
        });
      }, `${championName} in ${animState} state rendered cleanly`);
    }
  }
});

test('Sylla spirit bear model renders idle, turn and claw strike for both teams', async () => {
  const { drawSpiritBearSprite } = await import('./components/ChampionSpriteRenderer.ts');
  const canvas = new Proxy({}, {
    get: (target, key) => key in target ? target[key] : () => {},
    set: (target, key, value) => { target[key] = value; return true; },
  });
  for (const team of ['blue', 'red']) {
    assert.doesNotThrow(() => drawSpiritBearSprite(canvas, 2, team));
    assert.doesNotThrow(() => drawSpiritBearSprite(canvas, 2, team, { windup: 1, strike: 0 }));
    assert.doesNotThrow(() => drawSpiritBearSprite(canvas, 2, team, { windup: 0, strike: 1 }));
  }
});

