import type { PlayerCard } from '../types.ts';
import type {
  FpsBombsite,
  FpsMap,
  FpsMapId,
  FpsMatchEvent,
  FpsMatchReport,
  FpsMatchSettings,
  FpsPlayerMatchStats,
  FpsRoundPlayerSnapshot,
  FpsPlayerState,
  FpsRoundEndReason,
  FpsRoundResult,
  FpsSide,
  FpsTeamId,
  FpsWeaponId
} from './types.ts';
import { getFpsMap } from './maps.ts';
import {
  BOMB_PLANT_ATTACKER_BONUS,
  determineTeamBuyDecision,
  executePlayerPurchases,
  getLossReward,
  MAX_CASH,
  OVERTIME_STARTING_CASH,
  ROUND_WIN_REWARD,
  STARTING_CASH
} from './fpsEconomy.ts';
import { executeSetPiece, generateSetPieceCall } from './setPieceRules.ts';
import { assignFpsTeamRoles, initialFpsPsychology, rankFpsPlayers, updateFpsPsychology, updateContextualFpsPsychology } from './fpsPersonality.ts';
import { developFpsChemistry, developFpsFamiliarity, evaluatePlayerAction, evolveFpsTeamIdentity } from './fpsIdentity.ts';
import {assignContextualRoles,hydrateFpsIdentityContext} from './fpsIdentityMatch.ts';

export function createFpsPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function initializePlayerState(
  card: PlayerCard,
  team: FpsTeamId,
  side: FpsSide,
  startingCash: number
): FpsPlayerState {
  return {
    playerId: card.id,
    name: card.name,
    card,
    team,
    side,
    hp: 100,
    isAlive: true,
    cash: startingCash,
    loadout: {
      secondaryWeapon: 'sidearm_standard',
      armor: 0,
      hasHelmet: false,
      hasDefuseKit: false,
      hasBomb: false,
      utilities: []
    },
    currentZone: '',
    kills: 0,
    deaths: 0,
    assists: 0,
    damageDealt: 0,
    plants: 0,
    defuses: 0,
    tradeKills: 0,
    firstBloods: 0,
    clutchesWon: 0,
    setPiecesInvolved: 0,
    psychology: initialFpsPsychology()
  };
}

export function fpsOvertimeTarget(nextRound: number): number {
  return 19 + Math.max(0, Math.floor((nextRound - 32) / 6)) * 3;
}

export function simulateFpsMatch(
  blueRoster: PlayerCard[],
  redRoster: PlayerCard[],
  mapId: FpsMapId = 'breakwater',
  seed: number = 1337,
  settings: FpsMatchSettings = {}
): FpsMatchReport {
  const initialIdentity=settings.identityExperiment ? hydrateFpsIdentityContext(settings.identityExperiment,[...blueRoster,...redRoster].map(p=>p.id)) : undefined;
  if (initialIdentity) settings={...settings,identityExperiment:structuredClone(initialIdentity)};
  if (blueRoster.length !== 5 || redRoster.length !== 5 || new Set([...blueRoster, ...redRoster].map(p => p.id)).size !== 10) throw Error('FPS requires ten distinct players, five per side.');
  if (!Number.isInteger(seed)) throw Error('FPS seed must be an integer.');
  if (settings.roundSeconds !== undefined && (!Number.isFinite(settings.roundSeconds) || settings.roundSeconds < 1 || settings.roundSeconds > 115)) throw Error('Invalid round timer.');
  if (settings.bombSeconds !== undefined && (!Number.isFinite(settings.bombSeconds) || settings.bombSeconds < 1 || settings.bombSeconds > 40)) throw Error('Invalid device timer.');
  const prng = createFpsPrng(seed);
  const map = getFpsMap(mapId);

  const maxRegulationRounds = settings.maxRounds ?? 30;
  const regulationTargetWins = 16;
  const overtimeEnabled = settings.overtimeEnabled ?? true;
  const startingCash = settings.startingCash ?? STARTING_CASH;

  // Blue starts Attackers, Red starts Defenders in first half
  let blueSide: FpsSide = 'attackers';
  let redSide: FpsSide = 'defenders';

  const bluePlayers: FpsPlayerState[] = blueRoster.slice(0, 5).map(c =>
    initializePlayerState(c, 'blue', blueSide, startingCash)
  );
  const redPlayers: FpsPlayerState[] = redRoster.slice(0, 5).map(c =>
    initializePlayerState(c, 'red', redSide, startingCash)
  );

  let blueScore = 0;
  let redScore = 0;
  let blueLossStreak = 0;
  let redLossStreak = 0;

  let firstHalfScore = { blue: 0, red: 0 };
  let secondHalfScore = { blue: 0, red: 0 };
  let overtimeScore: { blue: number; red: number } | undefined;

  const roundResults: FpsRoundResult[] = [];
  const roundSnapshots: FpsRoundPlayerSnapshot[] = [];
  const events: FpsMatchEvent[] = [];

  let currentTick = 0;
  let currentSecond = 0;
  let currentRound = 1;
  let isOvertime = false;

  const pushEvent = (
    roundNumber: number,
    type: FpsMatchEvent['type'],
    text: string,
    extra: Partial<FpsMatchEvent> = {}
  ) => {
    currentTick += 10;
    currentSecond += 0.33;
    events.push({
      tick: currentTick,
      second: Math.round(currentSecond * 10) / 10,
      roundNumber,
      type,
      text,
      ...extra
    });
  };

  while (true) {
    if (currentRound > 1000) throw Error('FPS round safety limit reached without a winner.');
    // Check if match won in regulation
    if (!isOvertime) {
      if (blueScore >= regulationTargetWins) break;
      if (redScore >= regulationTargetWins) break;

      // Check regulation 15-15 tie
      if (currentRound > maxRegulationRounds) {
        if (blueScore === 15 && redScore === 15) {
          if (!overtimeEnabled) {
            break; // Official Draw
          }
          isOvertime = true;
          overtimeScore = { blue: 0, red: 0 };
          pushEvent(currentRound, 'overtime_start', 'REGULATION DRAW 15-15! Entering MR3 Overtime (First to 19)!');

          // Reset overtime economy
          for (const p of [...bluePlayers, ...redPlayers]) {
            p.cash = OVERTIME_STARTING_CASH;
            p.loadout.primaryWeapon = undefined;
            p.loadout.secondaryWeapon = 'sidearm_standard';
            p.loadout.armor = 0;
            p.loadout.hasHelmet = false;
            p.loadout.hasDefuseKit = false;
            p.loadout.utilities = [];
          }
        } else {
          break;
        }
      }
    } else {
      // Each MR3 block requires four wins. An 18-18 tie starts a fresh block.
      const target = fpsOvertimeTarget(currentRound);
      if (Math.max(blueScore, redScore) >= target && Math.abs(blueScore - redScore) >= 2) break;
    }

    // Side swap at round 16 (regulation half-time)
    if (currentRound === 16 && !isOvertime) {
      firstHalfScore = { blue: blueScore, red: redScore };
      blueSide = 'defenders';
      redSide = 'attackers';

      pushEvent(currentRound, 'side_swap', 'HALF-TIME: Teams swap sides! Blue is now Defending, Red is now Attacking.');

      // Reset pistol round economy for both teams
      for (const p of bluePlayers) {
        p.side = blueSide;
        p.cash = STARTING_CASH;
        p.loadout.primaryWeapon = undefined;
        p.loadout.secondaryWeapon = 'sidearm_standard';
        p.loadout.armor = 0;
        p.loadout.hasHelmet = false;
        p.loadout.hasDefuseKit = false;
        p.loadout.utilities = [];
      }
      for (const p of redPlayers) {
        p.side = redSide;
        p.cash = STARTING_CASH;
        p.loadout.primaryWeapon = undefined;
        p.loadout.secondaryWeapon = 'sidearm_standard';
        p.loadout.armor = 0;
        p.loadout.hasHelmet = false;
        p.loadout.hasDefuseKit = false;
        p.loadout.utilities = [];
      }
      blueLossStreak = 0;
      redLossStreak = 0;
    }

    // Overtime switches sides after every three-round half.
    if (isOvertime && currentRound > 31 && (currentRound - 31) % 3 === 0) {
      const prevBlueSide: FpsSide = blueSide;
      blueSide = redSide;
      redSide = prevBlueSide;
      for (const p of bluePlayers) p.side = blueSide;
      for (const p of redPlayers) p.side = redSide;
      pushEvent(currentRound, 'side_swap', 'OVERTIME HALF-TIME: Teams swap sides for second OT half.');
    }

    if (isOvertime && currentRound > 31 && (currentRound - 31) % 6 === 0) {
      for (const p of [...bluePlayers, ...redPlayers]) {
        p.cash = OVERTIME_STARTING_CASH;
        p.loadout = { secondaryWeapon: 'sidearm_standard', armor: 0, hasHelmet: false, hasDefuseKit: false, hasBomb: false, utilities: [] };
      }
      blueLossStreak = 0; redLossStreak = 0;
    }

    // === START OF ROUND ===
    const isPistolRound = currentRound === 1 || currentRound === 16;
    pushEvent(
      currentRound,
      'round_start',
      `--- ROUND ${currentRound} (${blueSide === 'attackers' ? 'Blue ATK vs Red DEF' : 'Red ATK vs Blue DEF'}) ---`
    );

    const roundStartedAt = currentSecond;

    // Reset player life and zones
    for (const p of bluePlayers) {
      p.isAlive = true;
      p.hp = 100;
      p.currentZone = p.side === 'attackers' ? map.attackerSpawnZone : map.defenderSpawnZone;
      p.loadout.hasBomb = false;
    }
    for (const p of redPlayers) {
      p.isAlive = true;
      p.hp = 100;
      p.currentZone = p.side === 'attackers' ? map.attackerSpawnZone : map.defenderSpawnZone;
      p.loadout.hasBomb = false;
    }

    // Designate bomb carrier
    const attackingTeam = blueSide === 'attackers' ? bluePlayers : redPlayers;
    const defendingTeam = blueSide === 'attackers' ? redPlayers : bluePlayers;
    if(settings.identityExperiment) {
      assignContextualRoles(attackingTeam,settings.identityExperiment);
      assignContextualRoles(defendingTeam,settings.identityExperiment);
    } else {
      assignFpsTeamRoles(attackingTeam);
      assignFpsTeamRoles(defendingTeam);
    }
    // Support carries the device so the opening duel does not routinely drop it.
    const carrier = (settings.identityExperiment ? attackingTeam.find(p=>p.tactics?.role==='support') : rankFpsPlayers(attackingTeam.filter(p => p.tactics?.role === 'support'), 'support')[0])
      ?? attackingTeam[0];
    carrier.loadout.hasBomb = true;

    // Buy Phase
    const chooseBuy = (team: FpsPlayerState[], opponentScore: number, ownScore: number) => {
      const baseline=determineTeamBuyDecision(team,currentRound,opponentScore,ownScore);
      const experiment=settings.identityExperiment;
      const avgCash=team.reduce((sum,p)=>sum+p.cash,0)/team.length;
      if (!experiment || currentRound===1 || currentRound===16 || (opponentScore>=15 && opponentScore>ownScore) || avgCash<2000 || avgCash>=4200) return baseline;
      const leader=team.find(p=>p.tactics?.isCaller) ?? team[0], identity=experiment.players[leader.playerId], environment=experiment.teams[leader.team];
      if (!identity || !environment) return baseline;
      const decision=evaluatePlayerAction(identity,{triggers:new Set(['economicTrouble','futureBuy']),opportunities:new Set(),teamIdentity:environment.culture,confidence:(leader.psychology?.confidence ?? 50)/100,fatigue:0},environment.coach,environment.plan,environment.chemistry,[
        {action:'force',legal:true,tacticalValue:avgCash/4200*.55,instruction:1-environment.plan.economy*2},
        {action:'save',legal:true,tacticalValue:(1-avgCash/4200)*.55,instruction:environment.plan.economy*2-1},
      ],prng);
      pushEvent(currentRound,'tactical_decision',`${leader.name} called ${decision.action==='force'?'a force buy':'an economic save'}.`,{actorId:leader.playerId,actorName:leader.name,decision});
      return decision.action==='force' ? 'force_buy' as const : 'eco_save' as const;
    };
    const blueBuy = chooseBuy(bluePlayers, redScore, blueScore);
    const redBuy = chooseBuy(redPlayers, blueScore, redScore);

    for (const p of bluePlayers) {
      executePlayerPurchases(p, blueBuy, currentRound, isPistolRound, prng, Boolean(settings.identityExperiment),settings.identityExperiment,decision=>pushEvent(currentRound,'tactical_decision',`${p.name} prioritized ${decision.action==='invest'?'utility':'equipment'} purchases.`,{actorId:p.playerId,actorName:p.name,decision}));
    }
    for (const p of redPlayers) {
      executePlayerPurchases(p, redBuy, currentRound, isPistolRound, prng, Boolean(settings.identityExperiment),settings.identityExperiment,decision=>pushEvent(currentRound,'tactical_decision',`${p.name} prioritized ${decision.action==='invest'?'utility':'equipment'} purchases.`,{actorId:p.playerId,actorName:p.name,decision}));
    }

    currentSecond += 15; currentTick += 450;
    pushEvent(
      currentRound,
      'buy_phase_complete',
      `Buy Phase: Blue (${blueBuy.toUpperCase()}) vs Red (${redBuy.toUpperCase()})`
    );

    for (const p of [...bluePlayers, ...redPlayers]) {
      roundSnapshots.push({
        roundNumber: currentRound,
        playerId: p.playerId,
        team: p.team,
        side: p.side,
        currentZone: p.currentZone,
        isAlive: p.isAlive,
        hp: p.hp,
        loadout: { ...p.loadout, utilities: [...p.loadout.utilities] },
        tactics: p.tactics ? structuredClone(p.tactics) : undefined
      });
    }

    // Tactical Execution: Generate & Execute "Set Piece"
    const setPieceCall = generateSetPieceCall(attackingTeam, defendingTeam, map, currentRound, prng, settings.identityExperiment);
    const liveStartedAt = currentSecond;
    const resolution = executeSetPiece(
      setPieceCall,
      attackingTeam,
      defendingTeam,
      map,
      currentRound,
      currentTick,
      currentSecond,
      prng,
      settings
    );

    // Merge events from set piece execution
    for (const ev of resolution.events) {
      events.push(ev);
      currentTick = ev.tick;
      currentSecond = ev.second;
    }

    currentSecond = liveStartedAt + resolution.durationSeconds;
    currentTick = Math.max(currentTick, Math.round(currentSecond * 30));
    if (settings.identityExperiment) for (const player of [...bluePlayers,...redPlayers]) {
      player.lastRoundEarlyDeath=resolution.events.some(event=>(event.type==='kill'||event.type==='trade_kill') && event.targetId===player.playerId && event.second-liveStartedAt<=20);
    }
    const winnerSide = resolution.winnerSide;
    const winnerTeam = (winnerSide === 'attackers' ? attackingTeam : defendingTeam)[0].team;
    const endReason = resolution.endReason;

    // Update Scores
    if (winnerTeam === 'blue') {
      blueScore += 1;
      blueLossStreak = 0;
      redLossStreak += 1;
    } else {
      redScore += 1;
      redLossStreak = 0;
      blueLossStreak += 1;
    }

    if (isOvertime && overtimeScore) {
      if (winnerTeam === 'blue') overtimeScore.blue += 1;
      else overtimeScore.red += 1;
    } else if (currentRound > 15) {
      secondHalfScore = {
        blue: blueScore - firstHalfScore.blue,
        red: redScore - firstHalfScore.red
      };
    } else {
      firstHalfScore = { blue: blueScore, red: redScore };
    }

    // Economy Distribution for Round End
    const blueWon = winnerTeam === 'blue';
    const blueReward = blueWon ? ROUND_WIN_REWARD : getLossReward(blueLossStreak - 1);
    const redReward = !blueWon ? ROUND_WIN_REWARD : getLossReward(redLossStreak - 1);

    for (const p of bluePlayers) {
      let reward = blueReward;
      if (p.side === 'attackers' && resolution.devicePlanted) {
        reward += BOMB_PLANT_ATTACKER_BONUS;
      }
      p.cash = Math.min(MAX_CASH, p.cash + reward);
      if (!p.isAlive) {
        p.loadout.primaryWeapon = undefined;
        p.loadout.secondaryWeapon = 'sidearm_standard';
        p.loadout.armor = 0;
        p.loadout.hasHelmet = false;
        p.loadout.hasDefuseKit = false;
        p.loadout.utilities = [];
      }
    }

    for (const p of redPlayers) {
      let reward = redReward;
      if (p.side === 'attackers' && resolution.devicePlanted) {
        reward += BOMB_PLANT_ATTACKER_BONUS;
      }
      p.cash = Math.min(MAX_CASH, p.cash + reward);
      if (!p.isAlive) {
        p.loadout.primaryWeapon = undefined;
        p.loadout.secondaryWeapon = 'sidearm_standard';
        p.loadout.armor = 0;
        p.loadout.hasHelmet = false;
        p.loadout.hasDefuseKit = false;
        p.loadout.utilities = [];
      }
    }

    const roundDuration = Math.round((currentSecond + .33 - roundStartedAt) * 10) / 10;

    const roundResult: FpsRoundResult = {
      roundNumber: currentRound,
      winnerTeam,
      winnerSide,
      reason: endReason,
      roundDurationSeconds: roundDuration,
      devicePlanted: resolution.devicePlanted,
      plantedSite: resolution.devicePlanted ? resolution.targetSite : undefined,
      plantedByPlayerId: resolution.planterId,
      defusedByPlayerId: resolution.defuserPlayerId,
      setPieceExecuted: true,
      setPieceStrategy: setPieceCall.strategy,
      setPieceSuccessful: winnerSide === 'attackers',
      blueScoreAfter: blueScore,
      redScoreAfter: redScore,
      blueCashTotal: bluePlayers.reduce((sum, p) => sum + p.cash, 0),
      redCashTotal: redPlayers.reduce((sum, p) => sum + p.cash, 0)
    };

    roundResults.push(roundResult);

    for (const roster of [bluePlayers,redPlayers]) for (const p of roster) {
      const identity=settings.identityExperiment?.players[p.playerId];
      if (identity && settings.identityExperiment) updateContextualFpsPsychology(p,winnerTeam===p.team,currentRound,identity.dna,settings.identityExperiment.teams[p.team].chemistry.trust);
      else updateFpsPsychology(p,winnerTeam===p.team,currentRound,roster);
    }
    if (settings.identityExperiment) {
      const experiment=settings.identityExperiment;
      for (const roster of [bluePlayers,redPlayers]) {
        const environment=experiment.teams[roster[0].team];
        const identities=roster.map(p=>experiment.players[p.playerId]).filter(p=>p!==undefined);
        for (const identity of identities) {
          identity.familiarity=developFpsFamiliarity(identity.familiarity,1,identity.dna.adaptability/100);
          const activations=resolution.events.filter(event=>event.type==='specialty_activated' && event.actorId===identity.id && event.specialtyId===identity.specialty?.id).length;
          if (activations) identity.specialtyProficiency=developFpsFamiliarity(identity.specialtyProficiency ?? .5,Math.min(1,activations/5),identity.dna.adaptability/100);
        }
        const actualTrade=resolution.events.some(event=>event.type==='trade_kill' && roster.some(p=>p.playerId===event.actorId));
        if (actualTrade) environment.chemistry=developFpsChemistry(environment.chemistry,{coordinated:true,roleConflict:false});
        environment.culture=evolveFpsTeamIdentity(environment.culture ?? {...environment.plan},environment.coach,environment.plan,identities.map(p=>p.dna));
      }
    }

    pushEvent(
      currentRound,
      'round_end',
      `ROUND ${currentRound} WON BY ${winnerTeam.toUpperCase()} (${endReason.replace('_', ' ').toUpperCase()})! Score: Blue ${blueScore} - ${redScore} Red.`
    );

    currentRound += 1;
  }

  // Determine Overall Winner
  let winnerTeam: FpsTeamId | 'draw' = 'draw';
  if (blueScore > redScore) winnerTeam = 'blue';
  else if (redScore > blueScore) winnerTeam = 'red';

  pushEvent(
    currentRound - 1,
    'match_end',
    `MATCH FINISHED! Winner: ${winnerTeam.toUpperCase()}! Final Score: Blue ${blueScore} - ${redScore} Red (${roundResults.length} rounds).`
  );

  // Compute Aggregate Player Statistics
  const playerStats: Record<string, FpsPlayerMatchStats> = {};
  const allPlayers = [...bluePlayers, ...redPlayers];
  const totalRoundsPlayed = roundResults.length;

  for (const p of allPlayers) {
    const totalKills = p.kills;
    const adr = Math.round((p.damageDealt / Math.max(1, totalRoundsPlayed)) * 10) / 10;
    const headshotRate = totalKills ? Math.round((p.headshotKills ?? 0) / totalKills * 100) : 0;

    playerStats[p.playerId] = {
      playerId: p.playerId,
      name: p.name,
      team: p.team,
      kills: totalKills,
      deaths: p.deaths,
      assists: p.assists,
      damage: p.damageDealt,
      adr,
      headshotRate,
      plants: p.plants,
      defuses: p.defuses,
      firstBloods: p.firstBloods,
      tradeKills: p.tradeKills,
      clutchesWon: p.clutchesWon,
      setPiecesInvolved: p.setPiecesInvolved
    };
  }

  return {
    version: 1,
    personalityVersion: 1,
    simulationVersion: settings.identityExperiment ? 3 : 2,
    ...(initialIdentity ? {identityExperiment: initialIdentity, identityDevelopment: structuredClone(settings.identityExperiment!)} : {}),
    format: 'MR15_TACTICAL_FPS',
    seed,
    mapId: map.id,
    mapName: map.name,
    totalRounds: totalRoundsPlayed,
    winnerTeam,
    finalScore: { blue: blueScore, red: redScore },
    halfScore: firstHalfScore,
    secondHalfScore,
    overtimeScore,
    roundResults,
    roundSnapshots,
    playerStats,
    events
  };
}
