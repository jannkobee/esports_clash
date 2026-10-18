import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { CHAMPIONS } from '../../EsportsClash.Web/src/mockData.ts';
import { AVATAR_DESIGNS } from '../../EsportsClash.Web/src/avatarDesigns.ts';
import { AVATAR_ANIMATION_MOTIFS } from '../../EsportsClash.Web/src/avatarSkillAnimation.ts';
import { sha } from './glb.mjs';
const avatars=[];
for(const kit of CHAMPIONS){
  const variant=kit.id==='c_invoker'?'claude':'current';
  const file=variant==='claude'?'imports/arsenaldo-claude.glb':`avatars-v9/${kit.id}.glb`;
  const bytes=await readFile(`EsportsClash.Web/public/models/${file}`);
  avatars.push({id:kit.id,name:kit.displayName,internal_name:kit.name,role:kit.primaryRole,design:AVATAR_DESIGNS[kit.id],
    motif:AVATAR_ANIMATION_MOTIFS[kit.name],variant,file,sha256:sha(bytes),bytes:bytes.length,
    abilities:['skill1','skill2','ultimate'].map(slot=>({slot,name:kit[slot].name,description:kit[slot].description}))});
}
await mkdir('EsportsClash.Api/resources/avatars',{recursive:true});
await writeFile('EsportsClash.Api/resources/avatars/catalog.json',JSON.stringify({version:1,avatars},null,2)+'\n');
console.log(JSON.stringify({avatars:avatars.length,source:'Actual shipped v9 assets and the selected Arsenaldo import'}));
