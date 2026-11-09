import type {ChampionKit} from './types.ts';
import {resolveHeroIdentityV3,V3_RULESET} from './heroIdentityV3.ts';
import designs from './data/v3RosterDesign.json' with {type:'json'};
import bases from './data/v3BaseStats.json' with {type:'json'};
import {ROSTER_DEFINITIONS,isRosterHero} from './v3Roster.ts';
import {V3_PREVIEW_KEYS} from './v3Combat.ts';
/** All 45 are bound to authored handlers; qualification remains deferred. */
export function v3Champion(champion:ChampionKit):ChampionKit {
  const hero=V3_PREVIEW_KEYS[champion.id],identity=resolveHeroIdentityV3(champion.id);if(!hero||!identity)throw Error('Unknown original avatar: '+champion.id);
  if(champion.abilityRuleset===V3_RULESET)return {...champion,name:identity.canonicalId,legacyInternalName:champion.legacyInternalName??identity.internalName};
  const design=designs.heroes.find(h=>h.canonicalId===hero)!;
  const cooldowns:Record<string,number[]>={'lulla-faespring':[8,13,90],'mirelle-vane':[5,10,7],'mora-fenhook':[8,13,86],'vesper-nullcode':[8,13,93],'teslan-veyr':[8,12,80]};
  const authored=isRosterHero(hero)?ROSTER_DEFINITIONS[hero].cooldowns:cooldowns[hero];
  const skill=(slot:'S1'|'S2'|'R',index:number)=>({name:design.abilities[slot].name,desc:design.abilities[slot].designText,cooldown:authored[index],damage:0,damageType:'Magic' as const,...(slot==='R'?{isUlt:true}:{})});
  // Runtime name dispatch is versioned; old signature passives cannot execute.
  // The catalog's original internal name remains available as an explicit alias.
  return {...champion,name:identity.canonicalId,legacyInternalName:champion.legacyInternalName??identity.internalName,abilityRuleset:V3_RULESET,displayName:identity.displayName,title:identity.title,basis:'Original V3 ? qualification pending',archetype:design.role,lore:design.combatSignature+' Counterplay: '+design.counterplay,
    passiveName:design.abilities.P.name,passiveDesc:design.abilities.P.designText,passiveImage:undefined,skill1:skill('S1',0),skill2:skill('S2',1),ultimate:skill('R',2)};
}

/** Catalog names remain signature aliases; the match uses canonical runtime dispatch names. */
export const ORIGINAL_CHAMPIONS:ChampionKit[]=bases.map(base=>{
 const empty={name:'',desc:'',cooldown:0,damage:0,damageType:'Magic' as const};
 const kit=v3Champion({...base,displayName:'',title:'',basis:'Original V3',archetype:'',passiveDesc:'',skill1:empty,skill2:empty,ultimate:empty} as ChampionKit);
 return {...kit,name:base.name};
});
