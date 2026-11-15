import catalog from './fps-player-architecture-v4.json' with { type: 'json' };

export const FPS_ARCHITECTURE_VERSION=4;
export type FpsTemperament='VOLATILE'|'STEADY'|'ICE_COLD';
export type FpsPlaystyle='PASSIVE'|'BALANCED'|'AGGRESSIVE';
export type FpsMindset='INDIVIDUALIST'|'TEAM_FIRST';
export type FpsDecisionStyle='INSTINCTIVE'|'METHODICAL'|'ADAPTIVE';
export interface FpsPersonality {temperament:FpsTemperament;playstyle:FpsPlaystyle;mindset:FpsMindset;decisionStyle:FpsDecisionStyle;id:string;name:string}
export type FpsTPosition='T_IGL'|'T_ENTRY'|'T_SUPPORT'|'T_LURKER'|'T_FLEX';
export type FpsCtPosition='CT_IGL'|'CT_ROTATOR'|'CT_ANCHOR_A'|'CT_ANCHOR_B'|'CT_FLEX';
export type FpsPosition=FpsTPosition|FpsCtPosition;
export interface FpsAssignments {t:FpsTPosition;ct:FpsCtPosition}
export const FPS_T_POSITIONS=catalog.tPositions as FpsTPosition[];
export const FPS_CT_POSITIONS=catalog.ctPositions as FpsCtPosition[];
export const FPS_POSITION_LABELS:Record<FpsPosition,string>={T_IGL:'T · In-Game Leader',T_ENTRY:'T · Entry Rifler',T_SUPPORT:'T · Support Rifler',T_LURKER:'T · Lurker',T_FLEX:'T · Flex',CT_IGL:'CT · In-Game Leader',CT_ROTATOR:'CT · Rotator',CT_ANCHOR_A:'CT · A Anchor',CT_ANCHOR_B:'CT · B Anchor',CT_FLEX:'CT · Flex'};
export const FPS_PERSONALITY_DIMENSIONS={temperament:catalog.temperaments as FpsTemperament[],playstyle:catalog.playstyles as FpsPlaystyle[],mindset:catalog.mindsets as FpsMindset[],decisionStyle:catalog.decisionStyles as FpsDecisionStyle[]};
export const FPS_BASE_BEHAVIORAL_PROFILES=catalog.profiles;
export const personalityLabel=(value:string)=>value==='ICE_COLD'?'Ice-Cold':value==='TEAM_FIRST'?'Team-First':value.toLowerCase().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
export function fpsBaseProfileId(p:Pick<FpsPersonality,'playstyle'|'mindset'|'decisionStyle'>):number {
  return FPS_PERSONALITY_DIMENSIONS.playstyle.indexOf(p.playstyle)*6+FPS_PERSONALITY_DIMENSIONS.mindset.indexOf(p.mindset)*3+FPS_PERSONALITY_DIMENSIONS.decisionStyle.indexOf(p.decisionStyle)+1;
}
export function validateFpsPersonality(value:unknown):FpsPersonality {
  if(!value||typeof value!=='object')throw Error('Missing four-dimensional personality');
  const p=value as FpsPersonality;
  for(const [key,values] of Object.entries(FPS_PERSONALITY_DIMENSIONS))if(!(values as string[]).includes(p[key as keyof typeof FPS_PERSONALITY_DIMENSIONS]))throw Error('Invalid personality dimension: '+key);
  const id=[p.temperament,p.playstyle,p.mindset,p.decisionStyle].join(':');
  return {temperament:p.temperament,playstyle:p.playstyle,mindset:p.mindset,decisionStyle:p.decisionStyle,id,name:`${personalityLabel(p.temperament)} ${catalog.profiles[fpsBaseProfileId(p)-1].name}`};
}
export const FPS_IDENTITY_PERSONALITIES:readonly FpsPersonality[]=FPS_PERSONALITY_DIMENSIONS.temperament.flatMap(temperament=>FPS_PERSONALITY_DIMENSIONS.playstyle.flatMap(playstyle=>FPS_PERSONALITY_DIMENSIONS.mindset.flatMap(mindset=>FPS_PERSONALITY_DIMENSIONS.decisionStyle.map(decisionStyle=>validateFpsPersonality({temperament,playstyle,mindset,decisionStyle})))));
/** FNV-1a shared with PHP; capability, role and match seed are deliberately absent. */
export function fpsIdentityHash(value:string):number {let hash=2166136261;for(const byte of new TextEncoder().encode(value))hash=Math.imul(hash^byte,16777619)>>>0;return hash;}
export function generateFpsPersonality(playerId:string):FpsPersonality {return {...FPS_IDENTITY_PERSONALITIES[fpsIdentityHash(playerId+':fps-personality-v4')%54]};}
export function naturalFpsIdentity(p:FpsPersonality,position:FpsPosition):string {
  const profile=catalog.profiles[fpsBaseProfileId(p)-1];
  const label=position.startsWith('T_')?profile.t[position as FpsTPosition]:profile.ct[position as FpsCtPosition];
  if(!label)throw Error('Unknown tactical position');
  return `${personalityLabel(p.temperament)} ${label}`;
}
export function validateFpsLineup(players:readonly {id:string;assignments:FpsAssignments}[]):void {
  if(players.length!==5||new Set(players.map(p=>p.id)).size!==5)throw Error('A lineup requires exactly five distinct players');
  for(const [side,required] of [['t',FPS_T_POSITIONS],['ct',FPS_CT_POSITIONS]] as const){
    const positions=players.map(p=>p.assignments?.[side]);
    if(new Set(positions).size!==5||required.some(position=>!positions.includes(position as never)))throw Error('All five unique '+side.toUpperCase()+' positions are required');
  }
}
/** Sample exhibition lineup only. Official teams must supply their manager's assignments. */
export function defaultFpsAssignments(ids:readonly string[]):Record<string,FpsAssignments> {
  const result=Object.fromEntries(ids.map((id,i)=>[id,{t:FPS_T_POSITIONS[i],ct:FPS_CT_POSITIONS[i]}]));
  validateFpsLineup(ids.map(id=>({id,assignments:result[id]})));return result;
}
/** Internal responsibility bridge into the existing tactical/weapon mechanics. Flex is free to rifle. */
export function fpsExecutionRole(position:FpsPosition):'caller'|'entry'|'support'|'lurker'|'trade'|'anchor'|'sniper' {
  if(position.endsWith('IGL'))return 'caller';if(position==='T_ENTRY')return 'entry';if(position==='T_SUPPORT')return 'support';
  if(position==='T_LURKER')return 'lurker';if(position.startsWith('CT_ANCHOR'))return 'anchor';return 'trade';
}
export interface FpsBehaviorPreferences {initiative:number;coordination:number;deliberation:number;reassessment:number;pressureSensitivity:number}
export function fpsBehaviorPreferences(p:FpsPersonality):FpsBehaviorPreferences {
  return {initiative:p.playstyle==='AGGRESSIVE'?.9:p.playstyle==='PASSIVE'?.1:.5,coordination:p.mindset==='TEAM_FIRST'?.85:.25,
    deliberation:p.decisionStyle==='METHODICAL'?.85:p.decisionStyle==='INSTINCTIVE'?.15:.5,
    reassessment:p.decisionStyle==='ADAPTIVE'?.85:p.decisionStyle==='INSTINCTIVE'?.6:.4,
    pressureSensitivity:p.temperament==='VOLATILE'?1:p.temperament==='STEADY'?.45:.1};
}
export const FPS_BEHAVIOR_METRICS=['engagement','firstContact','coordination','rotation','improvisation','failedExecuteAdjustment','opponentAdjustment','sacrifice','retake','utilitySupport','lurkTiming','risk','strategyCompliance'] as const;
export type FpsBehaviorMetric=typeof FPS_BEHAVIOR_METRICS[number];
export interface FpsBehaviorObservation {opportunities:number;attempts:number}
export interface FpsObservedBehavior {version:4;matches:number;metrics:Partial<Record<FpsBehaviorMetric,FpsBehaviorObservation>>}
export const emptyFpsObservedBehavior=():FpsObservedBehavior=>({version:4,matches:0,metrics:{}});
export function observeFpsBehavior(record:FpsObservedBehavior,metric:FpsBehaviorMetric,attempted:boolean):void {
  const item=record.metrics[metric]??{opportunities:0,attempts:0};item.opportunities++;if(attempted)item.attempts++;record.metrics[metric]=item;
}
export function observedFpsIdentity(record:FpsObservedBehavior|undefined):string|undefined {
  if(!record||record.matches<5||(record.metrics.engagement?.opportunities??0)<30)return undefined;
  const rate=(key:FpsBehaviorMetric)=>{const m=record.metrics[key];return m&&m.opportunities>=10?m.attempts/m.opportunities:undefined;};
  const engagement=rate('engagement')!,coordination=rate('coordination');
  return `${engagement>=.65?'Proactive':engagement<=.35?'Selective':'Balanced'} ${coordination===undefined?'approach':coordination>=.65?'team play':coordination<=.35?'independent play':'mixed coordination'}`;
}
export function mergeFpsObservedBehavior(current:FpsObservedBehavior,sample:FpsObservedBehavior):FpsObservedBehavior {
  const result=structuredClone(current);result.matches+=sample.matches;
  for(const key of FPS_BEHAVIOR_METRICS){const a=result.metrics[key]??{opportunities:0,attempts:0},b=sample.metrics[key];if(b){a.opportunities+=b.opportunities;a.attempts+=b.attempts;result.metrics[key]=a;}}
  return result;
}
