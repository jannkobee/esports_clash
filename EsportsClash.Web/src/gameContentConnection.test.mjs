import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogConnection} from './gameContentConnection.ts';
import {contentChampion,validateGameContent} from './gameContent.ts';
import {CHAMPIONS} from './mockData.ts';
const champion=CHAMPIONS[0];
function snapshot(hash='a'){
  return {schema:1,hash:hash.repeat(64),records:[{id:champion.id,kind:'avatar',version:1,builtin:true,deleted:false,data:{...champion,
    name:champion.displayName,internalName:champion.legacyInternalName??champion.name,canonicalId:'test-avatar',lore:champion.lore??''}}]};
}
test('published avatar values enter new snapshots while dispatch and frozen matches stay stable',()=>{
  const first=validateGameContent(snapshot());assert.ok(first);
  const frozen=structuredClone(first),next=snapshot('b');
  next.records[0].data.hp=1700;next.records[0].data.displayName='Updated avatar';next.records[0].data.name='Updated avatar';
  const published=validateGameContent(next);assert.ok(published);
  const current=contentChampion(champion,published);
  assert.equal(current.hp,1700);assert.equal(current.displayName,'Updated avatar');
  assert.equal(current.name,champion.name);assert.equal(current.id,champion.id);assert.equal(current.abilityRuleset,champion.abilityRuleset);
  assert.equal(contentChampion(champion,frozen).hp,champion.hp);
  const incompatible=structuredClone(published);incompatible.records[0].data.abilityRuleset='other-rules';
  assert.equal(contentChampion(champion,incompatible).hp,champion.hp);
  for(const mutate of [s=>s.records[0].data.hp=-1,s=>s.records[0].data.primaryColor='bad',s=>s.records[0].deleted=true]){
    const raw=snapshot();mutate(raw);assert.equal(validateGameContent(raw),undefined);
  }
});
test('refresh retains complete catalogs across outages, deduplicates versions and recovers',async()=>{
  const publications=[],statuses=[];let result=snapshot();
  const request=async()=>{if(result instanceof Error)throw result;return {ok:true,json:async()=>result};};
  const client=createCatalogConnection('/catalog',s=>publications.push(s),s=>statuses.push(s),request);
  await client.refresh();await client.refresh();assert.equal(publications.length,1);assert.equal(statuses.at(-1).status,'connected');
  const frozen=structuredClone(publications[0]);result=Error('offline');await client.refresh();
  assert.equal(statuses.at(-1).status,'stale');assert.equal(publications.length,1);
  result={schema:1};await client.refresh();assert.equal(statuses.at(-1).status,'stale');
  result=snapshot('b');await client.refresh();assert.equal(publications.length,2);assert.equal(statuses.at(-1).status,'connected');
  assert.equal(frozen.hash,'a'.repeat(64));client.dispose();await client.refresh();assert.equal(publications.length,2);
});
test('concurrent refreshes share one request and disposed responses cannot publish',async()=>{
  let resolve,calls=0;const publications=[],statuses=[];
  const request=()=>{calls++;return new Promise(r=>resolve=r);};
  const client=createCatalogConnection('/catalog',s=>publications.push(s),s=>statuses.push(s),request);
  const pending=client.refresh();await client.refresh();assert.equal(calls,1);
  client.dispose();resolve({ok:true,json:async()=>snapshot()});await pending;
  assert.equal(publications.length,0);assert.equal(statuses.length,0);
});
