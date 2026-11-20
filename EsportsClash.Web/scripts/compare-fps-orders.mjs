// Compare locked gameplans with the same roster, map and seed, once per starting side.
// Usage: node scripts/compare-fps-orders.mjs --seeds=11,22,33 --rounds=30
import {FpsLiveSimulation} from '../src/fps/fpsLiveSimulation.ts';
import {createFpsIdentityContext} from '../src/fps/fpsIdentityMatch.ts';
import {FPS_OFFICIAL_LIVE_MAPS} from '../src/fps/fpsOfficialLiveMatch.ts';

const option = (name, fallback) => process.argv.find(arg => arg.startsWith('--' + name + '='))?.split('=')[1] ?? fallback;
const seeds = option('seeds', '11,22,33').split(',').map(Number);
const roundsToPlay = Number(option('rounds', '30'));
const maps = option('map', 'all') === 'all' ? FPS_OFFICIAL_LIVE_MAPS : [option('map')];
if (!Number.isInteger(roundsToPlay) || roundsToPlay < 1 || roundsToPlay > 30 || seeds.some(seed => !Number.isInteger(seed) || seed < 1)
  || maps.some(map => !FPS_OFFICIAL_LIVE_MAPS.includes(map))) throw new Error('Expected official maps, positive seeds and 1–30 rounds');

const roster = name => Array.from({length: 5}, (_, slot) => ({
  id: name + '-' + slot,
  name: name + ' ' + (slot + 1),
  stats: {rifling: 68 + slot, sniping: 65 + slot * 3, entry: 77 - slot * 3, utility: 66 + slot * 2, positioning: 70, shotcalling: 72},
}));
const club = roster('Club');
const opponent = roster('Opponent');
const neutral = {tempo: .5, structure: .5, aggression: .5, preparation: .5, freedom: .5, economy: .5};

function run(mapId, seed, clubSide, order) {
  const [blue, red] = clubSide === 'blue' ? [club, opponent] : [opponent, club];
  const identity = createFpsIdentityContext(blue, red);
  for (const side of ['blue', 'red']) identity.teams[side].plan = {...neutral, ...(side === clubSide ? order : {})};
  const completed = [];
  // Match allocation derives execution profiles from the six pinned roster attributes.
  const sim = new FpsLiveSimulation(blue, red, seed, identity, {mapId, onRoundComplete: r => completed.push(r)});
  for (let tick = 0; tick < 400_000 && completed.length < roundsToPlay; tick++) {
    sim.step();
    sim.drainAudioCues();
    if (sim.phase === 'finished') break;
  }
  if (completed.length < roundsToPlay && sim.phase !== 'finished') throw Error('Simulation exceeded its step bound');
  return completed.filter(r => r.attackTeam === clubSide).map(r => r.orders);
}

function summarize(rows) {
  const timed = field => {
    const values = rows.flatMap(row => row[field] === undefined ? [] : [row[field]]);
    return {rounds: values.length, meanSeconds: values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : null};
  };
  return {
    attackingRounds: rows.length,
    firstDamage: timed('firstContactSeconds'),
    firstExecute: timed('firstExecuteSeconds'),
    entryDeaths: rows.filter(row => row.entrySupported !== undefined).length,
    supportedEntryDeaths: rows.filter(row => row.entrySupported === true).length,
  };
}

for (const map of maps) {
  for (const dimension of ['tempo', 'structure']) {
    const blocks = [];
    for (const seed of seeds) {
      for (const side of ['red', 'blue']) {
        blocks.push({seed, starts: side === 'red' ? 'attack' : 'defense',
          low: run(map, seed, side, {[dimension]: .25}),
          high: run(map, seed, side, {[dimension]: .75})});
      }
    }
    console.log(JSON.stringify({
      map, dimension,
      low: summarize(blocks.flatMap(block => block.low)),
      high: summarize(blocks.flatMap(block => block.high)),
      pairs: blocks.map(({seed, starts, low, high}) => ({seed, starts, low: summarize(low), high: summarize(high)})),
    }));
  }
}
