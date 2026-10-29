import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHAMPIONS,INITIAL_PLAYERS} from './mockData.ts';
import {HERO_IDENTITIES_V3,resolveHeroIdentityV3} from './heroIdentityV3.ts';
test('V3 source has exactly 45 unique mappings, 180 base slots and ten fabric pages',()=>{
  const m=JSON.parse(readFileSync(new URL('../../docs/avatar-rework/inputs/ESPORTSCLASH_V3_ABILITY_DESIGN_MANIFEST.json',import.meta.url)));
  assert.equal(m.heroes.length,45);
  for(const field of ['legacyId','canonicalId','displayName'])assert.equal(new Set(m.heroes.map(h=>h[field])).size,45);
  assert.equal(m.heroes.reduce((sum,h)=>sum+Object.keys(h.abilities).length,0),180);
  for(const h of m.heroes)assert.deepEqual(Object.keys(h.abilities),['P','S1','S2','R']);
  assert.equal(m.heroes.find(h=>h.canonicalId==='mirelle-vane').rPageSpells.length,10);
});
test('canonical and legacy aliases round-trip every real persisted avatar key without changing cards',()=>{
  const before=JSON.stringify(INITIAL_PLAYERS);assert.equal(HERO_IDENTITIES_V3.length,45);
  for(const c of CHAMPIONS){const h=resolveHeroIdentityV3(c.id);assert.ok(h);assert.equal(h.internalName,c.name);
    for(const alias of [h.key,h.internalName,h.legacyId,h.canonicalId,h.displayName])assert.equal(resolveHeroIdentityV3(alias)?.key,c.id);
  }
  assert.equal(JSON.stringify(INITIAL_PLAYERS),before);assert.equal(resolveHeroIdentityV3('missing'),undefined);
});
