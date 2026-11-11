import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { simulateFpsMatch } = await import(pathToFileURL(resolve(process.cwd(), 'src', 'fps', 'index.ts')).href);

const folder = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Match allocation path is required.');

const atomic = async (name, value) => {
  const target = resolve(folder, name);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, target);
};

try {
  const allocation = JSON.parse(await readFile(resolve(folder, 'allocation.json'), 'utf8'));
  const { plan, plan_hash: planHash } = allocation;
  if (plan.game_mode !== 'fps_mr15_v1' || plan.fps?.format !== 'MR15_TACTICAL_FPS' || plan.fps.rules_version !== 1) {
    throw new Error('Unsupported FPS ruleset.');
  }
  if (plan.fps.simulation_version !== undefined && ![2,3].includes(plan.fps.simulation_version)) throw new Error('Unsupported pinned FPS simulation revision.');
  if (plan.fps.simulation_version === 3 && !plan.fps_identity) throw new Error('Missing pinned identity state.');
  if (!Number.isInteger(plan.seed) || plan.seed <= 0 || !/^[a-f0-9]{64}$/.test(planHash)) {
    throw new Error('Invalid pinned match allocation.');
  }

  const catalogPath = process.env.ONLINE_CATALOG_PATH ?? '/online/catalog.json';
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const cardsById = new Map(catalog.cards.map(card => [card.id, card]));
  const playerForSlot = slot => {
    const definition = cardsById.get(slot.card_id);
    if (!definition) throw new Error(`Unknown player definition: ${slot.card_id}`);
    const profile = plan.player_profiles?.[slot.instance_id];
    if (plan.player_profile_schema === 1 && !profile) throw new Error(`Missing pinned player profile: ${slot.instance_id}`);
    return {
      ...definition,
      id: slot.instance_id,
      name: profile?.name ?? plan.player_identities?.[slot.instance_id] ?? definition.name,
      ...(profile ? {
        tier: profile.tier,
        ovr: profile.ovr,
        stats: profile.stats,
        primaryPersonality: definition.primaryPersonality,
        secondaryPersonality: definition.secondaryPersonality
      } : {})
    };
  };
  const blue = plan.blue.map(playerForSlot);
  const red = plan.red.map(playerForSlot);
  const playerIds = [...blue, ...red].map(player => player.id);
  if (blue.length !== 5 || red.length !== 5 || new Set(playerIds).size !== 10) {
    throw new Error('FPS matches require ten distinct allocated players.');
  }

  const startedAt = new Date().toISOString();
  await atomic('state.json', { status: 'running', sequence: 0, started_at: startedAt, public_replay: Boolean(plan.fixture) });

  const simulation = simulateFpsMatch(blue, red, plan.fps.map_id, plan.seed, plan.fps.simulation_version===3 ? {identityExperiment:plan.fps_identity} : {});
  // Private DNA and coach inputs stay in the trusted allocation, never in replay.
  delete simulation.identityExperiment;
  delete simulation.identityDevelopment;
  if (simulation.winnerTeam === 'draw') throw new Error('FPS simulation did not produce a verified winner.');
  const durationSeconds = simulation.roundResults.reduce((total, round) => total + round.roundDurationSeconds, 0);
  const report = { ...simulation, winner: simulation.winnerTeam, durationSeconds };
  const playerPerformance = Object.values(simulation.playerStats).map(player => ({
    instance_id: player.playerId,
    team: player.team,
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    damage: player.damage,
    adr: player.adr,
    headshot_rate: player.headshotRate,
    plants: player.plants,
    defuses: player.defuses,
    first_bloods: player.firstBloods,
    trade_kills: player.tradeKills,
    clutches_won: player.clutchesWon,
    set_pieces_involved: player.setPiecesInvolved
  }));
  if (playerPerformance.length !== 10 || playerPerformance.some(player =>
    !Number.isFinite(player.adr) || !Number.isFinite(player.headshot_rate) || player.kills < 0 || player.deaths < 0
  )) throw new Error('FPS performance report is incomplete or invalid.');

  const result = {
    schema: 1,
    match_id: plan.match_id,
    game_mode: plan.game_mode,
    versions: plan.versions,
    seed: plan.seed,
    winner: simulation.winnerTeam,
    report,
    player_performance: playerPerformance
  };
  await atomic('state.json', {
    status: 'completed',
    sequence: simulation.events.length,
    started_at: startedAt,
    public_replay: Boolean(plan.fixture),
    result
  });
  console.log(JSON.stringify({ completed: plan.match_id, rounds: simulation.totalRounds, winner: result.winner }));
} catch (error) {
  await atomic('state.json', { status: 'failed', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
}
