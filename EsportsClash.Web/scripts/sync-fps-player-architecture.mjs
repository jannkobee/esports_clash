import {readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const pairs=[
  ['../src/fps/fps-player-architecture-v4.json','../../EsportsClash.Api/resources/fps-player-architecture-v4.json'],
  ['../src/fps/fps-player-tendencies-v4.json','../../EsportsClash.Api/resources/fps-player-tendencies-v4.json'],
  ['../src/fps/fps-tendency-formulas-v4.json','../../EsportsClash.Api/resources/fps-tendency-formulas-v4.json'],
];
const loaded=await Promise.all(pairs.map(async([src,dst])=>({src:new URL(src,import.meta.url),dst:new URL(dst,import.meta.url),bytes:await readFile(new URL(src,import.meta.url))})));
const catalog=JSON.parse(loaded[0].bytes);
if(catalog.version!==4||catalog.profiles.length!==18)throw Error('Invalid canonical FPS player catalog');
const tendencies=JSON.parse(loaded[1].bytes);
if(tendencies.version!==4||tendencies.iglCategories.length!==4||tendencies.individualCategories.length!==14)throw Error('Invalid canonical FPS player tendencies catalog');
const formulaTable=JSON.parse(loaded[2].bytes);
if(formulaTable.version!==1||!formulaTable.formulas||!Array.isArray(formulaTable.diagnosticKeys))throw Error('Invalid canonical FPS tendency formula table');
try {await access(new URL('../../EsportsClash.Api/resources/',import.meta.url));}
catch {console.log('Frontend-only package: using the bundled FPS architecture catalog.');process.exit(0);}
if(process.argv.includes('--check')){
 for(const {src,dst,bytes} of loaded){
  const mirror=await readFile(dst);
  if(!bytes.equals(mirror))throw Error('API FPS architecture catalog is out of sync with '+fileURLToPath(src));
 }
 console.log('FPS architecture packages match.');
}else {
 for(const {dst,bytes} of loaded)await writeFile(dst,bytes);
 console.log('Updated the API FPS architecture packages.');
}
