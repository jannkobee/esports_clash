// Run from the repository root. Credentials/tokens are never printed or saved in evidence.
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const settings = Object.fromEntries((await readFile('.env.evolution.local', 'utf8')).split(/\r?\n/)
  .filter(line => line.includes('=')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const origin = 'http://127.0.0.1:8088';
const api = `${origin}/backend/api/v1`;
const operations = process.argv.includes('--operations');
const unauthenticated = await fetch(`${api}/evolution`, { headers: { Accept: 'application/json' } });
assert.equal(unauthenticated.status, 401);
const login = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ email: settings.EVOLUTION_OWNER_EMAIL, password: settings.EVOLUTION_OWNER_PASSWORD, device_name: 'Local deployment validation' }) });
assert.equal(login.status, 200, 'Local owner login failed');
const session = await login.json();
try {
  const response = await fetch(`${api}/evolution`, { headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' } });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.ok(Number.isInteger(data.settings.review_hours) && data.settings.review_hours >= 1 && data.settings.review_hours <= 336);
  assert.equal(data.capabilities.production_promotion, false);
  const browser = await readFile('infrastructure/evolution/verify-ui.mjs', 'utf8');
  const result = spawnSync('docker', ['compose', '--env-file', '.env.evolution.local', '-f', 'compose.evolution.yaml',
    'exec', '-T', 'runner', 'node', '--input-type=module'], {
    input: `const validationOperations = ${operations}; const validationCredentials = ${JSON.stringify({ email: settings.EVOLUTION_OWNER_EMAIL, password: settings.EVOLUTION_OWNER_PASSWORD })};\n${browser}`, encoding: 'utf8', timeout: 90000,
  });
  if (result.status !== 0) throw Error(`Dashboard validation failed: ${result.stderr.slice(-3000)}`);
  const ui = JSON.parse(result.stdout.trim());
  if (ui.screenshot) {
    await writeFile(operations ? 'docs/ml-operations-dashboard.png' : 'docs/evolution-blade-dashboard.png', Buffer.from(ui.screenshot, 'base64')); delete ui.screenshot;
  }
  if (ui.operationsScreenshot) {
    await writeFile('docs/ml-operations-controls.png', Buffer.from(ui.operationsScreenshot, 'base64')); delete ui.operationsScreenshot;
  }
  const evidence = { verified_at: new Date().toISOString(), origin: 'http://localhost:8089/evolution', unauthenticated_status: 401, owner_status: 200,
    schedule: data.settings, capabilities: data.capabilities, runs: data.runs, reviews: data.reviews, ui };
  await writeFile(operations ? 'docs/ml-operations-ui-verification.json' : 'docs/evolution-blade-verification.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ owner_api: 'passed', unauthorized_api: 'blocked', ui, runs: data.runs.map(run => ({ id: run.id, status: run.status, progress: run.progress })) }, null, 2));
} finally {
  await fetch(`${api}/auth/token`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' } });
}
