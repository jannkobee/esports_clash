import test from 'node:test';
import assert from 'node:assert/strict';
import {FPS_IDENTITY_PERSONALITIES} from './fps/fpsPlayerArchitecture.ts';
import {getFpsPreferences} from './fps/fpsPersonality.ts';
test('all 54 preference sets remain independent of execution attributes and kills',()=>{
 for(const personality of FPS_IDENTITY_PERSONALITIES){const card={id:'identity',fpsIdentity:{personality},stats:{rifling:1,sniping:1,entry:1,utility:1,positioning:1,shotcalling:1}};const expert={...card,kills:1000,stats:Object.fromEntries(Object.keys(card.stats).map(k=>[k,99]))};assert.deepEqual(getFpsPreferences(card),getFpsPreferences(expert));}
});
