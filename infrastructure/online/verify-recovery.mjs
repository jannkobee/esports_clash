import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const args = ['compose', '--env-file', '.env.evolution.local', '-f', 'compose.evolution.yaml'];
const docker = extra => execFileSync('docker', [...args, ...extra], { encoding: 'utf8', timeout: 30000 });
const inspect = () => JSON.parse(docker(['exec', '-T', 'match-worker', 'python', '-c',
  "import json;from pathlib import Path; p=next(Path('/online-data').glob('*/snapshot.json'));v=json.loads(p.read_text());s=json.loads((p.parent/'state.json').read_text());print(json.dumps({'match_id':v['match_id'],'sequence':v['sequence'],'second':v['snapshot']['second'],'fingerprint':v['snapshot']['fingerprint'],'plan_hash':v['plan_hash'],'status':s['status'],'error':s.get('error')}))"]));
const before = inspect();
assert.equal(before.status, 'running', 'Run during an active match to verify seed recovery');
const started = Date.now();
docker(['restart', 'match-worker']);
let after;
for (let i = 0; i < 120; i++) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  try { after = inspect(); } catch { continue; }
  assert.notEqual(after.status, 'failed', after.error);
  if (after.sequence > before.sequence) break;
}
assert.ok(after?.sequence > before.sequence, 'The worker did not recover and advance');
assert.equal(after.match_id, before.match_id);
assert.equal(after.plan_hash, before.plan_hash);
const evidence = { verified_at: new Date().toISOString(), before, after,
  recovery_seconds: (Date.now() - started) / 1000,
  method: 'Real match-worker restart; frozen seed replay must pass saved fingerprint equality before any new frame; same allocation advanced.',
  training_runner_restarted: false };
await writeFile('docs/online-normal-recovery.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
