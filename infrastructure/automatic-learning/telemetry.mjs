import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {atomic} from './store.mjs';
const directory=process.env.LEARNING_DATA;if(!directory||!process.env.LEARNING_HEALTH_URL)throw Error('Set LEARNING_DATA and LEARNING_HEALTH_URL');
const now=new Date();
const metrics=JSON.parse(execFileSync('aws',['lightsail','get-instance-metric-data','--region','ap-southeast-1','--instance-name','Ubuntu-1','--metric-name','BurstCapacityPercentage','--period','60','--start-time',new Date(now-600000).toISOString(),'--end-time',now.toISOString(),'--unit','Percent','--statistics','Average','--output','json'],{timeout:20000,encoding:'utf8'}));
const point=metrics.metricData.filter(p=>Number.isFinite(p.average)).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp))[0];
if(!point||now-Date.parse(point.timestamp)>600000)throw Error('Missing recent burst metric');
const mem=readFileSync('/proc/meminfo','utf8');const number=key=>Number(mem.match(new RegExp('^'+key+':\\s+(\\d+)','m'))?.[1]);
let healthy=false;try{healthy=(await fetch(process.env.LEARNING_HEALTH_URL,{signal:AbortSignal.timeout(5000)})).ok;}catch{}
atomic(directory+'/telemetry.json',{at:Date.now(),burstPercent:point.average,memoryFraction:number('MemAvailable')/number('MemTotal'),applicationHealthy:healthy});
