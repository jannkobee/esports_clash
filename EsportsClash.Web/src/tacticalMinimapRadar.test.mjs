import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  worldToRadar,
  drawTacticalMinimapRadar,
} from './match-viewer/TacticalMinimapRadar.ts';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  LANE_Y,
  DRAGON_X,
  NEXUS_X,
  BARRACKS_X,
  NEXUS_TOWER_X,
  INNER_TOWER_X,
  OUTER_TOWER_X,
} from './arenaLayout.ts';
import { CAMP_ROCK_RINGS, ARAM_BUSHES } from './arenaRules.ts';

/**
 * Creates a recording mock 2D canvas context for testing rendering pipelines.
 */
function createMockContext() {
  const operations = [];
  return {
    operations,
    save() { operations.push({ op: 'save' }); },
    restore() { operations.push({ op: 'restore' }); },
    translate(x, y) { operations.push({ op: 'translate', x, y }); },
    scale(sx, sy) { operations.push({ op: 'scale', sx, sy }); },
    beginPath() { operations.push({ op: 'beginPath' }); },
    closePath() { operations.push({ op: 'closePath' }); },
    clip() { operations.push({ op: 'clip' }); },
    rect(x, y, w, h) { operations.push({ op: 'rect', x, y, w, h }); },
    roundRect(x, y, w, h, r) { operations.push({ op: 'roundRect', x, y, w, h, r }); },
    fillRect(x, y, w, h) { operations.push({ op: 'fillRect', x, y, w, h }); },
    strokeRect(x, y, w, h) { operations.push({ op: 'strokeRect', x, y, w, h }); },
    arc(x, y, r, sa, ea) { operations.push({ op: 'arc', x, y, r, sa, ea }); },
    ellipse(x, y, rx, ry, rot, sa, ea) { operations.push({ op: 'ellipse', x, y, rx, ry, rot, sa, ea }); },
    moveTo(x, y) { operations.push({ op: 'moveTo', x, y }); },
    lineTo(x, y) { operations.push({ op: 'lineTo', x, y }); },
    fill() { operations.push({ op: 'fill' }); },
    stroke() { operations.push({ op: 'stroke' }); },
    fillText(text, x, y) { operations.push({ op: 'fillText', text, x, y }); },
    setLineDash(dash) { operations.push({ op: 'setLineDash', dash }); },
    createLinearGradient(x0, y0, x1, y1) {
      return {
        addColorStop(offset, color) { operations.push({ op: 'addColorStop', offset, color }); },
      };
    },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      return {
        addColorStop(offset, color) { operations.push({ op: 'addColorStop', offset, color }); },
      };
    },
    set shadowColor(c) {},
    set shadowBlur(b) {},
    set fillStyle(s) {},
    set strokeStyle(s) {},
    set lineWidth(w) {},
    set font(f) {},
    set textAlign(a) {},
    set textBaseline(b) {},
  };
}

test('worldToRadar scales 2800x1440 arena to 280x144 minimap with 0.1 scale', () => {
  const blueNexus = worldToRadar(NEXUS_X.blue, LANE_Y);
  assert.equal(blueNexus.scale, 0.1);
  assert.equal(blueNexus.rx, 26.0);
  assert.equal(blueNexus.ry, 72.0);

  const arenaCenter = worldToRadar(DRAGON_X, LANE_Y);
  assert.equal(arenaCenter.rx, 140.0);
  assert.equal(arenaCenter.ry, 72.0);

  const redNexus = worldToRadar(NEXUS_X.red, LANE_Y);
  assert.equal(redNexus.rx, 254.0);
  assert.equal(redNexus.ry, 72.0);
});

test('drawTacticalMinimapRadar renders authoritative structures at expanded spacing', () => {
  const ctx = createMockContext();

  const structures = [
    // Blue team structures
    { id: 'b_nexus', team: 'blue', type: 'nexus', name: 'Blue Nexus', x: NEXUS_X.blue, y: LANE_Y, hp: 5500, maxHp: 5500, ad: 0, range: 0, attackTimer: 0, isAlive: true, targetId: null, armor: 50 },
    { id: 'b_barracks_melee', team: 'blue', type: 'barracks', name: 'Blue Melee Barracks', x: BARRACKS_X.blue, y: 265, hp: 2500, maxHp: 2500, ad: 0, range: 0, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
    { id: 'b_tower_nexus', team: 'blue', type: 'turret', name: 'Blue Nexus Spire', x: NEXUS_TOWER_X.blue, y: LANE_Y, hp: 3000, maxHp: 3000, ad: 140, range: 250, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
    { id: 'b_tower_inner', team: 'blue', type: 'turret', name: 'Blue Inner Tower', x: INNER_TOWER_X.blue, y: LANE_Y, hp: 3000, maxHp: 3000, ad: 140, range: 250, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
    { id: 'b_tower_outer', team: 'blue', type: 'turret', name: 'Blue Outer Tower', x: OUTER_TOWER_X.blue, y: LANE_Y, hp: 3000, maxHp: 3000, ad: 140, range: 250, attackTimer: 0, isAlive: false, targetId: null, armor: 40 }, // Destroyed

    // Red team structures
    { id: 'r_tower_outer', team: 'red', type: 'turret', name: 'Red Outer Tower', x: OUTER_TOWER_X.red, y: LANE_Y, hp: 3000, maxHp: 3000, ad: 140, range: 250, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
    { id: 'r_tower_inner', team: 'red', type: 'turret', name: 'Red Inner Tower', x: INNER_TOWER_X.red, y: LANE_Y, hp: 3000, maxHp: 3000, ad: 140, range: 250, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
    { id: 'r_tower_nexus', team: 'red', type: 'turret', name: 'Red Nexus Spire', x: NEXUS_TOWER_X.red, y: LANE_Y, hp: 3000, maxHp: 3000, ad: 140, range: 250, attackTimer: 0, isAlive: true, targetId: null, armor: 40 },
    { id: 'r_nexus', team: 'red', type: 'nexus', name: 'Red Nexus', x: NEXUS_X.red, y: LANE_Y, hp: 5500, maxHp: 5500, ad: 0, range: 0, attackTimer: 0, isAlive: true, targetId: null, armor: 50 },
  ];

  drawTacticalMinimapRadar({
    ctx,
    rect: { Mw: 260, Mh: 144, mx: 10, my: 10 },
    viewport: { camX: 1300, camY: 720, halfW: 350, halfH: 200 },
    structures,
    champions: [],
    minions: [],
    camps: [],
    dragon: { x: 1300, y: 246, isAlive: true },
    matchTime: 45.0,
  });

  // Verify structure operations were recorded
  const arcOps = ctx.operations.filter(op => op.op === 'arc');
  assert.ok(arcOps.length > 5, 'Should render turret circles');

  // Verify destroyed turret renders crossed lines
  const lineOps = ctx.operations.filter(op => op.op === 'lineTo');
  assert.ok(lineOps.length > 10, 'Should render boundary, roadway, and destroyed structure crosshair lines');

  // Verify header text contains scoreboard
  const fillTexts = ctx.operations.filter(op => op.op === 'fillText');
  const hasRadarTitle = fillTexts.some(t => t.text.includes('TAC-RADAR'));
  assert.ok(hasRadarTitle, 'Minimap radar should display TAC-RADAR title in HUD');
});

test('drawTacticalMinimapRadar renders all 8 jungle camps and epic boss pits', () => {
  const ctx = createMockContext();

  const camps = [
    { id: 'j_blue_blue_buff', name: 'Azure Crest', type: 'blue_buff', x: 640, y: 275, isAlive: true },
    { id: 'j_blue_golem', name: 'Frost Sentinel', type: 'golem', x: 876, y: 320, isAlive: true },
    { id: 'j_red_wolves', name: 'Shadow Stalkers', type: 'wolves', x: 1724, y: 320, isAlive: false }, // Slain
    { id: 'j_red_blue_buff', name: 'Azure Crest', type: 'blue_buff', x: 1960, y: 275, isAlive: true },
    { id: 'j_blue_red_buff', name: 'Crimson Crest', type: 'red_buff', x: 785, y: 1135, isAlive: true },
    { id: 'j_blue_behemoth', name: 'Murk Behemoth', type: 'behemoth', x: 967, y: 1090, isAlive: true },
    { id: 'j_red_drakes', name: 'Crimson Drakes', type: 'drakes', x: 1633, y: 1090, isAlive: false }, // Slain
    { id: 'j_red_red_buff', name: 'Crimson Crest', type: 'red_buff', x: 1815, y: 1135, isAlive: true },
    { id: 'j_siege_golem', name: 'Gravemarch Colossus', type: 'siege_golem', x: 1300, y: 1155, isAlive: true },
  ];

  drawTacticalMinimapRadar({
    ctx,
    rect: { Mw: 260, Mh: 144, mx: 0, my: 0 },
    viewport: { camX: 1300, camY: 720, halfW: 300, halfH: 180 },
    structures: [],
    champions: [],
    minions: [],
    camps,
    dragon: { x: 1300, y: 246, isAlive: true },
    matchTime: 120.0,
  });

  const textOps = ctx.operations.filter(op => op.op === 'fillText');
  const dragonGlyph = textOps.find(t => t.text === 'D');
  assert.ok(dragonGlyph, 'Should render D glyph for alive Dragon Embermaw');

  const golemGlyph = textOps.find(t => t.text === 'G');
  assert.ok(golemGlyph, 'Should render G glyph for alive Golem Colossus');
});

test('drawTacticalMinimapRadar renders minion waves and champion tokens with HP indicator', () => {
  const ctx = createMockContext();

  const champions = [
    {
      id: 'blue_1',
      team: 'blue',
      player: { name: 'KSCARATO' },
      championId: 'c_stafford',
      x: 1200,
      y: 720,
      hp: 850,
      maxHp: 1000,
      isAlive: true,
    },
    {
      id: 'red_1',
      team: 'red',
      player: { name: 'ATFury' },
      championId: 'c_mirelle',
      x: 1400,
      y: 720,
      hp: 300,
      maxHp: 900,
      isAlive: true,
    },
  ];

  const minions = [
    { id: 'm_b1', team: 'blue', type: 'melee', x: 1150, y: 720, hp: 450, maxHp: 450, isAlive: true },
    { id: 'm_b2', team: 'blue', type: 'cannon', x: 1100, y: 720, hp: 800, maxHp: 800, isAlive: true },
    { id: 'm_r1', team: 'red', type: 'caster', x: 1450, y: 720, hp: 300, maxHp: 300, isAlive: true },
  ];

  drawTacticalMinimapRadar({
    ctx,
    rect: { Mw: 260, Mh: 144, mx: 0, my: 0 },
    viewport: { camX: 1300, camY: 720, halfW: 300, halfH: 180 },
    structures: [],
    champions,
    minions,
    camps: [],
    dragon: { x: 1300, y: 246, isAlive: false },
    matchTime: 60.0,
  });

  const textOps = ctx.operations.filter(op => op.op === 'fillText');
  const blueInit = textOps.find(t => t.text === 'K');
  const redInit = textOps.find(t => t.text === 'A');

  assert.ok(blueInit, 'Should render champion initials K on token');
  assert.ok(redInit, 'Should render champion initials A on token');

  // Verify minion arcs were drawn (2 standard minions at r=1.4)
  const standardMinionArcs = ctx.operations.filter(op => op.op === 'arc' && op.r === 1.4);
  assert.equal(standardMinionArcs.length, 2, 'Should draw 2 standard minion pips');
});
