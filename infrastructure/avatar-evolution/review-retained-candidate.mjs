// Isolated actual-renderer evidence; no API preparation, admission or publication.
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {inspect} from './browser.mjs';
const [parent,avatarId]=process.argv.slice(2);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const preparation=JSON.parse(await readFile(join(parent,'preparation.json'),'utf8'));
const plan=JSON.parse(await readFile(join(parent,'preparation-plan.json'),'utf8'));
const bytes=await readFile(join(parent,'candidate-01.glb'));
if(sha(bytes)!==preparation.sha256||plan.avatar_id!==avatarId)throw Error('Candidate identity mismatch');
const folder=join(dirname(parent),randomUUID());await mkdir(folder);
for(const name of ['candidate-01.glb','preparation-plan.json','preparation.json'])await copyFile(join(parent,name),join(folder,name));
const assets='/workspace/EsportsClash.Web/avatar-review-dist/assets';
const viewer={};
for(const name of (await readdir(assets)).sort())viewer[name]=sha(await readFile(join(assets,name)));
const lineage={parent,folder,avatar_id:avatarId,candidate_sha256:sha(bytes),viewer,
 browser_sha256:sha(await readFile(new URL('./browser.mjs',import.meta.url))),publication_eligible:false};
await writeFile(join(parent,'motion-review-fixture.json'),JSON.stringify(lineage,null,2),{flag:'wx'});
await writeFile(join(folder,'lineage.json'),JSON.stringify(lineage,null,2),{flag:'wx'});
const result=await inspect(folder,avatarId,'candidate-01',{motionReview:true});
await writeFile(join(folder,'browser-review.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({folder,passed:result.passed,gameplay:result.gameplay?.passed,views:result.previews?.length}));
