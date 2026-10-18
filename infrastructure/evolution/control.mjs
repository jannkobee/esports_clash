import { readFile } from 'node:fs/promises';
const settings = Object.fromEntries((await readFile('.env.evolution.local', 'utf8')).split(/\r?\n/).filter(line => line.includes('='))
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const api = 'http://127.0.0.1:8088/backend/api/v1';
const login = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ email: settings.EVOLUTION_OWNER_EMAIL, password: settings.EVOLUTION_OWNER_PASSWORD, device_name: 'Local evolution control' }) });
if (!login.ok) throw Error(`Owner login failed (${login.status})`);
const { token } = await login.json();
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' };
try {
  const action = process.argv[2] ?? 'status';
  const { data } = await (await fetch(`${api}/evolution`, { headers })).json();
  if (action === 'stop') {
    const active = data.runs.find(run => ['queued', 'running', 'stopping', 'paused_resource'].includes(run.status));
    if (active) {
      const response = await fetch(`${api}/evolution/runs/${active.id}`, { method: 'DELETE', headers });
      if (!response.ok) throw Error(`Stop failed (${response.status})`);
      console.log(JSON.stringify({ stopping: active.id }));
    } else console.log(JSON.stringify({ active: false }));
  } else if (action === 'start') {
    const response = await fetch(`${api}/evolution/runs`, { method: 'POST', headers });
    if (!response.ok) throw Error(`Start failed (${response.status})`);
    console.log(JSON.stringify((await response.json()).data));
  } else if (action === 'pause' || action === 'resume') {
    const response = await fetch(`${api}/evolution/settings`, { method: 'PUT', headers, body: JSON.stringify({ enabled: action === 'resume' }) });
    if (!response.ok) throw Error(`Schedule change failed (${response.status})`);
    console.log(JSON.stringify({ automatic_cycles: action === 'resume' }));
  } else if (action === 'status') {
    console.log(JSON.stringify({ settings: data.settings, runs: data.runs, reviews: data.reviews }, null, 2));
  } else throw Error('Expected status, start, stop, pause or resume');
} finally {
  await fetch(`${api}/auth/token`, { method: 'DELETE', headers });
}
