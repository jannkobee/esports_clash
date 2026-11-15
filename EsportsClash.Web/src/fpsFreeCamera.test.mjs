import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFreeFlight,FreeMapControls} from './fps/fpsFreeCamera.ts';
test('free flight uses wall-clock input, equal diagonal speed, vertical controls and bounded travel',()=>{
  const p={x:0,y:5,z:0,yaw:0,pitch:0};
  assert.deepEqual(advanceFreeFlight(p,new Set(),.1),p);
  const forward=advanceFreeFlight(p,new Set(['KeyW']),.1),diagonal=advanceFreeFlight(p,new Set(['KeyW','KeyD']),.1);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-forward.z)<1e-8);
  assert.ok(advanceFreeFlight(p,new Set(['KeyE']),.1).y>p.y);
  assert.ok(advanceFreeFlight(p,new Set(['KeyQ']),.1).y<p.y);
  assert.ok(advanceFreeFlight(p,new Set(['KeyW','ShiftLeft']),.1).z>forward.z);
  const edge=advanceFreeFlight({...p,x:34,z:43,y:65},new Set(['KeyW','KeyD','KeyE']),10);
  assert.equal(edge.x,34);assert.equal(edge.z,43);assert.equal(edge.y,65);
});
test('free camera input ignores inactive controls and clears on blur and disposal',()=>{
  const doc=new EventTarget(),canvas=new EventTarget();Object.assign(canvas,{ownerDocument:doc});doc.activeElement=canvas;
  const controls=new FreeMapControls(canvas),press=()=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{code:'KeyW'});doc.dispatchEvent(e);};
  press();const start={...controls.pose};controls.update(true,.1);assert.deepEqual(controls.pose,start);
  press();controls.update(true,.1);assert.ok(controls.pose.z>start.z);
  canvas.dispatchEvent(new Event('blur'));const stopped={...controls.pose};controls.update(true,.1);assert.deepEqual(controls.pose,stopped);
  controls.dispose();press();controls.update(true,.1);assert.deepEqual(controls.pose,stopped);
});
