/** Palm-relative fittings for actual modeled handles, in canonical authoring units. */
export type ContactProfile={left?:readonly[number,number,number];right?:readonly[number,number,number];twoHand?:'gun'|'staff'|'totem'|'keg';bow?:boolean;closeLeft?:number;closeRight?:number};
const sword={right:[0,2,-5],closeRight:1} as const;
const staff={right:[0,2,-5],closeRight:1} as const;
const gun={right:[0,2,-4],closeRight:1} as const;
export const AVATAR_CONTACTS:Readonly<Record<string,ContactProfile>>=Object.freeze({
 c_solana:{...sword,left:[0,-4,-5],closeLeft:.8},c_astra:{bow:true,closeLeft:.9,closeRight:.55},c_kyumi:{},
 c_buck:{...gun,twoHand:'gun',closeLeft:.85},c_valkira:{...sword,left:[0,2,-5],closeLeft:1},
 c_kage:{left:[0,2,-8],right:[0,2,-8],closeLeft:.9,closeRight:.9},c_kazemaru:sword,
 c_kindra:{bow:true,closeLeft:.9,closeRight:.55},c_cora:{right:[0,0,-7],closeRight:.75},c_renn:{},
 c_sylla:staff,c_tequoia:staff,c_zal:staff,c_xin:{...sword,left:[0,2,-5],closeLeft:1},c_raijin:{},
 c_kaolin:{...staff,twoHand:'staff',closeLeft:1},c_inai:{...staff,twoHand:'staff',closeLeft:1},
 c_qiyana:{right:[0,2,0],closeRight:1},c_locke:sword,c_senna:{...gun,twoHand:'gun',closeLeft:.85},
 c_largo:{right:[0,2,-9]},c_shadowfiend:{},c_earthshaker:{right:[11.5,2,-8],twoHand:'totem',closeRight:1,closeLeft:1},
 c_mirehook:{right:[0,2,-7],left:[0,2,-4],closeRight:1,closeLeft:1},c_nullweaver:{},c_voltgrip:{},
 c_aetherbolt:{left:[0,2,2],closeLeft:.7},c_corsara:{...gun,left:[0,2,-4],closeLeft:1},
 c_brewmaw:{right:[0,-4,-8],twoHand:'keg',closeLeft:1,closeRight:1},
 c_wraithhook:{...staff,left:[0,-15,-7],closeLeft:1},c_invoker:{},
 c_hwei:{...staff,left:[0,14,-6],closeLeft:.45},c_jayce:{...staff,twoHand:'staff',closeLeft:1},
 c_vi:{left:[0,-1,-6],right:[0,-1,-6],closeLeft:1,closeRight:1},c_jinx:{...gun,twoHand:'gun',closeLeft:.85},
 c_puck:{},c_batrider:{},c_bristleback:{},c_io:{},c_lulu:staff,
 c_silencer:{right:[0,2,-7],left:[-8,2,-8],closeLeft:.6,closeRight:.75},
 c_wukong_lol:{...staff,twoHand:'staff',closeLeft:1},c_monkeyking_dota:{...staff,twoHand:'staff',closeLeft:1},
 c_stepstone:{left:[0,2,-3],right:[0,2,-3],closeLeft:1,closeRight:1},c_skybreaker:{},
});
export function contactGait(state:string){
 return state==='run'?{stance:.5,span:28,lift:5.5}:state==='strafe'?{stance:.66,span:20,lift:3}:{stance:.62,span:24,lift:3.5};
}
