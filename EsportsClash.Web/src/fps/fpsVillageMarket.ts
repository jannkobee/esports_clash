import {MeshBuilder,type Scene} from '@babylonjs/core';
import type {VillageBuilder} from './fpsVillageArchitecture.ts';

import {VILLAGE_MARKET_STALLS} from './fpsVillageMarketLayout.ts';

export function buildVillageMarket(scene:Scene,{box,detail}:VillageBuilder):void {
  for(const stall of VILLAGE_MARKET_STALLS){
    const {id,x,z,w,d}=stall;
    for(let board=0;board<8;board++)box(`market-${id}-timber-slat-${board}`,x-w/2+(board+.5)*w/8,.52,z-d/2-.018,w/8-.018,.8,.035,'#a17b50');
    box(`market-${id}-counter-top`,x,1.04,z,w+.08,.08,d+.08,'#c8ab77');
    for(let stripe=0;stripe<9;stripe++){
      box(`market-${id}-canvas-stripe-${stripe}`,x-(w+.5)/2+(stripe+.5)*(w+.5)/9,2.745,z,(w+.5)/9,.018,d+1,stripe%2?'#e9d9ae':stall.canvas);
      box(`market-${id}-scalloped-valance-${stripe}`,x-(w+.5)/2+(stripe+.5)*(w+.5)/9,2.61,z-(d+1)/2,(w+.5)/9,.23,.035,stripe%2?'#e9d9ae':stall.canvas);
    }
    if(id==='produce')for(let bin=0;bin<3;bin++){
      const bx=x-.51+bin*.51;
      box(`market-produce-tray-${bin}`,bx,1.11,z,.47,.12,.78,'#795e3e');
      for(let fruit=0;fruit<15;fruit++){
        const item=detail(MeshBuilder.CreateSphere(`market-fruit-${bin}-${fruit}`,{diameter:.105,segments:6},scene),['#c56b49','#b7aa47','#789449'][bin]);
        item.position.set(bx-.15+(fruit%3)*.15,1.23+Math.floor(fruit/9)*.075,z-.27+Math.floor(fruit%9/3)*.23);
      }
    }
    if(id==='bread')for(let loaf=0;loaf<10;loaf++){
      const item=detail(MeshBuilder.CreateCapsule(`market-bread-loaf-${loaf}`,{height:.35,radius:.055,tessellation:8},scene),'#c89d5e');
      item.position.set(x-.5+(loaf%5)*.25,1.14,z-.19+Math.floor(loaf/5)*.38);item.rotation.z=Math.PI/2;
    }
    if(id==='fish'){
      box('market-fish-ice-tray',x,1.11,z,w-.15,.1,d-.12,'#c8d6ce');
      for(let fish=0;fish<7;fish++){
        const fx=x-.72+fish*.23;
        const item=detail(MeshBuilder.CreateSphere(`market-fish-${fish}`,{diameter:.25,segments:8},scene),'#839d9a');item.position.set(fx,1.19,z);item.scaling.set(.4,.25,1.6);
        const tail=detail(MeshBuilder.CreateCylinder(`market-fish-tail-${fish}`,{height:.09,diameter:.1,tessellation:3},scene),'#728783');tail.position.set(fx,1.19,z+.22);tail.rotation.x=Math.PI/2;tail.scaling.z=.2;
      }
    }
    for(const side of [-1,1]){
      const basket=detail(MeshBuilder.CreateCylinder(`market-${id}-basket-${side}`,{height:.3,diameterTop:.35,diameterBottom:.27,tessellation:12},scene),'#977447');basket.position.set(x+side*w*.33,.2,z);
    }
    const sign=box(`market-${id}-hanging-trade-sign`,x,2.22,z-d/2-.03,.48,.31,.04,'#6a6044');
    sign.rotation.z=.035;
    box(`market-${id}-sign-emblem`,x,2.22,z-d/2-.056,.19,id==='fish'?.065:.16,.015,id==='fish'?'#b1c5bd':'#dbb777');
  }
}
