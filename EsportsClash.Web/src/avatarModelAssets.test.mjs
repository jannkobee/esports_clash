import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { CHAMPIONS } from './mockData.ts';
import { AvatarModelResources, bindAvatarModel, disposeAvatarRig } from './threeAvatarModels.ts';
import { disposeArenaTerrainResources } from './threeArenaTerrain.ts';

const folder=new URL('../public/models/avatars-v2/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
const parse=async id=>{const bytes=await readFile(new URL(`${id}.glb`,folder));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};

test('all 45 saved GLBs contain valid UV/skinning data, a common joint root and four playable native clips',async()=>{
  assert.deepEqual(manifest.avatars.map(a=>a.id).sort(),CHAMPIONS.map(a=>a.id).sort());
  for(const asset of manifest.avatars){
    const bytes=await readFile(new URL(asset.file,folder));
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8').trim());
    const under=(root,target)=>root===target||(json.nodes[root].children??[]).some(child=>under(child,target));
    for(const skin of json.skins){assert.equal(skin.joints.length,17);assert.ok(skin.joints.every(joint=>under(skin.skeleton,joint)));}
    const file=await parse(asset.id);assert.deepEqual(file.animations.map(a=>a.name),['Idle','Walk','Attack','Cast']);
    let skins=0;
    file.scene.updateMatrixWorld(true);
    file.scene.traverse(node=>{if(!(node instanceof THREE.Mesh))return;
      const uv=node.geometry.getAttribute('uv');assert.ok(uv&&[...uv.array].every(Number.isFinite),asset.id+' UVs');
      if(!(node instanceof THREE.SkinnedMesh))return;skins++;node.skeleton.update();
      const weights=node.geometry.getAttribute('skinWeight'),indices=node.geometry.getAttribute('skinIndex');
      assert.equal(weights.count,node.geometry.getAttribute('position').count);
      for(let i=0;i<weights.count;i++){
        const values=[weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
        assert.ok(Math.abs(values.reduce((a,b)=>a+b,0)-1)<1e-5);
        assert.ok([indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)].every(index=>index>=0&&index<17));
      }
    });assert.ok(skins>0,asset.id+' skinned surfaces');
    const bounds=new THREE.Box3().setFromObject(file.scene);
    assert.ok(bounds.min.y>=-.03,asset.id+' rest-pose equipment passes through floor');
    assert.ok(bounds.max.y>.6&&bounds.max.y<4.5,asset.id+' meter-scale bounds');
    let sample;file.scene.traverse(node=>{if(!sample&&node instanceof THREE.SkinnedMesh)sample=node;});
    const mixer=new THREE.AnimationMixer(file.scene);mixer.clipAction(file.animations.find(clip=>clip.name==='Walk')).play();
    const point=()=>{file.scene.updateMatrixWorld(true);sample.skeleton.update();return sample.getVertexPosition(0,new THREE.Vector3()).applyMatrix4(sample.matrixWorld);};
    mixer.setTime(0);const before=point();mixer.setTime(.15);const after=point();assert.ok(before.distanceTo(after)>1e-5,asset.id+' native animation');
    mixer.stopAllAction();mixer.uncacheRoot(file.scene);disposeArenaTerrainResources(file.scene);
  }
});

test('imported GLB skeleton clones and live visual form changes remain isolated',async()=>{
  const file=await parse('c_invoker'),a=clone(file.scene),b=clone(file.scene),resources=new AvatarModelResources();
  const root=scene=>{let found;scene.traverse(node=>{if(node.userData.avatarPart==='avatar-root')found=node;});return found;};
  const one=bindAvatarModel(root(a),resources),two=bindAvatarModel(root(b),resources);
  const pose=Object.freeze({animState:'cast',animTimer:.3,kaelenOrbs:Object.freeze(['fire','fire','fire'])});
  one.animate(pose,2);two.animate({animState:'idle'},0);
  const arm=scene=>{let found;scene.traverse(node=>{if(node.userData.avatarPart==='right-arm')found=node;});return found;};
  assert.notEqual(arm(a).quaternion.x,arm(b).quaternion.x);
  assert.notEqual(a.getObjectByName('ForearmR'),b.getObjectByName('ForearmR'));
  one.dispose();two.dispose();disposeAvatarRig(file.scene);disposeArenaTerrainResources(file.scene);disposeArenaTerrainResources(resources.owner);
});
