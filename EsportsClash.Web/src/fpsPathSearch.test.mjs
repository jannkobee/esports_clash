import test from 'node:test';
import assert from 'node:assert/strict';
import { getLiveMapRuntime } from './fps/fpsLiveMapRegistry.ts';
import { createLiveRoutePlanner } from './fps/fpsLivePlanning.ts';

const length = (from, path) => {
  let total = 0, previous = from;
  for (const point of path) { total += Math.hypot(point.x - previous.x, point.z - previous.z); previous = point; }
  return path.length ? total : Infinity;
};

// Deterministic sample of nav nodes as origins/destinations.
const sample = (runtime, count, offset) => Array.from({ length: count }, (_, i) =>
  runtime.navNodes[(offset + i * 7919) % runtime.navNodes.length]);

for (const mapId of ['fontessa', 'spillway']) {
  test(`${mapId}: one-origin route search matches findPath reachability and length`, () => {
    const runtime = getLiveMapRuntime(mapId);
    const heatAt = point => (Math.abs(point.x) < 6 ? 2 : 0) + (point.z > 10 ? .5 : 0);
    for (const from of sample(runtime, 4, 11)) {
      const shared = runtime.findPathsFrom(from, [], 0, heatAt), staticShared = runtime.findPathsFrom(from);
      for (const to of sample(runtime, 12, 503)) {
        const single = runtime.findPath(from, to, [], 0, heatAt), many = shared(to);
        assert.equal(many.length === 0, single.length === 0, `${mapId} heat reachability ${JSON.stringify(from)} -> ${JSON.stringify(to)}`);
        if (single.length) assert.ok(Math.abs(length(from, many) - length(from, single)) <= .08 * length(from, single) + .5,
          `${mapId} heat length ${length(from, many)} vs ${length(from, single)}`);
        const plain = runtime.findPath(from, to), plainMany = staticShared(to);
        assert.equal(plainMany.length === 0, plain.length === 0);
        if (plain.length) assert.ok(Math.abs(length(from, plainMany) - length(from, plain)) <= .08 * length(from, plain) + .5);
      }
    }
  });
}

test('route planner reuses one search for many heat-weighted destinations', () => {
  const runtime = getLiveMapRuntime('spillway');
  let searches = 0, singles = 0;
  const counted = { ...runtime,
    findPathsFrom: (...args) => { searches++; return runtime.findPathsFrom(...args); },
    findPath: (...args) => { singles++; return runtime.findPath(...args); } };
  const from = runtime.navNodes[17];
  const route = createLiveRoutePlanner(from, [], 0, () => 1, counted);
  for (const to of sample(runtime, 10, 91)) route(to);
  assert.equal(searches, 1);
  assert.equal(singles, 0);
});

test('the planter leaves the device for a post-plant hold on every site', async()=>{
  const {planLivePostPlant,LIVE_POST_PLANT_OFF_DEVICE}=await import('./fps/fpsLivePlanning.ts');
  for(const mapId of ['fontessa','spillway'])for(const site of ['A','B']){
    const runtime=getLiveMapRuntime(mapId),bomb=runtime.safePoint(runtime.definition.sites[site]);
    for(let slot=0;slot<5;slot++){
      const plan=planLivePostPlant(bomb,site,bomb,slot,[],[],.7,false,runtime);
      const d=Math.hypot(plan.point.x-bomb.x,plan.point.z-bomb.z);
      assert.ok(d>=LIVE_POST_PLANT_OFF_DEVICE,`${mapId} ${site} slot ${slot}: post-plant spot ${d.toFixed(1)}m from the device`);
    }
  }
});
