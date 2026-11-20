// Where can bullets cross something that looks solid? Builds the Fontessa scenery unbatched in a CPU scene and
// compares seeded lines of fire against live collision. Groups shoot-through hits by the visual piece hit.
// Usage: node --experimental-strip-types scripts/diagnose-visual-collision.mjs [--rays=20000] [--seed=1] [--examples=2]
import {NullEngine,Scene,StandardMaterial} from '@babylonjs/core';
import {buildLiveScenery} from '../src/fps/fpsLiveScenery.ts';
import {LiveSurfaceLibrary} from '../src/fps/fpsLiveGraphics.ts';
import {FONTESSA_MAP_RUNTIME} from '../src/fps/fpsLiveMap.ts';
import {auditVisualCollision} from '../src/fps/fpsVisualCollisionAudit.ts';

const arg=(k,f)=>process.argv.find(v=>v.startsWith(`--${k}=`))?.split('=')[1]??f;
const rays=Number(arg('rays','20000')),seed=Number(arg('seed','1')),examples=Number(arg('examples','2'));
const engine=new NullEngine();
engine.createCanvas=(width,height)=>({width,height,getContext:()=>({
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData(){},fillRect(){},clearRect(){},strokeRect(){},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},save(){},restore(){},translate(){},scale(){},fillText(){},
  measureText:t=>({width:t.length*20}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
})});
const scene=new Scene(engine),materials=new Map();
const material=c=>{if(!materials.has(c))materials.set(c,new StandardMaterial(c,scene));return materials.get(c);};
buildLiveScenery(scene,material,new LiveSurfaceLibrary(scene),{batch:false});
const started=Date.now(),audit=auditVisualCollision(scene,FONTESSA_MAP_RUNTIME,{rays,seed});
const groups=new Map();
for(const f of audit.findings){const g=groups.get(f.group)??{count:0,penetrable:0,depth:0,list:[]};g.count++;if(f.penetrable)g.penetrable++;g.depth=Math.max(g.depth,f.depth??0);if(g.list.length<examples)g.list.push(f);groups.set(f.group,g);}
const fmt=p=>`(${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)})`;
console.log(`${audit.rays} lines of fire, ${audit.blockedVisual} visually blocked, ${audit.findings.length} shoot-through (${((Date.now()-started)/1000).toFixed(1)} s)`);
for(const [group,g] of [...groups].sort((a,b)=>b[1].count-a[1].count)){
  console.log(`${String(g.count).padStart(5)}  ${group}${g.depth?`  (up to ${g.depth.toFixed(1)} m deep)`:g.penetrable?`  [${g.penetrable} via penetrable solid]`:''}`);
  for(const f of g.list)console.log(`         hit ${fmt(f.point)} on ${f.mesh}  line ${fmt(f.from)} -> ${fmt(f.to)}`);
}
