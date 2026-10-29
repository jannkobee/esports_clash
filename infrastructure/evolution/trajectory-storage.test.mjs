import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,unlink,rmdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inflateSync} from 'node:zlib';
import {packTrajectoryRow,trajectoryJournal} from './trajectory-storage.mjs';

async function scratch(run){
 const folder=await mkdtemp(join(tmpdir(),'arena-trajectories-')),output=join(folder,'episode.json');
 try{await run(output);}finally{
  for(const path of [output,output+'.trajectory.partial.ndjson'])try{await unlink(path);}catch(e){if(e.code!=='ENOENT')throw e;}
  await rmdir(folder);
 }
}
test('compressed features preserve exact float32 values and transition metadata',()=>{
 const row={actor:'a',action:1,logp:-.5,state:[.1,.2],candidates:Array.from({length:5},(_,i)=>Array.from({length:224},(_,j)=>(i+j)%19/19))};
 const packed=packTrajectoryRow(row),binary=inflateSync(Buffer.from(packed.features_zlib_b64,'base64'));
 assert.equal(packed.feature_encoding,'float32le-zlib-v1');assert.equal(packed.candidate_count,5);
 assert.deepEqual(packed.state,row.state);assert.equal(packed.action,row.action);assert.equal(packed.logp,row.logp);
 assert.ok(Buffer.from(packed.features_zlib_b64,'base64').length<binary.length/4);
 let offset=0;for(const candidate of row.candidates)for(const value of candidate){assert.equal(binary.readFloatLE(offset),Math.fround(value));offset+=4;}
 assert.throws(()=>packTrajectoryRow({candidates:[[NaN]]}),/Invalid/);
 assert.throws(()=>packTrajectoryRow({candidates:[[0],[0,1]]}),/Invalid/);
});
test('streamed episode envelopes retain row order, empty episodes and immutable output',async()=>{
 await scratch(async output=>{
  const journal=await trajectoryJournal(output),rows=Array.from({length:1300},(_,i)=>({actor:'a',second:i,data:'sample '.repeat(32)}));
  for(const row of rows)await journal.append(row);
  await journal.finish({seed:47},{status:'censored'});
  assert.deepEqual(JSON.parse(await readFile(output,'utf8')),{item:{seed:47},episode:{status:'censored'},rows});
  const before=await readFile(output),again=await trajectoryJournal(output);
  await assert.rejects(()=>again.finish({seed:48},{status:'terminal'}),{code:'EEXIST'});
  assert.deepEqual(await readFile(output),before);
 });
 await scratch(async output=>{const journal=await trajectoryJournal(output);await journal.finish({seed:47},{status:'terminal'});
  assert.deepEqual(JSON.parse(await readFile(output,'utf8')).rows,[]);});
});
test('an interrupted collection keeps a partial journal without inventing a completed episode',async()=>{
 await scratch(async output=>{const journal=await trajectoryJournal(output);await journal.append({actor:'a',second:1});await journal.close();
  await access(output+'.trajectory.partial.ndjson');await assert.rejects(()=>access(output),{code:'ENOENT'});
  await assert.rejects(()=>journal.append({actor:'b'}),/Closed/);});
});
