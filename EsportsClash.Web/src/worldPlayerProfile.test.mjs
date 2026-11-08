import test from 'node:test';
import assert from 'node:assert/strict';
import {applyWorldPlayerProfile} from './worldPlayerProfile.ts';

const template = {id:'legacy-role-template',name:'Legacy alias',realName:'internal reference',tier:'GOAT',ovr:99,
  stats:{lan:99,tf:99,iq:99,ldr:99,clu:99,sta:99,flx:99},role:'Mage',playableRoles:['Mage','Support'],
  badges:['Legacy trophy'],signatureChampions:['Legacy signature'],level:40,morale:100,fatigue:0};
const profile = {name:'Vaerix',tier:'Bronze',stats:{lan:24,tf:25,iq:28,ldr:21,clu:19,sta:31,flx:26},ovr:25,
  age:19,wage:25,potentialOvr:74,avatarSvg:'world-id',nationality:{id:1,code:'PH',name:'Philippines'}};

test('world players enter the Arena with their own weak skills and country',()=>{
  const p=applyWorldPlayerProfile(template,profile);
  assert.equal(p.name,'Vaerix');assert.deepEqual(p.stats,profile.stats);assert.equal(p.ovr,25);assert.equal(p.tier,'Bronze');assert.equal(p.level,1);
  assert.equal(p.nationality.code,'PH');assert.equal(p.id,template.id);assert.deepEqual(p.playableRoles,template.playableRoles);
  assert.equal(template.stats.lan,99);assert.equal(template.name,'Legacy alias');
});
test('allocated profiles cannot override catalog IDs, roles or internal aliases',()=>{
  const p=applyWorldPlayerProfile(template,{...profile,id:'forged',role:'Assassin',realName:'forged'});
  assert.equal(p.id,template.id);assert.equal(p.role,'Mage');assert.equal(p.realName,template.realName);
});
test('missing nationality and illegal skills are rejected',()=>{
  assert.throws(()=>applyWorldPlayerProfile(template,{...profile,nationality:null}));
  assert.throws(()=>applyWorldPlayerProfile(template,{...profile,stats:{...profile.stats,iq:999}}));
  assert.throws(()=>applyWorldPlayerProfile(template,{...profile,stats:{...profile.stats,iq:NaN}}));
});
test('legacy allocations retain their old players and explicitly allocated names',()=>{
  assert.equal(applyWorldPlayerProfile(template),template);
  assert.equal(applyWorldPlayerProfile(template,undefined,'Historical allocated alias').name,'Historical allocated alias');
});
