import {MeshBuilder,Vector3,StandardMaterial,Color3,type Mesh,type Scene} from '@babylonjs/core';
import {arenaGroundHeight} from '../arenaElevation';
import {buildAbilityEffectPlan} from './abilityEffectPlan';
import type {ViewerSnapshot} from './MatchViewer';

/** Scene-owned emissive geometry. Choreography comes only from copied match time/state. */
export class AbilityWorldEffects {
  private meshes=new Map<string,{mesh:Mesh;count:number;shape:string}>();
  private materials=new Map<string,StandardMaterial>();
  constructor(private scene:Scene){}
  update(snapshot:ViewerSnapshot){
    const seen=new Set<string>();
    for(const p of buildAbilityEffectPlan(snapshot)){
      seen.add(p.id);let entry=this.meshes.get(p.id);
      if(entry&&(entry.count!==p.points.length||entry.shape!==p.shape)){entry.mesh.dispose();this.meshes.delete(p.id);entry=undefined;}
      const points=p.points.map(q=>new Vector3(q.x,arenaGroundHeight(q.x,q.y)+q.height,q.y));
      if(!entry){
        const mesh=p.shape==='orb'?MeshBuilder.CreateSphere(`ability-world:${p.id}`,{diameter:2,segments:6},this.scene):
          MeshBuilder.CreateTube(`ability-world:${p.id}`,{path:points,radius:p.radius,tessellation:6,updatable:true},this.scene);
        mesh.isPickable=false;mesh.alphaIndex=20;entry={mesh,count:p.points.length,shape:p.shape};this.meshes.set(p.id,entry);
      }else if(p.shape==='path')MeshBuilder.CreateTube('',{path:points,radius:p.radius,instance:entry.mesh},this.scene);
      if(p.shape==='orb'){entry.mesh.position.copyFrom(points[0]);entry.mesh.scaling.setAll(p.radius);}
      let material=this.materials.get(p.color);
      if(!material){material=new StandardMaterial(`ability-light:${p.color}`,this.scene);material.disableLighting=true;
        material.emissiveColor=Color3.FromHexString(p.color);material.diffuseColor=Color3.Black();material.specularColor=Color3.Black();
        material.alpha=.98;material.disableDepthWrite=true;material.backFaceCulling=false;this.materials.set(p.color,material);}
      entry.mesh.material=material;entry.mesh.visibility=Math.min(1,p.opacity);
    }
    for(const [id,e] of this.meshes)if(!seen.has(id)){e.mesh.dispose();this.meshes.delete(id);}
  }
  diagnostics(){return {worldMeshes:this.meshes.size,worldMaterials:this.materials.size};}
  dispose(){for(const e of this.meshes.values())e.mesh.dispose();for(const m of this.materials.values())m.dispose();this.meshes.clear();this.materials.clear();}
}
