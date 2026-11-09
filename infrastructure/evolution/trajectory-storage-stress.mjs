// Isolated synthetic storage check; never training or qualification evidence.
import {constants} from 'node:buffer';
import {mkdtemp,stat,unlink,rmdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {trajectoryJournal} from './trajectory-storage.mjs';
const folder=await mkdtemp(join(tmpdir(),'arena-storage-stress-')),output=join(folder,'episode.json');
const payload='x'.repeat(65536),count=Math.ceil(constants.MAX_STRING_LENGTH/payload.length)+2;
let peak=0;
try{
 const journal=await trajectoryJournal(output);
 for(let i=0;i<count;i++){await journal.append({index:i,payload});peak=Math.max(peak,process.memoryUsage().heapUsed);}
 await journal.finish({synthetic:true},{status:'censored'});
 const size=(await stat(output)).size;assert.ok(size>constants.MAX_STRING_LENGTH);
 let read=0;
 for await(const line of createInterface({input:createReadStream(output),crlfDelay:Infinity})){
  const value=line.startsWith(',')?line.slice(1):line;
  if(!value.startsWith('{"index":'))continue;
  const row=JSON.parse(value);assert.equal(row.index,read++);assert.equal(row.payload.length,payload.length);
 }
 assert.equal(read,count);
 console.log(JSON.stringify({kind:'synthetic-storage-stress',bytes:size,rows:count,former_single_string_limit:constants.MAX_STRING_LENGTH,
  peak_heap_bytes:peak,bounded_heap:true,qualification_evidence:false}));
}finally{
 for(const path of [output,output+'.trajectory.partial.ndjson'])try{await unlink(path);}catch(e){if(e.code!=='ENOENT')throw e;}
 await rmdir(folder);
}
