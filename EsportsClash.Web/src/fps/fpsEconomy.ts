import type { FpsPlayerState, FpsSide, FpsWeaponId } from './types.ts';
import { FPS_WEAPONS } from './weapons.ts';
import { getFpsPreferences } from './fpsPersonality.ts';
import {evaluatePlayerAction} from './fpsIdentity.ts';
import type {FpsIdentityExperiment} from './types.ts';

export const MAX_CASH = 16000;
export const STARTING_CASH = 800;
export const OVERTIME_STARTING_CASH = 10000;
export const ROUND_WIN_REWARD = 3250;
export const BOMB_PLANT_ATTACKER_BONUS = 300;

export const LOSS_BONUS_LADDER = [1400, 1900, 2400, 2900, 3400] as const;

export function getLossReward(consecutiveLosses: number): number {
  const index = Math.min(Math.max(consecutiveLosses, 0), LOSS_BONUS_LADDER.length - 1);
  return LOSS_BONUS_LADDER[index];
}

export type BuyCategory = 'full_buy' | 'force_buy' | 'eco_save';

export function determineTeamBuyDecision(
  teamPlayers: FpsPlayerState[],
  roundNumber: number,
  opponentScore: number,
  myScore: number
): BuyCategory {
  const avgCash = teamPlayers.reduce((sum, p) => sum + p.cash, 0) / teamPlayers.length;
  const conservation = teamPlayers.reduce((sum, p) => sum + (p.card ? getFpsPreferences(p.card, p.psychology).conservation : 0), 0) / teamPlayers.length;

  // Round 1 and Round 16 are pistol rounds (fixed $800)
  if (roundNumber === 1 || roundNumber === 16) {
    return 'force_buy'; // Pistol round buy
  }

  // Must force if opponent is at match point (15 or 15+ in overtime)
  if (opponentScore >= 15 && opponentScore > myScore) {
    return 'force_buy';
  }

  // Standard full buy threshold
  if (avgCash >= 4200) {
    return 'full_buy';
  }

  // Force buy threshold (e.g. moderate money)
  if (avgCash >= 2600 + conservation * 200 && avgCash < 4200) {
    return 'force_buy';
  }

  // Otherwise eco to prepare for full buy next round
  return 'eco_save';
}

export function executePlayerPurchases(
  player: FpsPlayerState,
  buyDecision: BuyCategory,
  roundNumber: number,
  isPistolRound: boolean,
  random: () => number,
  contextual = false,
  identityContext?: FpsIdentityExperiment,
  onDecision?:(decision:import('./fpsIdentity.ts').PlayerDecisionResult)=>void
): void {
  const preferences = contextual ? {aggression:0,coordination:0,patience:0,utility:0,conservation:0,leadership:0} : getFpsPreferences(player.card, player.psychology);
  // If player already survived with a primary weapon, keep it!
  const hasExistingPrimary = Boolean(player.loadout.primaryWeapon);
  const identity=identityContext?.players[player.playerId],environment=identityContext?.teams[player.team];
  if(identity && environment && buyDecision!=='eco_save') {
    const decision=evaluatePlayerAction(identity,{triggers:new Set(['rolePurchase',...(environment.plan.preparation>=.5?['utilityExecute' as const]:[])]),opportunities:new Set(),confidence:(player.psychology?.confidence??50)/100,fatigue:0},environment.coach,environment.plan,environment.chemistry,[
      {action:'invest',legal:player.loadout.utilities.length<3&&player.cash>=200,tacticalValue:player.tactics?.role==='support' ? .7 : .35,instruction:environment.plan.preparation},
      {action:'prepare',legal:true,tacticalValue:.55,instruction:environment.plan.structure},
      {action:'equip',legal:true,tacticalValue:.5,instruction:environment.plan.structure},
    ],random);
    onDecision?.(decision);
    if(decision.action==='equip' && !isPistolRound) {
      const role=player.tactics?.role;
      const weapon=role==='sniper'?'rifle_sniper':role==='entry'||role==='trade'?'rifle_assault':undefined;
      if(weapon && !player.loadout.primaryWeapon && player.cash>=FPS_WEAPONS[weapon].cost) {player.cash-=FPS_WEAPONS[weapon].cost;player.loadout.primaryWeapon=weapon;}
      if(role==='support'&&player.side==='defenders'&&!player.loadout.hasDefuseKit&&player.cash>=FPS_WEAPONS.gear_defuse_kit.cost){player.cash-=FPS_WEAPONS.gear_defuse_kit.cost;player.loadout.hasDefuseKit=true;}
    }
    if(decision.action==='invest')for(const grenade of ['utility_smoke','utility_flash'] as const) {
      if(player.loadout.utilities.length<3 && player.cash>=FPS_WEAPONS[grenade].cost && !player.loadout.utilities.includes(grenade)) {player.cash-=FPS_WEAPONS[grenade].cost;player.loadout.utilities.push(grenade);}
    }
  }

  if (isPistolRound) {
    // Starting pistol round ($800)
    // Options: Heavy Pistol ($700) OR Kevlar ($650) OR Utility + Standard Pistol
    const roll = random();
    if (roll < 0.45 && player.cash >= FPS_WEAPONS.gear_kevlar.cost) {
      player.cash -= FPS_WEAPONS.gear_kevlar.cost;
      player.loadout.armor = 100;
      player.loadout.hasHelmet = false;
    } else if (roll < 0.75 && player.cash >= FPS_WEAPONS.sidearm_heavy.cost) {
      player.cash -= FPS_WEAPONS.sidearm_heavy.cost;
      player.loadout.secondaryWeapon = 'sidearm_heavy';
    } else if (player.side === 'defenders' && roll < 0.90 && player.cash >= FPS_WEAPONS.gear_defuse_kit.cost) {
      player.cash -= FPS_WEAPONS.gear_defuse_kit.cost;
      player.loadout.hasDefuseKit = true;
      if (player.cash >= FPS_WEAPONS.utility_flash.cost) {
        player.cash -= FPS_WEAPONS.utility_flash.cost;
        player.loadout.utilities.push('utility_flash');
      }
    } else {
      // Buy smoke or flash
      if (player.cash >= FPS_WEAPONS.utility_smoke.cost) {
        player.cash -= FPS_WEAPONS.utility_smoke.cost;
        player.loadout.utilities.push('utility_smoke');
      }
      if (player.cash >= FPS_WEAPONS.utility_flash.cost) {
        player.cash -= FPS_WEAPONS.utility_flash.cost;
        player.loadout.utilities.push('utility_flash');
      }
    }
    return;
  }

  if (buyDecision === 'full_buy') {
    // Buy only missing gear; a retained helmet is not charged twice.
    if (player.loadout.armor < 100 && player.cash >= FPS_WEAPONS.gear_kevlar.cost) {
      player.cash -= FPS_WEAPONS.gear_kevlar.cost; player.loadout.armor = 100;
    }
    if (!player.loadout.hasHelmet && player.cash >= FPS_WEAPONS.gear_helmet.cost) {
      player.cash -= FPS_WEAPONS.gear_helmet.cost; player.loadout.hasHelmet = true;
    }

    // 2. Defuse kit for defenders (if not already owned)
    if (player.side === 'defenders' && !player.loadout.hasDefuseKit && player.cash >= FPS_WEAPONS.gear_defuse_kit.cost) {
      if (random() < 0.6 + preferences.utility * 0.15) {
        player.cash -= FPS_WEAPONS.gear_defuse_kit.cost;
        player.loadout.hasDefuseKit = true;
      }
    }

    // 3. Primary weapon (if not kept from prior round)
    if (!player.loadout.primaryWeapon) {
      // Weapon affinity uses FPS skills/preparation, independent of historical avatar roles.
      const wantsSniper = player.cash >= FPS_WEAPONS.rifle_sniper.cost + 800
        && (contextual ? player.tactics?.role==='sniper' : player.card.stats.lan >= 85 && player.card.stats.clu >= 75 && preferences.patience >= .25 && player.tactics?.role !== 'entry');
      if (wantsSniper && player.cash >= FPS_WEAPONS.rifle_sniper.cost) {
        player.cash -= FPS_WEAPONS.rifle_sniper.cost;
        player.loadout.primaryWeapon = 'rifle_sniper';
      } else if (player.cash >= FPS_WEAPONS.rifle_assault.cost) {
        player.cash -= FPS_WEAPONS.rifle_assault.cost;
        player.loadout.primaryWeapon = 'rifle_assault';
      } else if (player.cash >= FPS_WEAPONS.smg_tactical.cost) {
        player.cash -= FPS_WEAPONS.smg_tactical.cost;
        player.loadout.primaryWeapon = 'smg_tactical';
      }
    }

    // Three carried utility slots, including damaging and area-denial grenades.
    while (player.loadout.utilities.length < 3) {
      const smoke = !player.loadout.utilities.includes('utility_smoke');
      const flash = player.loadout.utilities.filter(u => u === 'utility_flash').length < 2;
      const options: FpsWeaponId[] = ['utility_he','utility_molotov'];
      if (smoke) options.unshift('utility_smoke');
      if (flash) options.unshift('utility_flash');
      const choice = smoke && preferences.utility >= .3 ? 'utility_smoke'
        : flash && preferences.aggression > .5 ? 'utility_flash'
        : options[Math.floor(random()*options.length)];
      if (player.cash < FPS_WEAPONS[choice].cost) break;
      player.cash -= FPS_WEAPONS[choice].cost; player.loadout.utilities.push(choice);
    }
    return;
  }

  if (buyDecision === 'force_buy') {
    // Buy Kevlar
    if (player.loadout.armor < 100 && player.cash >= FPS_WEAPONS.gear_kevlar.cost) {
      player.cash -= FPS_WEAPONS.gear_kevlar.cost;
      player.loadout.armor = 100;
    }

    // Buy SMG or Heavy Pistol
    if (!player.loadout.primaryWeapon) {
      if (player.cash >= FPS_WEAPONS.smg_tactical.cost) {
        player.cash -= FPS_WEAPONS.smg_tactical.cost;
        player.loadout.primaryWeapon = 'smg_tactical';
      } else if (player.cash >= FPS_WEAPONS.sidearm_heavy.cost) {
        player.cash -= FPS_WEAPONS.sidearm_heavy.cost;
        player.loadout.secondaryWeapon = 'sidearm_heavy';
      }
    }

    // Flashbang
    if (player.cash >= FPS_WEAPONS.utility_flash.cost && player.loadout.utilities.length < 2) {
      player.cash -= FPS_WEAPONS.utility_flash.cost;
      player.loadout.utilities.push('utility_flash');
    }
    return;
  }

  // eco_save: buy minimal or nothing
  if (buyDecision === 'eco_save') {
    // Only buy if player has surplus cash above $2,800
    if (player.cash > 2800 && player.loadout.secondaryWeapon === 'sidearm_standard' && player.cash >= FPS_WEAPONS.sidearm_heavy.cost) {
      player.cash -= FPS_WEAPONS.sidearm_heavy.cost;
      player.loadout.secondaryWeapon = 'sidearm_heavy';
    }
  }
}
