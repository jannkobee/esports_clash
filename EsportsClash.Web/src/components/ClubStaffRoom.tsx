import {WorldCareerDesk} from './WorldCareerDesk';
import {PersonPortrait} from './PersonPortrait';
import {pediaMoney,pediaTime,pediaStatus} from '../hexapedia';
import {LabelIcon} from './LabelIcon';
import { useEffect, useState } from 'react';
import { Activity, Brain, Crosshair, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { useAccount } from '../AccountContext';
import { isCloudPersistenceConfigured, request } from '../cloudPersistence';

interface StaffMember {
  portrait_key?:string;
  role: string;
  title: string;
  name: string;
  attributes: Record<string, number>;
  weekly_salary:number;contract_id:number|null;contract_ends_at:string|null;arrangement:string;
}

interface StaffDesk {
  staff: StaffMember[];
  candidates:{tier:string;quality:number;term_cost:number;id:string;role:string;title:string;name:string;attributes:Record<string,number>;weekly_salary:number;signing_fee:number;weeks:number}[];
  contracts:{id:number;name:string;role:string;starts_at:string;ends_at:string;terminated_at:string|null;status:string;weekly_salary:number;signing_fee:number}[];
  coach_effects: {
    name: string;
    style: string;
    rating10: number;
    playbookBonus: number;
    chemistryBonus: number;
    coachAttributes: Record<string, number>;
  };
  training_bonus_percent: number;
  draft_policy: {
    starter_selection: string;
    avatar_selection: string;
    meta_source: string;
    meta_minimum_samples: number;
  };
}

const icons = [GraduationCap, Users, Brain, Activity, ShieldCheck];
const labels: Record<string, string> = {
  tactics: 'Tactical planning',
  drafting: 'Drafting',
  leadership: 'Leadership',
  adaptation: 'Adaptation',
  preparation: 'Preparation',
  communication: 'Communication',
  flexibility: 'Flexibility',
  teamwork: 'Teamwork',
  meta_reading: 'Meta reading',
  scouting: 'Scouting',
  counter_pick: 'Counter-picking',
  data_quality: 'Data quality',
  conditioning: 'Conditioning',
  recovery: 'Recovery',
  development: 'Player development',
  load_management: 'Load management',
  composure: 'Composure',
  resilience: 'Resilience',
  motivation: 'Motivation',
};

export function ClubStaffRoom() {
  const { session } = useAccount();
  const [desk, setDesk] = useState<StaffDesk | null>(null);
  const [error, setError] = useState('');
  const [staffSearch,setStaffSearch]=useState(''),[staffRole,setStaffRole]=useState('');
  const [revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const act=async(path:string,body:unknown)=>{setBusy(true);setError('');setNotice('');try{await request(path,session,{method:'POST',body:JSON.stringify(body)});setRevision(v=>v+1);setNotice('Staff contract updated. Locked match snapshots retain their allocated staff.');window.dispatchEvent(new Event('hexatrick-inbox-updated'));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};

  useEffect(() => {
    if (!session || !isCloudPersistenceConfigured()) return;
    const controller = new AbortController();
    void request<{ data: StaffDesk }>('/online/staff', session, { signal: controller.signal })
      .then(result => setDesk(result.data))
      .catch(problem => {
        if (!controller.signal.aborted) setError((problem as Error).message);
      });
    return () => controller.abort();
  }, [session,revision]);

  if (!session || !isCloudPersistenceConfigured()) {
    return <section className="cm-panel"><div className="cm-panel-body"><p>Sign in to view your club staff.</p></div></section>;
  }
  if (error&&!desk) return <p role="alert" className="club-notice">{error} <button className="cm-btn" onClick={()=>setRevision(v=>v+1)}>Retry</button></p>;
  if (!desk) return <section className="cm-panel"><div className="cm-panel-body">Loading your staff cabinet…</div></section>;

  return <div className="space-y-4">{error&&<p role="alert" className="club-notice">{error}</p>}{notice&&<p role="status" className="club-notice">{notice}</p>}
    <section className="cm-panel">
      <h2 className="cm-panel-header flex items-center gap-2"><Users size={17}/> Staff cabinet</h2>
      <div className="cm-panel-body">
        <p className="club-help">Your staff prepare each Arena draft from player-role fit and the verified meta. You select the five starters; staff select their avatars for each match. Draft recommendations are pinned into the match plan before the Arena starts.</p>
        <div className="staff-roster-rows">{desk.staff.map((member,index)=>{const Icon=icons[index]??Users;return <article className="staff-person-row" key={member.role}><PersonPortrait id={member.portrait_key??'staff:'+session.user.id+':'+member.role} name={member.name} size={76}/><div className="staff-person-details"><span><Icon size={15}/>{member.title}</span><h3>{member.name}</h3><small>{member.arrangement}</small>{member.contract_ends_at&&<small>Contract through {pediaTime(member.contract_ends_at)}</small>}</div><dl className="staff-person-attributes">{Object.entries(member.attributes).map(([key,value])=><div key={key}><dt>{labels[key]??key}</dt><dd><strong>{value}</strong><small>/10</small><span className="staff-rating-track"><span style={{width:value*10+'%'}}/></span></dd></div>)}</dl><aside><span>Weekly salary</span><strong>{pediaMoney(member.weekly_salary)}</strong>{member.contract_id?<button className="cm-btn" disabled={busy} onClick={()=>void act('/online/staff/release',{role:member.role})}>End contract</button>:<small>Founding agreement</small>}</aside></article>;})}</div>
      </div>
    </section>
    <section className="cm-panel">
      <h2 className="cm-panel-header flex items-center gap-2"><Crosshair size={17}/> Match preparation</h2>
      <div className="cm-panel-body grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <p className="staff-effect"><span>Head coach</span><strong>{desk.coach_effects.name}</strong><small>{desk.coach_effects.style} · {desk.coach_effects.rating10}/10</small></p>
        <p className="staff-effect"><span>Playbook strength</span><strong>{desk.coach_effects.playbookBonus}/20</strong><small>Coach tactics, drafting and analyst meta reading</small></p>
        <p className="staff-effect"><span>Team cohesion</span><strong>{desk.coach_effects.chemistryBonus}/20</strong><small>Leadership, assistant teamwork and player composure</small></p>
        <p className="staff-effect"><span>Training efficiency</span><strong>+{desk.training_bonus_percent}%</strong><small>Performance coach development, conditioning and recovery</small></p>
        <p className="staff-effect"><span>Meta source</span><strong>Verified Arena</strong><small>Only completed games with player performance records; at least {desk.draft_policy.meta_minimum_samples} picks before a meta signal is used.</small></p>
      </div>
      <p className="club-help px-4 pb-4">Staff are persistent club records. Attribute values are 1–10. Match tactics and in-game mechanics remain governed by the existing Arena rules.</p>
    </section>
    <WorldCareerDesk onChange={()=>setRevision(v=>v+1)}/>
    <section className="cm-panel"><h2 className="cm-panel-header"><LabelIcon name="staff contracts"/> Staff appointments</h2><div className="cm-panel-body"><p className="club-help">Existing founding staff keep their original no-salary terms. Paid replacements have eight-week contracts, a two-week signing fee, and salary prorated by actual employment time. Ending a contract does not refund its signing fee; founding staff cover the role again. Keep four weeks of wages available after signing. New offers use a nonlinear quality premium, so exceptional and specialist staff command higher salaries. Existing signed terms are preserved.</p><div className="record-filters"><label>Find staff<input type="search" value={staffSearch} onChange={e=>setStaffSearch(e.target.value)} placeholder="Name, role or tier"/></label><label>Specialty<select value={staffRole} onChange={e=>setStaffRole(e.target.value)}><option value="">All roles</option>{desk.staff.map(m=><option key={m.role} value={m.role}>{m.title}</option>)}</select></label></div><div className="cm-table-wrap"><table className="cm-table staff-candidate-table"><thead><tr><th>Role / candidate</th><th>Attributes (1-10)</th><th>Weekly salary</th><th>Signing fee / full term</th><th>Appointment</th></tr></thead><tbody>{desk.candidates.filter(c=>(!staffRole||c.role===staffRole)&&(!staffSearch||[c.name,c.title,c.tier].join(' ').toLowerCase().includes(staffSearch.toLowerCase()))).map(c=><tr key={c.id}><th scope="row"><div className="staff-candidate-name"><PersonPortrait id={'candidate:'+c.id} name={c.name} size={52}/><div>{c.title}<p>{c.name} <span className={"tier-chip tier-"+c.tier}>{c.tier} tier</span></p><small>Quality {c.quality.toFixed(1)} / 10</small></div></div></th><td>{Object.entries(c.attributes).map(([k,v])=><span key={k} className="block">{labels[k]??k}: {v}/10</span>)}</td><td>{pediaMoney(c.weekly_salary)}</td><td>{pediaMoney(c.signing_fee)} signing<small className="block">{pediaMoney(c.term_cost)} over eight weeks</small></td><td><button className="cm-btn cm-btn-primary" disabled={busy} onClick={()=>void act('/online/staff/hire',{candidate_id:c.id})}><LabelIcon name="contract"/>Sign eight weeks</button></td></tr>)}</tbody></table></div></div></section>
    <section className="cm-panel"><h2 className="cm-panel-header"><LabelIcon name="contract history"/> Recent contract history</h2><div className="cm-panel-body">{desk.contracts.length?<div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Staff member</th><th>Started</th><th>Ended / due</th><th>Salary / week</th><th>Status</th></tr></thead><tbody>{desk.contracts.map(c=><tr key={c.id}><th>{c.name}<p>{pediaStatus(c.role)}</p></th><td>{pediaTime(c.starts_at)}</td><td>{pediaTime(c.terminated_at??c.ends_at)}</td><td>{pediaMoney(c.weekly_salary)}</td><td>{pediaStatus(c.status)}</td></tr>)}</tbody></table></div>:<p>No paid contracts signed. Founding staff are retained.</p>}</div></section>
  </div>;
}
