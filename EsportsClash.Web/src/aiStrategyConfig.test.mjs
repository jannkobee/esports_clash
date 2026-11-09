import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AI_STRATEGY, loadAIStrategyConfig, configureMacroStrategy } from './aiStrategyConfig.ts';
import { chooseMacroAction } from './macroActionDecision.ts';

const candidate = (action, factors, overrides={}) => ({ action, factors, available:true,
  priority:'optional', contextKey:action, reason:'fixture', ...overrides });

test('strategy schema rejects mechanical knobs, nonfinite and out-of-bounds preferences', () => {
  assert.deepEqual(loadAIStrategyConfig(DEFAULT_AI_STRATEGY), DEFAULT_AI_STRATEGY);
  for (const raw of [null, {...DEFAULT_AI_STRATEGY, version:2}, {...DEFAULT_AI_STRATEGY, towerDamage:0},
    {...DEFAULT_AI_STRATEGY, farmStrategic:NaN}, {...DEFAULT_AI_STRATEGY, farmStrategic:2},
    {...DEFAULT_AI_STRATEGY, pushTempoStrategic:.1}]) assert.equal(loadAIStrategyConfig(raw), undefined);
});

test('defaults preserve existing strategy and tuning can change a legal optional decision', () => {
  const candidates = [candidate('farm',{strategic:.42,tactical:.36,personality:.1,learned:.02}),
    candidate('push',{strategic:.18,tactical:.60,personality:.1,learned:.02})];
  const context = {tempoPush:false,postFightFarm:false};
  assert.deepEqual(configureMacroStrategy(candidates,DEFAULT_AI_STRATEGY,context),candidates);
  const choose = c => chooseMacroAction({actorAvailable:true,now:1,candidates:c}).selected.value;
  assert.equal(choose(candidates),'farm');
  const tuned = configureMacroStrategy(candidates,loadAIStrategyConfig({...DEFAULT_AI_STRATEGY,
    farmStrategic:.32,pushStrategic:.28}),context);
  assert.equal(choose(tuned),'push');
  assert.equal(tuned[0].factors.personality,candidates[0].factors.personality);
  assert.equal(tuned[0].factors.learned,candidates[0].factors.learned);
});

test('tuning cannot legalize an action, outrank survival or bypass commitment', () => {
  const emergency=candidate('retreat',{tactical:.1},{priority:'emergency'});
  const unavailable=candidate('farm',{strategic:.42},{available:false});
  const tactical=candidate('push',{strategic:.18},{priority:'tactical'});
  const tuned=configureMacroStrategy([emergency,unavailable,tactical],DEFAULT_AI_STRATEGY,
    {tempoPush:true,postFightFarm:true});
  assert.equal(tuned[0],emergency);assert.equal(tuned[1],unavailable);assert.equal(tuned[2],tactical);
  assert.equal(chooseMacroAction({actorAvailable:true,now:1,candidates:tuned}).selected.value,'retreat');
  const pair=[candidate('farm',{strategic:.42,tactical:.36}),candidate('push',{strategic:.18,tactical:.6})];
  const changed=configureMacroStrategy(pair,{...DEFAULT_AI_STRATEGY,farmStrategic:.32,pushStrategic:.28},
    {tempoPush:false,postFightFarm:false});
  assert.equal(chooseMacroAction({actorAvailable:true,now:1,candidates:changed,
    commitment:{action:'farm',contextKey:'farm',until:1.4}}).selected.value,'farm');
});
