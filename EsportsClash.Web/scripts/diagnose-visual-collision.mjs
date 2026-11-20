// Where can bullets cross something that looks solid, and where does collision stop a shot in open air? Builds the
// Fontessa scenery unbatched in a CPU scene and compares seeded lines of fire (and lob lines from eye height to
// points 2-14 m up) against live collision. Groups shoot-through hits by the visual piece hit, and phantom blocks
// by the visual collider hit.
// Usage: node --experimental-strip-types scripts/diagnose-visual-collision.mjs [--rays=20000] [--lobs=20000] [--seed=1] [--examples=2] [--strict]
import {NullEngine,Scene,StandardMaterial} from '@babylonjs/core';
import {buildLiveScenery} from '../src/fps/fpsLiveScenery.ts';
import {LiveSurfaceLibrary} from '../src/fps/fpsLiveGraphics.ts';
import {FONTESSA_MAP_RUNTIME} from '../src/fps/fpsLiveMap.ts';
import {auditVisualCollision} from '../src/fps/fpsVisualCollisionAudit.ts';

const arg=(k,f)=>process.argv.find(v=>v.startsWith(`--${k}=`))?.split('=')[1]??f;
const rays=Number(arg('rays','20000')),lobs=Number(arg('lobs',String(rays))),seed=Number(arg('seed','1')),examples=Number(arg('examples','2'));
const strict=process.argv.includes('--strict');
const engine=new NullEngine();
engine.createCanvas=(width,height)=>({width,height,getContext:()=>({
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData(){},fillRect(){},clearRect(){},strokeRect(){},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},save(){},restore(){},translate(){},scale(){},fillText(){},
  measureText:t=>({width:t.length*20}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
})});
const scene=new Scene(engine),materials=new Map();
const material=c=>{if(!materials.has(c))materials.set(c,new StandardMaterial(c,scene));return materials.get(c);};
buildLiveScenery(scene,material,new LiveSurfaceLibrary(scene),{batch:false});
const started=Date.now(),audit=auditVisualCollision(scene,FONTESSA_MAP_RUNTIME,{rays,lobs,seed,strict});
const fmt=p=>`(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
const report=(list,key,describe)=>{
  const groups=new Map();
  for(const f of list){const g=groups.get(f[key])??{count:0,lob:0,list:[],extra:0};g.count++;if(f.lob)g.lob++;g.extra=Math.max(g.extra,f.depth??0);if(g.list.length<examples)g.list.push(f);groups.set(f[key],g);}
  for(const [group,g] of [...groups].sort((a,b)=>b[1].count-a[1].count)){
    console.log(`${String(g.count).padStart(5)}  ${group}${g.lob?`  [${g.lob} lob]`:''}${g.extra?`  (up to ${g.extra.toFixed(1)} m deep)`:''}`);
    for(const f of g.list)console.log(`         ${describe(f)}  line ${fmt(f.from)} -> ${fmt(f.to)}`);
  }
};
console.log(`${audit.rays} lines of fire + ${audit.lobRays} lob lines, ${audit.blockedVisual} visually blocked, ${audit.findings.length} shoot-through${strict?' (strict)':''}, ${audit.phantoms.length} phantom (${((Date.now()-started)/1000).toFixed(1)} s)`);
if(audit.findings.length){console.log('\nShoot-through (drawn solid, bullets pass):');report(audit.findings,'group',f=>`hit ${fmt(f.point)} on ${f.mesh}`);}
if(audit.phantoms.length){console.log('\nPhantom (collider stops a shot where nothing solid is drawn):');report(audit.phantoms,'group',f=>`at ${fmt(f.point)} on ${f.collider}, drawn ${f.gap===null?'clear':`${f.gap.toFixed(2)} m on`}`);}
