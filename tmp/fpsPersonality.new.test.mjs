import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlayerPersonality,migratePlayerAttributes} from './playerPersonality.ts';
import {getFpsPreferences,initialFpsPsychology,updateFpsPsychology} from './fps/fpsPersonality.ts';
import {generateFpsPersonality,validateFpsPersonality} from './fps/fpsPlayerArchitecture.ts';
test('legacy roster conversion is deterministic, idempotent and independent from old badge meanings',()=>{
 const legacy={id:'stored-player',name:'Alias',stats:{lan:40,tf:70,iq:80,clu:60,sta:50,flx:90,ldr:80},primaryPersonality:'clutch_performer',secondaryPersonality:'igl',badges:[]};
 const before=structuredClone(legacy),p=normalizePlayerPersonality(legacy);assert.deepEqual(legacy,before);assert.equal(Object.keys(p.stats).length,6);assert.deepEqual(p.fpsIdentity.personality,generateFpsPersonality(legacy.id));assert.ok(!('primaryPersonality'in p));assert.deepEqual(normalizePlayerPersonality(p),p);
 assert.deepEqual(normalizePlayerPersonality({...legacy,stats:{...legacy.stats,lan:99}}).fpsIdentity.personality,p.fpsIdentity.personality);
 assert.equal(migratePlayerAttributes(legacy.stats).rifling,40);
});
test('temperament changes match-local confidence without changing permanent traits or aim',()=>{
 const run=temperament=>{const card=normalizePlayerPersonality({id:'mood',name:'Alias',stats:{rifling:50,sniping:50,entry:50,utility:50,positioning:50,shotcalling:50},badges:[]});card.fpsIdentity.personality=validateFpsPersonality({...card.fpsIdentity.personality,temperament});const p={playerId:card.id,card,isAlive:false,psychology:initialFpsPsychology()};updateFpsPsychology(p,false,1,[]);const mood=structuredClone(p.psychology);updateFpsPsychology(p,false,1,[]);assert.deepEqual(p.psychology,mood);return p;};
 const volatile=run('VOLATILE'),cold=run('ICE_COLD');assert.ok(volatile.psychology.confidence<cold.psychology.confidence);assert.deepEqual(volatile.card.stats,cold.card.stats);assert.equal(volatile.card.fpsIdentity.personality.temperament,'VOLATILE');
 assert.notDeepEqual(getFpsPreferences(volatile.card,volatile.psychology),getFpsPreferences(cold.card,cold.psychology));
});
