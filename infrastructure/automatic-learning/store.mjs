import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync,renameSync,readFileSync,unlinkSync,existsSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {baseline,validateBundle,upgradeTrainingBundle,migrateBundle,applySample,sha} from './model.mjs';
export function atomic(path,value){
  const bytes=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';
  writeFileSync(path+'.tmp',bytes);
  // Windows FlushFileBuffers needs a writable handle. Keep the durability
  // barrier before rename, and close the descriptor even if the flush fails.
  const fd=openSync(path+'.tmp','r+');
  try{fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(path+'.tmp',path);
}
/** Training lineages: two worker teams that co-evolve. `worker:main` keeps the legacy single model. */
export const TRAINING_LINEAGES=['worker:main','worker:rival'];
/** Training lineages plus club lineages that learn from submitted real matches. */
export const validLineage=lineage=>TRAINING_LINEAGES.includes(lineage)||/^(club:|worker:official-club-)[0-9]{1,18}$/.test(lineage);
export const modelKey=lineage=>!lineage||lineage==='worker:main'?'model':'model:'+lineage;
export class Store{
  constructor(directory){
    this.directory=directory;mkdirSync(directory,{recursive:true});
    for(const name of ['archives','reports','candidates','exports','versions'])mkdirSync(directory+'/'+name,{recursive:true});
    this.db=new DatabaseSync(directory+'/learning.sqlite');
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,hour TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,digest TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS archives(hour TEXT PRIMARY KEY,manifest TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,body TEXT NOT NULL,result TEXT);
      CREATE TABLE IF NOT EXISTS quarantine(id TEXT PRIMARY KEY,at TEXT NOT NULL,reason TEXT NOT NULL,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS model_versions(seq INTEGER PRIMARY KEY AUTOINCREMENT,lineage TEXT NOT NULL,sha TEXT NOT NULL,parent TEXT,reason TEXT NOT NULL,at TEXT NOT NULL,detail TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS model_versions_no_update BEFORE UPDATE ON model_versions BEGIN SELECT RAISE(ABORT,'model_versions is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS model_versions_no_delete BEFORE DELETE ON model_versions BEGIN SELECT RAISE(ABORT,'model_versions is append-only'); END;`);
    // A rejected bundle must not leak the SQLite handle (Windows keeps the file locked).
    try{this.initialize();}catch(error){try{this.db.close();}catch{}throw error;}
  }
  /**
   * Never resets learned state. An incompatible checkpoint is archived exactly (immutable version
   * row + content-addressed file), then explicitly migrated: learners that still validate are kept,
   * the others fork from their priors with the archive as parent.
   */
  upgradeOrMigrate(value,lineage,label){
    try{return upgradeTrainingBundle(value);}
    catch(error){
      const parent=this.recordVersion(value,lineage,'archived-before-migration',{label,error:String(error?.message??error)});
      const {bundle,forked}=migrateBundle(value);
      this.recordVersion(bundle,lineage,'migrated',{label,forked},parent);
      return bundle;
    }
  }
  initialize(){
    const current=this.get('model');
    if(!current){const model=baseline();this.set('model',model);this.recordVersion(model,'worker:main','baseline');}
    else this.set('model',this.upgradeOrMigrate(current,'worker:main','model'));
    for(const lineage of TRAINING_LINEAGES.slice(1)){
      const key=modelKey(lineage),own=this.get(key);
      if(own)this.set(key,this.upgradeOrMigrate(own,lineage,'model'));
      else{
        // A new lineage forks from the main lineage's learned state (never from scratch).
        const parent=this.snapshotModel('fork-source','worker:main');
        const forked=structuredClone(this.get('model'));this.set(key,forked);this.recordVersion(forked,lineage,'forked',{from:'worker:main'},parent);
      }
    }
    const cycle=this.get('cycle');
    if(cycle?.model&&cycle?.incumbent){
      cycle.model=this.upgradeOrMigrate(cycle.model,'worker:main','cycle-candidate');cycle.incumbent=this.upgradeOrMigrate(cycle.incumbent,'worker:main','cycle-incumbent');this.set('cycle',cycle);
    }
    const activeJob=this.get('activeJob');
    if(activeJob?.blue&&activeJob?.red){
      activeJob.blue=this.upgradeOrMigrate(activeJob.blue,'worker:main','job-blue');activeJob.red=this.upgradeOrMigrate(activeJob.red,'worker:main','job-red');this.set('activeJob',activeJob);
    }
    validateBundle(this.get('model'));
  }
  /** Append an immutable model version; the payload is stored once by content hash. Returns its sha. */
  recordVersion(value,lineage,reason,detail={},parent=null){
    const bytes=JSON.stringify(value),digest=sha(bytes),path=this.directory+'/versions/'+digest+'.json';
    if(!existsSync(path))atomic(path,bytes);
    else if(sha(readFileSync(path))!==digest)throw Error('Version file checksum mismatch');
    this.db.prepare('INSERT INTO model_versions(lineage,sha,parent,reason,at,detail) VALUES (?,?,?,?,?,?)')
      .run(lineage,digest,parent,reason,new Date().toISOString(),JSON.stringify(detail));
    return digest;
  }
  versions(lineage){return this.db.prepare('SELECT * FROM model_versions WHERE lineage=? ORDER BY seq').all(lineage).map(r=>({...r,detail:JSON.parse(r.detail)}));}
  versionPayload(digest){
    if(!/^[a-f0-9]{64}$/.test(digest))throw Error('Invalid version hash');
    const bytes=readFileSync(this.directory+'/versions/'+digest+'.json');
    if(sha(bytes)!==digest)throw Error('Version file checksum mismatch');
    return JSON.parse(bytes);
  }
  /** Snapshot the working model when it changed since the last recorded version. */
  snapshotModel(reason,lineage='worker:main'){
    const model=this.get(modelKey(lineage));if(!model)return null;
    const digest=sha(JSON.stringify(model)),last=this.db.prepare('SELECT sha FROM model_versions WHERE lineage=? ORDER BY seq DESC LIMIT 1').get(lineage);
    if(last?.sha===digest)return digest;
    return this.recordVersion(model,lineage,reason,{},last?.sha??null);
  }
  get(key){const row=this.db.prepare('SELECT value FROM state WHERE key=?').get(key);return row?JSON.parse(row.value):null;}
  set(key,value){this.db.prepare('INSERT OR REPLACE INTO state VALUES (?,?)').run(key,JSON.stringify(value));}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  append(record,learn=false,now=new Date()){return this.transaction(()=>this.appendInTransaction(record,learn,now));}
  /**
   * Worker ingestion: a record whose learning cannot be applied is kept in `quarantine` (and reported)
   * instead of stopping training; ledger conflicts and envelope errors still throw.
   */
  appendOrQuarantine(record,learn=false,now=new Date()){
    try{return this.append(record,learn,now);}
    catch(error){
      const reason=String(error?.message??error);
      if(/Conflicting duplicate|Invalid experience envelope|finalized hour/.test(reason))throw error;
      this.db.prepare('INSERT OR IGNORE INTO quarantine VALUES (?,?,?,?)').run(String(record?.id),now.toISOString(),reason,JSON.stringify(record));
      return false;
    }
  }
  quarantined(){return this.db.prepare('SELECT id,at,reason FROM quarantine ORDER BY at').all();}
  /** Append inside the caller's transaction (a batch of records commits or rolls back together). */
  appendInTransaction(record,learn=false,now=new Date()){
    if(!record||typeof record.id!=='string'||record.id.length>128||!['navigation','combat','movement','utility','playbook','start','round','result','error'].includes(record.kind)
      ||(record.lineage!==undefined&&!validLineage(record.lineage)))throw Error('Invalid experience envelope');
    const body=JSON.stringify(record),digest=sha(body),hour=now.toISOString().slice(0,13);
    const previous=this.db.prepare('SELECT digest FROM ledger WHERE id=?').get(record.id);
    if(previous){if(previous.digest!==digest)throw Error('Conflicting duplicate record');return false;}
    if(learn&&['navigation','combat','movement','utility','playbook'].includes(record.kind)){
      const key=modelKey(record.lineage);let bundle=this.get(key);
      if(!bundle){
        // A club lineage first seen through real matches forks from the main lineage's learned state.
        const parent=this.snapshotModel('fork-source','worker:main');
        bundle=structuredClone(this.get('model'));this.recordVersion(bundle,record.lineage,'forked',{from:'worker:main'},parent);
      }
      applySample(bundle,record);this.set(key,bundle);
    }
    if(this.db.prepare('SELECT hour FROM archives WHERE hour=?').get(hour))throw Error('Cannot append to a finalized hour');
    this.db.prepare('INSERT INTO ledger VALUES (?,?)').run(record.id,digest);
    this.db.prepare('INSERT INTO records VALUES (?,?,?,?)').run(record.id,hour,record.kind,body);
    return true;
  }
  job(job){this.db.prepare('INSERT OR IGNORE INTO jobs(id,body) VALUES (?,?)').run(job.id,JSON.stringify(job));}
  finish(id,result){this.db.prepare('UPDATE jobs SET result=? WHERE id=? AND result IS NULL').run(JSON.stringify(result),id);}
  result(id){const row=this.db.prepare('SELECT result FROM jobs WHERE id=?').get(id);return row?.result?JSON.parse(row.result):null;}
  async archive(now=new Date(),retentionDays=30){
    const current=now.toISOString().slice(0,13);
    const hours=this.db.prepare('SELECT DISTINCT hour FROM records WHERE hour<? ORDER BY hour').all(current);
    for(const {hour} of hours){
      if(this.db.prepare('SELECT hour FROM archives WHERE hour=?').get(hour))continue;
      const path=this.directory+'/archives/'+hour+'.jsonl.gz';
      const db=this.db;
      function* lines(){for(const row of db.prepare('SELECT body FROM records WHERE hour=? ORDER BY rowid').iterate(hour))yield row.body+'\n';}
      await pipeline(Readable.from(lines()),createGzip(),createWriteStream(path+'.tmp'));
      renameSync(path+'.tmp',path);
      const results=this.db.prepare("SELECT body FROM records WHERE hour=? AND kind='result'").all(hour).map(r=>JSON.parse(r.body).payload);
      const rounds=this.db.prepare("SELECT COUNT(*) AS n FROM records WHERE hour=? AND kind='round'").get(hour).n;
      const learningSamples={};
      for(const kind of ['navigation','combat','movement']){
        learningSamples[kind]=0;
        for(const row of this.db.prepare('SELECT body FROM records WHERE hour=? AND kind=?').all(hour,kind)){
          learningSamples[kind]+=JSON.parse(row.body).payload.samples?.length??0;
        }
      }
      // Utility experience is a per-round brain delta; its samples are the throws it scored.
      const utility={throws:0,successes:0};
      for(const row of this.db.prepare("SELECT body FROM records WHERE hour=? AND kind='utility'").all(hour)){
        const payload=JSON.parse(row.body).payload;utility.throws+=payload.throws??0;utility.successes+=payload.successes??0;
      }
      learningSamples.utility=utility.throws;
      const movementActions={};
      for(const row of this.db.prepare("SELECT body FROM records WHERE hour=? AND kind='movement'").all(hour)){
        for(const sample of JSON.parse(row.body).payload.samples??[])movementActions[sample.action]=(movementActions[sample.action]??0)+1;
      }
      const manifest={version:1,hour,sha256:sha(readFileSync(path)),records:this.db.prepare('SELECT COUNT(*) AS n FROM records WHERE hour=?').get(hour).n,
        available:true,rounds,completed:results.filter(r=>r.status==='completed').length,aborted:results.filter(r=>r.status!=='completed').length,
        wins:{blue:results.filter(r=>r.winner==='blue').length,red:results.filter(r=>r.winner==='red').length},
        metrics:Object.fromEntries(['plants','defuses','friendlyDamage','teamKills','stalledActorSeconds','simulatedSeconds','wallSeconds'].map(k=>[k,results.reduce((n,r)=>n+(r[k]??0),0)])),
        learningSamples,movementActions,utility:{...utility,onTargetRate:utility.throws?utility.successes/utility.throws:null},errors:results.filter(r=>r.failure).map(r=>r.failure)};
      manifest.completionRate=results.length?manifest.completed/results.length:null;
      manifest.simulationSpeed=manifest.metrics.wallSeconds?manifest.metrics.simulatedSeconds/manifest.metrics.wallSeconds:null;
      atomic(this.directory+'/reports/'+hour+'.json',manifest);
      this.db.prepare('INSERT INTO archives VALUES (?,?)').run(hour,JSON.stringify(manifest));
      // Data survives in the compressed file; keep only permanent dedup digests in SQLite.
      this.db.prepare('DELETE FROM records WHERE hour=?').run(hour);
    }
    for(const row of this.db.prepare('SELECT * FROM archives').all()){
      const manifest=JSON.parse(row.manifest);
      if(manifest.available&&Date.parse(row.hour+':00:00Z')<now.getTime()-retentionDays*86400000){
        const path=this.directory+'/archives/'+row.hour+'.jsonl.gz';if(existsSync(path))unlinkSync(path);
        manifest.available=false;manifest.deletedAt=now.toISOString();manifest.reason='retention';
        this.db.prepare('UPDATE archives SET manifest=? WHERE hour=?').run(JSON.stringify(manifest),row.hour);
        atomic(this.directory+'/reports/'+row.hour+'.json',manifest);
      }
    }
    for(const lineage of TRAINING_LINEAGES)this.snapshotModel('hourly',lineage);
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }
  close(){this.db.close();}
}
