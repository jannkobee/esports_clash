import type { FpsPrimaryRole, FpsGameplan } from './fpsIdentity.ts';
import { LIVE_WEAPONS, LIVE_WEAPON_TIERS, LIVE_SIDE_LOADOUTS, canBuyLiveWeapon, type LiveWeapon } from './fpsLiveWeapons.ts';
export type LiveBuyMode='pistol'|'eco'|'half'|'force'|'full';
export type LiveUtilityItem='flash'|'smoke'|'incendiary'|'he';
export const LIVE_UTILITY_COST={flash:200,smoke:300,incendiary:500,he:300} as const;
export interface LiveBuyPlayer {preferSniper?:boolean;expectedRange?:number;holdChoke?:boolean;ammo?:number;reserve?:number;id:string;role:FpsPrimaryRole;cash:number;weapon:LiveWeapon;sidearm?:LiveWeapon;armor:number;kit:boolean;flash:number;smoke:number;incendiary:number;he:number;attacking:boolean;giftFrom?:string;utilityStock?:LiveUtilityItem[];restock?:boolean}
export interface LiveBuyResult {mode:LiveBuyMode;players:LiveBuyPlayer[];spent:number;gifts:{from:string;to:string;weapon:LiveWeapon}[];reason:string}
const pistol=(w:LiveWeapon)=>LIVE_WEAPONS[w].category==='pistol';
export const liveUtilityCount=(p:Pick<LiveBuyPlayer,LiveUtilityItem>)=>(p.flash??0)+(p.smoke??0)+(p.incendiary??0)+(p.he??0);
export const canCarryLiveUtility=(p:Pick<LiveBuyPlayer,LiveUtilityItem>,kind:LiveUtilityItem)=>liveUtilityCount(p)<4&&p[kind]<(kind==='flash'?2:1);
/** Team policy owns buys. A donor pays the full price; surplus inventory is physical stock. */
export function buyLiveTeam(input:readonly LiveBuyPlayer[],plan:FpsGameplan,round:number,lossStreak:number,mustContest:boolean,economyJudgment=.5):LiveBuyResult {
 const players:LiveBuyPlayer[]=input.map(({id,role,cash,weapon,sidearm,armor,kit,flash=0,smoke=0,incendiary=0,he=0,attacking,preferSniper,expectedRange,holdChoke,ammo,reserve})=>({id,role,cash,weapon,sidearm,armor,kit,flash,smoke,incendiary,he,attacking,preferSniper,expectedRange,holdChoke,ammo,reserve,utilityStock:[]}));
 const retainedPrimaries=new Set(players.filter(p=>!pistol(p.weapon)).map(p=>p.id));
 const judgment=Math.max(0,Math.min(1,economyJudgment));
 const cash=players.reduce((n,p)=>n+p.cash,0),n=players.length;
 const fullCost=players.reduce((sum,p)=>sum+(pistol(p.weapon)?LIVE_WEAPONS[LIVE_SIDE_LOADOUTS[p.attacking?'t':'ct'].rifle].cost:0)+(p.armor<50?650:0)+700,0);
 const armed=players.filter(p=>!pistol(p.weapon)).length;
 const avg=cash/Math.max(1,players.length);
 const mode:LiveBuyMode=round===1||round===16?'pistol':cash>=fullCost?'full':mustContest||(plan.economy<.5&&lossStreak>0&&cash>=players.length*1200)?'force':(armed>=2&&cash>=players.length*1100)||avg>=2700?'half':'eco';
 const income=Math.min(3050,1400+lossStreak*450);
 const nextLossIncome=Math.min(3050,1400+(lossStreak+1)*450);
 const ecoReserve=Math.max(1950,4150-nextLossIncome);
 const halfReserve=lossStreak===0?750:Math.max(1400,Math.round(3500+judgment*600-income));
 const budgets=new Map(players.map(p=>[p.id,mode==='eco'?(p.cash<1900?Math.min(p.cash,200):Math.max(Math.min(p.cash,200),p.cash-ecoReserve)):mode==='half'?Math.max(0,p.cash-halfReserve):p.cash]));
 let spent=0;const gifts:LiveBuyResult['gifts']=[];
 const pay=(p:LiveBuyPlayer,cost:number)=>{if((budgets.get(p.id)??0)<cost||p.cash<cost)return false;p.cash-=cost;budgets.set(p.id,budgets.get(p.id)!-cost);spent+=cost;return true;};
 const priority:Record<FpsPrimaryRole,number>={entry:0,trade:1,sniper:2,anchor:3,lurker:3,support:4,caller:4};
 const ordered=[...players].sort((a,b)=>priority[a.role]-priority[b.role]||a.id.localeCompare(b.id));
 const sidePistolFor=(attacking:boolean):LiveWeapon=>attacking?'tec9':'fiveseven';
 const improvesPistol=(p:LiveBuyPlayer,weapon:LiveWeapon)=>LIVE_WEAPON_TIERS[weapon]>LIVE_WEAPON_TIERS[p.weapon];
 const hashSeed=(p:LiveBuyPlayer,salt:number)=>{let h=(round*31+salt*17)|0;for(let i=0;i<p.id.length;i++)h=(h*33+p.id.charCodeAt(i))|0;return Math.abs(h);};

 if(mode==='pistol'){
  for(const [idx,p] of ordered.entries()){
   if(!pistol(p.weapon))continue;
   const sidePistol=sidePistolFor(p.attacking);
   const h=hashSeed(p,idx);
   const sniper=p.preferSniper||p.role==='sniper';
   let pick:LiveWeapon|undefined;
   if(sniper)pick=h%3===0?sidePistol:'deagle';
   else if(p.role==='support'||p.role==='caller')pick=h%2===0?'p250':sidePistol;
   else if(p.role==='lurker'||(p.role==='anchor'&&h%3===0))pick=h%3===0?'cz75':h%3===1?sidePistol:'p250';
   else if(p.role==='entry'&&plan.aggression>.65&&h%3===0)pick=sidePistol;
   if(pick&&improvesPistol(p,pick)&&canBuyLiveWeapon(pick,p.attacking)&&pay(p,LIVE_WEAPONS[pick].cost)){p.weapon=pick;p.sidearm=pick;p.restock=true;}
  }
 }else if(mode==='eco'){
  for(const [idx,p] of ordered.entries()){
   if(!pistol(p.weapon))continue;
   const avail=budgets.get(p.id)??0;
   if(avail<300||p.cash<1900)continue;
   const sidePistol=sidePistolFor(p.attacking);
   const h=hashSeed(p,idx);
   const sniper=p.preferSniper||p.role==='sniper';
   const pool:LiveWeapon[]=sniper?['deagle',sidePistol,'p250']:h%3===0?['deagle',sidePistol,'cz75','p250']:[sidePistol,'cz75','deagle','p250'];
   for(const pick of pool){
    if(improvesPistol(p,pick)&&canBuyLiveWeapon(pick,p.attacking)&&pay(p,LIVE_WEAPONS[pick].cost)){p.weapon=pick;p.sidearm=pick;p.restock=true;break;}
   }
  }
 }else{
  for(const [idx,receiver] of ordered.filter(p=>pistol(p.weapon)).entries()){
   const l=LIVE_SIDE_LOADOUTS[receiver.attacking?'t':'ct'],sniper=receiver.preferSniper??receiver.role==='sniper';
   const sidePistol=sidePistolFor(receiver.attacking);
   const h=hashSeed(receiver,idx);
   const forceRoleMix=mode!=='full'&&(receiver.role==='support'||receiver.role==='caller'||receiver.role==='lurker')&&h%2===0;
   const closeHold=receiver.holdChoke&&receiver.expectedRange!==undefined&&receiver.expectedRange<=11;
   const suppressiveHold=receiver.holdChoke&&receiver.expectedRange!==undefined&&receiver.expectedRange>11&&receiver.expectedRange<=22&&plan.aggression<.55;
   const pistolPair:LiveWeapon[]=h%3===0?['deagle',sidePistol,'cz75','p250']:[sidePistol,'deagle','cz75','p250'];
   const options:LiveWeapon[]=sniper?['sniper','scout','deagle',l.rifle,l.budget,sidePistol,'p250']
    :mode!=='full'&&closeHold?[l.shotgun,l.smg,l.budget,...pistolPair]
    :mode==='force'&&suppressiveHold?[l.rifle,'negev',l.budget,l.smg,l.shotgun,...pistolPair]
    :forceRoleMix&&!(receiver.expectedRange!==undefined&&receiver.expectedRange>=22)?[...pistolPair,l.smg,l.budget,l.shotgun]
    :mode==='half'?[l.budget,l.smg,l.shotgun,...pistolPair]
    :[l.rifle,l.budget,l.smg,l.shotgun,'deagle',sidePistol];
   for(const weapon of options){
    if(!canBuyLiveWeapon(weapon,receiver.attacking))continue;
    const price=LIVE_WEAPONS[weapon].cost;
    const isPistol=LIVE_WEAPONS[weapon].category==='pistol';
    if(isPistol&&!improvesPistol(receiver,weapon))continue;
    // Prefer an armored close-range gun to spending the same bank on a naked rifle.
    const canAffordArmoredPrimary=(budgets.get(receiver.id)??0)>=LIVE_WEAPONS[l.smg].cost+650;
    const reserveArmor=isPistol||receiver.armor>=50?0:(mode==='full'||canAffordArmoredPrimary?650:0);
    const donor=[...players].sort((a,b)=>Number(b===receiver)-Number(a===receiver)||(budgets.get(b.id)??0)-(budgets.get(a.id)??0)).find(p=>{
     if(p!==receiver&&LIVE_WEAPONS[weapon].category==='pistol')return false;
     const needsOwnPrimary=pistol(p.weapon)&&p!==receiver;
     const own=needsOwnPrimary?LIVE_WEAPONS[LIVE_SIDE_LOADOUTS[p.attacking?'t':'ct'].budget].cost:0;
     const armor=p===receiver?reserveArmor:(!isPistol&&p.armor<50&&(mode==='full'||needsOwnPrimary)?650:0);
     return (budgets.get(p.id)??0)>=price+own+armor;
    });
    if(donor&&pay(donor,price)){receiver.weapon=weapon;receiver.restock=true;if(LIVE_WEAPONS[weapon].category==='pistol')receiver.sidearm=weapon;if(donor!==receiver){receiver.giftFrom=donor.id;gifts.push({from:donor.id,to:receiver.id,weapon});}break;}
   }
  }
 }
 const plannedAmmoRestocks=new Set<string>();
 for(const p of ordered){
  const boughtSidearmOnPistol=mode==='pistol'&&p.weapon!==LIVE_SIDE_LOADOUTS[p.attacking?'t':'ct'].sidearm&&p.weapon!=='pistol';
  if(p.armor<50&&mode!=='eco'&&!(mode==='pistol'&&(p.role==='support'||p.role==='caller'||boughtSidearmOnPistol))&&pay(p,650))p.armor=100;
  const stats=LIVE_WEAPONS[p.weapon],needsAmmo=p.ammo===undefined||p.reserve===undefined||p.ammo<stats.magazine||p.reserve<stats.reserve;
  if(!p.restock&&needsAmmo&&mode!=='eco'&&mode!=='pistol'&&pay(p,150)){p.restock=true;plannedAmmoRestocks.add(p.id);}
 }
 // A defuse kit is a team objective tool, funded before optional grenade stock/sidearms.
 if(mode!=='eco'&&mode!=='pistol'&&!players.some(p=>!p.attacking&&p.kit)){
  const defuser=[...ordered].filter(p=>!p.attacking).sort((a,b)=>Number(b.role==='anchor')-Number(a.role==='anchor')||(budgets.get(b.id)??0)-(budgets.get(a.id)??0)).find(p=>(budgets.get(p.id)??0)>=400);
  if(defuser&&pay(defuser,400))defuser.kit=true;
 }
 // Carry at most four grenades, at most two flashes and one of each other type.
 for(const p of [...ordered].sort((a,b)=>Number(b.role==='support')-Number(a.role==='support'))){
  const support=p.role==='support'||p.role==='caller';
  const sniperRole=p.weapon==='sniper'||p.weapon==='scout'||p.preferSniper||p.role==='sniper';
  const wanted:LiveUtilityItem[]=mode==='eco'?[]:mode==='pistol'?(support?['smoke','flash','flash']:['flash']):support?['smoke','flash','flash','incendiary']:sniperRole&&mode==='full'?['smoke','flash']:['smoke','flash','he','incendiary'];
  const bought:Record<LiveUtilityItem,number>={flash:0,smoke:0,incendiary:0,he:0};
  for(const kind of wanted)if(canCarryLiveUtility(p,kind)&&pay(p,LIVE_UTILITY_COST[kind])){p[kind]++;bought[kind]++;}
  if(!p.attacking&&!p.kit&&mode!=='eco'&&mode!=='pistol'&&players.filter(a=>a.kit).length<2&&pay(p,400))p.kit=true;
  // Round purchase limits: two of each non-flash, four flashes, including carried purchases.
  if(mode==='full'&&support)for(const kind of ['smoke','flash','flash','he','incendiary','he'] as LiveUtilityItem[]){
   if(bought[kind]<(kind==='flash'?4:2)&&p.cash>=1200+LIVE_UTILITY_COST[kind]&&pay(p,LIVE_UTILITY_COST[kind])){p.utilityStock!.push(kind);bought[kind]++;}
  }
 }
 // Replace a saved low-tier primary only after all teammates' core equipment is funded.
 // The simulation drops the replaced gun physically; valuable captured rifles remain usable.
 if(mode==='full')for(const p of ordered){
  if(pistol(p.weapon)||p.giftFrom||!retainedPrimaries.has(p.id))continue;
  const closeHold=p.holdChoke&&p.expectedRange!==undefined&&p.expectedRange<=11;
  const suppressiveHold=p.holdChoke&&p.expectedRange!==undefined&&p.expectedRange>11&&p.expectedRange<=22&&plan.aggression<.55;
  if(closeHold&&LIVE_WEAPONS[p.weapon].category==='shotgun'||suppressiveHold&&p.weapon==='negev')continue;
  const wantsSniper=p.preferSniper??p.role==='sniper';
  const choices:LiveWeapon[]=wantsSniper?['sniper','scout']:[LIVE_SIDE_LOADOUTS[p.attacking?'t':'ct'].rifle];
  for(const weapon of choices){
   if(LIVE_WEAPON_TIERS[weapon]<=LIVE_WEAPON_TIERS[p.weapon]||!canBuyLiveWeapon(weapon,p.attacking))continue;
   const cancelledAmmo=plannedAmmoRestocks.has(p.id)?150:0;
   if((budgets.get(p.id)??0)+cancelledAmmo<LIVE_WEAPONS[weapon].cost+300)continue;
   // Buying is still a plan: cancel restocking the old gun before replacing it.
   if(cancelledAmmo){p.cash+=cancelledAmmo;budgets.set(p.id,(budgets.get(p.id)??0)+cancelledAmmo);spent-=cancelledAmmo;plannedAmmoRestocks.delete(p.id);}
   if(pay(p,LIVE_WEAPONS[weapon].cost)){p.weapon=weapon;p.restock=true;break;}
  }
 }
 // Upgrade holstered sidearm for snipers and affluent full-buy riflers after team utility.
 if(mode!=='pistol'&&mode!=='eco'){
  for(const [idx,p] of ordered.entries()){
   if(pistol(p.weapon))continue;
   const hasStarter=!p.sidearm||p.sidearm==='usp_s'||p.sidearm==='glock'||p.sidearm==='pistol';
   if(!hasStarter)continue;
   const isSniperWeapon=p.weapon==='sniper'||p.weapon==='scout'||p.preferSniper||p.role==='sniper';
   const avail=budgets.get(p.id)??0;
   const minLeftover=isSniperWeapon?150:950;
   if(avail<minLeftover+300)continue;
   const sidePistol=sidePistolFor(p.attacking);
   const h=hashSeed(p,idx+5);
   const choices:LiveWeapon[]=isSniperWeapon?(h%3===0?['cz75',sidePistol,'deagle','p250']:['deagle','cz75',sidePistol,'p250'])
    :(h%4===0?['deagle',sidePistol,'cz75','p250']:[sidePistol,'p250','cz75','deagle']);
   for(const side of choices){
    const cost=LIVE_WEAPONS[side].cost;
    if(canBuyLiveWeapon(side,p.attacking)&&avail-cost>=minLeftover&&pay(p,cost)){p.sidearm=side;break;}
   }
  }
 }
 const reasons:Record<LiveBuyMode,string>={pistol:'Sidearms, armor and utility for the pistol round',eco:'Keep enough cash for the next five-player buy',half:'Contest with upgraded pistols, SMGs and half-buy firepower',force:'Contest with affordable rifles, Deagles and close-range weapons',full:'Fund five weapons, armor, sidearms and a utility execute'};
 return {mode,players,spent,gifts,reason:reasons[mode]};
}
