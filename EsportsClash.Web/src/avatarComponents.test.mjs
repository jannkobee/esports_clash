import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAvatarComponents} from './avatarComponents.ts';
const sample=()=>({schema:1,avatar_id:'c_invoker',version:1,hash:'a'.repeat(64),categories:{base:'Base body',outfit:'Clothing / armor'},components:[{id:'outfit',label:'Cape',category:'outfit',binding:'skinned',status:'reference_uploaded',reference_sha256:'b'.repeat(64),model_sha256:null}]});
test('accepts API inventory without treating uploaded references as models',()=>{const input=sample();const data=validateAvatarComponents(input,'c_invoker');assert.deepEqual(data,input);assert.notEqual(data,input);assert.equal(data.components[0].model_sha256,null);});
test('rejects wrong avatar, duplicate components and inconsistent completion claims',()=>{
  assert.equal(validateAvatarComponents(sample(),'c_astra'),undefined);
  const duplicate=sample();duplicate.components.push({...duplicate.components[0]});assert.equal(validateAvatarComponents(duplicate,'c_invoker'),undefined);
  for(const status of ['ready','published','model_unqualified','missing']){const input=sample();input.components[0].status=status;assert.equal(validateAvatarComponents(input,'c_invoker'),undefined);}
});
