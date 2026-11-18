/**
 * Browser cache for locally learned FPS models. The server lineage is the source of truth; this is a
 * cache and a local experiment space, so it must never silently lose what it holds.
 *
 * - IndexedDB backs the cache (no ~5 MB localStorage quota, no per-key size limits). The cache keeps a
 *   synchronous in-memory view so the simulation's synchronous learners can read and write it; writes
 *   go through to IndexedDB in the background. Existing localStorage values are copied in once and
 *   left in place (never deleted).
 * - Unreadable or incompatible stored values are quarantined under a dated key before anything new is
 *   written, never overwritten.
 * - "Reset" starts a new local experiment slot: the previous value is kept under a dated slot key.
 */
export interface FpsLearningStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;keys?():string[]}

const DB_NAME='hexatrick-fps-learning',STORE='kv';
/** Hard sanity bound for one stored value (corrupt data, not a learning limit). */
export const FPS_LEARNING_VALUE_MAX_CHARS=64_000_000;

class IndexedDbLearningStorage implements FpsLearningStorage {
  private readonly memory=new Map<string,string>();
  private db?:Promise<IDBDatabase|undefined>;
  readonly ready:Promise<void>;
  private readonly fallback:Storage|undefined;
  constructor(fallback:Storage|undefined){
    this.fallback=fallback;
    // Synchronous first view from localStorage, so nothing reads an empty cache before hydration.
    try{if(fallback)for(let i=0;i<fallback.length;i++){const key=fallback.key(i);if(key?.startsWith('hexatrick:')){const value=fallback.getItem(key);if(value!==null)this.memory.set(key,value);}}}catch{/* optional */}
    this.ready=this.hydrate();
  }
  private open():Promise<IDBDatabase|undefined>{
    this.db??=new Promise(resolve=>{
      try{
        const request=indexedDB.open(DB_NAME,1);
        request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(undefined);request.onblocked=()=>resolve(undefined);
      }catch{resolve(undefined);}
    });
    return this.db;
  }
  private async hydrate():Promise<void>{
    const db=await this.open();if(!db)return;
    const stored=await new Promise<Map<string,string>>(resolve=>{
      const out=new Map<string,string>();
      try{
        const cursor=db.transaction(STORE,'readonly').objectStore(STORE).openCursor();
        cursor.onsuccess=()=>{const c=cursor.result;if(!c){resolve(out);return;}if(typeof c.value==='string')out.set(String(c.key),c.value);c.continue();};
        cursor.onerror=()=>resolve(out);
      }catch{resolve(out);}
    });
    // IndexedDB is authoritative once it holds a key; localStorage-only keys are copied in.
    for(const [key,value] of this.memory)if(!stored.has(key))void this.persist(key,value);
    for(const [key,value] of stored)this.memory.set(key,value);
  }
  private async persist(key:string,value:string|null):Promise<void>{
    const db=await this.open();if(!db)return;
    await new Promise<void>(resolve=>{
      try{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);if(value===null)store.delete(key);else store.put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();}
      catch{resolve();}
    });
  }
  getItem(key:string){return this.memory.get(key)??null;}
  setItem(key:string,value:string){
    this.memory.set(key,value);void this.persist(key,value);
    try{this.fallback?.setItem(key,value);}catch{/* localStorage quota: IndexedDB still holds it. */}
  }
  removeItem(key:string){this.memory.delete(key);void this.persist(key,null);try{this.fallback?.removeItem(key);}catch{/* optional */}}
  keys(){return [...this.memory.keys()];}
}

let shared:IndexedDbLearningStorage|undefined;
/** The browser's learning cache (IndexedDB when available, else localStorage); undefined outside a browser. */
export function browserFpsLearningStorage():FpsLearningStorage|undefined {
  try{
    if(typeof window==='undefined')return undefined;
    if(typeof indexedDB==='undefined')return window.localStorage;
    shared??=new IndexedDbLearningStorage(window.localStorage);
    return shared;
  }catch{return undefined;}
}
/** Resolves once the IndexedDB cache has loaded (immediately outside a browser). */
export async function hydrateFpsLearningStorage():Promise<void>{browserFpsLearningStorage();await shared?.ready;}

const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
/** Keep an unreadable value under a dated quarantine key; the main key is then free for new learning. */
export function quarantineFpsLearningValue(storage:FpsLearningStorage,key:string,text:string,reason:string):void {
  storage.setItem(`${key}:quarantine:${stamp()}`,JSON.stringify({reason,at:new Date().toISOString(),text}));
}
/** Read a stored model through its validator. Unreadable data is quarantined (kept), never discarded. */
export function readStoredFpsModel<T>(storage:FpsLearningStorage|undefined,key:string,load:(raw:unknown)=>T|undefined):T|undefined {
  if(!storage)return;
  let text:string|null=null;
  try{text=storage.getItem(key);}catch{return;}
  if(!text)return;
  let model:T|undefined,reason='incompatible';
  if(text.length>FPS_LEARNING_VALUE_MAX_CHARS)reason='oversized';
  else try{model=load(JSON.parse(text));}catch{reason='unparseable';}
  if(model)return model;
  try{quarantineFpsLearningValue(storage,key,text,reason);storage.removeItem(key);}catch{/* keep the original if quarantine failed */}
  return;
}
/** Apply one completed round to the stored model (starting from the prior only when nothing is stored). */
export function saveStoredFpsRound<T,R>(storage:FpsLearningStorage|undefined,key:string,load:(raw:unknown)=>T|undefined,create:()=>T,apply:(model:T,round:R)=>void,round:R):T|undefined {
  if(!storage)return;
  try{
    const model=readStoredFpsModel(storage,key,load);
    // readStoredFpsModel quarantined anything unreadable; if quarantine itself failed the key still
    // holds data, and it must not be overwritten.
    if(!model&&storage.getItem(key))return;
    const next=model??create();apply(next,round);storage.setItem(key,JSON.stringify(next));return next;
  }catch{return;}
}
/** "Reset": keep the current local model under a dated slot key and start a fresh local experiment. */
export function startNewFpsLearningSlot(storage:FpsLearningStorage|undefined,key:string):string|undefined {
  if(!storage)return;
  try{
    const text=storage.getItem(key);if(!text)return;
    const slot=`${key}:slot:${stamp()}`;storage.setItem(slot,text);
    if(storage.getItem(slot)===text)storage.removeItem(key);
    return slot;
  }catch{return;}
}
