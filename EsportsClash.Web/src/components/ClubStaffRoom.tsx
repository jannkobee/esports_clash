import {WorldCareerDesk} from './WorldCareerDesk';
import {PersonPortrait} from './PersonPortrait';
import {pediaMoney,pediaTime,pediaStatus} from '../hexapedia';
import {LabelIcon} from './LabelIcon';
import {FilterBar,SelectField} from './ui/FilterBar';
import {SearchField} from './ui/SearchField';
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

interface Philosophy {levels:{key:string;label:string;value:number;label_text?:string}[];gameplan_fit:string|null}
interface StaffDesk {
  staff: StaffMember[];
  candidates:{tier:string;quality:number;term_cost:number;id:string;role:string;title:string;name:string;attributes:Record<string,number>;weekly_salary:number;signing_fee:number;weeks:number;philosophy?:Philosophy}[];
  attribute_effects?: Record<string, Record<string, [string, string]>>;
  fps_effects?: {system_learning:number;role_learning:number;chemistry:number;leadership:number;coach_change_retention:number;fixture_plan_carry:number;training_bonus_percent:number;reserve_practice_percent:number;opponent_report_categories:number};
  coach_philosophy?: Philosophy | null;
  contracts:{id:number;name:string;role:string;starts_at:string;ends_at:string;terminated_at:string|null;status:string;weekly_salary:number;signing_fee:number}[];
  training_bonus_percent: number;
}

const icons = [GraduationCap, Users, Brain, Activity, ShieldCheck];
const labels: Record<string, string> = {
  tactics: 'Tactical planning',
  drafting: 'Gameplan setup',
  leadership: 'Leadership',
  adaptation: 'Adaptation',
  preparation: 'Preparation',
  communication: 'Communication',
  flexibility: 'Flexibility',
  teamwork: 'Teamwork',
  meta_reading: 'Meta reading',
  scouting: 'Scouting',
  counter_pick: 'Counter-tactics',
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

  const labelFor=(role:string,key:string)=>desk.attribute_effects?.[role]?.[key]?.[0]??labels[key]??key;
  const effectFor=(role:string,key:string)=>desk.attribute_effects?.[role]?.[key]?.[1];
  const signed=(n:number)=>(n>0?'+':'')+n+'%';
  const fx=desk.fps_effects;
  return <div className="space-y-4">{error&&<p role="alert" className="club-notice">{error}</p>}{notice&&<p role="status" className="club-notice">{notice}</p>}
    <section className="cm-panel">
      <h2 className="cm-panel-header flex items-center gap-2"><Users size={17}/> Staff cabinet</h2>
      <div className="cm-panel-body">
        <p className="club-help">Your staff support your tactical system from player execution strengths and verified match trends. You select the five starters and assign their T and CT responsibilities; staff attributes and coach compatibility are pinned into the match plan before allocation.</p>
        <div className="staff-roster-rows">{desk.staff.map((member,index)=>{const Icon=icons[index]??Users;return <article className="staff-person-row" key={member.role}><PersonPortrait id={member.portrait_key??'staff:'+session.user.id+':'+member.role} name={member.name} size={76}/><div className="staff-person-details"><span><Icon size={15}/>{member.title}</span><h3>{member.name}</h3><small>{member.arrangement}</small>{member.contract_ends_at&&<small>Contract through {pediaTime(member.contract_ends_at)}</small>}</div><dl className="staff-person-attributes">{Object.entries(member.attributes).map(([key,value])=><div key={key} title={effectFor(member.role,key)}><dt>{labelFor(member.role,key)}</dt><dd><strong>{value}</strong><small>/10</small><span className="staff-rating-track"><span style={{width:value*10+'%'}}/></span></dd></div>)}</dl><aside><span>Weekly salary</span><strong>{pediaMoney(member.weekly_salary)}</strong>{member.contract_id?<button className="cm-btn" disabled={busy} onClick={()=>void act('/online/staff/release',{role:member.role})}>End contract</button>:<small>Founding agreement</small>}</aside></article>;})}</div>
      </div>
    </section>
    {fx&&<section className="cm-panel">
      <h2 className="cm-panel-header flex items-center gap-2"><Crosshair size={17}/> What your staff do</h2>
      <div className="cm-panel-body grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <p className="staff-effect"><span>Gameplan learning</span><strong>{signed(fx.system_learning)}</strong><small>Head coach system teaching and assistant session preparation</small></p>
        <p className="staff-effect"><span>New positions</span><strong>{signed(fx.role_learning)}</strong><small>Assistant role coaching</small></p>
        <p className="staff-effect"><span>Team chemistry growth</span><strong>{signed(fx.chemistry)}</strong><small>Assistant teamwork and communication, psychologist</small></p>
        <p className="staff-effect"><span>Accepting the IGL's calls</span><strong>{signed(fx.leadership)}</strong><small>Head coach leadership</small></p>
        <p className="staff-effect"><span>Fixture plans</span><strong>{fx.fixture_plan_carry}%</strong><small>of club-plan familiarity carried into a fixture-specific plan (match preparation)</small></p>
        <p className="staff-effect"><span>Coach change</span><strong>{fx.coach_change_retention}%</strong><small>of familiarity kept when this head coach takes over (adaptation)</small></p>
        <p className="staff-effect"><span>Training</span><strong>+{fx.training_bonus_percent}%</strong><small>match XP · reserves earn {fx.reserve_practice_percent}% from scrimmages</small></p>
        <p className="staff-effect"><span>Opponent reports</span><strong>{fx.opponent_report_categories} of 9</strong><small>observed-tendency categories your analyst covers</small></p>
      </div>
      {desk.coach_philosophy&&<div className="cm-panel-body staff-philosophy"><h3>Head coach philosophy <small>{desk.coach_philosophy.gameplan_fit?'Fit with your gameplan: '+desk.coach_philosophy.gameplan_fit:''}</small></h3>
        <dl>{desk.coach_philosophy.levels.map(l=><div key={l.key}><dt>{l.label}</dt><dd><b>{l.value}</b><small>/10</small></dd></div>)}</dl>
        <p className="club-help">A philosophy is a style, not a strength. Players lean toward it over repeated matches; a good fit with your gameplan avoids mixed signals.</p></div>}
      <p className="club-help px-4 pb-4">Staff change how fast your players learn and how much you know about opponents. They never change aim, damage or reactions. Ratings are 1–10.</p>
    </section>}
    <WorldCareerDesk onChange={()=>setRevision(v=>v+1)}/>
    <section className="cm-panel"><h2 className="cm-panel-header"><LabelIcon name="staff contracts"/> Staff appointments</h2><div className="cm-panel-body"><ul className="staff-terms"><li>Paid staff sign for eight weeks: a signing fee worth two weeks of salary, then salary for the time they are employed.</li><li>Ending a contract early does not refund the signing fee; your founding staff member covers the role again.</li><li>Keep four weeks of wages available after signing. Exceptional and specialist staff cost disproportionately more.</li><li>Founding staff keep their no-salary terms, and signed terms never change.</li></ul>{(()=>{const shown=desk.candidates.filter(c=>(!staffRole||c.role===staffRole)&&(!staffSearch||[c.name,c.title,c.tier].join(' ').toLowerCase().includes(staffSearch.toLowerCase()))).length;return <FilterBar count={`${shown} of ${desk.candidates.length} candidates`} active={Boolean(staffSearch||staffRole)} onClear={()=>{setStaffSearch('');setStaffRole('');}}><SearchField label="Find staff" showLabel value={staffSearch} onChange={setStaffSearch} placeholder="Name, role or tier"/><SelectField label="Specialty" value={staffRole} onChange={setStaffRole}><option value="">All roles</option>{desk.staff.map(m=><option key={m.role} value={m.role}>{m.title}</option>)}</SelectField></FilterBar>;})()}<div className="cm-table-wrap"><table className="cm-table staff-candidate-table"><thead><tr><th>Role / candidate</th><th>Attributes (1-10)</th><th>Weekly salary</th><th>Signing fee / full term</th><th>Appointment</th></tr></thead><tbody>{desk.candidates.filter(c=>(!staffRole||c.role===staffRole)&&(!staffSearch||[c.name,c.title,c.tier].join(' ').toLowerCase().includes(staffSearch.toLowerCase()))).map(c=><tr key={c.id}><th scope="row" className="cm-row-head"><div className="staff-candidate-name"><PersonPortrait id={'candidate:'+c.id} name={c.name} size={52}/><div><span className="staff-candidate-role">{c.title}</span><p>{c.name} <span className={"tier-chip tier-"+c.tier}>{c.tier} tier</span></p><small>Quality {c.quality.toFixed(1)} / 10</small></div></div></th><td>{Object.entries(c.attributes).map(([k,v])=><span key={k} className="block" title={effectFor(c.role,k)}>{labelFor(c.role,k)}: {v}/10</span>)}{c.philosophy&&<small className="block staff-candidate-philosophy">Philosophy: {c.philosophy.levels.slice(0,6).map(l=>`${l.label} ${l.value}`).join(' · ')}{c.philosophy.gameplan_fit?` · fit ${c.philosophy.gameplan_fit}`:''}</small>}</td><td>{pediaMoney(c.weekly_salary)}</td><td>{pediaMoney(c.signing_fee)} signing<small className="block">{pediaMoney(c.term_cost)} over eight weeks</small></td><td><button className="cm-btn cm-btn-sm" disabled={busy} aria-label={`Sign ${c.name} for eight weeks`} onClick={()=>void act('/online/staff/hire',{candidate_id:c.id})}><LabelIcon name="contract"/>Sign for 8 weeks</button></td></tr>)}</tbody></table></div></div></section>
    <section className="cm-panel"><h2 className="cm-panel-header"><LabelIcon name="contract history"/> Recent contract history</h2><div className="cm-panel-body">{desk.contracts.length?<div className="cm-table-wrap"><table className="cm-table"><thead><tr><th>Staff member</th><th>Started</th><th>Ended / due</th><th>Salary / week</th><th>Status</th></tr></thead><tbody>{desk.contracts.map(c=><tr key={c.id}><th>{c.name}<p>{pediaStatus(c.role)}</p></th><td>{pediaTime(c.starts_at)}</td><td>{pediaTime(c.terminated_at??c.ends_at)}</td><td>{pediaMoney(c.weekly_salary)}</td><td>{pediaStatus(c.status)}</td></tr>)}</tbody></table></div>:<p>No paid contracts signed. Founding staff are retained.</p>}</div></section>
  </div>;
}
