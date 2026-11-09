// Known-seed integration evidence only. These worlds never count as fresh wins.
import { readFile,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {liveExecutor} from './live-executor.mjs';
const [folder]=process.argv.slice(2),executor=await liveExecutor();
const save=(name,value)=>writeFile(folder+'/'+name+'.json',JSON.stringify(value,null,2)+'\n',{flag:'wx'});
try{
 const episodes=[];
 for(const swapped of [false,true])for(const repeat of [0,1]){
  console.error('Known baseline',swapped,repeat);
  const episode=await executor.episode({seed:47,draft:2,swapped,maxSeconds:1200,wallSeconds:900});
  await save(`baseline-${swapped}-${repeat}`,episode);assert.equal(episode.status,'terminal');episodes.push(episode);
 }
 for(const [a,b] of [[episodes[0],episodes[1]],[episodes[2],episodes[3]]]){
  assert.deepEqual(a.states,b.states);assert.deepEqual(a.result,b.result);
 }
 const actor=JSON.parse(await readFile(folder+'/actor.json','utf8')),rows=[];
 const learning=await executor.episode({seed:47,draft:2,swapped:false,maxSeconds:1200,wallSeconds:900,training:true,
  policies:{blue:actor,red:actor}},()=>{},batch=>rows.push(...batch.rows));
 await save('self-play',{episode:learning,rows});assert.equal(learning.status,'terminal');
 assert.ok(rows.length>1,'No safe training transitions observed');
 assert.ok(rows.some(r=>r.changed),'Actor did not influence any choices');
 assert.ok(rows.every(r=>r.intent!==undefined),'Missing actual intent evidence');
 assert.deepEqual(learning.states[0],episodes[0].states[0]);
 assert.notDeepEqual(learning.states.at(-1),episodes[0].states.at(-1));
 await save('verification',{verified:true,scope:'Known compatibility seed, excluded from held-out benefit',
  baselineBothSidesTerminal:true,repeatedControls:true,transitions:rows.length,learning:learning.learning,
  actorInfluencesWorld:true,productionPromoted:false});
}finally{await executor.close();}
