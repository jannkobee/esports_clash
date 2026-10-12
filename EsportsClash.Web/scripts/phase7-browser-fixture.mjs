// Controlled browser presentation check for Phase 7. This does not replace
// deterministic rule tests or claim a representative balance sample.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function checkPhase7({ evaluate, send, delay, outputDir }) {
  const rules = await evaluate(`(async () => {
    const runtime = await import('/src/abilityRuntimeRules.ts');
    const {CHAMPIONS} = await import('/src/mockData.ts');
    const kindra = CHAMPIONS.find(champion => champion.name === 'Kindra');
    return {
      huntedRange: runtime.getAbilityAdjustedBasicAttackRange(kindra, 5, false),
      smokedRange: runtime.getAbilityAdjustedBasicAttackRange(kindra, 5, true),
      expiryHeal: runtime.getLambsRespiteExpiryHeal(1),
      healthFloor: runtime.getLambsRespiteMinimumHealth(1000),
    };
  })()`);
  assert.ok(Math.abs(rules.huntedRange - 212.75) < 1e-9);
  assert.equal(rules.smokedRange, 55);
  assert.equal(rules.expiryHeal, 450);
  assert.equal(rules.healthFloor, 100);

  await evaluate(`(() => {
    const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView' ? fiber : walk(fiber.child) || walk(fiber.sibling);
    const fiber = walk(window.fixtureRoot._internalRoot.current);
    const refs = []; for (let hook = fiber.memoizedState; hook; hook = hook.next)
      if (hook.memoizedState && Object.hasOwn(hook.memoizedState, 'current')) refs.push(hook.memoizedState);
    const index = refs.findIndex(ref => Array.isArray(ref.current) && ref.current[0]?.champion);
    if (index < 0) throw Error('Live champion refs unavailable');
    const champions = refs[index].current;
    const spells = refs[index + 5].current;
    const buck = champions.find(unit => unit.champion.name === 'Buck');
    const kindra = champions.find(unit => unit.champion.name === 'Kindra');
    if (!buck || !kindra) throw Error('Phase 7 avatars missing from controlled lineup');
    buck.x = 1230; buck.y = 345; kindra.x = 1370; kindra.y = 420; kindra.kindraHuntTimer = 5;
    spells.push(
      {id:'phase7-smoke',type:'smoke_screen',x:1290,y:365,radius:55,duration:10,maxDuration:10,color:'#94a3b8',sourceUnitId:buck.id,avatarName:'Buck',abilitySlot:'skill2'},
      {id:'phase7-respite',type:'lambs_respite',x:1370,y:420,radius:65,duration:10,maxDuration:10,color:'#facc15',sourceUnitId:kindra.id,avatarName:'Kindra',abilitySlot:'ultimate'}
    );
  })()`);
  await delay(120);
  const capture = await send('Page.captureScreenshot', { format: 'png' });
  const path = join(outputDir, 'phase7-smoke-respite.png');
  await writeFile(path, Buffer.from(capture.data, 'base64'));
  console.log('Phase 7 controlled browser checks:', JSON.stringify(rules), 'Visual:', path);
}
