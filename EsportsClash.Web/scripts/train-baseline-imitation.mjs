// New checkpoint only: never overwrites a foundation, registry, or active policy.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {fitBaselineActor,baselineImitationMetrics} from '../src/baselineImitation.ts';
import {INTELLIGENCE_ACTIONS} from '../src/intelligencePolicy.ts';
const [input,output,heldoutSeed]=process.argv.slice(2);assert.ok(input&&output&&heldoutSeed,'input output heldout-seed required');
const stored=await readFile(input),bytes=stored[0]===31&&stored[1]===139?gunzipSync(stored):stored;
const evidence=JSON.parse(bytes);const train=[],heldout=[],seen=new Set();
for(const run of evidence.runs){
  const key=`${run.seed}:${run.draft}:${!!run.swapped}`;
  if(run.mode!=='baseline'||run.status!=='terminal'||seen.has(key))continue;seen.add(key);
  for(const row of run.demonstrations??[]){
    // Winning demonstrations are useful examples, not assumed optimal actions.
    if(row.team!==run.winner||!row.observation||row.selected!==row.zeroPolicySelected||!row.baselineLegal)continue;
    const action=INTELLIGENCE_ACTIONS.indexOf(row.zeroPolicySelected);if(action<0)continue;
    const tier=row.candidates.find(c=>c.key===row.zeroPolicySelected)?.priority;
    const mask=INTELLIGENCE_ACTIONS.map(a=>row.candidates.some(c=>c.key===a&&c.available&&c.priority===tier));
    if(mask.filter(Boolean).length<2)continue;
    (run.seed===Number(heldoutSeed)?heldout:train).push({observation:row.observation,action,mask});
  }
}
assert.ok(train.length&&heldout.length,'Independent training and held-out complete matches required');
const policy=fitBaselineActor(train);
await writeFile(output,JSON.stringify({kind:'baseline-imitation-checkpoint',version:1,policy,
  input_hash:createHash('sha256').update(bytes).digest('hex'),heldoutSeed:Number(heldoutSeed),
  training:baselineImitationMetrics(policy,train),heldout:baselineImitationMetrics(policy,heldout),
  qualified:false,note:'Imitation accuracy is not match improvement; independent seeded evaluation is required before activation.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({training:train.length,heldout:heldout.length,qualified:false}));
