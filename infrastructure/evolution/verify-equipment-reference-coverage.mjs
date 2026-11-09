import {readFile, readdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {backofficeSession} from './backoffice-session.mjs';

const root = 'docs/pipeline-audit-20261024/';
const declared = JSON.parse(await readFile(root+'component-inventory-declarations.json','utf8'));
const progress = JSON.parse(await readFile(root+'upload-progress.json','utf8'));
const reviewed = new Map();
for (const name of (await readdir(root)).filter(name=>/^uploads-equipment-.*\.json$/.test(name)&&!name.endsWith('.receipts.json'))) {
  for (const item of JSON.parse(await readFile(root+name,'utf8'))) {
    if (item.sha256) reviewed.set(item.avatar_id+'/'+item.component_id,item.sha256);
  }
}
const session = await backofficeSession();
const inventories = new Map();
try {
  for (const row of progress.rows) {
    inventories.set(row.avatar_id, await session.evaluate(`fetch('/api/v1/avatars/${row.avatar_id}/components',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Inventory unavailable');return r.json()})`));
  }
  const rows = declared.map(item=>{
    const inventory=inventories.get(item.avatar_id);
    const current=inventory.components.find(component=>component.id===item.component_id);
    assert.ok(current,`Missing inventory declaration ${item.avatar_id}/${item.component_id}`);
    const expected=reviewed.get(item.avatar_id+'/'+item.component_id);
    if(expected)assert.equal(current.reference_sha256,expected,`Reviewed upload changed ${item.avatar_id}/${item.component_id}`);
    return {avatar_id:item.avatar_id,id:item.component_id,label:item.label,status:current.status,
      reference_sha256:current.reference_sha256,reference_purpose:current.reference_purpose,
      reviewed:!!expected,inventory_version:inventory.version,inventory_hash:inventory.hash};
  });
  const uploaded=rows.filter(row=>row.reviewed&&row.reference_sha256&&row.reference_purpose==='reconstruction');
  const isolated=[...inventories.values()].flatMap(inventory=>inventory.components
    .filter(item=>item.reference_sha256&&item.reference_purpose==='reconstruction')
    .map(item=>({avatar_id:inventory.avatar_id,id:item.id,sha256:item.reference_sha256})));
  const evidence={checked_at:new Date().toISOString(),source:'authenticated live backoffice API',
    declared_components:rows.length,declared_references_uploaded:uploaded.length,
    declared_missing:rows.length-uploaded.length,total_isolated_references:isolated.length,
    scope:'Reviewed PNG references only; no 3D qualification or publication',rows,isolated};
  await writeFile(root+'equipment-reference-coverage.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({...evidence,rows:undefined,isolated:undefined}));
} finally {await session.close();}
