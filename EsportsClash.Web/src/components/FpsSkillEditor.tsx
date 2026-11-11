import { useEffect, useState } from 'react';
import type { PlayerCard } from '../types';
import { FPS_SKILL_GROUPS, FPS_ABILITY_LABELS, FPS_ABILITY_SUPPORT, fpsSkillSummaries, generateFpsSkillProfile, validateFpsSkillProfile, type FpsSkillProfile } from '../fps/fpsSkillProfile';

const storageKey='hexatrick:fps-skill-lab:v1';
export function useFpsLabProfiles(roster:PlayerCard[]) {
  const [profiles,setProfiles]=useState<Record<string,FpsSkillProfile>>(()=>{
    let saved:Record<string,unknown>={};
    try{saved=JSON.parse(localStorage.getItem(storageKey)??'{}');}catch{/* A corrupt local experiment does not affect club cards. */}
    const createdAt=new Date().toISOString();
    return Object.fromEntries(roster.map(card=>{
      try{return [card.id,validateFpsSkillProfile(saved[card.id],card.id)];}
      catch{return [card.id,generateFpsSkillProfile(card.id,20261111,createdAt)];}
    }));
  });
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(profiles));}catch{/* Continue as a session-only experiment when browser storage is unavailable. */}},[profiles]);
  return [profiles,setProfiles] as const;
}

export function FpsSkillEditor({roster,profiles,onChange,equalized}:{roster:PlayerCard[];profiles:Record<string,FpsSkillProfile>;onChange:(profiles:Record<string,FpsSkillProfile>)=>void;equalized:boolean}) {
  const [selected,setSelected]=useState(roster[0].id),profile=profiles[selected];
  const [importError,setImportError]=useState('');
  const download=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'hexatrick-fps-skill-lab-v1',profiles},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='hexatrick-fps-skill-profiles.json';link.click();URL.revokeObjectURL(url);
  };
  return <details className="fps-skill-editor"><summary>Detailed FPS abilities · 1–10</summary>
    <p>Fictional local test profiles, separate from your club cards. Twenty-four abilities have live behavior; Economy Judgment is reserved while team policy controls purchases. Changes are saved in this browser.</p>
    <div className="fps-skill-editor__toolbar"><label>Player<select value={selected} onChange={e=>setSelected(e.target.value)}>{roster.map((p,i)=><option key={p.id} value={p.id}>{i<5?'Blue':'Red'} · {p.name}</option>)}</select></label><button type="button" onClick={download}>Export test profiles</button><label>Import test profiles<input type="file" accept="application/json,.json" aria-label="Import detailed FPS test profiles" onChange={async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{const data=JSON.parse(await file.text());if(data.format!=='hexatrick-fps-skill-lab-v1'||!data.profiles||Object.keys(data.profiles).length!==roster.length)throw Error('Invalid export');
        const imported=Object.fromEntries(roster.map(p=>[p.id,validateFpsSkillProfile(data.profiles[p.id],p.id)]));onChange(imported);setImportError('');
      }catch{setImportError('Could not load these test profiles. Choose an exported 25-ability profile file.');}
    }}/></label></div>
    {importError&&<p role="alert">{importError}</p>}
    <p className="fps-skill-editor__provenance">{profile.source==='lab-generated-v1'?'Generated test profile':profile.source==='legacy_estimate_v1'?'Model-imputed estimate — not observed ability':'Edited test profile'} · revision {profile.revision}{equalized?' · All abilities equalized to 10 for this match':''}</p>
    <div className="fps-skill-editor__groups">{Object.entries(FPS_SKILL_GROUPS).map(([group,keys])=><fieldset key={group}><legend>{group==='tactical'?'Tactics and information':group==='team'?'Team execution':group==='mental'?'Mental and endurance':'Execution'}</legend>{keys.map(key=>{
      const support=FPS_ABILITY_SUPPORT[key];
      return <label key={key} title={support.consumer}><span>{FPS_ABILITY_LABELS[key]}{!support.active&&<small>Reserved</small>}</span><input type="number" min="1" max="10" step=".1" value={equalized?10:profile.values[key]} disabled={equalized||!support.active} aria-label={`${roster.find(p=>p.id===selected)?.name} ${FPS_ABILITY_LABELS[key]} out of 10`} onChange={e=>{
        const value=Number(e.target.value);if(!Number.isFinite(value)||value<1||value>10)return;
        onChange({...profiles,[selected]:{...profile,source:'lab-custom-v1',revision:profile.revision+1,values:{...profile.values,[key]:value}}});
      }}/></label>;
    })}</fieldset>)}</div>
    <div className="fps-lab__attributes"><table><caption>Compact summaries — display only</caption><thead><tr><th>Player</th>{Object.keys(fpsSkillSummaries(profile)).map(key=><th key={key}>{key} /10</th>)}</tr></thead><tbody>{roster.map((p,i)=><tr key={p.id}><th>{i<5?'Blue':'Red'} · {p.name}</th>{Object.entries(fpsSkillSummaries(profiles[p.id])).map(([key,value])=><td key={key}>{equalized?'10.0':value.toFixed(1)}</td>)}</tr>)}</tbody></table></div>
  </details>;
}
