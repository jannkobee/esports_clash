import {retiredAvatarAssetTest} from './testFixtures/retiredAvatarAssets.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CHAMPIONS} from './mockData.ts';
import {AVATAR_MESH_PROFILES,meshSection} from './avatarMeshProfiles.ts';
import {AvatarModelResources,buildAvatarModel} from './threeAvatarModels.ts';
import {wingMembrane} from './avatarCreatureMeshes.ts';
import {equipmentWorkshop} from './avatarEquipment.ts';
import {hasStandingAnatomy} from './avatarStance.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('all 45 avatars have bounded mesh proportions and equipment-specific attack direction',()=>{
 assert.deepEqual(Object.keys(AVATAR_MESH_PROFILES).sort(),CHAMPIONS.map(c=>c.id).sort());
 assert.equal(new Set(Object.values(AVATAR_MESH_PROFILES).map(p=>p.attack)).size,9);
 for(const p of Object.values(AVATAR_MESH_PROFILES)){
  for(const key of ['chest','waist','limb','face','depth'])assert.ok(p[key]>=.85&&p[key]<=1.2);
  for(let y=0;y<100;y++)assert.ok(Object.values(meshSection(p,y)).every(v=>Number.isFinite(v)&&v>.8&&v<1.3));
 }
});

test('standing shoulder bridges have continuous skin influences and usable normals around both sockets',()=>{
 const resources=new AvatarModelResources();let sockets=0;
 for(const kit of CHAMPIONS){
  if(!hasStandingAnatomy(kit.id)||kit.id==='c_invoker')continue;
  const model=buildAvatarModel(kit,resources,{externalAnatomy:true,externalOutfit:true});
  for(const side of [0,1]){
   const bridge=model.body.getObjectByName('shoulder-gusset-'+side),weights=bridge.geometry.attributes.skinWeight,normals=bridge.geometry.attributes.normal;
   assert.ok(bridge.isSkinnedMesh);let blended=0;
   for(let i=0;i<weights.count;i++){
    assert.ok(Math.abs(weights.getX(i)+weights.getY(i)-1)<1e-6);
    if(weights.getX(i)>.01&&weights.getY(i)>.01)blended++;
    assert.ok(Math.abs(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))-1)<1e-5);
   }
   assert.ok(blended>20,kit.id+' continuous shoulder blend');sockets++;
  }
  model.dispose();
 }
 assert.equal(sockets,70);disposeArenaTerrainResources(resources.owner);
});

test('mirrored wing membranes have matching shape, outward winding, finite normalized UVs and curved surfaces',()=>{
 for(const bat of [true,false]){
  const left=wingMembrane(-1,bat),right=wingMembrane(1,bat),a=left.attributes.position,b=right.attributes.position;
  assert.equal(a.count,b.count);let raised=0;
  for(let i=0;i<a.count;i++){
   assert.equal(a.getX(i),-b.getX(i));assert.equal(a.getY(i),b.getY(i));assert.equal(a.getZ(i),b.getZ(i));
   if(a.getY(i)>1)raised++;
   const uv=right.attributes.uv;assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1&&uv.getY(i)>=0&&uv.getY(i)<=1);
  }
  assert.ok(raised>20);
  for(const g of [left,right]){assert.ok(Array.from({length:g.attributes.normal.count},(_,i)=>g.attributes.normal.getY(i)).every(y=>y>0));g.dispose();}
 }
});

test('refined heavy weapons fit readable proportions and firearms have an open muzzle',()=>{
 const resources=new AvatarModelResources(),parent=new THREE.Group(),workshop=equipmentWorkshop(resources,'fixture','#98d8e1');
 const gun=workshop.gun(parent,60,7,'#407b74');const box=new THREE.Box3().setFromObject(gun);
 assert.ok(box.getSize(new THREE.Vector3()).x<15,'no oversized receiver block');
 const barrel=gun.getObjectByName('turned-barrel'),geometry=barrel.geometry,normal=geometry.attributes.normal;
 assert.ok(gun.getObjectByName('recessed-bore'));assert.ok(gun.getObjectByName('muzzle-rim'));
 // No front cap triangles whose three vertices share the muzzle's axial coordinate.
 const index=geometry.index,p=geometry.attributes.position,tip=geometry.boundingBox?.max.y??Math.max(...Array.from({length:p.count},(_,i)=>p.getY(i)));
 for(let i=0;i<index.count;i+=3)assert.ok(![index.getX(i),index.getX(i+1),index.getX(i+2)].every(v=>Math.abs(p.getY(v)-tip)<1e-5));
 assert.ok([...normal.array].every(Number.isFinite));
 const totem=workshop.totem(parent);assert.ok(new THREE.Box3().setFromObject(totem).getSize(new THREE.Vector3()).x<20);
 disposeArenaTerrainResources(resources.owner);
});

retiredAvatarAssetTest('v8 Blender scenes retain all shipped actions and all licensed grip shapes',async()=>{
 const folder=new URL('../../art/avatars-v8/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 assert.deepEqual(manifest.models.map(m=>m.id).sort(),CHAMPIONS.map(c=>c.id).sort());
 let shapes=0;
 for(const model of manifest.models){
  assert.deepEqual(model.actions,['Attack','Cast','Death','Hit','Idle','Run','Strafe','TurnLeft','TurnRight','Walk']);shapes+=model.gripShapes;
  const bytes=await readFile(new URL(model.file,folder));assert.equal(bytes.length,model.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256);
 }
 assert.equal(shapes,68);
});

retiredAvatarAssetTest('every v8 GLB has a single-parent node tree for strict importers and retains the runtime joint set',async()=>{
 for(const kit of CHAMPIONS){
  const bytes=await readFile(new URL(`../public/models/avatars-v8/${kit.id}.glb`,import.meta.url)),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),parents=new Set();
  for(const node of json.nodes)for(const child of node.children??[]){assert.ok(!parents.has(child),kit.id+' multiple node parents');parents.add(child);}
  for(const skin of json.skins)assert.equal(skin.joints.length,17);
  assert.equal(json.animations.length,10);assert.ok(!json.images.some(image=>image.uri));
 }
});
