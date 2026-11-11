import {FpsPlayerRole} from './FpsPlayerRole';
import {fpsRoleFit} from '../fps/fpsRoleFit';
import {PersonalityMarks} from './PersonalityMarks';
import {FpsIdentityMarks} from './FpsIdentityMarks';
import {FPS_ATTRIBUTE_LABELS} from '../fps/fpsPersonality';
import {CountryFlag} from './CountryFlag';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Check,Search,Users,Save,RotateCcw,ChevronDown} from 'lucide-react';
import {WorldPlayerPortrait} from './WorldPlayerPortrait';
import {PlayerForm} from './PlayerForm';
import type {PlayerFormData} from '../playerForm';
import {toScale10} from '../marketBatchEngine';
import {pediaHref,pediaMoney} from '../hexapedia';

export interface SquadCard {id:string;training_xp:number;form?:PlayerFormData;definition:{fpsIdentity?:import('../fps/fpsIdentity').FpsScoutingProfile;presentation?:import('../supporter').PlayerPresentation|null;name:string;role?:string;preferredRole?:string;primaryPersonality?:string;secondaryPersonality?:string;ovr:number;wage?:number;nationality?:{code:string;name:string};stats?:Record<string,number>}}
type Slot={instance_id:string};
const attributes=FPS_ATTRIBUTE_LABELS;

export function SquadRoster({cards,lineup,saved,onChange,busy,onReset,fixture=false}:{cards:SquadCard[];lineup:Slot[];saved:Slot[];onChange:(slots:Slot[])=>void;busy:boolean;onReset:()=>void;fixture?:boolean}) {
  const [slot,setSlot]=useState(0),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[sort,setSort]=useState('name');
  const dirty=JSON.stringify(lineup)!==JSON.stringify(saved);
  const starters=new Set(lineup.map(s=>s.instance_id));
  const assign=(id:string)=>{const next=lineup.map(s=>({...s})),existing=next.findIndex(s=>s.instance_id===id);if(existing===slot)return;if(existing>=0)[next[slot],next[existing]]=[next[existing],next[slot]];else next[slot]={instance_id:id};onChange(next);};
  const move=(from:number,to:number)=>{const next=[...lineup];[next[from],next[to]]=[next[to],next[from]];onChange(next);setSlot(to);};
  const rows=cards.filter(c=>(filter==='all'||starters.has(c.id)===(filter==='starters'))&&[c.definition.name,fpsRoleFit(c.definition.stats),c.definition.nationality?.name].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='overall'?b.definition.ovr-a.definition.ovr:sort==='form'?(b.form?.score??-1)-(a.form?.score??-1):sort==='wage'?(b.definition.wage??0)-(a.definition.wage??0):a.definition.name.localeCompare(b.definition.name));
  return <div className="squad-desk">
    <div className="squad-slots" aria-label="Starting five">{lineup.map((s,i)=>{const c=cards.find(c=>c.id===s.instance_id);return <div className={'squad-slot '+(slot===i?'selected':'')} key={i}>
      <button type="button" className="squad-slot__select" aria-pressed={slot===i} onClick={()=>setSlot(i)}><span className="squad-slot__number">{i+1}</span>{c&&<WorldPlayerPortrait id={c.id} name={c.definition.name} appearance={c.definition.presentation?.appearance} size={44}/>}<span><strong>{c?.definition.name??'Unavailable'}</strong><small><FpsPlayerRole stats={c?.definition.stats}/></small></span><b>{c?toScale10(c.definition.ovr):'—'}<small>OVR</small></b></button>
      <div className="squad-slot__order"><button type="button" disabled={busy||i===0} onClick={()=>move(i,i-1)} aria-label={'Move starter '+(i+1)+' earlier'}><ArrowLeft size={12}/></button><small>{slot===i?'Replacing this slot':'Select to replace'}</small><button type="button" disabled={busy||i===4} onClick={()=>move(i,i+1)} aria-label={'Move starter '+(i+1)+' later'}><ArrowRight size={12}/></button></div>
    </div>;})}</div>
    <div className="squad-roster-toolbar"><h4><Users size={16}/> Club roster <span>{cards.length}</span></h4><label className="squad-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Player, role or nationality" aria-label="Search squad"/></label><label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All players</option><option value="starters">Starting five</option><option value="reserves">Reserves</option></select></label><label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Name</option><option value="overall">Overall</option><option value="form">Form</option><option value="wage">Weekly wage</option></select></label></div>
    <div className="cm-table-wrap"><table className="cm-table squad-table"><thead><tr><th>Player</th><th>FPS role / nationality</th><th>Overall</th><th>Form</th><th>Weekly wage</th><th>Development</th><th>Selection</th></tr></thead><tbody>{rows.map(c=><tr key={c.id} className={starters.has(c.id)?'squad-is-starter':''}><th scope="row"><div className="squad-player-name"><WorldPlayerPortrait id={c.id} name={c.definition.name} appearance={c.definition.presentation?.appearance} size={44}/><a href={pediaHref('players',c.id)}>{c.definition.name}</a></div><>{c.definition.fpsIdentity?<FpsIdentityMarks profile={c.definition.fpsIdentity}/>:<PersonalityMarks primary={c.definition.primaryPersonality} secondary={c.definition.secondaryPersonality}/>}</><details className="squad-attributes"><summary><ChevronDown size={11}/> Attributes</summary><dl>{Object.entries(attributes).map(([k,label])=><div key={k}><dt>{label}</dt><dd>{c.definition.stats?.[k]!=null?toScale10(c.definition.stats[k]):'—'}<small> / 10</small></dd></div>)}</dl></details></th><td><FpsPlayerRole stats={c.definition.stats}/><small className="squad-nationality">{c.definition.nationality?<CountryFlag code={c.definition.nationality.code} name={c.definition.nationality.name} showName/>:'Not recorded'}</small></td><td><strong>{toScale10(c.definition.ovr)}</strong><small> / 10</small></td><td><PlayerForm form={c.form}/></td><td>{c.definition.wage!=null?pediaMoney(c.definition.wage*100):'Not recorded'}</td><td>{c.training_xp} XP</td><td><button type="button" className={'cm-btn '+(lineup[slot]?.instance_id===c.id?'':'cm-btn-primary')} disabled={busy||lineup[slot]?.instance_id===c.id} onClick={()=>assign(c.id)}>{lineup[slot]?.instance_id===c.id?<><Check size={12}/>Selected</>:starters.has(c.id)?'Swap into slot '+(slot+1):'Start in slot '+(slot+1)}</button>{!starters.has(c.id)&&!saved.some(s=>s.instance_id===c.id)&&<a className="squad-transfer" href={'#transfer-exchange?tab=sell&player='+c.id}>List for auction</a>}</td></tr>)}</tbody></table>{!rows.length&&<p className="squad-no-results">No players match your filters.</p>}</div>
    <footer className="squad-save"><span role="status">{dirty?'Unsaved selection changes':'Saved selection'} · FPS roles are assigned from your starting five</span><button type="button" className="cm-btn" disabled={busy||!dirty} onClick={onReset}><RotateCcw size={13}/>Reset</button><button className="cm-btn cm-btn-primary" disabled={busy||(!dirty&&!fixture)}><Save size={13}/>{busy?'Saving…':fixture?'Save fixture orders':'Save starting five'}</button></footer>
  </div>;
}
