// One private live episode per invocation. No candidate commands or shell input.
import { readFile } from 'node:fs/promises';
import { liveExecutor } from './live-executor.mjs';
import {packTrajectoryRow,trajectoryJournal} from './trajectory-storage.mjs';
const [request,output]=process.argv.slice(2);
const item=JSON.parse(await readFile(request,'utf8'));
const executor=await liveExecutor();let journal;
try {
  journal=await trajectoryJournal(output);
  const episode=await executor.episode(item,()=>{},async batch=>{
    for(const row of batch.rows){
      if(item.learningTeam&&row.team!==item.learningTeam)continue;
      await journal.append(item.compactTrajectories?packTrajectoryRow(row):row);
    }
  });
  // Incomplete matches are retained as evidence but never converted to terminal returns.
  await journal.finish(item,episode);
} finally { await journal?.close();await executor.close(); }
