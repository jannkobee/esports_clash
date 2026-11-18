// Append-only promotion registry for approved learning bundles.
//
// `registry.json` holds an ordered list of events (promote, rollback, pause, resume). The active
// bundle is the fold of those events (registryState in model.mjs, mirrored by the API controller).
// Events are only ever appended; bundle files are content-addressed and never removed, so every
// promoted version stays available for rollback and league evaluation.
//
// Owner controls (run from the repository root):
//   node infrastructure/automatic-learning/registry.mjs status
//   node infrastructure/automatic-learning/registry.mjs pause "<reason>"      # stop automatic promotion
//   node infrastructure/automatic-learning/registry.mjs resume "<reason>"
//   node infrastructure/automatic-learning/registry.mjs rollback <sha256|baseline> "<reason>"
import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {atomic} from './store.mjs';
import {registryState,sha,validateBundle} from './model.mjs';

export const registryPath=directory=>directory+'/registry.json';
export function readRegistry(directory){
  return existsSync(registryPath(directory))?JSON.parse(readFileSync(registryPath(directory),'utf8')):{version:1,events:[]};
}
/** Append one event; refuses anything that would rewrite history or produce an invalid state. */
export function appendRegistryEvent(directory,event){
  mkdirSync(directory,{recursive:true});
  const registry=readRegistry(directory);
  const next={version:1,events:[...registry.events,{...event,at:event.at??new Date().toISOString()}]};
  registryState(next);
  atomic(registryPath(directory),next);
  return registryState(next);
}
/** Store the exact bundle bytes under their hash (write-once) and append a promotion. */
export function promoteBundle(directory,bundle,detail={}){
  validateBundle(bundle);
  const bytes=JSON.stringify(bundle)+'\n',digest=sha(bytes),file=directory+'/'+digest+'.json';
  mkdirSync(directory,{recursive:true});
  if(!existsSync(file))atomic(file,bytes);
  else if(sha(readFileSync(file))!==digest)throw Error('Promoted bundle checksum mismatch');
  appendRegistryEvent(directory,{action:'promote',bundle:digest+'.json',sha256:digest,...detail});
  return digest;
}
export function promotedBundle(directory,digest){
  const bytes=readFileSync(directory+'/'+digest+'.json');
  if(sha(bytes)!==digest)throw Error('Promoted bundle checksum mismatch');
  return validateBundle(JSON.parse(bytes));
}
/** Previously promoted versions, most recent first (league opponents). */
export function promotionHistory(directory){
  return readRegistry(directory).events.filter(e=>e.action==='promote').reverse();
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const directory=(process.env.LEARNING_DATA??root+'EsportsClash.Api/storage/app/automatic-learning')+'/models';
  const [command,arg,reason]=process.argv.slice(2);
  if(command==='status'){const s=registryState(readRegistry(directory));console.log(JSON.stringify({...s,events:readRegistry(directory).events.length},null,2));}
  else if(command==='pause'||command==='resume')console.log(JSON.stringify(appendRegistryEvent(directory,{action:command,reason:arg??'owner',by:'owner'})));
  else if(command==='rollback'){
    if(arg==='baseline')console.log(JSON.stringify(appendRegistryEvent(directory,{action:'rollback',bundle:null,sha256:null,reason:reason??'owner',by:'owner'})));
    else console.log(JSON.stringify(appendRegistryEvent(directory,{action:'rollback',bundle:arg+'.json',sha256:arg,reason:reason??'owner',by:'owner'})));
  }else{console.error('usage: registry.mjs status|pause <reason>|resume <reason>|rollback <sha256|baseline> <reason>');process.exitCode=2;}
}
