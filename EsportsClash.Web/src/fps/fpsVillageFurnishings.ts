import {MeshBuilder, Vector3, type Scene} from '@babylonjs/core';
import {LIVE_FPS_MAP} from './fpsLiveMap.ts';
import type {VillageBuilder} from './fpsVillageArchitecture.ts';

/** Native environment geometry: rooted trunks, branching crowns and street-use details. */
export function buildVillageFurnishings(scene:Scene,{box,detail}:VillageBuilder):void {
  for(const wall of LIVE_FPS_MAP.solids){
    const x=(wall.minX+wall.maxX)/2,z=(wall.minZ+wall.maxZ)/2;
    if(wall.id.startsWith('village-tree-')){
      const trunk=detail(MeshBuilder.CreateCylinder(`${wall.id}-bark`,{height:wall.height,diameterBottom:wall.maxX-wall.minX,diameterTop:.29,tessellation:14},scene),'#67543d');
      trunk.position.set(x,wall.height/2,z);
      for(let groove=0;groove<9;groove++){
        const a=groove*Math.PI*2/9;
        detail(MeshBuilder.CreateTube(`${wall.id}-bark-ridge-${groove}`,{path:[new Vector3(x+Math.cos(a)*.31,.1,z+Math.sin(a)*.31),new Vector3(x+Math.cos(a+.15)*.23,1.7,z+Math.sin(a+.15)*.23),new Vector3(x+Math.cos(a+.3)*.14,wall.height,z+Math.sin(a+.3)*.14)],radius:.018,tessellation:5},scene),'#897050');
      }
      for(let branch=0;branch<9;branch++){
        const a=branch*2.399,reach=1.2+(branch%3)*.35,top=wall.height+.8+(branch%2)*.5;
        const end=new Vector3(x+Math.cos(a)*reach,top,z+Math.sin(a)*reach);
        detail(MeshBuilder.CreateTube(`${wall.id}-branch-${branch}`,{path:[new Vector3(x,wall.height*.56,z),new Vector3(x+Math.cos(a)*.6,wall.height*.85,z+Math.sin(a)*.6),end],radius:.055+(branch%2)*.025,tessellation:7},scene),'#776048');
        const crown=detail(MeshBuilder.CreateSphere(`${wall.id}-leaf-mass-${branch}`,{diameter:1.65,segments:8},scene),branch%3?'#71804d':'#596d43');
        crown.position.copyFrom(end);crown.scaling.set(1.1,.68,.95);crown.metadata={castShadow:true};
        // Small modeled leaf sprays break up the silhouette and read at operative eye level.
        for(let leaf=0;leaf<18;leaf++){
          const angle=leaf*2.399+branch,rad=.65+(leaf%3)*.16;
          const spray=detail(MeshBuilder.CreateSphere(`${wall.id}-leaf-${branch}-${leaf}`,{diameter:.38,segments:4},scene),(leaf+branch)%3?'#86905a':'#a0a775');
          spray.position.set(end.x+Math.cos(angle)*rad,end.y+(leaf%5-2)*.24,end.z+Math.sin(angle)*rad);
          spray.scaling.set(1,.18,.45);spray.rotation.set(angle*.3,angle,.35);spray.metadata={castShadow:false};
        }
      }
      const grate=detail(MeshBuilder.CreateTorus(`${wall.id}-soil-border`,{diameter:1.7,thickness:.08,tessellation:24},scene),'#8d9277');grate.position.set(x,.03,z);
      const soil=detail(MeshBuilder.CreateDisc(`${wall.id}-soil`,{radius:.8,tessellation:24},scene),'#76664c');soil.rotation.x=Math.PI/2;soil.position.set(x,.012,z);soil.metadata={castShadow:false};
    }
    if(wall.id==='east-lane-dogleg'){
      box('residential-terrace-planter-lip',x,wall.height+.03,z,wall.maxX-wall.minX+.06,.08,wall.maxZ-wall.minZ+.06,'#d0bea0');
      box('residential-terrace-planter-soil',x,wall.height+.075,z,wall.maxX-wall.minX-.16,.025,wall.maxZ-wall.minZ-.16,'#74644d');
      for(let plant=0;plant<7;plant++){
        const leaf=detail(MeshBuilder.CreateSphere(`residential-planter-herb-${plant}`,{diameter:.6,segments:6},scene),plant%2?'#849463':'#667b50');
        leaf.position.set(x+(plant%2-.5)*.45,wall.height+.24,z-1.05+plant*.35);leaf.scaling.y=.6;
      }
    }
    if(wall.id.startsWith('village-bin-')){
      const body=detail(MeshBuilder.CreateCylinder(`${wall.id}-metal-body`,{height:1.02,diameter:.58,tessellation:16},scene),'#536d65');body.position.set(x,.51,z);
      const lid=detail(MeshBuilder.CreateCylinder(`${wall.id}-metal-lid`,{height:.08,diameter:.62,tessellation:16},scene),'#78867a');lid.position.set(x,1.01,z);
      box(`${wall.id}-slot`,x,.84,z-.29,.28,.11,.025,'#172e2a');
      for(let rib=0;rib<12;rib++){
        const a=rib*Math.PI/6;
        box(`${wall.id}-rib-${rib}`,x+Math.cos(a)*.287,.47,z+Math.sin(a)*.287,.025,.8,.025,'#819082');
      }
      for(let scrap=0;scrap<5;scrap++){
        const paper=box(`${wall.id}-paper-${scrap}`,x-.47+scrap*.2,.02,z-.5+(scrap%2)*.15,.16,.012,.11,scrap%2?'#d8cfab':'#9d8060');paper.rotation.y=scrap*1.9;paper.metadata={castShadow:false};
      }
    }
  }
  for(const [x,z] of [[-15.01,-14],[-7.51,14],[14.01,-14],[16.01,10],[33.49,-18],[33.49,-3]]){
    const drain=box(`village-service-drain-${x}-${z}`,x,.022,z,.45,.018,1,'#6b7264');drain.metadata={castShadow:false};
    for(let slit=0;slit<6;slit++)box(`village-drain-slot-${x}-${z}-${slit}`,x,.033,z-.38+slit*.15,.33,.008,.04,'#36423e').metadata={castShadow:false};
  }
}
