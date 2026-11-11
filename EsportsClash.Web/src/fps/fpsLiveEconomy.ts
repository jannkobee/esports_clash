import type { FpsPrimaryRole, FpsGameplan } from './fpsIdentity.ts';
import { LIVE_WEAPONS, type LiveWeapon } from './fpsLiveWeapons.ts';

export type LiveBuyMode='pistol'|'eco'|'half'|'force'|'full';
export interface LiveBuyPlayer {id:string;role:FpsPrimaryRole;cash:number;weapon:LiveWeapon;armor:number;kit:boolean;flash:number;smoke:number;attacking:boolean}
export interface LiveBuyResult {mode:LiveBuyMode;players:LiveBuyPlayer[];spent:number;gifts:{from:string;to:string;weapon:LiveWeapon}[];reason:string}

const isPistol = (w: LiveWeapon) => w === 'pistol' || w === 'usp_s' || w === 'glock' || w === 'deagle';

/** One coherent team budget; transfers are paid by the actual donor, never created for free. */
export function buyLiveTeam(input:readonly LiveBuyPlayer[],plan:FpsGameplan,round:number,lossStreak:number,mustContest:boolean):LiveBuyResult {
  const players=input.map(p=>({...p})),cash=players.reduce((n,p)=>n+p.cash,0);
  const armed=players.filter(p=>!isPistol(p.weapon)).length,armored=players.filter(p=>p.armor>=50).length;
  const fullCost=Math.max(0,4-armed)*2700+Math.max(0,4-armored)*650+1000;
  let mode:LiveBuyMode;
  if(round===1||round===16)mode='pistol';
  else if((armed>=4&&armored>=3)||cash>=fullCost)mode='full';
  else if(mustContest||(plan.economy<.5&&lossStreak>0&&cash>=6000))mode='force';
  else if(armed>=2&&cash>=6500)mode='half';
  else mode='eco';
  const income=Math.min(3400,1400+lossStreak*500);
  const budgets=new Map(players.map(p=>[p.id,mode==='eco'?Math.min(200,p.cash):mode==='half'?Math.max(0,Math.min(1400,p.cash-Math.max(0,3800-income))):p.cash]));
  const gifts:LiveBuyResult['gifts']=[];let spent=0;
  const pay=(p:LiveBuyPlayer,cost:number)=>{if((budgets.get(p.id)??0)<cost||p.cash<cost)return false;p.cash-=cost;budgets.set(p.id,budgets.get(p.id)!-cost);spent+=cost;return true;};
  const importance:Record<FpsPrimaryRole,number>={entry:0,trade:1,sniper:2,anchor:3,lurker:3,support:4,caller:4};
  const ordered=[...players].sort((a,b)=>importance[a.role]-importance[b.role]||a.id.localeCompare(b.id));

  // Team-specific weapon allocations
  if(mode!=='pistol'&&mode!=='eco')for(const receiver of ordered.filter(p=>isPistol(p.weapon))) {
    const remaining=ordered.filter(p=>p!==receiver&&isPistol(p.weapon)).length;
    const available=players.reduce((n,p)=>n+(budgets.get(p.id)??0),0);
    const isAttacking = receiver.attacking;
    const teamRifle: LiveWeapon = isAttacking ? 'ak47' : 'm4a1_s';
    const teamSmg: LiveWeapon = isAttacking ? 'mac10' : 'mp9';
    const desired:LiveWeapon=mode==='full'&&receiver.role==='sniper'&&available>=4750+remaining*2700+2000?'sniper':mode==='half'?'smg':'rifle';
    const options:LiveWeapon[]=desired==='sniper'
      ? ['sniper','scout',teamRifle,'rifle','smg',teamSmg]
      : desired==='rifle'
        ? (receiver.role==='anchor'&&!isAttacking?[teamRifle,'rifle','smg','mag7','negev',teamSmg]:[teamRifle,'rifle','smg',teamSmg])
        : ['smg',teamSmg,isAttacking?'nova':'mag7','deagle'];
    for(const weapon of options) {
      const price=LIVE_WEAPONS[weapon].cost;
      const donor=[...players].sort((a,b)=>Number(b.id===receiver.id)-Number(a.id===receiver.id)||(budgets.get(b.id)??0)-(budgets.get(a.id)??0)).find(p=>{
        const reserve=p.id!==receiver.id&&isPistol(p.weapon)?(mode==='full'?2700:1250):0;
        return (budgets.get(p.id)??0)>=price+reserve;
      });
      if(donor&&pay(donor,price)){receiver.weapon=weapon;if(donor!==receiver)gifts.push({from:donor.id,to:receiver.id,weapon});break;}
    }
  }

  // Deagle sidearm purchases on force or eco when cash permits
  if(mode==='force'||mode==='half')for(const p of ordered.filter(p=>isPistol(p.weapon)&&p.weapon!=='deagle')) {
    if(p.cash>=700&&pay(p,700))p.weapon='deagle';
  }

  const equipment=[...players].sort((a,b)=>Number(b.role==='support')-Number(a.role==='support')||a.id.localeCompare(b.id));
  for(const p of equipment) {
    const support=p.role==='support'||p.role==='caller';
    if(support){if(!p.flash&&pay(p,200))p.flash=1;if(!p.smoke&&mode!=='eco'&&pay(p,300))p.smoke=1;}
    if(p.armor<50&&mode!=='eco'&&pay(p,650))p.armor=100;
    if(!p.attacking&&!p.kit&&mode!=='eco'&&players.filter(a=>!a.attacking&&a.kit).length<2&&pay(p,400))p.kit=true;
    if(!p.flash&&mode!=='eco'&&pay(p,200))p.flash=1;
  }
  const reasons:Record<LiveBuyMode,string>={pistol:'Pistol-round armor and utility',eco:'Preserve cash for the next coordinated buy',half:'Support surviving weapons without exhausting next-round cash',force:'Contest this round with the resources available',full:'Coordinate primary weapons, armor and utility'};
  return {mode,players,spent,gifts,reason:reasons[mode]};
}
