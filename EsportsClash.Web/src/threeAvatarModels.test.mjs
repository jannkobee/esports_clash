import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { CHAMPIONS } from './mockData.ts';
import { AVATAR_DESIGNS } from './avatarDesigns.ts';
import { AvatarModelResources, buildAvatarModel } from './threeAvatarModels.ts';
import { disposeArenaTerrainResources } from './threeArenaTerrain.ts';

function geometryFingerprint(body) {
  body.updateMatrixWorld(true); const hash=createHash('sha256');
  body.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const position=object.geometry.getAttribute('position'), point=new THREE.Vector3();
    for (let i=0;i<position.count;i++) {
      point.fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld);
      hash.update(`${point.x.toFixed(3)},${point.y.toFixed(3)},${point.z.toFixed(3)};`);
    }
  });
  return hash.digest('hex');
}

test('all 45 current avatars have authored models with distinct geometry, finite bounds and reusable resources', () => {
  assert.equal(CHAMPIONS.length,45);
  assert.deepEqual(Object.keys(AVATAR_DESIGNS).sort(),CHAMPIONS.map(c=>c.id).sort());
  const resources=new AvatarModelResources(), fingerprints=new Set();
  const kits=CHAMPIONS.map(kit=>Object.freeze({...kit}));
  const original=JSON.stringify(kits);
  for (const kit of kits) {
    const model=buildAvatarModel(kit,resources);
    assert.equal(model.body.userData.fallback,undefined,kit.displayName);
    const bounds=new THREE.Box3().setFromObject(model.body), size=bounds.getSize(new THREE.Vector3());
    assert.ok(size.toArray().every(value=>Number.isFinite(value)&&value>0&&value<180),kit.displayName);
    const fingerprint=geometryFingerprint(model.body);
    assert.ok(!fingerprints.has(fingerprint),`${kit.displayName} repeats another mesh design`); fingerprints.add(fingerprint);
    const pose=Object.freeze({animState:'cast',animTimer:.3,trueFormTimer:0,
      kaelenOrbs:Object.freeze(['fire','ice','wind']),propellaGunshipTimer:2});
    model.animate(pose,3); model.animate(pose,3);
  }
  assert.equal(JSON.stringify(kits),original);
  const retained=resources.owner.children.length;
  for (const kit of kits) buildAvatarModel(kit,resources);
  assert.equal(resources.owner.children.length,retained,'respawning avatars reuse cached GPU geometry/materials');
  const stats=disposeArenaTerrainResources(resources.owner);
  assert.ok(stats.geometries>45 && stats.materials>45);
});

test('avatar animation follows real form/orb/gunship state without accumulating transforms', () => {
  const resources=new AvatarModelResources();
  const get=name=>buildAvatarModel(CHAMPIONS.find(kit=>kit.name===name),resources);
  const sylla=get('Sylla'), propella=get('Skybreaker'), arsenal=get('Kaelen');
  const form=sylla.body.getObjectByName('ironclaw-form');
  sylla.animate({trueFormTimer:8},2); assert.equal(form.visible,true);
  sylla.animate({trueFormTimer:0},2); assert.equal(form.visible,false);
  const fins=propella.body.getObjectByName('gunship-fins');
  propella.animate({propellaGunshipTimer:3},2); assert.equal(fins.visible,true);
  propella.animate({propellaGunshipTimer:0},2); assert.equal(fins.visible,false);
  const pose=Object.freeze({animState:'walk',animTimer:.5,kaelenOrbs:Object.freeze(['fire','ice','wind'])});
  arsenal.animate(pose,2); const first=geometryFingerprint(arsenal.body);
  arsenal.animate(pose,2); assert.equal(geometryFingerprint(arsenal.body),first);
  const fire=arsenal.body.getObjectByName('element-orb:0').children[0].material;
  assert.equal(fire.color.getHexString(),new THREE.Color('#ff9960').getHexString());
  disposeArenaTerrainResources(resources.owner);
});
