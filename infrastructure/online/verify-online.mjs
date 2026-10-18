import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:8088/backend/api/v1';
await mkdir('.local-tools', { recursive: true });
const path = '.local-tools/online-verification-accounts.json';
let accounts;
try { accounts = JSON.parse(await readFile(path, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  accounts = ['Blue', 'Red'].map(side => ({ name: `Normal Verification ${side}`,
    email: `normal-${side.toLowerCase()}-${Date.now()}@example.com`, password: randomBytes(24).toString('base64url') }));
  await writeFile(path, JSON.stringify(accounts, null, 2));
}
const sessions = [];
// Reserved local verification accounts are provisioned administratively: Docker DNS
// need not resolve example.com, and production registration keeps its DNS validation.
const seed = spawn('docker', ['compose', '--env-file', '.env.evolution.local', '-f', 'compose.evolution.yaml',
  'exec', '-T', 'api', 'php'], { stdio: ['pipe', 'pipe', 'pipe'] });
let seedErrors = '';
seed.stderr.on('data', bytes => { seedErrors = (seedErrors + bytes).slice(-2000); });
seed.stdout.resume();
seed.stdin.end(`<?php require '/app/vendor/autoload.php';
$app = require '/app/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
foreach (json_decode(base64_decode('${Buffer.from(JSON.stringify(accounts)).toString('base64')}'), true) as $account) {
  if (!preg_match('/^normal-(blue|red)-[0-9]+@example\\.com$/', $account['email'])) throw new RuntimeException('Invalid verification account');
  if (!App\\Models\\User::where('email', $account['email'])->exists()) App\\Models\\User::create($account);
}
`);
assert.equal(await new Promise(resolve => seed.once('exit', resolve)), 0, `Local verification provisioning failed: ${seedErrors}`);
const api = async (route, session, method = 'GET', body) => {
  const response = await fetch(`${base}${route}`, { method, headers: { Accept: 'application/json',
    ...(session ? { Authorization: `Bearer ${session.token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
};
try {
  for (const account of accounts) {
    let response = await api('/auth/login', null, 'POST', account);
    assert.ok([200, 201].includes(response.status), `Verification account authentication failed (${response.status}): ${response.data.message}`);
    sessions.push(response.data);
  }
  const rosters = [];
  for (const session of sessions) {
    const response = await api('/online', session);
    assert.equal(response.status, 200);
    assert.equal(response.data.data.cards.length, 5);
    rosters.push(response.data.data);
  }
  const foreign = structuredClone(rosters[0].club.lineup);
  foreign[0].instance_id = rosters[1].cards[0].id;
  assert.equal((await api('/online/club', sessions[0], 'PUT', { revision: rosters[0].club.revision, lineup: foreign })).status, 422);
  assert.equal((await api('/evolution', sessions[0])).status, 403);
  const source = await readFile('infrastructure/online/verify-browsers.mjs', 'utf8');
  const child = spawn('docker', ['compose', '--env-file', '.env.evolution.local', '-f', 'compose.evolution.yaml',
    'run', '--rm', '-T', '--no-deps', '--entrypoint', 'node', 'match-worker', '--input-type=module'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = '';
  child.stdout.on('data', bytes => { output += bytes; });
  child.stderr.on('data', bytes => { errors = (errors + bytes).slice(-5000); });
  child.stdin.end(`const verificationSessions = ${JSON.stringify(sessions)};\n${source}`);
  const exit = await new Promise(resolve => child.once('exit', resolve));
  assert.equal(exit, 0, `Browser verification failed: ${errors}`);
  const browser = JSON.parse(output);
  if (browser.screenshot) {
    await writeFile('docs/online-normal-verification.png', Buffer.from(browser.screenshot, 'base64'));
    delete browser.screenshot;
  }
  const matchId = browser.match_id;
  let match;
  for (let i = 0; i < 30; i++) {
    const response = await api(`/online/matches/${matchId}`, sessions[0]);
    assert.equal(response.status, 200); match = response.data.data;
    if (match.status === 'completed' || match.status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(match.status, 'completed', `Match settlement failed: ${match.error}`);
  const second = (await api(`/online/matches/${matchId}`, sessions[1])).data.data;
  assert.equal(match.result_hash, second.result_hash);
  assert.equal((await api(`/online/matches/${matchId}`, sessions[0], 'POST', { winner: 'red' })).status, 405);
  const first = await api(`/online/matches/${matchId}/replay?after=0&limit=1`, sessions[0]);
  const last = await api(`/online/matches/${matchId}/replay?after=${match.sequence - 1}&limit=1`, sessions[1]);
  assert.equal(first.status, 200); assert.equal(last.status, 200);
  assert.equal(first.data.data.frames[0].sequence, 1);
  assert.equal(last.data.data.frames[0].snapshot.finished, true);
  for (const session of sessions) assert.equal((await api('/online', session)).data.data.cards.length, 5);
  const evidence = { verified_at: new Date().toISOString(), scope: 'Two authenticated local verification accounts; no global player/population claim',
    browser, ownership_foreign_card_blocked: true, evolution_owner_access_blocked: true,
    browser_completion_blocked: true, result_consistent_across_accounts: true,
    match: { id: match.id, status: match.status, sequence: match.sequence, plan_hash: match.plan_hash,
      result_hash: match.result_hash, versions: match.plan.versions, winner: match.result.winner,
      duration_seconds: match.result.report.durationSeconds, terminal_nexus: match.result.terminal_nexus },
    replay_first_sequence: first.data.data.frames[0].sequence, replay_terminal_sequence: last.data.data.frames[0].sequence,
    owned_cards_per_account: 5, ranked_rating_or_currency_grants: false };
  await writeFile('docs/online-normal-verification.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  for (const session of sessions) await api('/auth/token', session, 'DELETE');
}
