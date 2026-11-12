import type { FpsMap, FpsMatchEvent, FpsMatchSettings, FpsPlayerState, FpsRoundEndReason, FpsSide, FpsWeaponId, SetPieceCall } from './fpsTypes.ts';
import type { SetPieceResolution } from './fpsSetPieceRules.ts';
import { getWeaponDef } from './fpsWeapons.ts';
import { shouldSaveFpsRetake } from './fpsPersonality.ts';
import { evaluatePlayerAction, resolveTacticalExecution, type FpsSpecialtyOpportunity, type PersonalityTrigger } from './fpsIdentity.ts';
import {observedPersonalityTriggers} from './fpsIdentityMatch.ts';

/** Shortest legal route on the authored map. No movement can cross a missing edge. */
export function findFpsRoute(map: FpsMap, from: string, to: string): string[] {
  if (!map.zones[from] || !map.zones[to]) return [];
  const costs = new Map([[from, 0]]), paths = new Map([[from, [from]]]), visited = new Set<string>();
  while (visited.size < Object.keys(map.zones).length) {
    const next = [...costs].filter(([id]) => !visited.has(id)).sort((a,b) => a[1]-b[1] || a[0].localeCompare(b[0]))[0];
    if (!next) break;
    const [id, cost] = next;
    if (id === to) return paths.get(id)!;
    visited.add(id);
    for (const neighbor of map.zones[id].connectedZones) {
      const edge = map.rotationTimes[id]?.[neighbor] ?? 3;
      if (map.zones[neighbor] && cost + edge < (costs.get(neighbor) ?? Infinity)) {
        costs.set(neighbor, cost + edge); paths.set(neighbor, [...paths.get(id)!, neighbor]);
      }
    }
  }
  return [];
}

export function simulateFpsRound(call: SetPieceCall, attackers: FpsPlayerState[], defenders: FpsPlayerState[], map: FpsMap,
  roundNumber: number, tickOffset: number, secondOffset: number, random: () => number, settings: FpsMatchSettings = {}): SetPieceResolution {
  const roundLimit = settings.roundSeconds ?? 115, bombLimit = settings.bombSeconds ?? 40;
  const players = [...attackers, ...defenders], events: FpsMatchEvent[] = [];
  for (const p of players) if (!map.zones[p.currentZone]) p.currentZone = p.side === 'attackers' ? map.attackerSpawnZone : map.defenderSpawnZone;
  const living = (team: FpsPlayerState[]) => team.filter(p => p.isAlive);
  const eligibleRetake=(def:FpsPlayerState[],atk:FpsPlayerState[])=>def.length<=2&&atk.length-def.length>=2;
  const siteZones = call.targetSite === 'A' ? map.siteAZones : map.siteBZones;
  const site = siteZones[0];
  const otherSite = (call.targetSite === 'A' ? map.siteBZones : map.siteAZones)[0];
  const cooldown = new Map<string, number>(), travel = new Map<string, number>(), blind = new Map<string, number>();
  const flashSource = new Map<string, string>();
  const enteredZoneAt = new Map(players.map(p=>[p.playerId,0]));
  const lastSniperShot = new Map<string,number>();
  const contactDecisions = new Map<string, {until:number; advance:boolean;action?:string;waypoint?:string}>();
  const lastContact=new Map<string,number>();
  const rotations=new Map<string,{time:number;from:string;to:string;observedBy:Set<string>}>();
  const vacated=new Map<string,{time:number;observedBy:Set<string>}>();
  const droppedWeapons=new Map<string,FpsWeaponId[]>();
  const smoke = new Map<string, number>(), fire = new Map<string, { until: number; owner: FpsPlayerState }>();
  const contributions = new Map<string, Map<string, number>>();
  const recentKills: { killer: string; victim: string; team: string; time: number }[] = [];
  const clutchCandidates = new Set<string>();
  let t = 0, plantedAt: number | undefined, planterId: string | undefined, defuserPlayerId: string | undefined;
  let plantProgress = 0, defuseProgress = 0, plantingId: string | undefined, defusingId: string | undefined;
  let droppedZone: string | undefined, devicePlanted = false, defused = false, saving = false, saveConsidered = false;
  let firstKill = true, entryDuelWon = false, tradeSuccess = false, utilityUsed = 0;
  let reason: FpsRoundEndReason = 'time_expired', winnerSide: FpsSide = 'defenders';
  const emit = (type: FpsMatchEvent['type'], text: string, extra: Partial<FpsMatchEvent> = {}) => {
    const second = Math.round((secondOffset + t) * 10) / 10;
    events.push({ type, text, second, tick: Math.max(tickOffset + Math.round(t*30), (events.at(-1)?.tick ?? tickOffset) + 1), roundNumber, ...extra });
  };
  const visible = (a: FpsPlayerState, b: FpsPlayerState) => a.currentZone === b.currentZone ||
    (map.zones[a.currentZone]?.connectedZones.includes(b.currentZone) && (smoke.get(a.currentZone) ?? 0) <= t && (smoke.get(b.currentZone) ?? 0) <= t);
  const damage = (shooter: FpsPlayerState | undefined, target: FpsPlayerState, amount: number, weaponId?: FpsWeaponId, headshot = false) => {
    if (!target.isAlive) return;
    const dealt = Math.min(target.hp, Math.max(0, Math.round(amount)));
    target.hp -= dealt;
    if (shooter) {
      shooter.damageDealt += dealt;
      const ledger = contributions.get(target.playerId) ?? new Map<string, number>();
      ledger.set(shooter.playerId, (ledger.get(shooter.playerId) ?? 0) + dealt); contributions.set(target.playerId, ledger);
    }
    if (defusingId === target.playerId) { defuseProgress = 0; defusingId = undefined; }
    if (plantingId === target.playerId) { plantProgress = 0; plantingId = undefined; }
    emit('damage', `${shooter?.name ?? 'Device blast'} dealt ${dealt} damage to ${target.name}.`, {
      actorId: shooter?.playerId, actorName: shooter?.name, targetId: target.playerId, targetName: target.name,
      zone: target.currentZone, weaponId, damage: dealt, targetHp: target.hp, targetArmor: target.loadout.armor,
    });
    if (target.hp > 0) return;
    target.isAlive = false; target.deaths++;
    if(settings.identityExperiment && target.loadout.primaryWeapon) {
      droppedWeapons.set(target.currentZone,[...(droppedWeapons.get(target.currentZone)??[]),target.loadout.primaryWeapon]);
      target.loadout.primaryWeapon=undefined;
    }
    if (target.loadout.hasBomb) { target.loadout.hasBomb = false; droppedZone = target.currentZone;
      emit('bomb_dropped', `${target.name} dropped the device.`, { targetId: target.playerId, zone: target.currentZone }); }
    if (shooter) {
      shooter.kills++;
      shooter.cash = Math.min(16000, shooter.cash + (weaponId ? getWeaponDef(weaponId).killReward : 0));
      if (headshot) shooter.headshotKills = (shooter.headshotKills ?? 0) + 1;
      if (firstKill) { shooter.firstBloods++; firstKill = false; }
      const trade = recentKills.some(k => k.killer === target.playerId && k.team === shooter.team && t-k.time <= 1.5);
      if (trade) { shooter.tradeKills++; tradeSuccess = true; }
      for (const [id, contribution] of contributions.get(target.playerId) ?? []) {
        const assister = players.find(p => p.playerId === id);
        if (id !== shooter.playerId && contribution >= 20 && assister) assister.assists++;
      }
      recentKills.push({ killer: shooter.playerId, victim: target.playerId, team: target.team, time: t });
      if (shooter.playerId === call.entryFraggerId) entryDuelWon = true;
      emit(trade ? 'trade_kill' : 'kill', `${shooter.name} eliminated ${target.name}${headshot ? ' (HEADSHOT)' : ''}.`, {
        actorId: shooter.playerId, actorName: shooter.name, targetId: target.playerId, targetName: target.name,
        zone: target.currentZone, weaponId, isHeadshot: headshot,
      });
    } else emit('player_eliminated', `${target.name} was eliminated by the device blast.`, { targetId: target.playerId, targetName: target.name, zone: target.currentZone });
  };
  const move = (p: FpsPlayerState, destination: string) => {
    if (p.currentZone === destination) return;
    const route = findFpsRoute(map, p.currentZone, destination);
    if (route.length < 2) return;
    const next = route[1], seconds = map.rotationTimes[p.currentZone]?.[next] ?? 3;
    const moveOpportunities=new Set<FpsSpecialtyOpportunity>();
    if (p.loadout.primaryWeapon==='rifle_sniper' && t-(lastSniperShot.get(p.playerId) ?? -100)<=5) moveOpportunities.add('exposedSniperRelocation');
    const opponents=living(p.side==='attackers'?defenders:attackers), allies=living(p.side==='attackers'?attackers:defenders);
    const nextExposed=opponents.some(enemy=>enemy.currentZone===next || (map.zones[next].connectedZones.includes(enemy.currentZone) && (smoke.get(next) ?? 0)<=t && (smoke.get(enemy.currentZone) ?? 0)<=t));
    if (p.side==='attackers' && !nextExposed && !opponents.some(enemy=>visible(p,enemy)) && opponents.some(enemy=>allies.some(ally=>ally!==p && visible(ally,enemy)))) moveOpportunities.add('infiltrationWindow');
    const gap=vacated.get(next);
    if(gap && t-gap.time<=4 && gap.observedBy.has(p.team) && !nextExposed)moveOpportunities.add('coverageGap');
    const knownRotation=[...rotations.values()].some(rotation=>t-rotation.time<=5 && rotation.observedBy.has(p.team));
    if(p.tactics?.isCaller && knownRotation)moveOpportunities.add('knownRotation');
    if(p.tactics?.isCaller && contactDecisions.get(p.playerId)?.action==='improvise' && !living(attackers).some(ally=>ally.playerId===call.entryFraggerId) && map.zones[p.currentZone].connectedZones.length>=2)moveOpportunities.add('compromisedPlan');
    if(p.tactics?.isCaller && call.strategy==='fake_execute' && living(attackers).some(ally=>ally.currentZone===otherSite) && living(attackers).some(ally=>ally.currentZone===site || ally.currentZone===call.entryChokeZone))moveOpportunities.add('supportedDoubleFake');
    const activation=resolveTacticalExecution(settings.identityExperiment?.players[p.playerId]?.specialty,moveOpportunities,settings.identityExperiment?.players[p.playerId]?.specialtyProficiency ?? .5);
    if (activation?.active && (travel.get(p.playerId) ?? 0)===0) emit('specialty_activated',`${p.name} used ${settings.identityExperiment!.players[p.playerId].specialty!.name} while moving.`,{actorId:p.playerId,actorName:p.name,zone:next,specialtyId:activation.specialtyId,executionBonus:activation.executionBonus});
    const progress = (travel.get(p.playerId) ?? 0) + .5;
    // Movement is sampled at half-second steps. Convert a small speed advantage
    // into a bounded chance of arriving one step earlier, preserving its mean size.
    const early=progress<seconds && progress+.5>=seconds && (activation?.executionBonus ?? 0)>0 && random()<Math.min(1,seconds*activation!.executionBonus/.5);
    if (progress < seconds && !early) { travel.set(p.playerId, progress); return; }
    travel.set(p.playerId, 0);
    const fromZone = p.currentZone;
    const observedBy=new Set(players.filter(observer=>observer.isAlive && observer.team!==p.team && visible(observer,p)).map(observer=>observer.team));
    p.currentZone = next; enteredZoneAt.set(p.playerId,t);
    for(const observer of players)if(observer.isAlive && observer.team!==p.team && visible(observer,p))observedBy.add(observer.team);
    if(p.side==='defenders') {
      vacated.set(fromZone,{time:t,observedBy});
      if(map.zones[fromZone].isSiteArea && destination!==fromZone)rotations.set(p.playerId,{time:t,from:fromZone,to:next,observedBy});
    }
    emit('player_moved', `${p.name} moved to ${map.zones[next].name}.`, { actorId: p.playerId, actorName: p.name, zone: next, fromZone });
  };
  const caller = attackers.find(p => p.playerId === call.callerId);
  emit('set_piece_call', `${caller?.name ?? 'Attackers'} called ${call.strategy.replaceAll('_',' ')} at site ${call.targetSite}. ${call.decisionReason ?? ''}`, { actorId: caller?.playerId, actorName: caller?.name, site: call.targetSite });
  players.forEach(p => { p.setPiecesInvolved++; });
  // Defenders use the prep window to establish two anchors per site and a reserve.
  const otherChoke=map.chokeZones.find(zone=>zone!==call.entryChokeZone)??call.entryChokeZone;
  const defensivePosts = new Map(defenders.map((p,i) => [p.playerId, settings.identityExperiment&&p.tactics?.role==='lurker'?otherChoke:i < 2 ? site : i < 4 ? otherSite : map.defenderSpawnZone]));
  const fakePlayers=new Set(attackers.filter(p=>!p.loadout.hasBomb && p.playerId!==call.callerId).slice(-2).map(p=>p.playerId));
  const fakeTravel=findFpsRoute(map,map.attackerSpawnZone,otherSite).reduce((sum,zone,index,route)=>index?sum+(map.rotationTimes[route[index-1]]?.[zone]??3):0,0);
  const setupTime = settings.identityExperiment ? 0 : call.strategy === 'fast_rush' ? 0 : call.strategy === 'default_probe' ? 15 : call.strategy === 'fake_execute' ? 10 : 5;
  for (t = 0; t <= roundLimit + bombLimit + 1; t += .5) {
    const atk = living(attackers), def = living(defenders);
    for (const team of [atk,def]) if (team.length === 1 && (team === atk ? def : atk).length >= 2) clutchCandidates.add(team[0].playerId);
    if (!def.length) { reason = 'defenders_eliminated'; winnerSide = 'attackers'; break; }
    if (!atk.length && !devicePlanted) { reason = 'attackers_eliminated'; break; }
    if (devicePlanted && t >= plantedAt! + bombLimit) {
      reason = 'device_exploded'; winnerSide = 'attackers';
      emit('device_exploded', `Device detonated at site ${call.targetSite}.`, { site: call.targetSite, zone: site });
      for (const p of living(players)) if (siteZones.includes(p.currentZone)) damage(undefined, p, 100);
      break;
    }
    if (!devicePlanted && t >= roundLimit) { reason = 'time_expired'; break; }
    if (devicePlanted && !saving) {
      const eligible=def.length>0 && def.length<=2 && atk.length-def.length>=2 && def.some(p=>p.loadout.primaryWeapon);
      if (!settings.identityExperiment && shouldSaveFpsRetake(def,atk)) saving=true;
      else if (settings.identityExperiment && eligible && !saveConsidered) {
        saveConsidered=true;
        const leader=def.find(p=>p.tactics?.isCaller) ?? def[0], identity=settings.identityExperiment.players[leader.playerId], environment=settings.identityExperiment.teams[leader.team];
        if (identity && environment) {
          const decision=evaluatePlayerAction(identity,{triggers:new Set(['poorRetake']),opportunities:new Set(),teamIdentity:environment.culture,confidence:(leader.psychology?.confidence ?? 50)/100,fatigue:0},environment.coach,environment.plan,environment.chemistry,[
            {action:'save',legal:true,tacticalValue:.5,instruction:environment.plan.economy*2-1},
            {action:'react',legal:true,tacticalValue:.4,instruction:1-environment.plan.economy*2},
          ],random);
          saving=decision.action==='save';
          emit('tactical_decision',`${leader.name} called ${saving?'a save':'a retake'} in a ${def.length}v${atk.length}.`,{actorId:leader.playerId,actorName:leader.name,site:call.targetSite,decision});
        }
      }
      if (saving) emit('save_equipment', `Defenders called an equipment save in a ${def.length}v${atk.length}.`, { site: call.targetSite });
    }
    for (const p of living(players)) {
      const enemies = p.side === 'attackers' ? living(defenders) : living(attackers);
      const contact = enemies.some(e => visible(p,e));
      if(contact)lastContact.set(p.playerId,t);
      if (p.side === 'attackers') {
        let target = devicePlanted ? (siteZones.includes(p.currentZone) ? p.currentZone : site) : droppedZone ??
          (call.strategy === 'fake_execute' && t < setupTime ? otherSite : t < setupTime ? call.entryChokeZone : site);
        if(settings.identityExperiment && !devicePlanted && !droppedZone) {
          const knownRotation=p.tactics?.role==='lurker'
            ?[...rotations.values()].find(item=>t-item.time<=5&&item.observedBy.has(p.team))
            :undefined;
          if(siteZones.includes(p.currentZone))target=p.currentZone;
          else if(knownRotation&&!p.loadout.hasBomb)target=knownRotation.to;
          else if(!p.loadout.hasBomb && siteZones.length>1) {
            const preferred=siteZones[attackers.indexOf(p)%siteZones.length];
            target=siteZones.map((zone,index)=>({
              zone,
              score:living(attackers).filter(ally=>ally!==p&&ally.currentZone===zone).length*4
                +findFpsRoute(map,p.currentZone,zone).length
                +(zone===preferred?0:.35),
            })).sort((a,b)=>a.score-b.score||a.zone.localeCompare(b.zone))[0].zone;
          } else target=site;
        }
        if(!settings.identityExperiment) {if (!contact || (smoke.get(p.currentZone) ?? 0) > t) move(p, target);}
        else if ((!devicePlanted || p.tactics?.role==='lurker') && (p.currentZone!==target || (contact && p.tactics?.isCaller && !p.loadout.hasBomb && !living(attackers).some(ally=>ally.playerId===call.entryFraggerId))) && p.playerId!==plantingId) {
          const identity=settings.identityExperiment?.players[p.playerId], environment=settings.identityExperiment?.teams[p.team];
          if (identity && environment) {
            let choice=contactDecisions.get(p.playerId);
            if (!choice || t>=choice.until) {
              const visibleEnemies=enemies.filter(e=>visible(p,e));
              const supported=living(attackers).some(ally=>ally!==p && ally.currentZone===p.currentZone);
              const compromised=!living(attackers).some(ally=>ally.playerId===call.entryFraggerId);
              const triggers=observedPersonalityTriggers({round:roundNumber,elapsed:t,quietSeconds:t-(lastContact.get(p.playerId)??0),allies:living(attackers).length,enemies:visibleEnemies.length,winStreak:p.psychology?.winStreak??0,lossStreak:p.psychology?.lossStreak??0,earlyDeath:p.lastRoundEarlyDeath,advantage:visibleEnemies.some(e=>(blind.get(e.playerId)??0)>t),disrupted:visibleEnemies.some(e=>(blind.get(e.playerId)??0)>t),prepared:t>=setupTime,planCompromised:compromised,callerAlive:living(attackers).some(ally=>ally.tactics?.isCaller),allyContact:supported&&contact});
              const urgent=p.loadout.hasBomb && roundLimit-t<20;
              const freedom=identity.instruction==='initiative'?1:environment.plan.freedom;
              const decision=evaluatePlayerAction(identity,{triggers,opportunities:new Set(),teamIdentity:environment.culture,confidence:(p.psychology?.confidence ?? 50)/100,fatigue:0},environment.coach,environment.plan,environment.chemistry,[
                {action:'pressure',legal:true,tacticalValue:urgent?2:supported ? .65 : .35,instruction:environment.plan.aggression*2-1},
                {action:'coordinate',legal:!urgent,tacticalValue:supported ? .5 : .4,instruction:identity.instruction==='support'?1:environment.plan.structure*2-1},
                {action:'react',legal:!urgent&&contact,tacticalValue:.45,instruction:identity.instruction==='hold'?1:1-environment.plan.tempo*2},
                {action:'prepare',legal:!urgent,tacticalValue:.25,instruction:environment.plan.preparation*2-1},
                {action:'probe',legal:!contact,tacticalValue:.6+(p.card.stats.iq/100)*.3,instruction:1-environment.plan.tempo*2},
                {action:'improvise',legal:!p.loadout.hasBomb && compromised && map.zones[p.currentZone].connectedZones.length>=2,tacticalValue:.5,instruction:freedom*2-1},
              ],random);
              const direct=findFpsRoute(map,p.currentZone,target)[1];
              choice={until:t+4,advance:!contact||['pressure','probe','improvise'].includes(decision.action),action:decision.action,waypoint:decision.action==='improvise'?map.zones[p.currentZone].connectedZones.filter(zone=>zone!==direct && findFpsRoute(map,zone,target).length>0).sort()[0]:undefined}; contactDecisions.set(p.playerId,choice);
              emit('tactical_decision',`${p.name} chose ${decision.action}${decision.triggers.length?' with '+identity.personality.name+' active':''}.`,{actorId:p.playerId,actorName:p.name,zone:p.currentZone,decision});
            }
            if(choice.action==='coordinate') {const entry=living(attackers).find(ally=>ally.playerId===call.entryFraggerId);if(entry && entry!==p && !contact)move(p,entry.currentZone);}
            if(choice.waypoint===p.currentZone)choice.waypoint=undefined;
            if(choice.waypoint)target=choice.waypoint;
            if (choice.advance) move(p,target);
          }
        } else if(!contact && p.playerId!==plantingId)move(p,target);
      } else {
        const knownSite = devicePlanted || attackers.some(a => a.isAlive && siteZones.includes(a.currentZone) && def.some(d => visible(d,a)));
        let destination=saving ? map.defenderSpawnZone : knownSite ? site : defensivePosts.get(p.playerId)!;
        if(settings.identityExperiment && knownSite && !saving && !contact && p.currentZone!==site && p.playerId!==defusingId) {
          const identity=settings.identityExperiment.players[p.playerId],environment=settings.identityExperiment.teams[p.team];
          let choice=contactDecisions.get(p.playerId);
          if(!choice || t>=choice.until) {
            const route=findFpsRoute(map,p.currentZone,site);
            const travelTime=route.reduce((sum,zone,index)=>index?sum+(map.rotationTimes[route[index-1]]?.[zone]??3):0,0);
            const urgent=devicePlanted && plantedAt!+bombLimit-t<=travelTime+(p.loadout.hasDefuseKit?5:10)+4;
            const triggers=observedPersonalityTriggers({round:roundNumber,elapsed:t,quietSeconds:t-(lastContact.get(p.playerId)??0),allies:def.length,enemies:atk.length,winStreak:p.psychology?.winStreak??0,lossStreak:p.psychology?.lossStreak??0,earlyDeath:p.lastRoundEarlyDeath,planCompromised:true,callerAlive:def.some(ally=>ally.tactics?.isCaller),poorRetake:eligibleRetake(def,atk),prepared:false});
            const decision=evaluatePlayerAction(identity,{triggers,opportunities:new Set(),confidence:(p.psychology?.confidence??50)/100,fatigue:0,teamIdentity:environment.culture},environment.coach,environment.plan,environment.chemistry,[{action:'coordinate',legal:true,tacticalValue:.8,instruction:environment.plan.structure},{action:'react',legal:!urgent,tacticalValue:.3,instruction:1-environment.plan.tempo},{action:'pressure',legal:true,tacticalValue:.6,instruction:environment.plan.aggression}],random);
            choice={until:t+4,advance:decision.action!=='react',action:decision.action};contactDecisions.set(p.playerId,choice);
            emit('tactical_decision',`${p.name} chose ${decision.action} during the rotation.`,{actorId:p.playerId,actorName:p.name,zone:p.currentZone,decision});
          }
          if(!choice.advance)destination=p.currentZone;
        }
        if (!contact || saving) move(p,destination);
      }
      const flame = fire.get(p.currentZone);
      if (flame && flame.until > t && flame.owner.team !== p.team) damage(flame.owner, p, 6, 'utility_molotov');
      if(settings.identityExperiment && p.isAlive && !p.loadout.primaryWeapon && !contact && !p.loadout.hasBomb && p.playerId!==defusingId) {
        const gear=droppedWeapons.get(p.currentZone);
        if(gear?.length) {
          const identity=settings.identityExperiment.players[p.playerId], environment=settings.identityExperiment.teams[p.team];
          const decision=evaluatePlayerAction(identity,{triggers:new Set(['recoverableGear']),opportunities:new Set(),confidence:.5,fatigue:0},environment.coach,environment.plan,environment.chemistry,[{action:'save',legal:true,tacticalValue:1,instruction:environment.plan.economy},{action:'react',legal:true,tacticalValue:0,instruction:0}],random);
          if(decision.action==='save') {p.loadout.primaryWeapon=gear.shift();emit('weapon_recovered',`${p.name} recovered a dropped weapon.`,{actorId:p.playerId,actorName:p.name,weaponId:p.loadout.primaryWeapon,zone:p.currentZone,decision});}
        }
      }
    }
    const carrier = living(attackers).find(p => p.loadout.hasBomb);
    if (!devicePlanted && !carrier && droppedZone) {
      const pickup = living(attackers).find(p => p.currentZone === droppedZone);
      if (pickup) { pickup.loadout.hasBomb = true; droppedZone = undefined; emit('bomb_picked_up', `${pickup.name} recovered the device.`, { actorId: pickup.playerId, zone: pickup.currentZone }); }
    }
    // Deterministic initiative ordering; every kill comes from a real hit and HP depletion.
    const initiative = living(players).map(p => ({ p, roll: random() })).sort((a,b) => b.roll-a.roll);
    for (const {p} of initiative) {
      if (!p.isAlive || (cooldown.get(p.playerId) ?? 0) > t || (saving && p.side === 'defenders')) continue;
      const enemies = living(p.side === 'attackers' ? defenders : attackers).filter(e => visible(p,e));
      const target = enemies.sort((a,b) => (a.currentZone === p.currentZone ? -1 : 0)-(b.currentZone === p.currentZone ? -1 : 0) || a.hp-b.hp)[0];
      if (!target) continue;
      if (p.playerId === plantingId || p.playerId === defusingId) continue;
      const grenade = p.loadout.utilities[0];
      if (grenade) {
        p.loadout.utilities.shift(); utilityUsed++;
        const utilityOpportunities=new Set<FpsSpecialtyOpportunity>();
        if (grenade==='utility_smoke' && p.currentZone!==target.currentZone && map.zones[p.currentZone].connectedZones.includes(target.currentZone)) utilityOpportunities.add('smokeCoverage');
        if (grenade==='utility_flash' && p.side==='attackers' && living(attackers).some(ally=>ally.playerId===call.entryFraggerId && ally!==p && ally.currentZone===p.currentZone && visible(ally,target))) utilityOpportunities.add('coordinatedFlash');
        if (devicePlanted && p.side==='defenders' && siteZones.includes(target.currentZone)) utilityOpportunities.add('retakeUtility');
        if (p.side==='defenders' && siteZones.includes(p.currentZone) && siteZones.includes(target.currentZone) && grenade==='utility_molotov') utilityOpportunities.add('siteDelay');
        const utilityActivation=resolveTacticalExecution(settings.identityExperiment?.players[p.playerId]?.specialty,utilityOpportunities,settings.identityExperiment?.players[p.playerId]?.specialtyProficiency ?? .5);
        const utilityFactor=1+(utilityActivation?.executionBonus ?? 0);
        if (utilityActivation?.active) emit('specialty_activated',`${p.name} used ${settings.identityExperiment!.players[p.playerId].specialty!.name} with deployed utility.`,{actorId:p.playerId,actorName:p.name,zone:target.currentZone,specialtyId:utilityActivation.specialtyId,executionBonus:utilityActivation.executionBonus});
        emit('utility_deployed', `${p.name} deployed ${getWeaponDef(grenade).name}.`, { actorId: p.playerId, actorName: p.name, weaponId: grenade, zone: target.currentZone, site: call.targetSite });
        if (grenade === 'utility_smoke') smoke.set(target.currentZone, t+15*utilityFactor);
        if (grenade === 'utility_flash') for (const e of enemies) { blind.set(e.playerId,t+2*utilityFactor); flashSource.set(e.playerId,p.playerId); }
        if (grenade === 'utility_he') for (const e of enemies.filter(e => e.currentZone === target.currentZone)) damage(p,e,35*utilityFactor,grenade);
        if (grenade === 'utility_molotov') fire.set(target.currentZone,{until:t+7*utilityFactor,owner:p});
        cooldown.set(p.playerId,t+1); continue;
      }
      const weaponId = p.loadout.primaryWeapon ?? p.loadout.secondaryWeapon, weapon = getWeaponDef(weaponId);
      const distance = map.zones[target.currentZone].engagementDistance;
      const cover = map.zones[target.currentZone].coverQuality;
      const fatigue = Math.max(.8, 1-Math.max(0,roundNumber-15)*(.0015+(100-p.card.stats.sta)*.000025));
      const flex = weapon.category === 'sidearm' || weapon.category === 'smg' ? .85+p.card.stats.flx*.0015 : 1;
      const opportunities = new Set<FpsSpecialtyOpportunity>();
      // These facts come from live events and positions, not from the specialty badge.
      if ((blind.get(target.playerId) ?? 0)>t && flashSource.has(target.playerId) && flashSource.get(target.playerId)!==p.playerId && players.some(ally=>ally.playerId===flashSource.get(target.playerId) && ally.team===p.team)) opportunities.add('allyFlashWindow');
      if (recentKills.some(k=>k.killer===target.playerId && k.team===p.team && t-k.time<=1.5)) opportunities.add('immediateTrade');
      const allies=living(p.side==='attackers'?attackers:defenders).filter(ally=>ally!==p);
      const prepared=(t-(enteredZoneAt.get(p.playerId) ?? 0))>=3;
      const targetPrepared=(t-(enteredZoneAt.get(target.playerId) ?? 0))>=3;
      if (firstKill && p.side==='attackers' && target.side==='defenders' && targetPrepared && siteZones.includes(target.currentZone) && allies.some(ally=>ally.currentZone===p.currentZone)) opportunities.add('coordinatedBreach');
      if (weapon.category==='sniper' && distance==='long' && prepared) {
        opportunities.add('preparedLongAngle');
        if (t<=30 && firstKill) opportunities.add('openingSightline');
      }
      if (p.side==='attackers' && p.playerId!==call.entryFraggerId && allies.some(ally=>ally.playerId===call.entryFraggerId && ally.currentZone===p.currentZone && visible(ally,target))) opportunities.add('entryFollowup');
      if (p.side==='defenders' && allies.some(ally=>ally.currentZone!==p.currentZone && visible(ally,target))) opportunities.add('defensiveCrossfire');
      if (p.side==='attackers' && allies.some(ally=>visible(ally,target)) && enemies.some(enemy=>enemy!==target && enemy.currentZone!==target.currentZone && visible(p,enemy))) opportunities.add('breakCrossfire');
      if (p.side==='defenders' && siteZones.includes(p.currentZone) && siteZones.includes(target.currentZone) && !living(defenders).some(ally=>ally!==p && ally.currentZone===p.currentZone)) opportunities.add('isolatedSiteHold');
      const rotation=rotations.get(target.playerId);
      if(rotation && t-rotation.time<=5 && rotation.observedBy.has(p.team) && [rotation.from,rotation.to].includes(p.currentZone))opportunities.add('interceptableRotation');
      const assignedFlank=p.side==='attackers'&&devicePlanted?call.entryChokeZone:otherChoke;
      if((p.tactics?.role==='lurker'||settings.identityExperiment?.players[p.playerId]?.instruction==='hold') && p.currentZone===assignedFlank && allies.some(ally=>siteZones.includes(ally.currentZone)) && !siteZones.includes(target.currentZone))opportunities.add('assignedFlankCoverage');
      const activation=resolveTacticalExecution(settings.identityExperiment?.players[p.playerId]?.specialty,opportunities,settings.identityExperiment?.players[p.playerId]?.specialtyProficiency ?? .5);
      const specialtyBonus=activation?.executionBonus ?? 0;
      const accuracy = Math.max(.08, Math.min(.94, weapon.accuracy*(.45+p.card.stats.lan/150)*(1-cover*.25)*fatigue*flex*((blind.get(p.playerId) ?? 0)>t ? .25 : 1)+specialtyBonus));
      if (activation?.active) emit('specialty_activated', `${p.name} used ${settings.identityExperiment!.players[p.playerId].specialty!.name} in a qualifying engagement.`, {actorId:p.playerId,actorName:p.name,targetId:target.playerId,zone:p.currentZone,specialtyId:activation.specialtyId,executionBonus:specialtyBonus});
      emit('duel_engagement', `${p.name} engaged ${target.name}.`, { actorId: p.playerId, actorName: p.name, targetId: target.playerId, targetName: target.name, zone: target.currentZone, weaponId });
      cooldown.set(p.playerId,t+(weapon.category === 'sniper' ? 2 : 1));
      if (weapon.category==='sniper') lastSniperShot.set(p.playerId,t);
      if (random() > accuracy) continue;
      const headshot = random() < .08+p.card.stats.lan*.003;
      let amount = weapon.baseDamage*(headshot ? weapon.headshotMultiplier : 1);
      if (distance === 'long' && weapon.range === 'close') amount *= .65;
      if (distance === 'close' && weapon.range === 'close') amount *= 1.25;
      if (target.loadout.armor > 0 && (!headshot || target.loadout.hasHelmet)) {
        amount *= 1-(1-weapon.armorPenetration)*.5;
        target.loadout.armor = Math.max(0, target.loadout.armor-Math.round(amount*.3));
      }
      damage(p,target,amount,weaponId,headshot);
    }
    if (!devicePlanted) {
      const planter = living(attackers).find(p => p.loadout.hasBomb && siteZones.includes(p.currentZone));
      if (planter && !living(defenders).some(p => p.currentZone === planter.currentZone)) {
        if (plantingId !== planter.playerId) { plantingId = planter.playerId; plantProgress = 0; emit('plant_started', `${planter.name} began planting.`, { actorId: planter.playerId, actorName: planter.name, site: call.targetSite, zone: planter.currentZone }); }
        else plantProgress += .5;
        if (plantProgress >= 3.5) {
          devicePlanted = true; plantedAt = t; planterId = planter.playerId; planter.plants++; planter.loadout.hasBomb = false; plantingId = undefined;
          emit('plant_completed', `${planter.name} planted the device.`, { actorId: planter.playerId, actorName: planter.name, site: call.targetSite, zone: planter.currentZone });
          emit('retake_initiated', 'Defenders rotate to the planted device.', { site: call.targetSite, zone: site });
        }
      } else { plantProgress = 0; plantingId = undefined; }
    } else if (!saving) {
      const defuser = living(defenders).filter(p => p.currentZone === site && !living(attackers).some(a => visible(p,a))).sort((a,b) => Number(b.loadout.hasDefuseKit)-Number(a.loadout.hasDefuseKit))[0];
      if (defuser) {
        if (defusingId !== defuser.playerId) { defusingId = defuser.playerId; defuseProgress = 0; emit('defuse_started', `${defuser.name} began a ${defuser.loadout.hasDefuseKit ? 5 : 10}s defuse.`, { actorId: defuser.playerId, actorName: defuser.name, site: call.targetSite, zone: site }); }
        else defuseProgress += .5;
        if (defuseProgress >= (defuser.loadout.hasDefuseKit ? 5 : 10)) {
          defused = true; defuserPlayerId = defuser.playerId; defuser.defuses++; reason = 'device_defused';
          emit('defuse_completed', `${defuser.name} defused the device.`, { actorId: defuser.playerId, actorName: defuser.name, site: call.targetSite, zone: site }); break;
        }
      } else { defusingId = undefined; defuseProgress = 0; }
    }
  }
  for (const p of living(winnerSide === 'attackers' ? attackers : defenders)) if (clutchCandidates.has(p.playerId)) p.clutchesWon++;
  return { call, events, siteSecured: devicePlanted, targetSite: call.targetSite, entryDuelWon, tradeSuccess,
    utilityEffectiveness: Math.min(1,utilityUsed*.15), devicePlanted, planterId, defused, defuserPlayerId,
    endReason: reason, winnerSide, durationSeconds: t };
}
