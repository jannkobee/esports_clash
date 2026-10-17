/** Mesh-only proportions. Joint spacing, game size, speed and hitboxes are unchanged. */
export type MeshProfile={chest:number;waist:number;limb:number;face:number;depth:number;finish:'plate'|'leather'|'cloth'|'organic'|'machine'|'light';mark:'sun'|'frost'|'leaf'|'flame'|'wave'|'rune'|'gear';attack:'cut'|'thrust'|'draw'|'shot'|'crush'|'punch'|'weave'|'sweep'|'pulse';sweep:number};
const profile=(chest:number,waist:number,limb:number,face:number,depth:number,finish:MeshProfile['finish'],mark:MeshProfile['mark'],attack:MeshProfile['attack'],sweep:number):MeshProfile=>({chest,waist,limb,face,depth,finish,mark,attack,sweep});
export const AVATAR_MESH_PROFILES:Readonly<Record<string,MeshProfile>>=Object.freeze({
 c_solana:profile(1.06,.94,1.02,1.02,1.05,'plate','sun','cut',.24),
 c_astra:profile(.98,.89,.93,.96,.97,'leather','frost','draw',.08),
 c_kyumi:profile(.96,.87,.92,.94,.96,'cloth','flame','weave',.23),
 c_buck:profile(1.1,1.08,1.16,1.08,1.1,'leather','gear','shot',.16),
 c_valkira:profile(1.04,.93,1.04,1.03,1.02,'plate','rune','cut',.32),
 c_kage:profile(.99,.9,.98,.94,.95,'leather','rune','thrust',.3),
 c_kazemaru:profile(1.03,.91,1.01,.98,1,'cloth','wave','cut',.44),
 c_kindra:profile(.95,.88,.92,.93,.96,'leather','leaf','draw',.12),
 c_cora:profile(.98,.9,.95,.96,.98,'cloth','wave','sweep',.37),
 c_renn:profile(1.04,.94,1.02,1,1.03,'cloth','sun','sweep',.42),
 c_sylla:profile(1.08,1.05,1.08,1.08,1.06,'leather','leaf','crush',.28),
 c_tequoia:profile(1.01,.93,.96,.97,1.02,'organic','leaf','sweep',.31),
 c_zal:profile(.97,.96,.94,.95,.98,'cloth','rune','weave',.26),
 c_xin:profile(1.05,.93,1.05,1.01,1.03,'plate','flame','cut',.39),
 c_raijin:profile(1.12,1.09,1.11,1.08,1.12,'cloth','wave','pulse',.27),
 c_kaolin:profile(1.1,1.02,1.14,1.04,1.07,'plate','rune','crush',.38),
 c_inai:profile(.96,.9,.92,.94,.97,'cloth','rune','sweep',.34),
 c_qiyana:profile(1.01,.87,1,.98,1.03,'plate','leaf','sweep',.46),
 c_locke:profile(1.02,.94,.98,1,1.02,'leather','flame','thrust',.35),
 c_senna:profile(1,.91,.97,.99,1.02,'plate','rune','shot',.22),
 c_largo:profile(1.04,1.1,1.08,1,1.07,'organic','wave','crush',.34),
 c_shadowfiend:profile(1.12,.85,1.06,1,1.08,'organic','flame','pulse',.4),
 c_earthshaker:profile(1.13,1.04,1.18,1.08,1.1,'plate','rune','crush',.46),
 c_mirehook:profile(1.08,1.18,1.14,1.1,1.16,'leather','rune','cut',.36),
 c_nullweaver:profile(1.03,.86,.92,1,1.02,'light','rune','pulse',.26),
 c_voltgrip:profile(1.12,1.03,1.18,1,1.1,'machine','gear','punch',.32),
 c_aetherbolt:profile(1,.92,.95,.98,1,'leather','sun','punch',.22),
 c_corsara:profile(1.01,.91,.97,1.01,1.01,'leather','wave','shot',.18),
 c_brewmaw:profile(1.07,1.16,1.12,1.1,1.14,'leather','gear','crush',.3),
 c_wraithhook:profile(.99,.91,.97,.95,.98,'plate','rune','sweep',.42),
 c_invoker:profile(1.04,.92,.99,1.02,1.03,'cloth','sun','weave',.29),
 c_hwei:profile(.96,.89,.93,.95,.97,'cloth','wave','sweep',.4),
 c_jayce:profile(1.11,.98,1.12,1.06,1.08,'plate','gear','crush',.43),
 c_vi:profile(1.07,.93,1.12,1.03,1.05,'leather','gear','punch',.4),
 c_jinx:profile(.94,.86,.9,.95,.95,'leather','gear','shot',.24),
 c_puck:profile(1,.91,.95,1,1.04,'organic','wave','pulse',.23),
 c_batrider:profile(1.03,.98,1.01,1,1.04,'leather','flame','sweep',.31),
 c_bristleback:profile(1.12,1.1,1.16,1,1.12,'organic','leaf','crush',.36),
 c_io:profile(1,.9,.9,1,1,'light','wave','pulse',.19),
 c_lulu:profile(.98,.91,.93,.98,1.01,'cloth','leaf','weave',.32),
 c_silencer:profile(1.07,.94,1.04,1.01,1.05,'plate','rune','cut',.26),
 c_wukong_lol:profile(1.03,.9,1.04,1.02,1.02,'cloth','wave','sweep',.47),
 c_monkeyking_dota:profile(1.09,.96,1.1,1.06,1.07,'plate','leaf','crush',.48),
 c_stepstone:profile(1.05,.89,1.08,.99,1.02,'cloth','gear','punch',.34),
 c_skybreaker:profile(1.08,.97,1.05,1,1.06,'machine','gear','shot',.28),
});

/** Smooth cross-section changes in the canonical bind frame, away from fixed joint centers. */
export function meshSection(profile:MeshProfile,y:number){
 const chest=Math.exp(-(((y-47)/8)**2)),waist=Math.exp(-(((y-34)/5)**2));
 return {x:1+(profile.chest-1)*chest+(profile.waist-1)*waist,z:1+(profile.depth-1)*(chest+waist*.5)};
}
