import test from 'node:test';
import assert from 'node:assert/strict';
import {gameplayController,usesBaseline,usesLearning} from './gameplayController.ts';
test('ordinary matches start with coordinated policies, not the unqualified command actor',()=>{
  assert.equal(gameplayController(false),'hybrid');
  assert.equal(gameplayController(false,'arena'),'hybrid');
  assert.equal(usesBaseline(gameplayController(false)),true);
  assert.equal(usesLearning(gameplayController(false)),true);
});
test('ML off is independent of installed models and historical experiments remain explicit',()=>{
  assert.equal(gameplayController(false,'baseline'),'baseline');
  assert.equal(usesLearning('baseline'),false);
  assert.equal(gameplayController(true,'arena'),'arena');
  assert.equal(usesBaseline('arena'),false);
  assert.equal(gameplayController(true),'legacy');
});
