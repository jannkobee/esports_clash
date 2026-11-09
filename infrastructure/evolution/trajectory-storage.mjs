import {open,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {deflateSync} from 'node:zlib';

/** Lossless float32 packing. Repeated own/kit features compress especially well. */
export function packTrajectoryRow(row){
  if(!row.candidates)return row;
  const {candidates,...rest}=row,inputs=candidates[0]?.length;
  if(!inputs||!candidates.every(c=>c.length===inputs&&c.every(Number.isFinite)))throw Error('Invalid trajectory feature matrix');
  const bytes=Buffer.allocUnsafe(candidates.length*inputs*4);let offset=0;
  for(const candidate of candidates)for(const value of candidate){bytes.writeFloatLE(value,offset);offset+=4;}
  return {...rest,candidate_count:candidates.length,feature_encoding:'float32le-zlib-v1',
    features_zlib_b64:deflateSync(bytes,{level:1}).toString('base64')};
}

/** Bound memory during collection and JSON export. A crashed partial journal is
 * retained; only a successfully completed envelope receives a worker witness. */
export async function trajectoryJournal(output){
  const partial=output+'.trajectory.partial.ndjson',journal=await open(partial,'wx');let closed=false;
  const close=async()=>{if(!closed){closed=true;await journal.close();}};
  return {
    async append(row){if(closed)throw Error('Closed trajectory journal');await journal.writeFile(JSON.stringify(row)+'\n');},
    close,
    async finish(item,episode){
      await close();const envelope=await open(output,'wx');
      try{
        await envelope.writeFile('{"item":'+JSON.stringify(item)+',"episode":'+JSON.stringify(episode)+',"rows":[\n');
        let separator='';
        const input=createInterface({input:createReadStream(partial),crlfDelay:Infinity});
        for await(const line of input){if(!line)continue;await envelope.writeFile(separator+line+'\n');separator=',';}
        await envelope.writeFile(']}\n');
      }finally{await envelope.close();}
      await unlink(partial);
    }
  };
}
