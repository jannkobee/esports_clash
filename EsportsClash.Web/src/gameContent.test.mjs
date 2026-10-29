import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentChampion, contentItems, contentInvokedSpells, validateGameContent, catalogImageUrl } from './gameContent.ts';
import { CHAMPIONS } from './mockData.ts';
import { ALL_ITEMS, BOOTS, getRecommendedItem } from './itemsData.ts';
import { KAELEN_INVOKED_SPELLS } from './kaelenAbilities.ts';
import { ultimateBaseCooldown } from './abilityRules.ts';
const source=JSON.parse(readFileSync(new URL('../../EsportsClash.Api/resources/game/editor-catalog.json',import.meta.url),'utf8'));
const snapshot=()=>({schema:1,hash:'a'.repeat(64),records:source.records.map(row=>({...row,data:structuredClone(row.payload),payload:undefined,version:1,builtin:true,deleted:false}))});
test('the shared initial catalog matches every bundled definition without changing defaults',()=>{
  const raw=snapshot();raw.records.sort((a,b)=>a.id.localeCompare(b.id));
  const s=validateGameContent(raw);assert.ok(s);assert.equal(s.records.length,239);
  const items=contentItems(ALL_ITEMS,BOOTS,s);assert.deepEqual(items.items,ALL_ITEMS);assert.deepEqual(items.boots,BOOTS);
  for(const c of CHAMPIONS) {
    const loaded=contentChampion(c,s);
    for(const slot of ['skill1','skill2','ultimate']) { assert.equal(loaded[slot].damage,c[slot].damage);assert.equal(loaded[slot].cooldown,c[slot].cooldown);assert.equal(loaded[slot].castType,c[slot].castType); }
  }
});
test('new-match changes affect real recommendations and abilities while frozen data stays intact',()=>{
  const s=validateGameContent(snapshot()), frozen=structuredClone(s);
  const c=CHAMPIONS[0], row=s.records.find(row=>row.id===c.id+':skill1');row.data.damage=999;row.data.cooldown=1.5;
  const loaded=contentChampion(c,s);assert.equal(loaded.skill1.damage,c.skill1.damage);assert.equal(loaded.skill1.cooldown,1.5);
  assert.notEqual(c.skill1.damage,999);assert.notEqual(contentChampion(c,frozen).skill1.damage,999);
  const item=s.records.find(row=>row.kind==='item'&&row.data.tier==='Starting');item.data.cost=1;item.data.stats.ad=777;
  const catalog=contentItems(ALL_ITEMS,BOOTS,s);assert.equal(getRecommendedItem('Fighter',[],1,undefined,catalog.items).stats.ad,777);
});
test('deleted items and boots are unavailable; deleted active skills and invoked spells are disabled',()=>{
  const s=validateGameContent(snapshot());const c=CHAMPIONS[0];
  s.records.find(row=>row.id===c.id+':skill1').deleted=true;
  s.records.find(row=>row.id===BOOTS.id).deleted=true;
  s.records.find(row=>row.id===ALL_ITEMS[0].id).deleted=true;
  s.records.find(row=>row.data.slot==='invoked').deleted=true;
  assert.equal(contentChampion(c,s).skill1.disabled,true);
  const items=contentItems(ALL_ITEMS,BOOTS,s);assert.equal(items.boots,undefined);assert.ok(!items.items.some(item=>item.id===ALL_ITEMS[0].id));
  assert.equal(contentInvokedSpells(KAELEN_INVOKED_SPELLS,s)[0].disabled,true);
});
test('explicit ultimate cooldown survives a second normalization and leaves authored kit defaults alone',()=>{
  const s=validateGameContent(snapshot()), c=CHAMPIONS[0];s.records.find(row=>row.id===c.id+':ultimate').data.cooldown=7;
  const loaded=contentChampion(contentChampion(c,s),s);
  assert.equal(ultimateBaseCooldown({champion:loaded,level:6}),7);assert.equal(ultimateBaseCooldown({champion:c,level:6}),c.ultimate.cooldown);
  const newer=structuredClone(s);newer.records.find(row=>row.id===c.id+':ultimate').data.cooldown=9;
  assert.equal(ultimateBaseCooldown({champion:contentChampion(loaded,newer),level:6}),9);
  newer.records.find(row=>row.id===c.id+':ultimate').data.cooldown=c.ultimate.cooldown;
  assert.equal(ultimateBaseCooldown({champion:contentChampion(loaded,newer),level:6}),c.ultimate.cooldown);
});
test('invalid snapshots and unsafe image paths cannot enter the shared catalog',()=>{
  for(const mutate of [s=>s.schema=2,s=>s.records.push(s.records[0]),s=>s.records[0].data.cost=-1,s=>s.records[0].data.image='../../secret',s=>s.records[0].data.stats.ad=Infinity]) {const s=snapshot();mutate(s);assert.equal(validateGameContent(s),undefined);}
  assert.equal(catalogImageUrl('x.svg','/api'),undefined);assert.equal(catalogImageUrl('javascript:alert(1)','/api'),undefined);
  assert.equal(catalogImageUrl('a'.repeat(64)+'.png','/api/'),'/api/game-content/images/'+'a'.repeat(64)+'.png');
});
