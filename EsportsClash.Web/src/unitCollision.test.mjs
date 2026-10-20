import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCrowdMovement } from './unitCollision.ts';
import { captureUnitCollisionStarts, resolveArenaUnitCollisions } from './arenaUnitCollision.ts';
import { isInsideRockTerrain, ROCK_TERRAIN } from './arenaRules.ts';

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const body = (id,x,y,tx=x,ty=y,radius=17,locked=false) => ({id,from:{x,y},to:{x:tx,y:ty},radius,locked});
const stepToward = (point, goal, length) => {
  const d=distance(point,goal), t=d?Math.min(1,length/d):0;
  return {x:point.x+(goal.x-point.x)*t,y:point.y+(goal.y-point.y)*t};
};

test('walking into a stationary avatar slides around it without moving the target or gaining speed',()=>{
  let p={x:-65,y:0};const obstacle={x:0,y:0},goal={x:75,y:0};
  let maxStep=0;
  for(let tick=0;tick<150;tick++){
    const to=stepToward(p,goal,2),result=resolveCrowdMovement([
      body('walker',p.x,p.y,to.x,to.y),body('stationary',0,0),
    ],1/30);
    const next=result.get('walker');assert.deepEqual(result.get('stationary'),obstacle);
    assert.ok(distance(next,obstacle)>=34-.001,`penetration at ${tick}`);
    maxStep=Math.max(maxStep,distance(p,next));p=next;
  }
  assert.ok(p.x>65,`walker did not pass: ${JSON.stringify(p)}`);
  assert.ok(maxStep<=2.001,`speed increased to ${maxStep}`);
});

test('head-on walkers pass on stable sides and results do not depend on array order',()=>{
  let a={x:-65,y:0},b={x:65,y:0};
  for(let tick=0;tick<140;tick++){
    const ta=stepToward(a,{x:80,y:0},2),tb=stepToward(b,{x:-80,y:0},2);
    const input=[body('a',a.x,a.y,ta.x,ta.y),body('b',b.x,b.y,tb.x,tb.y)];
    const original=structuredClone(input),r=resolveCrowdMovement(input,1/30),reverse=resolveCrowdMovement([...input].reverse(),1/30);
    assert.deepEqual([...r],[...reverse]);assert.deepEqual(input,original);
    const nextA=r.get('a'),nextB=r.get('b');
    assert.ok(distance(nextA,nextB)>=34-.001,`overlap at ${tick}`);
    assert.ok(distance(a,nextA)<=2.001);assert.ok(distance(b,nextB)<=2.001);
    a=nextA;b=nextB;
  }
  assert.ok(a.x>65&&b.x<-65,`head-on deadlock: ${JSON.stringify({a,b})}`);
});

test('a swept move cannot tunnel through a small solid body even when endpoints are clear',()=>{
  const r=resolveCrowdMovement([body('a',-80,0,80,0),body('solid',0,0,0,0,10,true)],1/30);
  assert.deepEqual(r.get('solid'),{x:0,y:0});
  assert.ok(Math.abs(r.get('a').y)>1,'path should bend around the solid body');
  assert.ok(distance(r.get('a'),{x:0,y:0})>=27);
});

test('coincident spawns recover gradually and deterministically without moving locked actors',()=>{
  let a={x:0,y:0},b={x:0,y:0};
  for(let tick=0;tick<70;tick++){
    const r=resolveCrowdMovement([body('a',a.x,a.y),body('b',b.x,b.y),body('recall',100,0,100,0,17,true)],1/30);
    assert.ok(distance(a,r.get('a'))<=1.201);assert.ok(distance(b,r.get('b'))<=1.201);
    assert.deepEqual(r.get('recall'),{x:100,y:0});a=r.get('a');b=r.get('b');
  }
  assert.ok(distance(a,b)>=33.95);
});

test('crowded solid bodies preserve non-overlap and bounded motion while finding room',()=>{
  let units=Array.from({length:24},(_,i)=>({id:`unit-${String(i).padStart(2,'0')}`,x:-85-Math.floor(i/4)*24,y:(i%4-1.5)*24}));
  const anchor=body('anchor',0,0,0,0,17,true);
  for(let tick=0;tick<180;tick++){
    const input=units.map(u=>{const to=stepToward(u,{x:140,y:u.y*.98},2);return body(u.id,u.x,u.y,to.x,to.y,10);});
    const result=resolveCrowdMovement([...input,anchor],1/30);
    const next=units.map(u=>({id:u.id,...result.get(u.id)}));
    for(let i=0;i<next.length;i++){
      assert.ok(distance(next[i],units[i])<=2.001);
      assert.ok(distance(next[i],{x:0,y:0})>=27-.001);
      for(let j=i+1;j<next.length;j++)assert.ok(distance(next[i],next[j])>=20-.001,`wave overlap ${tick}:${i},${j}`);
    }
    units=next;
  }
  assert.ok(units.filter(u=>u.x>30).length>12,'crowd must keep flowing');
});

test('arena adapter retains terrain, recalling targets, forced movement and dead-unit exclusion',()=>{
  const rock=ROCK_TERRAIN.find(r=>r.campId==='blue_highground');
  const walker={id:'walking',x:rock.x-55,y:rock.y,isAlive:true,team:'blue'},recall={id:'recall',x:rock.x-100,y:rock.y,isAlive:true,isRecalling:true};
  const dash={id:'dash',x:1200,y:380,isAlive:true,dash:{kind:'test'}},dead={id:'dead',x:1150,y:380,isAlive:false};
  const starts=captureUnitCollisionStarts([walker,recall,dash,dead]);walker.x+=2;dash.x+=9;
  const snapshot=structuredClone({recall,dash,dead});
  resolveArenaUnitCollisions([walker,recall,dash,dead],[],[],starts,1/30);
  assert.deepEqual({recall,dash,dead},snapshot);
  assert.equal(isInsideRockTerrain(walker.x,walker.y,13),false);
});
