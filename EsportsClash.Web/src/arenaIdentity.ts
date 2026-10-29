import playbook from './data/arenaPlaybookV4.json' with {type:'json'};
import { PERSONALITY_IDS } from './playerPersonality.ts';
import type { ChampionKit, PlayerCard } from './types';

// Order is frozen in the hashed playbook, never dependent on draft/roster order.
export const ARENA_AVATAR_IDS=playbook.avatars.map(a=>a.id);
export const ARENA_IDENTITY_INPUTS=224;
export const arenaAvatarLesson=(id:string)=>playbook.avatars.find(a=>a.id===id);
export interface ArenaIdentityContext {
  avatarId:string;cardId:string;cardName:string;values:number[];
  cooldowns:number[];shield:number;kit:number[];traits:ReturnType<typeof arenaKitTraits>[];
}
/** Catalog facts, never advice about which action to choose. Unknown/new IDs
 * use exactly the same representation. Renaming an identical kit changes none. */
export function arenaKitTraits(skill:ChampionKit['skill1']){
  const text=skill.desc.toLowerCase();
  return {
    control:/stun|root|knock|pull|charm|silenc|fear|interrupt|snare|pin |slow/.test(text),
    protect:/shield|heal|cannot die|cannot fall|sanctuary|guard|untargetable/.test(text),
    mobility:/dash|blink|teleport|leap|jaunt|movement|recoil|propelling/.test(text),
    channel:/channel|spin for/.test(text),
  };
}
export function arenaKitFacts(c:ChampionKit):number[]{
  const roles=['Tank','Fighter','Assassin','Mage','Marksman','Support'];
  const facts=[c.hp/2000,c.ad/150,c.armor/100,c.mr/100,c.aspd/2,c.range/8,
    (roles.indexOf(c.primaryRole)+1)/6,(roles.indexOf(c.secondaryRole??'')+1)/6];
  for(const skill of [c.skill1,c.skill2,c.ultimate]){
    const traits=arenaKitTraits(skill);
    facts.push(skill.damage/600,skill.cooldown/120,skill.adRatio??0,skill.apRatio??0,
      +(skill.damageType==='Physical'),+(skill.damageType==='Magic'),+(skill.damageType==='True'),
      +traits.control,+traits.protect,+traits.mobility,+traits.channel,+(skill.targeting==='self'||skill.castType==='no_target'));
  }
  facts.push(1);
  return facts.map(v=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0);
}
export function arenaIdentity(champion:ChampionKit,player:PlayerCard,cooldowns:readonly number[],shield=0):ArenaIdentityContext {
  const v=Array(71).fill(0);
  // Four reproducible ID projections preserve identity across cosmetic aliases.
  // These are inputs only, never a stat bonus or a lookup of opponent secrets.
  for(let i=0;i<4;i++){
    let hash=(2166136261+i*1013904223)>>>0;
    for(const letter of player.id)hash=Math.imul(hash^letter.charCodeAt(0),16777619)>>>0;
    v[i]=hash/4294967295*2-1;
  }
  v[4]=player.stats.clu/100;v[5]=player.stats.flx/100;v[6]=player.morale/100;
  v[7]=player.fatigue/100;v[8]=player.ovr/100;
  v[9]=+player.signatureChampions.includes(champion.name);
  v[10]=+((player.preferredRole??player.role)===champion.primaryRole);
  const primary=PERSONALITY_IDS.indexOf(player.primaryPersonality!),secondary=PERSONALITY_IDS.indexOf(player.secondaryPersonality!);
  if(primary>=0)v[11+primary]=1;if(secondary>=0)v[41+secondary]=1;
  return {avatarId:champion.id,cardId:player.id,cardName:player.name,values:v,
    cooldowns:cooldowns.map(c=>Math.max(0,Math.min(1,c/120))),shield,kit:arenaKitFacts(champion),
    traits:[champion.skill1,champion.skill2,champion.ultimate].map(arenaKitTraits)};
}

export const arenaSkillTraits=(avatarId:string,slot:string)=>arenaAvatarLesson(avatarId)?.abilities.find(s=>s.slot===slot)?.tags;

export interface ArenaMasterySnapshot {damage:number;control:number;objectives:number;allies:number}
/** Small bounded potential. A real terminal always closes it to zero. */
export function arenaMasteryPotential(avatarId:string,s:ArenaMasterySnapshot):number {
  const weights=arenaAvatarLesson(avatarId)?.mastery_weights;
  if(!weights)return 0;
  const clamp=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
  return playbook.rewards.scale*(weights.damage*clamp(s.damage/12000)+weights.control*clamp(s.control/6000)
    +weights.objectives*clamp(s.objectives/12000)+weights.allies*clamp(s.allies/4));
}

/** Training/evidence bookkeeping only. No mutation of combat or policy scores. */
export class ArenaMasteryLedger {
  damage=new Map<string,number>();followup=new Map<string,number>();objectives=new Map<string,number>();
  controls=new Map<string,{actor:string;team:string;until:number}>();
  control(actor:string,team:string,target:string,second:number,duration:number){
    if(duration>0)this.controls.set(target,{actor,team,until:second+duration});
  }
  objective(actor:string,damage:number,hpBefore:number){
    if(!Number.isFinite(damage)||!Number.isFinite(hpBefore))return;
    const effective=Math.max(0,Math.min(damage,hpBefore));
    if(effective>0)this.objectives.set(actor,(this.objectives.get(actor)??0)+effective);
  }
  hit(actor:string,team:string,target:string,healthLost:number,second:number,stillControlled=true){
    if(!(healthLost>0)||!Number.isFinite(healthLost))return;
    this.damage.set(actor,(this.damage.get(actor)??0)+healthLost);
    const control=this.controls.get(target);
    if(stillControlled&&control&&control.until>second&&control.actor!==actor&&control.team===team)
      this.followup.set(control.actor,(this.followup.get(control.actor)??0)+healthLost);
  }
}
