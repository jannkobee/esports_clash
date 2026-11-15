import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FPS_IDENTITY_PERSONALITIES} from './fps/fpsPlayerArchitecture.ts';
test('the FPS catalog resolves entirely inside the frontend package',async()=>{
 const source=await readFile(new URL('./fps/fpsPlayerArchitecture.ts',import.meta.url),'utf8');
 assert.ok(!source.includes('EsportsClash.Api/'));const json=JSON.parse(await readFile(new URL('./fps/fps-player-architecture-v4.json',import.meta.url),'utf8'));
 assert.equal(json.version,4);assert.equal(json.profiles.length,18);assert.equal(FPS_IDENTITY_PERSONALITIES.length,54);
});
