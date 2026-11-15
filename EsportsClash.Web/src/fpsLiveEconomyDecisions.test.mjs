import test from 'node:test';
import assert from 'node:assert/strict';
import {buyLiveTeam,liveUtilityCount} from './fps/fpsLiveEconomy.ts';
import {LIVE_WEAPONS,canBuyLiveWeapon} from './fps/fpsLiveWeapons.ts';

const plan={tempo:.6,structure:.7,aggression:.5,preparation:.7,freedom:.5,economy:.8};
const player=(overrides={})=>({id:'buyer',role:'entry',cash:4500,weapon:'usp_s',sidearm:'usp_s',armor:0,kit:false,flash:0,smoke:0,incendiary:0,he:0,attacking:false,...overrides});
const buy=(p,force=false)=>buyLiveTeam([p],plan,5,0,force);

test('force buys retain armor money when a complete SMG kit beats a naked rifle',()=>{
  for(const [attacking,cash,weapon] of [[true,1800,'mac10'],[false,2050,'mp9']]){
    const result=buy(player({attacking,cash,weapon:attacking?'glock':'usp_s',sidearm:attacking?'glock':'usp_s'}),true);
    assert.equal(result.mode,'force');
    assert.equal(result.players[0].weapon,weapon);
    assert.equal(result.players[0].armor,100);
    assert.ok(result.players[0].cash>=0);
  }
});

test('authored lane context makes close holds and medium choke suppression deliberate',()=>{
  const close=buy(player({cash:2850,role:'anchor',expectedRange:9,holdChoke:true}),true);
  const long=buy(player({cash:2850,role:'anchor',expectedRange:26,holdChoke:true}),true);
  const choke=buy(player({cash:2850,role:'anchor',expectedRange:16,holdChoke:true}),true);
  assert.equal(close.players[0].weapon,'mag7');
  assert.equal(long.players[0].weapon,'budget_ct');
  assert.equal(choke.players[0].weapon,'negev');
  assert.equal(close.players[0].armor,100);
  assert.equal(long.players[0].armor,100);
  assert.equal(choke.players[0].armor,100);
});

test('eco players never pay to downgrade a conserved upgraded sidearm',()=>{
  const p=player({weapon:'deagle',sidearm:'deagle',cash:2650,armor:100});
  const result=buy(p);
  assert.equal(result.mode,'eco');
  assert.equal(result.players[0].weapon,'deagle');
  assert.equal(result.spent,0);
});

test('a full CT buy funds a team kit before spending the last cash on utility',()=>{
  const input=['entry','trade','anchor','support','caller'].map((role,i)=>player({id:`kit-${i}`,role,cash:4500}));
  const result=buyLiveTeam(input,plan,5,0,false);
  assert.equal(result.mode,'full');
  assert.ok(result.players.some(p=>p.kit),'All five used to spend their remaining bank on grenades first');
  assert.ok(result.players.every(p=>p.weapon==='m4a1_s'&&p.armor===100));
  assert.equal(result.spent,input.reduce((sum,p)=>sum+p.cash,0)-result.players.reduce((sum,p)=>sum+p.cash,0));
});

test('a physical weapon donor reserves their own armor once and still funds the poor entry',()=>{
  const input=['entry','trade','anchor','support','caller'].map((role,i)=>player({id:`gift-${i}`,role,cash:i?6000:200,armor:i?0:100}));
  const result=buyLiveTeam(input,plan,5,0,false);
  assert.equal(result.mode,'full');
  assert.equal(result.players[0].weapon,'m4a1_s');
  assert.ok(result.gifts.some(g=>g.to==='gift-0'&&g.weapon==='m4a1_s'));
  assert.ok(result.players.every(p=>p.cash>=0&&LIVE_WEAPONS[p.weapon].category!=='pistol'));
});

test('wealthy survivors upgrade saved low-tier weapons but preserve captured rifles and close shotguns',()=>{
  const upgrades=buy(player({cash:7000,weapon:'mp9',armor:100,ammo:30,reserve:120}));
  assert.equal(upgrades.players[0].weapon,'m4a1_s');
  assert.equal(upgrades.players[0].restock,true);
  const emptyUpgrade=buy(player({cash:7000,weapon:'mp9',armor:100,ammo:3,reserve:12}));
  assert.equal(emptyUpgrade.players[0].weapon,'m4a1_s');
  assert.equal(emptyUpgrade.spent,upgrades.spent,'Replacing a saved primary cancels its provisional ammo charge');
  const capture=buy(player({cash:7000,weapon:'ak47',armor:100,ammo:30,reserve:90}));
  assert.equal(capture.players[0].weapon,'ak47');
  const close=buy(player({cash:7000,role:'anchor',weapon:'mag7',armor:100,ammo:5,reserve:25,holdChoke:true,expectedRange:9}));
  assert.equal(close.players[0].weapon,'mag7');
  const sniper=buy(player({cash:10000,weapon:'scout',preferSniper:true,armor:100,ammo:10,reserve:40}));
  assert.equal(sniper.players[0].weapon,'sniper');
});

test('paid ammunition restocking is skipped for a conserved full magazine and reserve',()=>{
  const base=player({cash:1600,weapon:'m4a1_s',sidearm:'deagle',armor:100,kit:true,flash:1,smoke:1,he:1,incendiary:1});
  const full=buy({...base,ammo:25,reserve:75});
  const partial=buy({...base,ammo:12,reserve:75});
  assert.equal(full.spent,0);
  assert.equal(full.players[0].restock,undefined);
  assert.equal(partial.spent,150);
  assert.equal(partial.players[0].restock,true);
});

test('contextual purchases stay deterministic, immutable, faction-legal and cash/inventory bounded',()=>{
  for(const attacking of [false,true])for(const cash of [800,1400,2050,2850,4500,10000]){
    const input=['entry','trade','anchor','support','caller'].map((role,i)=>player({id:`audit-${i}`,role,cash,attacking,weapon:attacking?'glock':'usp_s',sidearm:attacking?'glock':'usp_s',holdChoke:role==='anchor',expectedRange:role==='anchor'?9:26}));
    const original=structuredClone(input);
    const result=buyLiveTeam(input,plan,cash===800?1:5,1,cash===2050||cash===2850);
    assert.deepEqual(result,buyLiveTeam(input,plan,cash===800?1:5,1,cash===2050||cash===2850));
    assert.deepEqual(input,original);
    assert.equal(result.spent,cash*5-result.players.reduce((sum,p)=>sum+p.cash,0));
    for(const p of result.players){
      assert.ok(canBuyLiveWeapon(p.weapon,p.attacking),p.weapon);
      assert.ok(p.cash>=0&&p.cash<=cash);
      assert.ok(liveUtilityCount(p)<=4);
      assert.ok(p.flash<=2&&p.smoke<=1&&p.he<=1&&p.incendiary<=1);
      assert.ok(LIVE_WEAPONS[p.weapon].cost>0);
    }
    for(const gift of result.gifts)assert.equal(result.players.find(p=>p.id===gift.to).weapon,gift.weapon,'A later upgrade cannot replace a paid physical gift');
  }
});
