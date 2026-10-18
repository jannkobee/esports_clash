import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const evidence = JSON.parse(await readFile('docs/online-normal-verification.json', 'utf8'));
const accounts = JSON.parse(await readFile('.local-tools/online-verification-accounts.json', 'utf8'));
const sessions = [], base = 'http://127.0.0.1:8088/backend/api/v1';
async function api(path, token, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
}
try {
  const before = [];
  for (const account of accounts) {
    const session = await api('/auth/login', null, 'POST', account); sessions.push(session);
    const { data } = await api('/online', session.token);
    before.push({ club: data.club, cards: data.cards.map(card => card.id).sort() });
  }
  execFileSync('docker', ['compose', '--env-file', '.env.evolution.local', '-f', 'compose.evolution.yaml',
    'restart', 'api', 'worker', 'match-worker'], { stdio: 'ignore', timeout: 30000 });
  for (let i = 0; i < 40; i++) {
    try { await api('/me', sessions[0].token); break; } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  for (const [index, session] of sessions.entries()) {
    const { data } = await api('/online', session.token);
    assert.deepEqual({ club: data.club, cards: data.cards.map(card => card.id).sort() }, before[index]);
    const match = (await api(`/online/matches/${evidence.match.id}`, session.token)).data;
    assert.equal(match.status, 'completed'); assert.equal(match.result_hash, evidence.match.result_hash);
    assert.equal(match.sequence, evidence.match.sequence);
    const replay = (await api(`/online/matches/${match.id}/replay?after=${match.sequence - 1}&limit=1`, session.token)).data;
    assert.equal(replay.frames[0].snapshot.fingerprint, evidence.browser.terminal_fingerprint);
    assert.equal(replay.frames[0].snapshot.finished, true);
  }
  const result = { verified_at: new Date().toISOString(), match_id: evidence.match.id,
    services_restarted: ['api', 'worker', 'match-worker'],
    same_completed_result_hash: evidence.match.result_hash, same_terminal_sequence: evidence.match.sequence,
    both_accounts_ownership_clubs_and_replay_preserved: true, training_runner_restarted: false };
  await writeFile('docs/online-normal-persistence.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  for (const session of sessions) await api('/auth/token', session.token, 'DELETE');
}
