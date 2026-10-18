import * as THREE from 'three';

type V = readonly [number, number, number];
type Fitting = { part: string; tip: V; base?: V; style: 'gun' | 'bow' | 'blade' | 'magic' | 'fist' };
const blade = (length: number): Fitting => ({part:'right-grip',tip:[0,length,5],base:[0,4,5],style:'blade'});
const staff = (height: number): Fitting => ({part:'right-grip',tip:[0,height,5],base:[0,12,5],style:'magic'});
const hand: Fitting = {part:'right-grip',tip:[0,-2,6],base:[0,-2,0],style:'magic'};
const gun = (length: number, heavy = false): Fitting => ({part:'right-grip',tip:[0,2,8+length*(heavy?.76:.9)],base:[0,2,18],style:'gun'});
const bow: Fitting = {part:'bow',tip:[10,0,0],base:[0,0,0],style:'bow'};
const creature = (tip: V): Fitting => ({part:'outfit',tip,style:'magic'});

/** Points on the actual modeled equipment, in the owning part's authoring units.
 * Bind after loading: v8 GLBs and code models share these rig parts, even though
 * mesh batching removes individual barrel/blade meshes. No asset rewrite needed. */
export const AVATAR_WEAPON_SOCKETS: Readonly<Record<string,Fitting>> = {
 c_solana:blade(42),c_astra:bow,c_kyumi:{...hand,tip:[2,5,17]},c_buck:{...gun(35),tip:[2.415,2,39.5]},
 c_valkira:blade(42),c_kage:{...blade(-30),tip:[0,-30,18]},c_kazemaru:blade(47),c_kindra:bow,
 c_cora:{...hand,tip:[0,14,7]},c_renn:hand,c_sylla:staff(49),c_tequoia:staff(40),c_zal:staff(50),
 c_xin:blade(35),c_raijin:hand,c_kaolin:staff(66),c_inai:staff(52),
 c_qiyana:{part:'elemental-hoop',tip:[0,19,0],base:[0,-19,0],style:'blade'},
 c_locke:blade(40),c_senna:gun(60,true),c_largo:{part:'right-arm',tip:[0,-25,9],style:'fist'},
 c_shadowfiend:{part:'soul-claw:1',tip:[0,-39,6],style:'magic'},
 c_earthshaker:{...blade(22),tip:[0,22,8],base:[0,-12,8]},
 c_mirehook:{part:'meat-hook',tip:[9,22.5,0],base:[0,3,0],style:'blade'},
 c_nullweaver:creature([0,46,15]),c_voltgrip:{part:'right-arm',tip:[0,-31,11],style:'fist'},
 c_aetherbolt:{...hand,tip:[0,-1,9],style:'magic'},c_corsara:gun(24),
 c_brewmaw:{...blade(-27),tip:[0,-27,8],base:[0,2,8]},
 c_wraithhook:staff(61),c_invoker:hand,c_hwei:staff(69),c_jayce:{...staff(29),tip:[-8,28,23]},
 c_vi:{...hand,tip:[0,-8,11],style:'fist'},c_jinx:gun(49,true),
 c_puck:creature([0,30,28]),c_batrider:creature([16,48,19]),c_bristleback:{...creature([20,28,14]),style:'fist'},
 c_io:creature([0,38,12]),c_lulu:staff(46),c_silencer:{...hand,tip:[-6,23,7]},
 c_wukong_lol:{...staff(54),style:'blade'},c_monkeyking_dota:{...staff(63),style:'blade'},
 c_stepstone:{...hand,tip:[0,-3,7],style:'fist'},
 c_skybreaker:{part:'flak-cannon',tip:[0,0,32],base:[0,0,0],style:'gun'},
};

export type WeaponSocket = { tip: [number,number,number]; base: [number,number,number]; style: Fitting['style']; avatarId?:string };
export function bindWeaponSocket(root: THREE.Object3D, id: string) {
 const fitting = AVATAR_WEAPON_SOCKETS[id];
 if (!fitting) return () => undefined;
 let part: THREE.Object3D | undefined;
 root.traverse(node => {if(node.userData.avatarPart===fitting.part)part=node;});
 // Non-standing rigs attach props to arm groups rather than palm groups.
 if(!part && fitting.part==='right-grip')root.traverse(node=>{if(node.userData.avatarPart==='right-arm')part=node;});
 const tip=new THREE.Vector3(),base=new THREE.Vector3();
 return (): WeaponSocket | undefined => {
  if(!part)return;
  for(let node: THREE.Object3D | null=part;node;node=node.parent)if(!node.visible)return;
  part.updateWorldMatrix(true,false);
  tip.set(...fitting.tip).applyMatrix4(part.matrixWorld);
  base.set(...(fitting.base??fitting.tip)).applyMatrix4(part.matrixWorld);
  return {tip:tip.toArray(),base:base.toArray(),style:fitting.style,avatarId:id};
 };
}
