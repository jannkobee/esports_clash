import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArenaFeatures, resolveArenaAtmosphere, parseLightingOverride, DUSK_START_SECOND } from './match-viewer/battlefieldFeatures.ts';
import { captureViewerSnapshot } from './match-viewer/MatchViewer.ts';
import { ViewerReplay } from './match-viewer/ViewerReplay.ts';

const baseFrame = {
  second: 100, champions: [], minions: [], structures: [], camps: [],
  dragon: { id: 'dragon', x: 0, y: 0, hp: 0, maxHp: 1, isAlive: false }, wards: [], projectiles: [], spells: [],
};
const scuttler = (over = {}) => ({ id: 's1', x: 1400, y: 330, hp: 80, maxHp: 100, isAlive: true, ...over });

test('features cover live scuttlers, shrines, plants, hexgates and supply drops', () => {
  const features = buildArenaFeatures({
    second: 100,
    scuttlers: [scuttler({ shrineTeam: 'blue', shrineExpiresAt: 130 }), scuttler({ id: 's2', isAlive: false })],
    plants: [{ id: 'p1', kind: 'blast_cone', x: 1, y: 2, isAlive: true }, { id: 'p2', kind: 'honeyfruit', x: 3, y: 4, isAlive: false }],
    portals: [{ id: 'g1', team: 'red', fromX: 10, fromY: 20, toX: 30, toY: 40, expiresAt: 110 }, { id: 'g2', team: 'blue', fromX: 0, fromY: 0, toX: 1, toY: 1, expiresAt: 90 }],
    supplyDrop: { id: 'drop', x: 1400, y: 720, active: true, capturingTeam: 'blue', captureProgress: 1.5 },
    supplyCaptureSeconds: 3,
  });
  const byKind = kind => features.filter(f => f.kind === kind);
  assert.equal(byKind('scuttler').length, 1, 'dead scuttlers are omitted');
  assert.equal(byKind('speed_shrine')[0].team, 'blue');
  assert.ok(Math.abs(byKind('speed_shrine')[0].progress - 30 / 65) < 1e-9);
  assert.equal(byKind('blast_cone')[0].active, true);
  assert.equal(byKind('honeyfruit')[0].active, false, 'dormant plants stay visible but inactive');
  assert.deepEqual(byKind('hexgate').map(f => f.id), ['g1:in', 'g1:out'], 'expired gates are omitted');
  assert.equal(byKind('supply_drop')[0].progress, 0.5);
});

test('claimed, inactive or absent supply drops and expired shrines produce no props', () => {
  const none = buildArenaFeatures({
    second: 200, scuttlers: [scuttler({ shrineTeam: 'red', shrineExpiresAt: 150 })], plants: [], portals: [],
    supplyDrop: { id: 'drop', x: 0, y: 0, active: true, claimedByTeam: 'red', captureProgress: 3 }, supplyCaptureSeconds: 3,
  });
  assert.deepEqual(none.map(f => f.kind), ['scuttler']);
  assert.equal(buildArenaFeatures({ second: 1, scuttlers: [], plants: [], portals: [], supplyDrop: null, supplyCaptureSeconds: 3 }).length, 0);
});

test('atmosphere is daylight until overtime, then dusk; the lighting override wins', () => {
  assert.equal(resolveArenaAtmosphere(DUSK_START_SECOND - 1, null).lighting, 'daylight');
  assert.equal(resolveArenaAtmosphere(DUSK_START_SECOND, 'ocean').lighting, 'dusk');
  assert.equal(resolveArenaAtmosphere(5, 'cloud', 'overcast').lighting, 'overcast');
  assert.equal(parseLightingOverride('overcast'), 'overcast');
  assert.equal(parseLightingOverride('night'), undefined);
  assert.throws(() => { resolveArenaAtmosphere(0, null).lighting = 'dusk'; }, TypeError);
});

test('viewer snapshots copy features and atmosphere, and replay round-trips them', () => {
  const features = buildArenaFeatures({
    second: 100, scuttlers: [scuttler()], plants: [{ id: 'p1', kind: 'scryer_bloom', x: 5, y: 6, isAlive: false }],
    portals: [], supplyDrop: null, supplyCaptureSeconds: 3,
  });
  const frame = { ...baseFrame, features, atmosphere: resolveArenaAtmosphere(100, 'infernal') };
  const snapshot = captureViewerSnapshot(frame);
  const feature = snapshot.actors.filter(a => a.kind === 'feature');
  assert.deepEqual(feature.map(a => a.subtype), ['scuttler', 'scryer_bloom']);
  assert.equal(feature[1].motion.state, 'dormant');
  assert.equal(snapshot.atmosphere.element, 'infernal');
  assert.throws(() => { feature[0].x = 0; }, TypeError);
  const replay = new ViewerReplay(); replay.capture(frame);
  const restored = ViewerReplay.parse(replay.export()).seek(100);
  assert.equal(restored.actors.filter(a => a.kind === 'feature').length, 2);
  assert.equal(restored.atmosphere.lighting, 'daylight');
});

test('replay rejects malformed atmosphere and non-finite feature progress', () => {
  const frame = { ...baseFrame, features: [{ id: 'f', kind: 'supply_drop', x: 0, y: 0, team: 'neutral', active: true, hp: 1, maxHp: 1, progress: 0.2 }],
    atmosphere: resolveArenaAtmosphere(0, null) };
  const replay = new ViewerReplay(); replay.capture(frame);
  const bad = JSON.parse(replay.export()); bad.frames[0].atmosphere.lighting = 'neon';
  assert.throws(() => ViewerReplay.parse(JSON.stringify(bad)), /Invalid atmosphere/);
  const badProgress = JSON.parse(replay.export()); badProgress.frames[0].actors[0].progress = 'x';
  assert.throws(() => ViewerReplay.parse(JSON.stringify(badProgress)), /Invalid actor/);
});
