import {readFile} from 'node:fs/promises';
import {V3_PREVIEW_KEYS} from '../src/v3Combat.ts';
const progress=JSON.parse(await readFile(new URL('../../docs/avatar-rework/progress.json',import.meta.url),'utf8'));
const allowed=new Set(['implemented','partial','blocked','not started']);
if(progress.heroes.length!==45||new Set(progress.heroes.map(h=>h.key)).size!==45)throw Error('Invalid V3 progress inventory');
for(const h of progress.heroes)if(Object.values(h.stages).some(s=>!allowed.has(s)))throw Error('Invalid V3 stage status');
const missingHandlers=progress.heroes.filter(h=>!V3_PREVIEW_KEYS[h.key]).map(h=>h.canonicalId);
const unqualified=progress.heroes.filter(h=>!h.qualified||Object.values(h.stages).some(s=>s!=='implemented')||(h.productionArt!=='implemented'&&!h.placeholderLabel)).map(h=>h.canonicalId);
const ready=progress.identityManifestSupplied&&missingHandlers.length===0&&unqualified.length===0;
console.log(JSON.stringify({ready,registeredPrototypeKits:Object.keys(V3_PREVIEW_KEYS).length,missingHandlers,unqualified,
  reason:ready?'All recorded release requirements satisfied':'V3 is a preview; incomplete gameplay and unqualified counterplay cannot pass release'},null,2));
if(!ready)process.exitCode=1;
