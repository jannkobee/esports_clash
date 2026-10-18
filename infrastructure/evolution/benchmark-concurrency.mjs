// Two isolated experimental simulators share the same aggregate 2 CPU / 3 GiB budget.
// This benchmark does not enable concurrent training or contribute fitting evidence.
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = await readFile('infrastructure/evolution/benchmark.mjs', 'utf8');
const run = () => new Promise((resolve, reject) => {
  const child = spawn('docker', ['run','--rm','--init','--memory=1536m','--cpus=1','--shm-size=256m','-i',
    '-e','BENCHMARK_MODES=headless','-e','BENCHMARK_FAST_PAGE=1','--entrypoint','node',
    'teamfight-evolution-runner:local','--input-type=module'], {stdio:['pipe','pipe','pipe']});
  let out='',err='';child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err=(err+data).slice(-3000));
  child.once('error',reject);child.once('exit',code=>code===0?resolve(JSON.parse(out)):reject(Error(err)));
  child.stdin.end(source);
});
const started=Date.now();const results=await Promise.all([run(),run()]);
assert.deepEqual(results[0].modes[0].states,results[1].modes[0].states);
const rows=results.map(result=>{const {states,...row}=result.modes[0];return row;});
const evidence={verified_at:new Date().toISOString(),scope:'Experimental isolated worker-count benchmark; excluded from learning; no concurrent training enabled',
  workers:2,aggregate_cpu_limit:2,aggregate_ram_limit_mib:3072,wall_seconds:(Date.now()-started)/1000,
  aggregate_simulated_seconds_per_wall_second:rows.reduce((sum,row)=>sum+row.simulated_seconds,0)/((Date.now()-started)/1000),
  sum_of_sampled_anon_peaks_mib:rows.reduce((sum,row)=>sum+row.memory.max_sampled_anon_mib,0),
  final_state_rng_events_and_audits_match:true,runs:rows,
  four_workers:'Not attempted: four times the measured single-worker peak plus reserves must fit the same 3 GiB budget before qualification.'};
await writeFile('docs/ml-concurrency-benchmark.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
