/** Dependency-free identity table: safe in either combat module import order. */
export const V3_ROSTER_KEYS={
 c_solana:'solenne-vaelor',c_astra:'ivera-frostwhistle',c_kyumi:'mireth-lune',c_buck:'bramm-coil',
 c_valkira:'kael-vespera',c_kage:'nyxara-vale',c_kazemaru:'serrin-galecrest',c_kindra:'orin-and-fen',
 c_cora:'quillene-rook',c_renn:'aurelio-vane',c_sylla:'droven-bearmantle',c_tequoia:'thalara-rootwright',
 c_zal:'vesper-loom',c_xin:'rux-emberchain',c_kaolin:'joruun-jadecoil',c_inai:'astrax-mire',
 c_qiyana:'prismelle-cade',c_locke:'ashkar-veilhand',c_senna:'maris-solquill',c_largo:'odo-bogsong',
 c_shadowfiend:'mourn-ashwake',c_earthshaker:'dolm-runesunder',c_mirehook:'garruk-mawsuture',
 c_voltgrip:'coiljack-ampfist',c_aetherbolt:'talan-slipshot',c_corsara:'calixa-broadwake',
 c_brewmaw:'brohm-caskfall',c_hwei:'maelis-chromabloom',c_jayce:'axiom-rail',c_vi:'brakka-fenn',
 c_jinx:'pippa-fuseburst',c_batrider:'bryx-emberkite',c_bristleback:'murdle-ridgehide',
 c_io:'nemea-halolink',c_lulu:'thimble-briarwish',c_silencer:'sevrin-inkseal',
 c_wukong_lol:'koro-cloudtail',c_monkeyking_dota:'bram-stonebranch',c_stepstone:'toma-bellbreak',
 c_skybreaker:'ravelle-skyrake',
} as const;
export type RosterHero=typeof V3_ROSTER_KEYS[keyof typeof V3_ROSTER_KEYS];
