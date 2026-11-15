import test from 'node:test';
import assert from 'node:assert/strict';
import {applyWorldPlayerProfile} from './worldPlayerProfile.ts';

const template = {id:'legacy-player-template',name:'Legacy alias',realName:'internal reference',tier:'GOAT',ovr:99,
  stats:{rifling:99,entry:99,positioning:99,shotcalling:99,sniping:99,utility:99},level:40,morale:100,fatigue:0};
const profile = {name:'Vaerix',tier:'Bronze',stats:{rifling:24,entry:25,positioning:28,shotcalling:21,sniping:19,utility:31},ovr:25,
  age:19,wage:25,potentialOvr:74,avatarSvg:'world-id',nationality:{id:1,code:'PH',name:'Philippines'}};

test('world players enter the club circuit with their own weak skills and country',()=>{
  const p=applyWorldPlayerProfile(template,profile);
  assert.equal(p.name,'Vaerix');assert.deepEqual(p.stats,profile.stats);assert.equal(p.ovr,25);assert.equal(p.tier,'Bronze');assert.equal(p.level,1);
  assert.equal(p.nationality.code,'PH');assert.equal(p.id,template.id);
  assert.equal(template.stats.rifling,99);assert.equal(template.name,'Legacy alias');
});
test('allocated profiles cannot override catalog IDs or internal aliases',()=>{
  const p=applyWorldPlayerProfile(template,{...profile,id:'forged',realName:'forged'});
  assert.equal(p.id,template.id);assert.equal(p.realName,template.realName);
});
test('missing nationality and illegal skills are rejected',()=>{
  assert.throws(()=>applyWorldPlayerProfile(template,{...profile,nationality:null}));
  assert.throws(()=>applyWorldPlayerProfile(template,{...profile,stats:{...profile.stats,positioning:999}}));
  assert.throws(()=>applyWorldPlayerProfile(template,{...profile,stats:{...profile.stats,positioning:NaN}}));
});
test('legacy allocations retain their old players and explicitly allocated names',()=>{
  assert.equal(applyWorldPlayerProfile(template),template);
  assert.equal(applyWorldPlayerProfile(template,undefined,'Historical allocated alias').name,'Historical allocated alias');
});
