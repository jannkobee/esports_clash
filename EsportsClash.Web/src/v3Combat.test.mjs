import test from 'node:test';
import assert from 'node:assert/strict';
import {createV3World,requestV3Cast,stepV3Combat,completedV3Ability,v3Actor,damageV3Construct,
  selectV3Page,cycleV3PageGroup,acceptV3Ferry,v3Walking,v3Projectile,v3Passenger,v3DamageMultiplier,chooseV3Ability,V3_PAGE_NAMES} from './v3Combat.ts';
const actor=(id,team,hero,x=100,y=100)=>({id,team,hero,x,y,hp:1000,maxHp:1000,mana:5000,level:10,alive:true,controlled:false,shield:0});
function fixture(hero='lulla-faespring'){
 const w=createV3World(),units=[actor('a','blue',hero),actor('b','red',undefined,150,100),actor('c','blue',undefined,100,120)];
 const hits=[];const e={units,legalPoint:p=>p.x>=0&&p.x<2600&&p.y>=0&&p.y<=700,legalSegment:()=>true,visible:()=>true,
 damage:(a,b,n,slot)=>{b.hp=Math.max(0,b.hp-n);b.alive=b.hp>0;hits.push({source:a.id,target:b.id,n,slot});},slow:(u,n,s)=>hits.push({slow:u.id,n,s})};
 const advance=n=>{for(let i=0;i<n;i++)stepV3Combat(w,e,w.tick+1);};
 const cast=(slot,point=units[1],extra={})=>{const ok=requestV3Cast(w,e,{actor:'a',slot,point:{x:point.x,y:point.y},...extra});if(ok)advance(45);return ok;};
 return {w,e,units,hits,advance,cast};
}
test('Lulla records completed spells once, consumes notes and taxes only the next resolved cast',()=>{
 const f=fixture();assert.ok(f.cast('skill1'));
 assert.equal(v3Actor(f.w,'a').notes.b,undefined,'basic attacks do not call the completion hook');
 completedV3Ability(f.w,f.e,'b','b-cast-1');completedV3Ability(f.w,f.e,'b','b-cast-1');
 assert.equal(v3Actor(f.w,'a').notes.b.count,1);
 assert.ok(f.cast('skill2',f.units[1],{target:'b'}));
 const hp=f.units[2].hp;f.e.damage(f.units[1],f.units[2],100,'skill1');
 assert.equal(completedV3Ability(f.w,f.e,'b','b-cast-2'),.35);
 assert.equal(f.units[2].hp,hp-100,'effect resolves, no silence or cancelled damage');
 assert.equal(completedV3Ability(f.w,f.e,'b','b-cast-3'),0);
 assert.equal(f.units[1].controlled,false);assert.equal(f.units[1].x,150);
});
test('Lulla announces three theater beats; destroying its center ends future tax windows',()=>{
 const f=fixture();assert.ok(f.cast('ultimate',f.units[0]));
 const stage=f.w.constructs.find(c=>c.kind==='theater');assert.ok(stage);
 while(f.w.tick<stage.created+60)f.advance(1);
 assert.equal(completedV3Ability(f.w,f.e,'b','beat'),.25);
 const center=stage.supports[0];assert.ok(damageV3Construct(f.w,f.e,'b',center));assert.ok(damageV3Construct(f.w,f.e,'b',center));
 while(f.w.tick<stage.created+90)f.advance(1);
 assert.equal(completedV3Ability(f.w,f.e,'b','after-destruction'),0);
 assert.equal(f.w.constructs.some(c=>c.kind==='theater'),false);
});
test('pending casts cancel on control or invalid commit without paying mana/cooldown',()=>{
 const f=fixture(),mana=f.units[0].mana;
 assert.equal(requestV3Cast(f.w,f.e,{actor:'a',slot:'skill1',point:{x:900,y:100}}),false);
 assert.equal(f.units[0].mana,mana);
 assert.ok(requestV3Cast(f.w,f.e,{actor:'a',slot:'skill1',point:{x:110,y:100}}));f.units[0].controlled=true;f.advance(15);
 assert.equal(f.w.constructs.length,0);assert.equal(f.units[0].mana,mana);assert.equal(v3Actor(f.w,'a').cooldowns.skill1,0);
});
test('despawning the owner during a cast does not leave a scheduled effect or dereference a missing actor',()=>{
 const f=fixture();assert.ok(requestV3Cast(f.w,f.e,{actor:'a',slot:'skill1',point:{x:110,y:100}}));
 f.advance(10);f.e.units=f.e.units.filter(u=>u.id!=='a');f.advance(10);assert.equal(f.w.casts.length,0);assert.equal(f.w.constructs.length,0);
});
test('recovery tax stays below the per-cast and rolling-window caps and expires harmlessly',()=>{
 const f=fixture();for(let i=0;i<10;i++){v3Actor(f.w,'b').yawn={source:'a',expires:100};completedV3Ability(f.w,f.e,'b','cast-'+i);}
 assert.ok(v3Actor(f.w,'b').taxHistory.reduce((n,x)=>n+x.seconds,0)<=1.4+1e-9);
 v3Actor(f.w,'b').yawn={source:'a',expires:1};f.advance(2);assert.equal(completedV3Ability(f.w,f.e,'b','expired'),0);
});
function preparedPage(page){const f=fixture('mirelle-vane');
 const points=[{x:90,y:80},{x:150,y:80},{x:120,y:140}];for(let i=0;i<3;i++)assert.ok(f.cast('skill1',points[i]));
 if(page===4){f.w.constructs.push({id:'hazard',owner:'b',team:'red',kind:'ground-hazard',x:120,y:80,radius:15,hp:2,maxHp:2,created:f.w.tick,expires:9999,
 points:[],supports:[],angle:0,charges:1,disabledUntil:0,hit:[],progress:{},passengers:[],capacity:0,arrivalShield:0});}
 return f;
}
test('Mirelle has ten selectable independently cooled pages; selection is free and successful casts consume exact pins',()=>{
 assert.equal(V3_PAGE_NAMES.length,10);
 for(let page=1;page<=10;page++){const f=preparedPage(page),a=v3Actor(f.w,'a'),before=f.units[0].mana;
 assert.ok(selectV3Page(f.w,'a',page));assert.equal(f.units[0].mana,before);
 assert.ok(f.cast('ultimate',{x:150,y:100},{page,...(page===2?{target:'c'}:{})}),'page '+page);
 assert.ok(a.pageCooldowns[page-1]>f.w.tick);assert.equal(a.pageCooldowns.filter(n=>n>0).length,1);
 const expected=[2,1,2,2,3,2,2,3,1,3][page-1];assert.equal(f.w.constructs.filter(c=>c.kind==='pin').length,3-expected);
 assert.equal(requestV3Cast(f.w,f.e,{actor:'a',slot:'ultimate',point:{x:120,y:100},page}),false,'shared weave lockout');}
});
test('Mirelle refuses invalid geometry and wall bridges without consuming pins, mana or cooldown',()=>{
 const f=preparedPage(4),mana=f.units[0].mana;f.e.legalSegment=()=>false;
 assert.equal(f.cast('ultimate',{x:120,y:100},{page:4}),false);assert.equal(f.units[0].mana,mana);
 assert.equal(f.w.constructs.filter(c=>c.kind==='pin').length,3);
 const g=fixture('mirelle-vane'),before=g.units[0].mana;assert.equal(g.cast('skill2',g.units[0]),true,'empty S2 cycles the page group');assert.equal(v3Actor(g.w,'a').page,4);assert.equal(g.units[0].mana,before);assert.equal(v3Actor(g.w,'a').cooldowns.skill2,0);
});
test('Held Breath retains exactly one consenting non-ultimate allied shot, team and heading',()=>{
 const f=preparedPage(3);assert.ok(f.cast('ultimate',{x:150,y:100},{page:3}));
 const p={id:'shot',team:'blue',x:120,y:70,vx:0,vy:100,damage:80,ultimate:false,consenting:true,redirected:false};
 assert.equal(v3Projectile(f.w,f.e,p,{x:120,y:90}),'held');assert.equal(p.heldUntil,f.w.tick+21);
 assert.equal(p.vx,0);assert.equal(p.vy,100);assert.equal(p.team,'blue');assert.equal(p.damage,80);
 assert.equal(v3Projectile(f.w,f.e,{...p,id:'second',heldUntil:undefined},{x:120,y:90}),'pass');
 f.advance(21);assert.equal(v3Projectile(f.w,f.e,p,{x:120,y:90}),'pass');
});
test('Mora requires consent; a destroyed destination cancels transport at the last legal position',()=>{
 const f=fixture('mora-fenhook');assert.ok(f.cast('skill1',{x:100,y:100}));assert.ok(f.cast('skill1',{x:200,y:100}));
 assert.ok(f.cast('skill2',f.units[0]));const ferry=f.w.constructs.find(c=>c.kind==='ferry');assert.ok(ferry);
 f.units[2].x=ferry.x;f.units[2].y=ferry.y;
 assert.equal(acceptV3Ferry(f.w,f.e,'c',ferry.id,false),false);assert.equal(v3Passenger(f.w,'c'),false);
 assert.equal(acceptV3Ferry(f.w,f.e,'c',ferry.id,true),true);f.advance(4);const x=f.units[2].x;
 const post=ferry.supports[1];f.units[1].x=200;assert.ok(damageV3Construct(f.w,f.e,'b',post));assert.ok(damageV3Construct(f.w,f.e,'b',post));f.advance(1);
 assert.equal(v3Passenger(f.w,'c'),false);assert.equal(f.units[2].x,x);assert.equal(v3Actor(f.w,'a').fare,0);
});
test('Mora awards Fare and arrival shields only after an uninterrupted completed crossing',()=>{
 for(const interruption of ['none','control','ferry-shutdown','post-shutdown']){
  const f=fixture('mora-fenhook');assert.ok(f.cast('skill1',{x:100,y:100}));assert.ok(f.cast('skill1',{x:200,y:100}));
  assert.ok(f.cast('skill2',f.units[0]));const ferry=f.w.constructs.find(c=>c.kind==='ferry');
  ferry.arrivalShield=100;ferry.expires=f.w.tick+2;Object.assign(f.units[2],{x:ferry.x,y:ferry.y});
  assert.ok(acceptV3Ferry(f.w,f.e,'c',ferry.id,true));f.advance(1);const prior={x:f.units[2].x,y:f.units[2].y};
  if(interruption==='control')f.units[2].controlled=true;
  if(interruption==='ferry-shutdown')ferry.disabledUntil=f.w.tick+45;
  if(interruption==='post-shutdown')f.w.constructs.find(c=>c.id===ferry.supports[1]).disabledUntil=f.w.tick+45;
  f.advance(1);assert.equal(v3Passenger(f.w,'c'),false);
  const arrived=interruption==='none';assert.equal(v3Actor(f.w,'a').fare,arrived?1:0);assert.equal(f.units[2].shield,arrived?100:0);
  assert.ok(f.w.events.some(e=>e.actor==='c'&&e.type===(arrived?'ferry_arrived':'ferry_cancelled')));
  if(!arrived)assert.deepEqual({x:f.units[2].x,y:f.units[2].y},prior);
 }
});
test('Vesper bends requested headings with bounded speed, never drags stationary actors or clips walls',()=>{
 const f=fixture('vesper-nullcode');v3Actor(f.w,'a').momentum=2;assert.ok(f.cast('ultimate',f.units[1]));
 const target=f.units[1],from={x:150,y:100};assert.deepEqual(v3Walking(f.w,f.e,target,from,from),from);
 const next=v3Walking(f.w,f.e,target,from,{x:153,y:100});assert.ok(next.y>100);assert.ok(Math.abs(Math.hypot(next.x-150,next.y-100)-3)<1e-9);
 f.e.legalSegment=()=>false;assert.deepEqual(v3Walking(f.w,f.e,target,from,{x:153,y:100}),from);
});
test('Teslan circuits are breakable, deflect at most once, and world walls take precedence',()=>{
 const f=fixture('teslan-veyr');assert.ok(f.cast('skill1',{x:100,y:70}));assert.ok(f.cast('skill1',{x:100,y:130}));
 assert.equal(v3Actor(f.w,'a').capacitors,1);assert.ok(f.cast('skill2',f.units[0]));
 const p={id:'shot',team:'red',x:90,y:100,vx:100,vy:0,damage:50,ultimate:false,consenting:false,redirected:false};
 assert.equal(v3Projectile(f.w,f.e,p,{x:110,y:100}),'pass');assert.equal(p.redirected,true);const velocity=[p.vx,p.vy];
 v3Projectile(f.w,f.e,p,{x:110,y:100});assert.deepEqual([p.vx,p.vy],velocity);
 f.e.legalSegment=()=>false;assert.equal(v3Projectile(f.w,f.e,p,{x:110,y:100}),'blocked');
});
test('ten actors / five original prototypes soak for 1200 ticks and are identical at 1x and 4x presentation grouping',()=>{
 function run(group){const f=fixture();f.e.units=[];const heroes=['lulla-faespring','mirelle-vane','mora-fenhook','vesper-nullcode','teslan-veyr'];
 for(let i=0;i<10;i++)f.e.units.push(actor('unit-'+i,i<5?'blue':'red',heroes[i%5],100+i*10,100+i%2*30));
 for(let rendered=0;rendered<1200;rendered+=group)for(let j=0;j<group;j++){
  if(f.w.tick%120===0)for(const u of f.e.units)requestV3Cast(f.w,f.e,{actor:u.id,slot:'skill1',point:{x:u.x+20,y:u.y+20}});
  f.advance(1);assert.ok(f.e.units.every(u=>Number.isFinite(u.hp)&&u.hp>=0&&u.mana>=0));assert.ok(f.w.constructs.length<=32);
 }return f;}
 const a=run(1),b=run(4);assert.deepEqual(a.w,b.w);assert.deepEqual(a.e.units,b.e.units);
});
test('Baste Line catches exactly the first enemy, including a step ending precisely on its seam',()=>{
 const f=preparedPage(1);assert.ok(f.cast('ultimate',{x:150,y:100},{page:1}));const enemy=f.units[1];
 v3Walking(f.w,f.e,enemy,{x:120,y:70},{x:120,y:80});assert.ok(f.hits.some(h=>h.n===40));
 const second=actor('second','red',undefined,130,70);f.e.units.push(second);const count=f.hits.length;
 v3Walking(f.w,f.e,second,{x:130,y:70},{x:130,y:90});assert.equal(f.hits.length,count);
});
test('Pocket Shelter intercepts a single frontal shot at the protected ally, then tears',()=>{
 const f=preparedPage(2);assert.ok(f.cast('ultimate',{x:150,y:100},{page:2,target:'c'}));
 const shot={id:'shot',team:'red',x:160,y:120,vx:-100,vy:0,damage:200,ultimate:false,consenting:false,redirected:false};
 assert.equal(v3Projectile(f.w,f.e,shot,{x:90,y:120}),'blocked');
 assert.equal(v3Projectile(f.w,f.e,{...shot,id:'second'},{x:90,y:120}),'pass');
});
test('Ladder Stitch mitigates only its declared temporary ground hazard',()=>{
 const f=preparedPage(4);assert.ok(f.cast('ultimate',{x:150,y:100},{page:4}));const target={...f.units[2],x:120,y:80};
 assert.equal(v3DamageMultiplier(f.w,target,{x:120,y:80},'hazard'),.5);
 assert.equal(v3DamageMultiplier(f.w,target,{x:120,y:80},'other-hazard'),1);
});
test('Pleat Fold blocks one projectile; all canopy protection ends when a consumed support is destroyed',()=>{
 const f=preparedPage(5);assert.ok(f.cast('ultimate',{x:150,y:100},{page:5}));const field=f.w.constructs.find(c=>c.kind==='pleat');
 const [a,b]=field.points,center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},direction={x:Math.cos(field.angle),y:Math.sin(field.angle)};
 const shot={id:'shot',team:'red',x:center.x+direction.x*80,y:center.y+direction.y*80,vx:-direction.x*100,vy:-direction.y*100,damage:200,ultimate:false,consenting:false,redirected:false};
 const end={x:center.x-direction.x*80,y:center.y-direction.y*80};assert.equal(v3Projectile(f.w,f.e,shot,end),'blocked');assert.equal(v3Projectile(f.w,f.e,shot,end),'pass');
 const g=preparedPage(10);assert.ok(g.cast('ultimate',{x:150,y:100},{page:10}));const canopy=g.w.constructs.find(c=>c.kind==='canopy'),ally={...g.units[2],x:120,y:100};
 assert.equal(v3DamageMultiplier(g.w,ally,{x:300,y:100}),.85);assert.equal(v3DamageMultiplier(g.w,ally,{x:0,y:100}),1);
 damageV3Construct(g.w,g.e,'b',canopy.supports[0]);damageV3Construct(g.w,g.e,'b',canopy.supports[0]);assert.equal(v3DamageMultiplier(g.w,ally,{x:300,y:100}),1);
});
test('Serrated Seam does not hit standing units or repeat hits after a successful crossing',()=>{
 const f=preparedPage(6);assert.ok(f.cast('ultimate',{x:150,y:100},{page:6}));const field=f.w.constructs.find(c=>c.kind==='serrated');
 while(f.w.tick<field.created+48)f.advance(1);const before=f.hits.length;
 v3Walking(f.w,f.e,f.units[1],{x:120,y:80},{x:120,y:80});assert.equal(f.hits.length,before);
 v3Walking(f.w,f.e,f.units[1],{x:120,y:70},{x:120,y:90});assert.equal(f.hits.filter(h=>h.n===85).length,1);
 v3Walking(f.w,f.e,f.units[1],{x:120,y:90},{x:120,y:70});assert.equal(f.hits.filter(h=>h.n===85).length,1);
});
test('Hem grants a brief directional speed interval; Waltz requires ordered movement and never removes a larger existing shield',()=>{
 const f=preparedPage(7);assert.ok(f.cast('ultimate',{x:150,y:100},{page:7}));
 const a={x:100,y:85},b={x:103,y:85};assert.ok(v3Walking(f.w,f.e,f.units[2],a,b).x>103);f.advance(1);assert.ok(v3Walking(f.w,f.e,f.units[2],a,b).x>103);
 const g=preparedPage(8);assert.ok(g.cast('ultimate',{x:150,y:100},{page:8}));const c=g.units[2];c.shield=600;
 v3Walking(g.w,g.e,c,{x:70,y:80},{x:90,y:80});v3Walking(g.w,g.e,c,{x:90,y:80},{x:120,y:140});assert.equal(c.shield,600);
 v3Walking(g.w,g.e,c,{x:120,y:140},{x:150,y:80});v3Walking(g.w,g.e,c,{x:150,y:80},{x:120,y:140});assert.equal(c.shield,600);assert.ok(g.w.events.some(e=>e.type==='shield_applied'));
});
test('Silhouette Dress advertises a distinguishable fake selection without damage or a free cast; page groups are selection only',()=>{
 const f=preparedPage(9);assert.ok(f.cast('ultimate',{x:150,y:100},{page:9}));const count=f.hits.length,mana=f.units[0].mana;
 assert.ok(selectV3Page(f.w,'a',4));assert.ok(f.w.events.some(e=>e.type==='fake_windup_announced'&&e.value===4));
 assert.ok(cycleV3PageGroup(f.w,'a'));assert.equal(v3Actor(f.w,'a').page,7);assert.equal(f.units[0].mana,mana);assert.equal(f.hits.length,count);
});
test('Teslan delays only the next windup and its public-state scorer can choose Conduct or Brownout',()=>{
 const f=fixture('teslan-veyr');assert.ok(f.cast('skill1',{x:100,y:70}));assert.ok(f.cast('skill1',{x:100,y:130}));
 const choice=chooseV3Ability(f.w,f.e,f.units[0]);assert.equal(choice.request.slot,'skill2');assert.equal(choice.request.polarity,'conduct');
 f.units[1].x=100;f.units[1].hero='vesper-nullcode';assert.ok(f.cast('ultimate',f.units[0]));
 assert.ok(requestV3Cast(f.w,f.e,{actor:'b',slot:'skill1',point:{x:110,y:100}}));let cast=f.w.casts.find(c=>c.request.actor==='b');assert.equal(cast.commit-cast.start,26);
 f.advance(40);assert.ok(requestV3Cast(f.w,f.e,{actor:'b',slot:'skill2',point:{x:110,y:100}}));cast=f.w.casts.find(c=>c.request.actor==='b');assert.equal(cast.commit-cast.start,11);
});
