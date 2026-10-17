// Public CC0 data only. No downloaded executable code is evaluated.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve('..'),destination=path.join(root,'.local-tools/character-sources');
const manifest=JSON.parse(await readFile(path.join(root,'art/character-sources.json'),'utf8'));
for(const file of manifest.files){
 const target=path.resolve(destination,file.local);
 if(!target.startsWith(destination+path.sep)||!/^[a-f0-9]{40}$/.test(file.commit))throw Error('Invalid source manifest');
 let bytes;try{bytes=await readFile(target);}catch{}
 const valid=value=>value?.length===file.bytes&&createHash('sha256').update(value).digest('hex')===file.sha256;
 if(valid(bytes))continue;
 const url=`https://raw.githubusercontent.com/${file.repo}/${file.commit}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
 const response=await fetch(url);if(!response.ok)throw Error(`Download failed: ${response.status} ${file.local}`);
 bytes=Buffer.from(await response.arrayBuffer());if(!valid(bytes))throw Error('Source hash mismatch: '+file.local);
 await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);
}
console.log(`Verified ${manifest.files.length} pinned CC0 source files.`);
