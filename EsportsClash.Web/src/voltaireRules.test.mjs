import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceStaticRemnant,consumeVoltaireOverload,collectVoltaireBallHits,VOLTAIRE} from './voltaireRules.ts';
import {AvatarModelResources,buildAvatarModel} from './threeAvatarModels.ts';
import {CHAMPIONS} from './mockData.ts';
import {getAbilityPresentation} from './abilityPresentation.ts';
import {disposeArenaTerrainResources} from './threeArenaTerrain.ts';

test('Static Remnant arms, triggers by proximity, hits the blast once and excludes immune/dead targets',()=>{
 const enemy=(id,x,extra={})=>Object.freeze({id,x,y:0,isAlive:true,...extra});
 const enemies=Object.freeze([enemy('trigger',60),enemy('splash',79),enemy('outside',81),enemy('dead',20,{isAlive:false}),enemy('stasis',20,{zhonyaActive:true}),enemy('untargetable',20,{untargetableTimer:1})]);
 const state={elapsed:0,resolved:false},origin=Object.freeze({x:0,y:0}),before=JSON.stringify(enemies);
 assert.deepEqual(advanceStaticRemnant(state,origin,.2,enemies),[]);
 assert.deepEqual(advanceStaticRemnant(state,origin,.1,enemies),['trigger','splash']);
 assert.deepEqual(advanceStaticRemnant(state,origin,.1,enemies),[]);assert.equal(JSON.stringify(enemies),before);
 const expired={elapsed:VOLTAIRE.remnantLifetime-.01,resolved:false};assert.deepEqual(advanceStaticRemnant(expired,origin,.02,enemies),[]);
 const waiting={elapsed:.5,resolved:false};assert.deepEqual(advanceStaticRemnant(waiting,origin,.1,[enemy('far',70)]),[]);assert.equal(waiting.resolved,false);
});

test('Voltaire becomes a ball only during actual travel and reforms on interruption, end and death',()=>{
 const resources=new AvatarModelResources(),model=buildAvatarModel(CHAMPIONS.find(c=>c.id==='c_raijin'),resources);
 const form=model.body.getObjectByName('voltaire-ball-lightning'),outfit=model.body.getObjectByName('outfit'),charge=model.body.getObjectByName('voltaire-overload-charge');
 const dash=Object.freeze({kind:'raijin_bolt',remaining:.4}),pose=Object.freeze({motionState:'walk',dash,voltaireOverloadTimer:4});
 const before=JSON.stringify(pose);model.animate(pose,.35);assert.equal(form.visible,true);assert.equal(outfit.visible,false);assert.equal(charge.visible,false);
 model.animate({motionState:'idle',voltaireOverloadTimer:4},.4);assert.equal(form.visible,false);assert.equal(outfit.visible,true);assert.equal(charge.visible,true);
 model.animate({motionState:'walk',dash:{...dash,remaining:0}},.5);assert.equal(form.visible,false);
 model.animate({motionState:'death',dash},.6);assert.equal(form.visible,false);assert.equal(outfit.visible,true);
 assert.equal(JSON.stringify(pose),before);model.dispose();disposeArenaTerrainResources(resources.owner);
});

test('Voltaire descriptions document the actual trap, pull, flight and counterplay',()=>{
 const kit=CHAMPIONS.find(c=>c.id==='c_raijin');
 assert.match(kit.passiveDesc,/one charge/);assert.match(kit.skill1.desc,/0.3 seconds/);assert.match(kit.skill1.desc,/65 units/);
 for(const slot of ['skill1','skill2','ultimate']){const p=getAbilityPresentation(kit,slot);assert.ok(p.visualDescription&&p.counterplay);}
 assert.equal(getAbilityPresentation(kit,'ultimate').movement.distance,320);
 assert.match(kit.ultimate.desc,/lightning ball/);assert.match(kit.ultimate.desc,/does not grant immunity/);
});

test('Overload spends one primary charge on avatars/minions and preserves it on structures and neutrals',()=>{
 const unit={voltaireOverloadTimer:VOLTAIRE.overloadLifetime};
 for(const kind of ['structure','camp','dragon'])assert.equal(consumeVoltaireOverload(unit,kind),false);
 assert.equal(unit.voltaireOverloadTimer,6);
 assert.equal(consumeVoltaireOverload(unit,'champion'),true);assert.equal(unit.voltaireOverloadTimer,0);
 assert.equal(consumeVoltaireOverload(unit,'minion'),false);
 unit.voltaireOverloadTimer=6;unit.voltaireOverloadTimer=6;
 assert.equal(consumeVoltaireOverload(unit,'minion'),true);assert.equal(consumeVoltaireOverload(unit,'minion'),false);
});

test('Ball Lightning hits overlapping contacts once and only adds eligible arrival victims',()=>{
 const enemy=(id,x,extra={})=>Object.freeze({id,x,y:0,isAlive:true,...extra});
 const targets=Object.freeze([enemy('a',20),enemy('b',20),enemy('edge',28),enemy('arrival',50),enemy('outside',56),enemy('immune',10,{zhonyaActive:true}),enemy('dead',5,{isAlive:false})]);
 const state={hitIds:[]},before=JSON.stringify(targets),position={x:0,y:0};
 assert.deepEqual(collectVoltaireBallHits(state,position,targets),['a','b','edge']);
 assert.deepEqual(collectVoltaireBallHits(state,position,targets),[]);
 assert.deepEqual(collectVoltaireBallHits(state,position,targets,true),['arrival']);
 assert.deepEqual(collectVoltaireBallHits(state,position,targets,true),[]);assert.equal(JSON.stringify(targets),before);
});
