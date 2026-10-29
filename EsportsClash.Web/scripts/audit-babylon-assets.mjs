import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {heroes}=JSON.parse(await readFile('src/data/heroIdentityV3.json','utf8'));
assert.equal(heroes.length,45);assert.equal(new Set(heroes.map(h=>h.key)).size,45);
const avatars=[];
for(const hero of heroes){
  const path=`public/models/avatars-v9/${hero.key}.glb`,buffer=await readFile(path);
  assert.equal(buffer.toString('utf8',0,4),'glTF');assert.equal(buffer.readUInt32LE(4),2);assert.equal(buffer.readUInt32LE(8),buffer.length);
  const gltf=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
  const clips=(gltf.animations??[]).map(a=>a.name.toLowerCase());
  const missing=['idle','walk','run','attack','cast','hit','death'].filter(c=>!clips.includes(c));
  avatars.push({id:hero.key,canonicalId:hero.canonicalId,path,sha256:createHash('sha256').update(buffer).digest('hex'),bytes:buffer.length,
    meshes:gltf.meshes?.length??0,skeletons:gltf.skins?.length??0,clips,missing,qualification:'legacy-art-structural-inventory-only'});
  assert.equal(missing.length,0,hero.key+' missing clips');assert.ok(gltf.skins?.length>0,hero.key+' missing skeleton');
}
await writeFile('../docs/babylon-migration/asset-inventory.json',JSON.stringify({date:'2026-10-24',avatars,scope:'File availability/header/clip inventory; not glTF schema, rest-pose, skinning, sockets or V3 art qualification'},null,2));
console.log(`${avatars.length} stable IDs have bundled GLBs, skeletons, and required clip names.`);
