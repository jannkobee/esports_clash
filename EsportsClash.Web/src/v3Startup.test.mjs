import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const entry of ['v3Roster.ts', 'v3Combat.ts', 'v3Arena.ts']) {
  test(`V3 startup initializes when ${entry} is imported first`, () => {
    const url = new URL(`./${entry}`, import.meta.url).href;
    const script = `await import(${JSON.stringify(url)}); const {V3_PREVIEW_KEYS}=await import(${JSON.stringify(new URL('./v3Combat.ts', import.meta.url).href)}); if(Object.keys(V3_PREVIEW_KEYS).length!==45)throw new Error('Missing roster entries');`;
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
  });
}
