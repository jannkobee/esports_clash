import {Mesh,type ShadowGenerator} from '@babylonjs/core';
import type {LivePlayer} from './fpsLiveSimulation.ts';

/** Bounded reuse of weapon/viewmodel meshes across equip and camera changes. */
export class LiveRenderCache<K,V>{
  private values=new Map<K,V>();
  private readonly limit:number;
  private readonly disposeValue:(value:V)=>void;
  constructor(limit:number,disposeValue:(value:V)=>void){this.limit=limit;this.disposeValue=disposeValue;}
  has(key:K):boolean{return this.values.has(key);}
  get(key:K,create:()=>V):V{
    let value=this.values.get(key);
    if(value===undefined)value=create();
    this.values.delete(key);this.values.set(key,value);
    while(this.values.size>this.limit){const oldest=this.values.keys().next().value!;this.disposeValue(this.values.get(oldest)!);this.values.delete(oldest);}
    return value;
  }
  clear(){for(const value of this.values.values())this.disposeValue(value);this.values.clear();}
}

/** Merge immutable opaque geometry sharing material, vertex layout and shadow behavior. */
export function batchStaticLiveGeometry(meshes:readonly Mesh[],shadows?:ShadowGenerator){
  const groups=new Map<string,Mesh[]>(),casters=new Set(shadows?.getShadowMap()?.renderList??[]);
  const retained=new Set(meshes),inputVertices=meshes.reduce((sum,mesh)=>sum+mesh.getTotalVertices(),0);
  let mergedCount=0;
  for(const mesh of meshes){
    if(mesh.isDisposed()||mesh.parent||mesh.skeleton||mesh.morphTargetManager||!mesh.material||!mesh.getTotalVertices()||mesh.visibility<1||mesh.material.needAlphaBlending())continue;
    mesh.computeWorldMatrix(true);
    const cast=shadows?casters.has(mesh):mesh.metadata?.castShadow!==false;
    const key=`${mesh.material.uniqueId}:${mesh.receiveShadows}:${mesh.renderingGroupId}:${cast}:${mesh.getVerticesDataKinds().sort().join(',')}`;
    const group=groups.get(key);if(group)group.push(mesh);else groups.set(key,[mesh]);
  }
  for(const group of groups.values()){
    if(group.length>1){
      const first=group[0],cast=shadows?casters.has(first):first.metadata?.castShadow!==false,receive=first.receiveShadows,renderingGroup=first.renderingGroupId;
      const merged=Mesh.MergeMeshes(group,false,true);
      if(merged){
        merged.name=`static-batch-${merged.uniqueId}`;merged.isPickable=false;merged.receiveShadows=receive;merged.renderingGroupId=renderingGroup;
        merged.metadata={castShadow:cast};
        for(const mesh of group){shadows?.removeShadowCaster(mesh);retained.delete(mesh);mesh.dispose(false,false);}
        retained.add(merged);
        if(cast)shadows?.addShadowCaster(merged);
        merged.freezeWorldMatrix();merged.doNotSyncBoundingInfo=true;mergedCount+=group.length-1;
      }
    }else{group[0].freezeWorldMatrix();group[0].doNotSyncBoundingInfo=true;}
  }
  const outputMeshes=[...retained],stats={input:meshes.length,removed:mergedCount,output:outputMeshes.length,inputVertices,outputVertices:outputMeshes.reduce((sum,mesh)=>sum+mesh.getTotalVertices(),0)};
  if(meshes[0])meshes[0].getScene().metadata={...(meshes[0].getScene().metadata??{}),fpsStaticBatch:stats};
  return {...stats,meshes:outputMeshes};
}

/** Visual interpolation only; authoritative action times, aim and physics stay intact. */
export function interpolateLivePlayer(before:LivePlayer|undefined,current:LivePlayer,alpha:number):LivePlayer {
  if(!before)return current;
  const t=Math.max(0,Math.min(1,alpha)),mix=(a:number,b:number)=>a+(b-a)*t;
  const sameWeapon=before.equipped===current.equipped;
  return {...current,x:mix(before.x,current.x),z:mix(before.z,current.z),
    yaw:before.yaw+Math.atan2(Math.sin(current.yaw-before.yaw),Math.cos(current.yaw-before.yaw))*t,
    pitch:mix(before.pitch??0,current.pitch??0),recoilYaw:mix(before.recoilYaw??0,current.recoilYaw??0),recoilPitch:mix(before.recoilPitch??0,current.recoilPitch??0),
    jumpY:mix(before.jumpY??0,current.jumpY??0),speed:mix(before.speed,current.speed),scopeLevel:mix(before.scopeLevel??0,current.scopeLevel??0),
    reload:sameWeapon&&before.reload>0&&current.reload>0?mix(before.reload,current.reload):current.reload,
    weaponReady:sameWeapon?mix(before.weaponReady,current.weaponReady):current.weaponReady,
    channel:sameWeapon&&before.channel>0&&current.channel>0?mix(before.channel,current.channel):current.channel};
}
