import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,Vector3} from '@babylonjs/core';
import {LIVE_FPS_MAP,LIVE_BOOST_SPOTS,liveWalkable} from './fps/fpsLiveMap.ts';
import {liveVillageAsset} from './fps/fpsVillageDesign.ts';
import {computeOverviewCameraPose} from './fps/fpsBroadcastDirector.ts';
import {advanceLiveRecoil,liveWeaponRecoilKick} from './fps/fpsLiveWeapons.ts';
import {liveSmokeDepth,liveSmokeOccludes,liveSmokeCloudLobes} from './fps/fpsLiveBrain.ts';
import {createLiveSmokeRenderVolume,updateLiveSmokeRenderVolume} from './fps/fpsSmokeRendering.ts';
import {SIGNAL_CIRCUIT,fpsBroadcastPresentation,fpsBroadcastText} from './fps/fpsBroadcastPresentation.ts';

test('every live collider has a village purpose, civic A differs from market B, and spawns remain free',()=>{
  for(const solid of LIVE_FPS_MAP.solids){const asset=liveVillageAsset(solid.id);assert.ok(asset.purpose.length>10);assert.ok(asset.surface);}
  const fallback=liveVillageAsset('fontessa-patch-73');assert.equal(fallback.kind,'wall');assert.ok(fallback.purpose.length>10);
  assert.equal(liveVillageAsset('a-crates').kind,'clock');assert.equal(liveVillageAsset('b-fountain').kind,'fountain');
  assert.equal(LIVE_FPS_MAP.solids.some(w=>w.id==='b-sandbags'),false);
  assert.equal(LIVE_BOOST_SPOTS.length,0);for(const spot of LIVE_BOOST_SPOTS)assert.ok(liveWalkable(spot),'Crate perches use admitted physical terrain');
  for(const slot of [0,1,2,3,4]){
    assert.ok(liveWalkable({x:(slot-2)*2.2,z:-33-(slot%2)*1.4}));
    assert.ok(liveWalkable({x:slot<=1?-3.5-slot*2:slot===2?0:3.5+(slot-3)*2.2,z:slot===2?42:40+(slot%2)*1.5}));
  }
});

test('bird view fits all map corners and rooftop height on landscape and portrait canvases',()=>{
  for(const aspect of [16/9,4/3,9/16]){
    const pose=computeOverviewCameraPose(aspect),eye=new Vector3(...Object.values(pose.position)),target=new Vector3(...Object.values(pose.target));
    const forward=target.subtract(eye).normalize(),right=Vector3.Cross(Vector3.Up(),forward).normalize(),up=Vector3.Cross(forward,right).normalize();
    for(const x of [-36,36])for(const z of [-46,46])for(const y of [0,8]){
      const v=new Vector3(x,y,z).subtract(eye),depth=Vector3.Dot(v,forward),half=depth*Math.tan(pose.fov/2);
      assert.ok(Math.abs(Vector3.Dot(v,right)/(half*aspect))<1);assert.ok(Math.abs(Vector3.Dot(v,up)/half)<1);
    }
    assert.ok(eye.y>90&&Math.abs(eye.z)<12);
  }
});

test('spray climbs continuously within fixed limits, compensation remains individual, release settles',()=>{
  for(const weapon of ['ak47','m4a1_s','mp9','mac10']){
    let pitch=0,yaw=0,low=0,high=0;
    for(let shot=1;shot<=30;shot++){
      const kick=liveWeaponRecoilKick(weapon,shot);pitch+=kick.pitch;yaw+=kick.yaw;
      assert.ok(Math.abs(kick.yaw)<.016);assert.ok(pitch>=0&&pitch<.25&&Math.abs(yaw)<.08);
      low=advanceLiveRecoil(low,0,.1,.1)+kick.pitch;high=advanceLiveRecoil(high,1,.1,.1)+kick.pitch;
    }
    assert.ok(low>high+.015);
    for(let i=0;i<30;i++)low=advanceLiveRecoil(low,0,1/30,.2+i/30);
    assert.ok(low<.0001);
  }
  assert.ok(liveWeaponRecoilKick('ak47',1).pitch>liveWeaponRecoilKick('m4a1_s',1).pitch);
});

test('smoke uses optical path length rather than tangent hits, clears on expiry and fits renderer bounds',()=>{
  const smoke={id:1,x:0,z:0,y:1.44,radius:4.8,startedAt:0,expires:18};
  assert.ok(liveSmokeDepth({x:0,z:-8},{x:0,z:8},1.6,1.6,smoke,5)>4);
  assert.equal(liveSmokeOccludes({x:7,z:-8},{x:7,z:8},1.6,1.6,smoke,5),false);
  assert.equal(liveSmokeOccludes({x:0,z:-8},{x:0,z:8},7,7,smoke,5),false);
  assert.equal(liveSmokeDepth({x:0,z:-8},{x:0,z:8},1.6,1.6,smoke,18),0);
  const engine=new NullEngine(),scene=new Scene(engine);
  try{
    engine.getCaps().fragmentDepthSupported=true;
    engine.getCaps().maxFragmentUniformVectors=16;assert.equal(createLiveSmokeRenderVolume(scene,0),undefined);
    engine.getCaps().maxFragmentUniformVectors=256;
    const view=createLiveSmokeRenderVolume(scene,1);assert.ok(view);updateLiveSmokeRenderVolume(view,smoke,5);
    assert.equal(view.material.disableDepthWrite,true);assert.equal(view.mesh.isPickable,false);
    for(const radius of [.3,1,4.8]){
      const cloud={...smoke,radius};updateLiveSmokeRenderVolume(view,cloud,5);
      for(const lobe of liveSmokeCloudLobes(cloud,5)){
        assert.ok(Math.abs(lobe.x)+lobe.scaleX/2<=view.mesh.scaling.x/2);
        assert.ok(Math.abs(lobe.y)+lobe.scaleY/2<=view.mesh.scaling.y/2);
        assert.ok(Math.abs(lobe.z)+lobe.scaleZ/2<=view.mesh.scaling.z/2);
      }
    }
  }finally{scene.dispose();engine.dispose();}
});

test('Hexapedia organizer packages select their own presentation with a stable offline fallback',()=>{
  const registry=[SIGNAL_CIRCUIT,{id:'harbor-stage',name:'Harbor Stage',broadcast:{version:1,layout:'competition',accent:'#79bad0',package:'Harbor Matchday',intro:'ON THE WATERFRONT',round:'HARBOR ROUND'}},{id:'meridian-relay',name:'Meridian Relay',broadcast:{version:1,layout:'spotlight',accent:'#aebc83',package:'Meridian Matchday',intro:'THE NEXT ANGLE',round:'MERIDIAN ROUND'}}];
  for(const organizer of registry){const result=fpsBroadcastPresentation(organizer.id,registry);assert.equal(result.name,organizer.name);assert.equal(result.layout,organizer.broadcast.layout);assert.equal(result.round,organizer.broadcast.round);}
  assert.equal(fpsBroadcastPresentation('unknown').id,'signal-circuit');
  assert.equal(fpsBroadcastPresentation('unknown',registry).id,registry[0].id);
  assert.equal(fpsBroadcastText('Cardrel: Contact Civic passage - last seen'),'Cardrel: Contact ahead - last seen');
  assert.equal(fpsBroadcastText('Footsteps near Town-hall courtyard - unconfirmed'),'Footsteps nearby - unconfirmed');
});

test('three-tier smoke cloud lobes keep skirt grounded and crown elevated inside shader bounds',()=>{
  const lobes=liveSmokeCloudLobes({id:4,x:0,z:0,y:1.44,radius:4.8,startedAt:0,expires:18},4.5);
  assert.equal(lobes.length,15);
  assert.ok(lobes.some(l=>l.y<-.1),'Lower skirt lobes must dip below smoke.y to ground on floor');
  assert.ok(lobes.some(l=>l.y>.2),'Upper crown lobes must rise above smoke.y');
});
