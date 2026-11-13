import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync,renameSync,readFileSync,unlinkSync,existsSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {createWriteStream} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {baseline,validateBundle,upgradeTrainingBundle,applySample,sha} from './model.mjs';
export function atomic(path,value){
  const bytes=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';
  writeFileSync(path+'.tmp',bytes);const fd=openSync(path+'.tmp','r');fsyncSync(fd);closeSync(fd);renameSync(path+'.tmp',path);
}
export class Store{
  constructor(directory){
    this.directory=directory;mkdirSync(directory,{recursive:true});
    for(const name of ['archives','reports','candidates','exports'])mkdirSync(directory+'/'+name,{recursive:true});
    this.db=new DatabaseSync(directory+'/learning.sqlite');
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,hour TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,digest TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS archives(hour TEXT PRIMARY KEY,manifest TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,body TEXT NOT NULL,result TEXT);`);
    const current=this.get('model');
    if(!current)this.set('model',baseline());
    else this.set('model',upgradeTrainingBundle(current));
    for(const key of ['cycle']){
      const cycle=this.get(key);
      if(cycle?.model&&cycle?.incumbent){
        cycle.model=upgradeTrainingBundle(cycle.model);cycle.incumbent=upgradeTrainingBundle(cycle.incumbent);this.set(key,cycle);
      }
    }
    const activeJob=this.get('activeJob');
    if(activeJob?.blue&&activeJob?.red){
      activeJob.blue=upgradeTrainingBundle(activeJob.blue);activeJob.red=upgradeTrainingBundle(activeJob.red);this.set('activeJob',activeJob);
    }
    validateBundle(this.get('model'));
  }
  get(key){const row=this.db.prepare('SELECT value FROM state WHERE key=?').get(key);return row?JSON.parse(row.value):null;}
  set(key,value){this.db.prepare('INSERT OR REPLACE INTO state VALUES (?,?)').run(key,JSON.stringify(value));}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  append(record,learn=false,now=new Date()){
    if(!record||typeof record.id!=='string'||record.id.length>128||!['navigation','combat','movement','start','round','result','error'].includes(record.kind))throw Error('Invalid experience envelope');
    const body=JSON.stringify(record),digest=sha(body),hour=now.toISOString().slice(0,13);
    return this.transaction(()=>{
      const previous=this.db.prepare('SELECT digest FROM ledger WHERE id=?').get(record.id);
      if(previous){if(previous.digest!==digest)throw Error('Conflicting duplicate record');return false;}
      if(learn&&['navigation','combat','movement'].includes(record.kind)){const bundle=this.get('model');applySample(bundle,record);this.set('model',bundle);}
      if(this.db.prepare('SELECT hour FROM archives WHERE hour=?').get(hour))throw Error('Cannot append to a finalized hour');
      this.db.prepare('INSERT INTO ledger VALUES (?,?)').run(record.id,digest);
      this.db.prepare('INSERT INTO records VALUES (?,?,?,?)').run(record.id,hour,record.kind,body);
      return true;
    });
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
      const movementActions={};
      for(const row of this.db.prepare("SELECT body FROM records WHERE hour=? AND kind='movement'").all(hour)){
        for(const sample of JSON.parse(row.body).payload.samples??[])movementActions[sample.action]=(movementActions[sample.action]??0)+1;
      }
      const manifest={version:1,hour,sha256:sha(readFileSync(path)),records:this.db.prepare('SELECT COUNT(*) AS n FROM records WHERE hour=?').get(hour).n,
        available:true,rounds,completed:results.filter(r=>r.status==='completed').length,aborted:results.filter(r=>r.status!=='completed').length,
        wins:{blue:results.filter(r=>r.winner==='blue').length,red:results.filter(r=>r.winner==='red').length},
        metrics:Object.fromEntries(['plants','defuses','friendlyDamage','teamKills','stalledActorSeconds','simulatedSeconds','wallSeconds'].map(k=>[k,results.reduce((n,r)=>n+(r[k]??0),0)])),
        learningSamples,movementActions,errors:results.filter(r=>r.failure).map(r=>r.failure)};
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
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }
  close(){this.db.close();}
}
