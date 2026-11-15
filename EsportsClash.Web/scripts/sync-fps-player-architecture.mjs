import {readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const source=new URL('../src/fps/fps-player-architecture-v4.json',import.meta.url);
const packaged=new URL('../../EsportsClash.Api/resources/fps-player-architecture-v4.json',import.meta.url);
const bytes=await readFile(source);
const catalog=JSON.parse(bytes);
if(catalog.version!==4||catalog.profiles.length!==18)throw Error('Invalid canonical FPS player catalog');
try {await access(new URL('../../EsportsClash.Api/resources/',import.meta.url));}
catch {console.log('Frontend-only package: using the bundled FPS architecture catalog.');process.exit(0);}
if(process.argv.includes('--check')){
 const mirror=await readFile(packaged);
 if(!bytes.equals(mirror))throw Error('API FPS architecture catalog is out of sync with '+fileURLToPath(source));
 console.log('FPS architecture packages match.');
}else {await writeFile(packaged,bytes);console.log('Updated the API FPS architecture package.');}
