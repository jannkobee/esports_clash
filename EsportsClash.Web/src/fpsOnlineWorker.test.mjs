import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

test('authoritative FPS worker writes a deterministic MR15 report with allocated aliases', async () => {
  const webRoot = resolve(import.meta.dirname, '..');
  const repositoryRoot = resolve(webRoot, '..');
  const catalogPath = resolve(repositoryRoot, 'EsportsClash.Api', 'resources', 'game', 'catalog.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const selected = catalog.cards.slice(0, 10);
  const id = '10000000-0000-4000-8000-000000000001';
  const folder = await mkdtemp(resolve(tmpdir(), 'fps-match-worker-'));
  const slots = selected.map((card, index) => ({
    instance_id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    card_id: card.id,
    avatar_id: `unused-${index}`
  }));
  const plan = {
    schema: 1,
    match_id: id,
    mode: 'normal',
    game_mode: 'fps_mr15_v1',
    seed: 1337,
    fps: { format: 'MR15_TACTICAL_FPS', rules_version: 1, map_id: 'breakwater' },
    versions: { catalog_version: 'test', rules_version: 'test', policy_version: 'test', observation_version: 'test' },
    blue: slots.slice(0, 5),
    red: slots.slice(5),
    player_profile_schema: 0,
    player_identities: Object.fromEntries(slots.map((slot, index) => [slot.instance_id, selected[index].name]))
  };
  await writeFile(resolve(folder, 'allocation.json'), JSON.stringify({ plan, plan_hash: 'a'.repeat(64) }));

  try {
    const worker = resolve(repositoryRoot, 'infrastructure', 'online', 'fps-match-worker.mjs');
    const child = spawnSync(process.execPath, ['--experimental-strip-types', worker, folder], {
      cwd: webRoot,
      encoding: 'utf8',
      env: { ...process.env, ONLINE_CATALOG_PATH: catalogPath }
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);

    const state = JSON.parse(await readFile(resolve(folder, 'state.json'), 'utf8'));
    assert.equal(state.status, 'completed');
    assert.equal(state.result.game_mode, 'fps_mr15_v1');
    assert.equal(state.result.report.format, 'MR15_TACTICAL_FPS');
    assert.equal(state.result.report.seed, plan.seed);
    assert.equal(state.result.report.mapId, plan.fps.map_id);
    assert.equal(state.result.player_performance.length, 10);
    for (const slot of slots) {
      assert.equal(state.result.report.playerStats[slot.instance_id].name, plan.player_identities[slot.instance_id]);
    }
    assert.equal(state.result.report.finalScore[state.result.winner] >= 16, true);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
