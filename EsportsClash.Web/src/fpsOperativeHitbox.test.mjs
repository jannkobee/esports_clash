import test from 'node:test';
import assert from 'node:assert/strict';
import { Color3, Mesh, NullEngine, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { LIVE_HITBOX, liveActorHeadY, liveRayDirection, traceLiveActorHit } from './fps/fpsLiveBallistics.ts';
import { liveAimTargetSize, liveAimZone } from './fps/fpsLiveGunplay.ts';
import { createTacticalOperativeMesh } from './fps/fpsLiveViewer.ts';

/** Fraction of a grid of parallel rays (spacing `step`) across a 1 m window that hit the head. */
function headCoverage(target, from, step = .01) {
  let head = 0;
  for (let x = -.5; x <= .5; x += step) for (let y = 1.0; y <= 1.9; y += step) {
    const hit = traceLiveActorHit({ x: target.x + x, y, z: from }, liveRayDirection(0, 0), 40, target);
    if (hit?.region === 'head') head++;
  }
  return head * step * step;
}

test('the head is a skull-sized target: about a third of the old 0.17 m sphere', () => {
  const target = { x: 0, z: 10, crouch: false, jumpY: 0, yaw: Math.PI };
  const area = headCoverage(target, 0);
  const oldArea = Math.PI * .17 * .17;
  assert.ok(area < oldArea * .4, `head cross-section ${area.toFixed(4)} m² vs old ${oldArea.toFixed(4)} m²`);
  assert.ok(area > Math.PI * .085 * .105, 'still a real head, not a pinpoint');
  // Just under the chin is the neck (body), not the head.
  const neck = traceLiveActorHit({ x: 0, y: liveActorHeadY(target) - .11, z: 0 }, liveRayDirection(0, 0), 20, target);
  assert.equal(neck?.region, 'body');
});

test('torso is wider than it is deep, legs have a gap, and crouching lowers every volume', () => {
  const front = { x: 0, z: 10, crouch: false, jumpY: 0, yaw: Math.PI };
  const side = { ...front, yaw: Math.PI / 2 };
  const across = (target, offset) => traceLiveActorHit({ x: offset, y: 1.2, z: 0 }, liveRayDirection(0, 0), 20, target);
  assert.equal(across(front, .18)?.region, 'body', 'chest is ~0.4 m across seen from the front');
  assert.equal(across(side, .18), undefined, 'and ~0.27 m deep seen from the side');
  assert.equal(traceLiveActorHit({ x: 0, y: .4, z: 0 }, liveRayDirection(0, 0), 20, front), undefined, 'gap between the legs');
  assert.equal(traceLiveActorHit({ x: .105, y: .4, z: 0 }, liveRayDirection(0, 0), 20, front)?.region, 'body', 'a leg');
  const crouched = { ...front, crouch: true };
  assert.equal(traceLiveActorHit({ x: 0, y: liveActorHeadY(crouched) + .01, z: 0 }, liveRayDirection(0, 0), 20, crouched)?.region, 'head');
  assert.equal(traceLiveActorHit({ x: 0, y: 1.3, z: 0 }, liveRayDirection(0, 0), 20, crouched), undefined, 'nothing above a crouched head');
});

test('the head hit volume never extends beyond the drawn head of any operative', () => {
  const engine = new NullEngine(), scene = new Scene(engine), mats = new Map();
  const getMat = hex => { let m = mats.get(hex); if (!m) { m = new StandardMaterial(hex, scene); m.diffuseColor = Color3.FromHexString(hex); mats.set(hex, m); } return m; };
  const h = LIVE_HITBOX.head, centreY = 1.54 + h.centreOffset;
  for (const force of ['ct', 't']) for (let variant = 0; variant < 5; variant++) {
    const operative = createTacticalOperativeMesh(force, `hb-${force}-${variant}`, scene, getMat, variant);
    operative.root.computeWorldMatrix(true);
    let min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of operative.headPivot.getChildMeshes()) {
      if (!(mesh instanceof Mesh) || !mesh.isEnabled()) continue;
      mesh.computeWorldMatrix(true);mesh.refreshBoundingInfo();
      const box = mesh.getBoundingInfo().boundingBox;
      min = Vector3.Minimize(min, box.minimumWorld);max = Vector3.Maximize(max, box.maximumWorld);
    }
    const label = `${force}${variant}`;
    assert.ok(max.x - min.x >= h.halfWidth * 2, `${label}: head width ${(max.x - min.x).toFixed(3)} covers the hitbox`);
    assert.ok(min.y <= centreY - h.halfHeight && max.y >= centreY + h.halfHeight, `${label}: head height covers the hitbox`);
    assert.ok(max.z - min.z >= h.halfDepth * 2, `${label}: head depth covers the hitbox`);
  }
  scene.dispose();engine.dispose();
});

test('aim zone: close one-taps go for the head, mid-range rifles and SMGs aim at the chest and spray', () => {
  assert.equal(liveAimZone({ weapon: 'deagle', distance: 8, precision: .8 }), 'head');
  assert.equal(liveAimZone({ weapon: 'ak47', distance: 6, precision: .7 }), 'head');
  assert.equal(liveAimZone({ weapon: 'ak47', distance: 22, precision: .5 }), 'body', 'average rifler at mid range');
  assert.equal(liveAimZone({ weapon: 'mac10', distance: 18, precision: .7 }), 'body');
  assert.equal(liveAimZone({ weapon: 'sniper', distance: 4, precision: 1 }), 'body', 'the AWP kills to the chest');
  assert.equal(liveAimZone({ weapon: 'nova', distance: 4, precision: 1 }), 'body');
  assert.equal(liveAimZone({ weapon: 'scout', distance: 35, precision: .6 }), 'head');
  // Spraying, a moving target and pressure all pull the crosshair down.
  const still = liveAimZone({ weapon: 'm4a1_s', distance: 11, precision: .85 });
  assert.equal(still, 'head');
  assert.notEqual(liveAimZone({ weapon: 'm4a1_s', distance: 11, precision: .85, spraying: true }), 'head');
  assert.notEqual(liveAimZone({ weapon: 'm4a1_s', distance: 11, precision: .85, targetSpeed: 2.5, pressure: 1 }), 'head');
  // The trigger window for a head matches the smaller hit volume.
  const head = liveAimTargetSize(10, true), body = liveAimTargetSize(10, false);
  assert.ok(Math.tan(head.halfWidth) * 10 <= LIVE_HITBOX.head.halfWidth && Math.tan(head.halfHeight) * 10 <= LIVE_HITBOX.head.halfHeight);
  assert.ok(body.halfWidth > head.halfWidth * 2);
});
