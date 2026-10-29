import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preparationRequest} from './preparation-server.mjs';

const id='11111111-2222-4333-8444-555555555555';
test('local preparation admission, validation and restart cannot mutate or launch an asset job',async()=>{
  const root=await mkdtemp(join(tmpdir(),'colab-prep-guard-'));
  try{
    for(const suffix of ['', '/validate','/resume','/reset']){
      let result;
      const ctx={root,children:new Map(),uuid:/^[a-f0-9-]{36}$/,catalog:{avatars:[]},
        reply:(_,code,value)=>{result={code,value};},json:()=>{throw Error('Blocked local admission must not read a plan');}};
      assert.equal(await preparationRequest('/preparations/'+id+suffix,{method:'POST'},{},ctx),true);
      assert.equal(result.code,409);
      assert.equal(result.value.stage,'waiting_for_colab');
      assert.equal(result.value.publication_eligible,false);
      assert.deepEqual(await readdir(root),[]);
      assert.equal(ctx.children.size,0);
    }
  }finally{await rm(root,{recursive:true,force:true});}
});

test('cloud-only enforcement preserves cancellation of a historical local attempt',async()=>{
  const root=await mkdtemp(join(tmpdir(),'colab-prep-cancel-'));
  try{
    let result;
    const ctx={root,children:new Map(),uuid:/^[a-f0-9-]{36}$/,
      reply:(_,code,value)=>{result={code,value};},
      atomic:async(path,value)=>writeFile(path,JSON.stringify(value))};
    assert.equal(await preparationRequest('/preparations/'+id+'/cancel',{method:'POST'},{},ctx),true);
    assert.equal(result.code,200);
    assert.equal(result.value.status,'cancelled');
    assert.equal(JSON.parse(await readFile(join(root,id,'state.json'),'utf8')).status,'cancelled');
  }finally{await rm(root,{recursive:true,force:true});}
});
