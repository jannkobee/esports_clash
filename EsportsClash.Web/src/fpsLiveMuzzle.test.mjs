import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,StandardMaterial,Vector3} from '@babylonjs/core';
import {create3DWeaponMesh,createViewmodelMesh,FpsLiveViewer} from './fps/fpsLiveViewer.ts';
import {LIVE_WEAPONS} from './fps/fpsLiveWeapons.ts';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);
const pointClose=(actual,expected)=>{close(actual.x,expected.x);close(actual.y,expected.y);close(actual.z,expected.z);};
function sceneFixture(){
  const engine=new NullEngine(),scene=new Scene(engine),materials=new Map();
  const getMat=hex=>{if(!materials.has(hex))materials.set(hex,new StandardMaterial(hex,scene));return materials.get(hex);};
  return {scene,getMat,dispose:()=>{scene.dispose();engine.dispose();}};
}

test('every firearm socket matches its actual barrel, brake or suppressor tip',()=>{
  const f=sceneFixture();
  const expected={pistol:[.038,.19],glock:[.038,.19],usp_s:[.038,.305],deagle:[.04,.24],
    rifle:[.035,.585],ak47:[.035,.585],m4a1_s:[.035,.54],sniper:[.038,.82],scout:[.035,.67],
    smg:[.03,.35],mp9:[.035,.24],mac10:[.03,.22],mag7:[.045,.33],nova:[.042,.535],negev:[.04,.47]};
  try{
    for(const weapon of Object.keys(LIVE_WEAPONS)){
      const gun=create3DWeaponMesh(weapon,weapon,f.scene,f.getMat),socket=gun.metadata?.muzzle;
      assert.ok(socket,`${weapon} has no muzzle socket`);assert.equal(socket.parent,gun);
      close(socket.position.x,0);close(socket.position.y,expected[weapon][0]);close(socket.position.z,expected[weapon][1]);
    }
    for(const item of ['knife','flash','smoke','incendiary','bomb'])
      assert.equal(create3DWeaponMesh(item,item,f.scene,f.getMat).metadata?.muzzle,undefined);
  }finally{f.dispose();}
});

test('muzzle sockets follow the gun position, crouch height, yaw and scale',()=>{
  const f=sceneFixture();
  try{
    const gun=create3DWeaponMesh('ak47','world',f.scene,f.getMat),socket=gun.metadata.muzzle;
    gun.position.set(5,.8,9);gun.rotation.y=Math.PI/2;gun.scaling.setAll(1.2);
    gun.computeWorldMatrix(true);socket.computeWorldMatrix(true);
    pointClose(socket.getAbsolutePosition(),new Vector3(5+.585*1.2,.8+.035*1.2,9));
  }finally{f.dispose();}
});

test('first-person and world tracers originate at their own animated muzzles and stay isolated per camera',()=>{
  const f=sceneFixture();
  try{
    const gun=create3DWeaponMesh('m4a1_s','world',f.scene,f.getMat);
    gun.position.set(5,.8,9);gun.rotation.y=.5;
    const first=createViewmodelMesh('m4a1_s','blue','first',f.scene,f.getMat);
    first.position.set(5.25,1.1,9.3);first.rotation.set(.08,.5,.04);
    assert.ok(first.metadata.muzzle);assert.notEqual(first.metadata.muzzle.parent,first,'The socket must inherit the nested gun transform');
    const viewer=Object.create(FpsLiveViewer.prototype);
    Object.assign(viewer,{scene:f.scene,actors:new Map([['shooter',{gunNode:gun,gunWeapon:'m4a1_s'}]]),
      tracers:new Map(),mainFpEnabled:true,mainFollowedId:'shooter',fpGunRoot:first,fpGunWeapon:'m4a1_s'});
    const shot={id:1,time:10,actorId:'shooter',weapon:'m4a1_s',from:{x:5,z:9},fromY:1.6,to:{x:20,z:30},toY:.82,team:'blue'};
    viewer.updateShotTracers({time:10,shots:[shot]});
    const tracer=viewer.tracers.get(1);
    const checkOrigins=()=>{
      const world=tracer.world.getVerticesData('position'),fp=tracer.firstPerson.getVerticesData('position');
      pointClose(new Vector3(...world.slice(0,3)),viewer.muzzlePosition(gun));
      pointClose(new Vector3(...fp.slice(0,3)),viewer.muzzlePosition(first));
      assert.notDeepEqual(world.slice(0,3),fp.slice(0,3));
      pointClose(new Vector3(...world.slice(3,6)),new Vector3(20,.82,30));
      pointClose(new Vector3(...fp.slice(3,6)),new Vector3(20,.82,30));
    };
    checkOrigins();
    gun.position.y=.65;first.rotation.x=.16;viewer.updateShotTracers({time:10.03,shots:[shot]});checkOrigins();
    viewer.setTracerCamera(true);assert.equal(tracer.world.isEnabled(),false);assert.equal(tracer.firstPerson.isEnabled(),true);
    viewer.setTracerCamera(false);assert.equal(tracer.world.isEnabled(),true);assert.equal(tracer.firstPerson.isEnabled(),false);
    viewer.updateShotTracers({time:10.11,shots:[shot]});assert.equal(viewer.tracers.size,0);
  }finally{f.dispose();}
});
