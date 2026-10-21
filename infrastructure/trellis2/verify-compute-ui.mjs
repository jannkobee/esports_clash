import {readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const settings = Object.fromEntries((await readFile('.env.evolution.local','utf8')).split(/\r?\n/)
  .filter(line=>line.includes('=')).map(line=>[line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1)]));
const script = await readFile('infrastructure/trellis2/compute-browser.mjs','utf8');
const credentials = {email:settings.EVOLUTION_OWNER_EMAIL,password:settings.EVOLUTION_OWNER_PASSWORD};
const result = spawnSync('docker',['exec','-i','teamfight-evolution-avatar-worker-1','node','--input-type=module'], {
  input:`const validationCredentials=${JSON.stringify(credentials)};\n${script}`,
  encoding:'utf8', timeout:120000, maxBuffer:12*1024*1024,
});
if (result.status !== 0) throw Error('Compute UI verification failed: '+result.stderr.slice(-2000));
const report = JSON.parse(result.stdout.trim());
await writeFile('docs/generation-compute-ui.png',Buffer.from(report.screenshot,'base64'));
delete report.screenshot;
report.verified_at = new Date().toISOString();
await writeFile('docs/generation-compute-ui-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
