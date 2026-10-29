import {readFile, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {backofficeSession} from './backoffice-session.mjs';
const progress = JSON.parse(await readFile('docs/pipeline-audit-20261024/upload-progress.json', 'utf8'));
const session = await backofficeSession();
const rows = [];
try {
  for (const row of progress.rows) {
    const inventory = await session.evaluate(`fetch('/api/v1/avatars/${row.avatar_id}/components',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Inventory read failed');return r.json()})`);
    for (const receipt of [row.base_reference, row.appearance_design, ...row.isolated_equipment].filter(Boolean)) {
      const item = inventory.components.find(component => component.id === receipt.id);
      assert.equal(item?.reference_sha256, receipt.sha256, `${row.avatar_id}/${receipt.id} no longer matches reviewed upload`);
    }
    rows.push({avatar_id: row.avatar_id, inventory_hash: inventory.hash, version: inventory.version, base: !!row.base_reference, design: !!row.appearance_design, isolated_equipment: row.isolated_equipment.length});
  }
  const evidence = {checked_at: new Date().toISOString(), source: 'authenticated live backoffice API', avatars: rows.length, base_references: rows.filter(row=>row.base).length, appearance_designs: rows.filter(row=>row.design).length, isolated_equipment: rows.reduce((total,row)=>total+row.isolated_equipment,0), qualification: 'References only; no model qualification asserted', rows};
  await writeFile('docs/pipeline-audit-20261024/live-reference-coverage.json', JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({...evidence, rows: undefined}));
} finally { await session.close(); }
