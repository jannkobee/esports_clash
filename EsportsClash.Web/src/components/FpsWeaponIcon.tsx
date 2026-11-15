import {LIVE_WEAPONS,type LiveEquippedWeapon,type LiveWeapon} from '../fps/fpsLiveWeapons';

/** Separate, tightly framed profiles stay recognizable at roster/killfeed size. */
const profiles:Record<LiveWeapon,{body:string;detail:string;short?:boolean}>={
  pistol:{short:true,body:'M2 8h27l6 4v5H22l-4 12H9l3-14H2Z',detail:'M6 11h22M22 18h6'},
  usp_s:{short:true,body:'M2 9h27V7h17v6H29v5H21l-4 11H9l3-14H2Z',detail:'M33 9v2m5-2v2M6 11h19M22 19h5'},
  glock:{short:true,body:'M3 7h28l5 3v8H23l-5 12H8l4-15H3Z',detail:'M8 10h22M27 8v5m3-5v5M22 20h7'},
  p250:{short:true,body:'M3 8h25l7 3v6H22l-4 12H9l3-13H3Z',detail:'M7 11h19M23 19h6M26 10v4'},
  fiveseven:{short:true,body:'M2 8h31l7 4v5H23l-5 12H9l4-14H2Z',detail:'M7 10h25M22 19h8m-3-9h5'},
  tec9:{short:true,body:'M3 10h20l3-3h18v6H30l-4 16H17l3-12h-5l-4 12H4l4-14H3Z',detail:'M27 10h13M10 13h10M21 19l-2 7'},
  cz75:{short:true,body:'M2 9h29l6 3v5H28l-2 11h-6l2-11h-4l-4 12H7l4-14H2Z',detail:'M7 11h21M22 19h5M30 14h6'},
  deagle:{short:true,body:'M2 8 7 4h29l8 7v6H27l-5 13H10l4-15H2Z',detail:'M8 8h27l5 5H25M28 19h7M13 21h7'},
  rifle:{body:'M2 15h14l7-7h31l5 4h29v4H57l-4 5H38l-3 9H24l2-12H15l-5 6H2Z',detail:'M28 11h22M65 10v6M39 22h9'},
  m4a1_s:{body:'M2 13h15l4-5h30l5 4h17V9h20v7H56l-4 5H38l-2 9H25l3-12H18l-4 6H2Z',detail:'M24 6h28M26 10v4m4-4v4m4-4v4M43 21v6M76 11h14'},
  budget_ct:{body:'M3 13h16l7-6h34l5 5h27v4H62l-5 7H44l-3 8H30l2-14H18l-7 7H3Z',detail:'M30 4h24v4M33 11h21M48 23h7v6M69 13h19'},
  budget_t:{body:'M2 14h14l10-6h35l7 5h24v3H67l-9 5H44q2 6 6 9H39l-7-12H21l-7 7H2Z',detail:'M29 11h26M44 22l4 6M71 14h18'},
  ak47:{body:'M2 13 14 9l9 3 6-5h29l6 5h28v4H65l-5 4H46q2 7 10 9l-5 3q-12-3-14-13H27l-4 10h-9l4-14-7 6H2Z',detail:'M31 10h21M61 9v8M40 21q3 6 9 8M20 13l-7 4'},
  sniper:{body:'M1 15h18l9-5h31l4 3h30v3H63l-7 5H32l-8 9H12l6-11H1Z M39 3h25v6H39Z M47 8h5v5h-5Z',detail:'M42 5h18M67 14h24M25 15h23M30 21l-4 6'},
  scout:{body:'M2 15h15l9-5h29l4 4h34v2H59l-7 5H28l-6 8H9l8-11H2Z M37 5h20v4H37Z M43 8h4v5h-4Z',detail:'M39 7h15M62 15h29M30 13h19'},
  smg:{body:'M3 13h16l6-6h31v6h24v4H52l-2 13H38l1-12H25l-3 9H12l4-11H3Z',detail:'M29 10h22M59 14h17M41 20v7'},
  mp9:{body:'M4 14h15l7-8h35l3 6h18v5H61l-4 9h-6l1-9H39l-2 13H25l3-14H4Z',detail:'M29 10h25M30 6V3h16v3M52 18l-1 7'},
  mac10:{body:'M5 8h49v5h22v5H54l-6 4H35v10H24V18H5Z M5 6H1v18h4Z',detail:'M10 11h38M38 8V4h8v4M27 21h5M59 14h14'},
  mag7:{body:'M3 10h22l5-4h41v5h19v6H61v5H44l-2 10H28l2-15H18l-5 8H3Z',detail:'M33 10h30M47 21h10v8H45M72 13h15'},
  nova:{body:'M2 15h17l9-6h61v3H62v4H45l-8 5H26l-7 9H7l10-12H2Z',detail:'M47 12h15v7H45ZM65 10h22M28 13h12'},
  negev:{body:'M2 13h16l7-7h36l7 6h25v6H66l-6 5H48v9H29V19H19l-7 7H2Z',detail:'M30 3h26v3M31 11h27M35 21v8m6-8v8M75 17l-7 13m9-13 8 13M71 14h19'},
};

export function FpsWeaponIcon({weapon,attacking=false}:{weapon:LiveEquippedWeapon;attacking?:boolean}){
  const gun=Object.hasOwn(LIVE_WEAPONS,weapon)?profiles[weapon as LiveWeapon]:undefined;
  const name=gun?LIVE_WEAPONS[weapon as LiveWeapon].name:weapon==='incendiary'?(attacking?'Molotov':'Incendiary'):weapon==='flash'?'Flashbang':weapon==='he'?'HE grenade':weapon==='bomb'?'C4':weapon==='knife'?'Knife':'Smoke grenade';
  const body=gun?.body??(weapon==='knife'?'M2 18h20L68 7l25 2-21 10-50 3H2Z M19 12h4v16h-4Z'
    :weapon==='incendiary'&&attacking?'M21 2h6v9l7 7v12H13V18l8-7Z M25 2l9-2 4 5-8 3Z'
    :weapon==='flash'?'M20 2h9v5h5v23H15V7h5Z'
    :weapon==='he'?'M19 4h12v5q8 4 8 11T25 32Q11 30 11 20T19 9Z'
    :weapon==='bomb'?'M7 9h35v22H7Z M12 2h6v7h-6ZM31 2h5v7h-5Z'
    :'M16 7h20v23H16Z M21 2h10v5H21Z M32 4h8v2h-8Z');
  const detail=gun?.detail??(weapon==='flash'?'M15 11h19m-19 6h19m-19 6h19':weapon==='he'?'M13 17h24m-24 7h24M21 11v18m8-18v18':weapon==='bomb'?'M11 14h12v6H11Zm17 0h9m-9 5h9m-26 6h26':'M18 14h16m-16 7h16');
  return <svg viewBox={`0 0 ${gun?(gun.short?48:96):weapon==='knife'?96:48} 34`} className="broadcast-weapon-icon" role="img" aria-label={name}>
    <title>{name}</title><path d={body} fill="currentColor"/>
    <path d={detail} fill="none" stroke="var(--weapon-icon-detail,#101a23)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>;
}
