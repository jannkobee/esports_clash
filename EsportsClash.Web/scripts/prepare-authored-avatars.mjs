import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {CHAMPIONS} from '../src/mockData.ts';
import {AVATAR_DESIGNS} from '../src/avatarDesigns.ts';
import {AUTHORED_AVATARS} from '../src/avatarArt.ts';
import {AvatarModelResources,buildAvatarModel} from '../src/threeAvatarModels.ts';
import {avatarModelAnimations} from '../src/avatarModelAnimations.ts';
import {disposeArenaTerrainResources} from '../src/threeArenaTerrain.ts';
import {COMBAT_MOTIONS} from '../src/avatarCombatMotion.ts';
import {AVATAR_MESH_PROFILES} from '../src/avatarMeshProfiles.ts';
globalThis.FileReader=class{result;onloadend;async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}async readAsDataURL(blob){this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onloadend?.();}};
const mesh=process.argv.includes('--mesh'),contact=mesh||process.argv.includes('--contact'),combat=contact||process.argv.includes('--combat'),stance=combat||process.argv.includes('--stance'),version=mesh?8:contact?7:combat?6:stance?5:4;
const output=mesh?'../.local-tools/mesh-prep':contact?'../.local-tools/contact-prep':combat?'../.local-tools/combat-prep':stance?'../.local-tools/stance-prep':'../.local-tools/artist-prep',selected=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
await mkdir(output+'/bodies',{recursive:true});await mkdir(output+'/parts',{recursive:true});
const exporter=new GLTFExporter(),resources=new AvatarModelResources(),rows=[];
for(const kit of CHAMPIONS){
 const art=AUTHORED_AVATARS[kit.id];if((!art&&!stance)||(selected&&selected!==kit.id))continue;
 const design=AVATAR_DESIGNS[kit.id],externalOutfit=!!art&&design.body==='scout';
 const model=buildAvatarModel(kit,resources,{externalAnatomy:!!art,externalOutfit});
 const clips=avatarModelAnimations(model),root=new THREE.Group();root.name=kit.displayName;root.scale.setScalar(.025);
 root.userData={avatarId:kit.id,units:'meters',authoring:'Esports Clash costume and equipment with Blender-authored licensed anatomy'};root.add(model.body);
 const binary=await exporter.parseAsync(root,{binary:true,onlyVisible:false,animations:clips});await writeFile(`${output}/bodies/${kit.id}.glb`,Buffer.from(binary));
 rows.push({id:kit.id,name:kit.displayName,...art,...(combat?{motion:COMBAT_MOTIONS[kit.id]}:{}),...(mesh?{mesh:AVATAR_MESH_PROFILES[kit.id]}:{}),anatomy:!!art,outfit:externalOutfit,primary:kit.primaryColor,accent:kit.accentColor,skin:design.skin,hairColor:design.hair,height:design.height,width:design.width*.85,handColor:kit.id==='c_invoker'?'#302b32':design.skin});model.dispose();
}
disposeArenaTerrainResources(resources.owner);
await writeFile(`${output}/avatars.json`,JSON.stringify({version,date:'2026-10-17',avatars:rows},null,2)+'\n');console.log(JSON.stringify({prepared:rows.length,output}));
