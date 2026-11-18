import {useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight,BookOpen,Play} from 'lucide-react';
import {AppIcon} from './ui/AppIcon';
import {SearchField} from './ui/SearchField';
import {FilterBar,SelectField} from './ui/FilterBar';
import {EmptyState} from './ui/States';
import {FPS_SECTION_ICONS} from './ui/icons';
import {FPS_REFERENCE_SECTIONS,fpsReferenceEntries,fpsReferenceHref,type FpsReferenceSection} from '../fps/fpsReference';
import './fps-reference.css';

export function FpsHexapediaPage({section,itemId}:{section:FpsReferenceSection;itemId?:string}) {
  const [query,setQuery]=useState(''),[category,setCategory]=useState('all');
  const all=useMemo(()=>fpsReferenceEntries(section),[section]);
  const selected=itemId?all.find(item=>item.id===itemId):undefined;
  const categories=[...new Set(all.map(item=>item.category))];
  const items=all.filter(item=>(category==='all'||category===item.category)&&`${item.name} ${item.summary}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="fps-reference" aria-label="Tactical FPS reference">
    <header className="fps-reference__heading"><div><p className="pedia-eyebrow">CURRENT TACTICAL FPS</p><h1><AppIcon name={FPS_SECTION_ICONS[section]} size={26}/>{selected?.name??FPS_REFERENCE_SECTIONS[section]}</h1><p>Learn the people, equipment and rules behind the round.</p></div><a className="cm-btn cm-btn-primary" href="#fps-simulation"><Play size={15}/>Watch a simulation</a></header>
    {section==='fps'?<><div className="fps-reference__intro"><BookOpen size={26}/><div><h2>Build a five. Read the round.</h2><p>Roles describe a player's job. Personality shapes how they approach it. Equipment, 3D geometry and live utility rules decide what is possible.</p><p>Explore the 4-slot live armory, Influence Maps, Blackboards, Behavior Trees, lawful death-callout trading, and live 3D maps alongside the five recorded league maps.</p></div></div><div className="fps-reference__grid">{Object.entries(FPS_REFERENCE_SECTIONS).filter(([key])=>key!=='fps').map(([key,label])=><a className="fps-reference__portal" href={fpsReferenceHref(key as FpsReferenceSection)} key={key}><h2>{label}<ArrowUpRight size={18}/></h2><p>{fpsReferenceEntries(key as FpsReferenceSection).length} current reference entries</p></a>)}</div><p className="fps-reference__note">Recorded tactical matches resolve across Breakwater, Foundry, Old Quarter, Red Mesa and Northpoint, while the real-time 3D broadcast on Fontessa and Spillway supports 1P, 3P, Free, Overview, PiP bomb cam, and Auto Director cameras.</p></>
    :itemId&&!selected?<div role="alert" className="fps-reference__intro"><div><h2>Entry not found</h2><p>This address does not identify a current entry.</p><a href={fpsReferenceHref(section)}>Back to {FPS_REFERENCE_SECTIONS[section]}</a></div></div>
    :selected?<><a className="fps-reference__back" href={fpsReferenceHref(section)}><ArrowLeft size={14}/>All {FPS_REFERENCE_SECTIONS[section].toLowerCase()}</a><article className="fps-reference__card"><span className="fps-reference__category">{selected.category}</span><p className="fps-reference__summary">{selected.summary}</p>{selected.body.map(text=><p key={text}>{text}</p>)}<dl>{selected.facts.map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></article></>
    :<>{section==='roles'&&<p className="fps-reference__note">Each lineup locks five unique responsibilities on each side. Players can rotate, trade or lead a retake as the round demands.</p>}{(section==='personalities'||section==='identityPersonalities')&&<p className="fps-reference__note">Personality changes probabilities in context. All players can exploit available opportunities. Base skills remain separate.</p>}{section==='attributes'&&<p className="fps-reference__note">Six attributes govern execution: Rifling, Sniping, Entry, Utility, Positioning and Shotcalling.</p>}
      <FilterBar count={`${items.length} ${items.length===1?'entry':'entries'}`} active={!!query||category!=='all'} onClear={()=>{setQuery('');setCategory('all');}}>
        <SearchField label="Search this reference" placeholder="Search names and descriptions" value={query} onChange={setQuery}/>
        {categories.length>1&&<SelectField label="Category" value={category} onChange={setCategory}><option value="all">All categories</option>{categories.map(name=><option key={name} value={name}>{name}</option>)}</SelectField>}
      </FilterBar>
      {!items.length&&<EmptyState title="No entries match" action={<button type="button" className="cm-btn" onClick={()=>{setQuery('');setCategory('all');}}>Clear filters</button>}>Try another word or clear the filters.</EmptyState>}
      <div className="fps-reference__grid">{items.map(item=><article className="fps-reference__card" key={item.id}><span className="fps-reference__category">{item.category}</span><h2><a href={fpsReferenceHref(section,item.id)}>{item.name}<ArrowUpRight size={15}/></a></h2><p>{item.summary}</p>{item.body[0]&&<p className="fps-reference__tradeoff">{item.body[0]}</p>}<dl>{item.facts.slice(0,3).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><a href={fpsReferenceHref(section,item.id)}>Read entry</a></article>)}</div>{!items.length&&<p role="status">No entries match. Try a different name or category.</p>}</>}
  </section>;
}
