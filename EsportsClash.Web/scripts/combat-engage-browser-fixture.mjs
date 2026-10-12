// Controlled live-simulator check for proactive, non-CC teamfight initiation.
import assert from 'node:assert/strict';

export async function checkCombatEngage({ evaluate, delay, click }) {
  const before = await evaluate(`(() => {
    const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView' ? fiber : walk(fiber.child) || walk(fiber.sibling);
    const fiber = walk(window.fixtureRoot._internalRoot.current);
    const refs = []; for (let hook = fiber.memoizedState; hook; hook = hook.next)
      if (hook.memoizedState && Object.hasOwn(hook.memoizedState, 'current')) refs.push(hook.memoizedState);
    const championsRef = refs.find(ref => Array.isArray(ref.current) && ref.current.length === 10 && ref.current[0]?.champion);
    const structuresRef = refs.find(ref => Array.isArray(ref.current) && ref.current.some(item => item?.type?.includes?.('tower')));
    if (!championsRef || !structuresRef) throw Error('Live combat refs unavailable');
    structuresRef.current.forEach(structure => { structure.range = 0; structure.targetId = undefined; structure.diveAggressorId = undefined; });
    championsRef.current.forEach((unit, index) => {
      const sideIndex = index % 5;
      unit.x = unit.team === 'blue' ? 1150 : 1450;
      unit.y = 300 + sideIndex * 35;
      unit.hp = unit.maxHp; unit.mana = 100; unit.level = 6;
      unit.cd1 = 0; unit.cd2 = 0; unit.cdUlt = 0;
      unit.isRecalling = false; unit.recallIntent = false; unit.diveAborting = false;
      unit.committedState = undefined; unit.decisionCommitTimer = 0;
      unit.allInCommitTimer = 0;
      unit.actionIntent = undefined; unit.followUpEngageSignaled = false;
      unit.blackHole = undefined; unit.corsaraBarrage = undefined; unit.monkeySpin = undefined;
    });
    return { channelers: championsRef.current.filter(unit => unit.blackHole || unit.corsaraBarrage || unit.monkeySpin).length };
  })()`);
  assert.equal(before.channelers, 0, 'fixture must begin without landed or channeled control');
  await delay(300);
  const result = await evaluate(`(() => {
    const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView' ? fiber : walk(fiber.child) || walk(fiber.sibling);
    const fiber = walk(window.fixtureRoot._internalRoot.current);
    const refs = []; for (let hook = fiber.memoizedState; hook; hook = hook.next)
      if (hook.memoizedState && Object.hasOwn(hook.memoizedState, 'current')) refs.push(hook.memoizedState);
    const champions = refs.find(ref => Array.isArray(ref.current) && ref.current.length === 10 && ref.current[0]?.champion).current;
    return {
      signaled: champions.filter(unit => unit.followUpEngageSignaled).length,
      fighting: champions.filter(unit => unit.committedState === 'fight').length,
      championIntents: champions.filter(unit => unit.actionIntent?.kind === 'champion').length,
      aborting: champions.filter(unit => unit.diveAborting).length,
    };
  })()`);
  assert.ok(result.signaled >= 6, JSON.stringify(result));
  assert.ok(result.fighting >= 6, JSON.stringify(result));
  assert.ok(result.championIntents >= 6, JSON.stringify(result));
  assert.equal(result.aborting, 0, JSON.stringify(result));
  console.log('Controlled proactive all-in check:', JSON.stringify(result));

  await click('4x');
  const sample = { blueMinAlive: 5, redMinAlive: 5, totalDeaths: 0 };
  for (let index = 0; index < 75; index++) {
    await delay(100);
    const frame = await evaluate(`(() => {
      const walk = fiber => !fiber ? null : fiber.type?.name === 'AramMatchView' ? fiber : walk(fiber.child) || walk(fiber.sibling);
      const fiber = walk(window.fixtureRoot._internalRoot.current);
      const refs = []; for (let hook = fiber.memoizedState; hook; hook = hook.next)
        if (hook.memoizedState && Object.hasOwn(hook.memoizedState, 'current')) refs.push(hook.memoizedState);
      const champions = refs.find(ref => Array.isArray(ref.current) && ref.current.length === 10 && ref.current[0]?.champion).current;
      return { blueAlive: champions.filter(unit => unit.team === 'blue' && unit.isAlive).length,
        redAlive: champions.filter(unit => unit.team === 'red' && unit.isAlive).length,
        deaths: champions.reduce((sum, unit) => sum + unit.deaths, 0) };
    })()`);
    sample.blueMinAlive = Math.min(sample.blueMinAlive, frame.blueAlive);
    sample.redMinAlive = Math.min(sample.redMinAlive, frame.redAlive);
    sample.totalDeaths = Math.max(sample.totalDeaths, frame.deaths);
  }
  console.log('Controlled 30-sim-second clash sample:', JSON.stringify(sample));
}
