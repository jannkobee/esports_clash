import {CountrySelect} from './CountrySelect';
import { useEffect, useId, useState } from 'react';
import { request, publicApiAsset, type ApiSession } from '../cloudPersistence';

interface JerseyDesign {
  pattern: string;
  crest_position?: string;
  lettering?: string;
  number_style?: string;
}

export interface ClubIdentity {
  nickname?: string; motto?: string; bio?: string; country: string; city?: string;
  crest: { shape: string; mark: string };
  colors: { primary: string; secondary: string; accent: string };
  assets?:Partial<Record<'logo'|'home_jersey'|'away_jersey',string>>;
  home_jersey: JerseyDesign; away_jersey: JerseyDesign;
}

interface Props {
  session: ApiSession;
  club: { name: string; tag?: string | null; revision: number; identity?: ClubIdentity | null };
  onSaved: () => void;
}

const defaultIdentity: ClubIdentity = {
  country: 'PH', crest: { shape: 'shield', mark: 'star' },
  colors: { primary: '#112e50', secondary: '#ffffff', accent: '#f5c542' },
  home_jersey: { pattern: 'solid' }, away_jersey: { pattern: 'solid' },
};

function CrestArtwork({ crest, colors }: Pick<ClubIdentity, 'crest' | 'colors'>) {
  const shapes = { shield: 'M4 3H28V16Q28 24 16 30Q4 24 4 16Z', circle: 'M16 2A14 14 0 1 1 16 30A14 14 0 1 1 16 2', diamond: 'M16 2L30 16L16 30L2 16Z' };
  const marks = { star: 'M16 6L19 12L26 13L21 18L22 25L16 22L10 25L11 18L6 13L13 12Z', bolt: 'M17 6L9 18H15L14 26L23 13H17Z', tower: 'M9 8H13V12H15V8H17V12H19V8H23V15L21 18L22 25H10L11 18L9 15Z' };
  return <>
    <path d={shapes[crest.shape as keyof typeof shapes] ?? shapes.shield} fill={colors.primary} stroke={colors.accent} strokeWidth="1.5" />
    <path d={marks[crest.mark as keyof typeof marks] ?? marks.star} fill={colors.secondary} />
  </>;
}

export function ClubCrest(props: Pick<ClubIdentity, 'crest' | 'colors'> & {logo?:string}) {
  if(props.logo&&publicApiAsset(props.logo))return <img className="club-custom-crest" src={publicApiAsset(props.logo)} alt="Club crest" width={40} height={40}/>;
  return <svg viewBox="0 0 32 32" className="h-10 w-10" aria-hidden="true"><CrestArtwork {...props} /></svg>;
}

function JerseyPreview({ label, kit, identity, tag, base, trim }: { label: string; kit: JerseyDesign; identity: ClubIdentity; tag: string; base: string; trim: string }) {
  const clip = useId();
  const artwork=identity.assets?.[label==='Home kit'?'home_jersey':'away_jersey'];
  if(artwork)return <figure className="club-custom-kit"><img src={publicApiAsset(artwork)} alt={label}/><figcaption>{label}</figcaption></figure>;
  const outline = 'M23 8L35 4Q50 20 65 4L77 8L97 28L82 44L73 34V88H27V34L18 44L3 28Z';
  const crestX = kit.crest_position === 'center' ? 43 : kit.crest_position === 'right' ? 56 : 30;
  const letters = kit.lettering === 'mono' ? 'monospace' : 'system-ui';
  const outlineNumber = kit.number_style === 'outline';
  return <figure className="text-center text-sm">
    <svg viewBox="0 0 100 92" className="mx-auto h-28 w-28" aria-hidden="true">
      <defs><clipPath id={clip}><path d={outline} /></clipPath></defs>
      <path d={outline} fill={base} stroke={trim} strokeWidth="2" />
      <g clipPath={`url(#${clip})`}>
        {kit.pattern === 'stripes' && <path d="M33 0V92M50 0V92M67 0V92" stroke={trim} strokeWidth="6" />}
        {kit.pattern === 'diagonal' && <path d="M17 12L84 84" stroke={trim} strokeWidth="12" />}
      </g>
      <svg x={crestX} y="18" width="14" height="14" viewBox="0 0 32 32"><CrestArtwork crest={identity.crest} colors={identity.colors} /></svg>
      <rect x="28" y="43" width="44" height="30" rx="3" fill={base} />
      <text x="50" y="51" fill={trim} fontFamily={letters} fontStyle={kit.lettering === 'italic' ? 'italic' : 'normal'}
        fontSize="6" fontWeight="700" textAnchor="middle">{tag.slice(0, 12) || 'CLUB'}</text>
      <text x="50" y="67" fill={outlineNumber ? base : trim} stroke={outlineNumber ? trim : undefined} strokeWidth="0.6"
        fontSize="16" fontFamily={letters} fontWeight="700" textAnchor="middle">07</text>
    </svg>
    <figcaption>{label}</figcaption>
  </figure>;
}

const normalizeIdentity=(value?:ClubIdentity|null):ClubIdentity=>({...defaultIdentity,...value,crest:{...defaultIdentity.crest,...value?.crest},colors:{...defaultIdentity.colors,...value?.colors},home_jersey:{...defaultIdentity.home_jersey,...value?.home_jersey},away_jersey:{...defaultIdentity.away_jersey,...value?.away_jersey}});
export function ClubIdentityEditor({ session, club, onSaved }: Props) {
  const [name, setName] = useState(club.name);
  const [tag, setTag] = useState(club.tag ?? '');
  const [identity, setIdentity] = useState<ClubIdentity>(normalizeIdentity(club.identity));
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploads,setUploads]=useState<Partial<Record<'logo'|'home_jersey'|'away_jersey',File>>>({});
  const supporter=session.user.supporter;const custom=!!supporter?.active;
  useEffect(() => {
    setName(club.name); setTag(club.tag ?? ''); setIdentity(normalizeIdentity(club.identity));
  }, [club.revision]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const {assets: _savedAssets,...editable}=identity;void _savedAssets;
      let result=await request<{data:{revision:number}}>('/online/club/identity',session,{method:'PUT',body:JSON.stringify({name,tag,identity:editable,revision:club.revision})});
      for(const [kind,image] of Object.entries(uploads)){const body=new FormData();body.set('kind',kind);body.set('revision',String(result.data.revision));body.set('image',image);result=await request('/online/club/media',session,{method:'POST',body});}
      setUploads({});
      setMessage('Club identity saved.'); onSaved();
    } catch (error) { setMessage((error as Error).message);onSaved(); }
    finally { setSaving(false); }
  }
  const field = 'cm-input block w-full';
  return <form onSubmit={save} className="club-panel space-y-5">
    <div><h3>Club identity</h3><p className="club-help mt-1">Make the club yours. Your saved identity appears on fixtures, standings, and match reports.</p></div>
    <div className="club-preview">
      <div className="flex min-w-32 items-center gap-2"><ClubCrest crest={identity.crest} colors={identity.colors} logo={identity.assets?.logo} /><span>{tag || name}</span></div>
      <JerseyPreview label="Home kit" kit={identity.home_jersey} identity={identity} tag={tag} base={identity.colors.primary} trim={identity.colors.accent} />
      <JerseyPreview label="Away kit" kit={identity.away_jersey} identity={identity} tag={tag} base={identity.colors.secondary} trim={identity.colors.primary} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Club name<input className={field} required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>Club tag<input className={field} required pattern="[A-Z0-9]{2,12}" value={tag} onChange={event => setTag(event.target.value.toUpperCase())} /></label>
      {(['nickname', 'motto', 'city'] as const).map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<input className={field} maxLength={key === 'motto' ? 120 : 80} value={identity[key] ?? ''} onChange={event => setIdentity({ ...identity, [key]: event.target.value })} /></label>)}
      <label>Country<CountrySelect label="Club country" value={identity.country} onChange={country=>setIdentity({...identity,country})} allowEmpty={false} emptyLabel="Choose a country"/></label><label className="sm:col-span-2">Club bio<textarea className={field} maxLength={1000} value={identity.bio ?? ''} onChange={event => setIdentity({ ...identity, bio: event.target.value })} /></label>
      {(['shape','mark'] as const).map(key=><fieldset className="identity-choices" key={key}><legend>Standard crest {key}</legend><div role="group" aria-label={'Crest '+key}>{(key==='shape'?['shield','circle','diamond']:['star','bolt','tower']).map(option=><button type="button" className={identity.crest[key]===option?'selected':''} aria-pressed={identity.crest[key]===option} key={option} onClick={()=>setIdentity({...identity,crest:{...identity.crest,[key]:option}})}>{option}</button>)}</div></fieldset>)}
      <div className="club-palette sm:col-span-2">{(['primary', 'secondary', 'accent'] as const).map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)} colour<input type="color" value={identity.colors[key]} onChange={event => setIdentity({ ...identity, colors: { ...identity.colors, [key]: event.target.value } })} /></label>)}</div>
      {(['home_jersey', 'away_jersey'] as const).map(key => <fieldset key={key} className="club-kit" disabled={!custom}>
        <legend>{key === 'home_jersey' ? 'Home jersey' : 'Away jersey'}</legend>
        {([
          ['pattern', 'Pattern', ['solid', 'stripes', 'diagonal']],
          ['crest_position', 'Crest placement', ['left', 'center', 'right']],
          ['lettering', 'Lettering', ['block', 'italic', 'mono']],
          ['number_style', 'Number style', ['solid', 'outline']],
        ] as const).map(([setting, title, options]) => <label key={setting}>{title}
          <span className="identity-choice-row" role="group" aria-label={title}>{options.map(option=><button type="button" key={option} className={(identity[key][setting]??options[0])===option?'selected':''} aria-pressed={(identity[key][setting]??options[0])===option} onClick={()=>setIdentity({...identity,[key]:{...identity[key],[setting]:option}})}>{option}</button>)}</span>
        </label>)}
      </fieldset>)}
    </div>
    <section className="supporter-artwork"><header><strong>Supporter studio</strong><span className="club-status">{custom?(supporter?.kind==='trial'?'Trial active':'Supporter'):'Supporter required'}</span>{supporter?.ends_at&&<small>Until {new Date(supporter.ends_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</small>}</header><p className="club-help">Upload your own crest and home/away jersey artwork. PNG, JPEG or WebP, up to 4 MB and 1024 px. New accounts receive a one-month trial. Standard club identity stays free.</p><div className="supporter-upload-grid">{(['logo','home_jersey','away_jersey'] as const).map(kind=><label key={kind}>{kind==='logo'?'Custom crest':kind==='home_jersey'?'Home jersey artwork':'Away jersey artwork'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!custom||saving} onChange={e=>{const file=e.target.files?.[0];setUploads(old=>({...old,[kind]:file}));}}/><small>{uploads[kind]?.name??(identity.assets?.[kind]?'Saved artwork':'No artwork selected')}</small></label>)}</div>{!custom&&<p className="club-help">Custom jersey editing and artwork uploads are available to Supporters. Your previously saved identity remains on record.</p>}</section>
    <div className="flex flex-wrap items-center gap-3"><button disabled={saving} className="cm-btn cm-btn-primary">{saving ? 'Saving…' : 'Save identity'}</button><p className="club-help">Changes apply to future allocations. Locked fixtures keep their matchday identity.</p></div>
    {message && <p role="status" className="club-notice">{message}</p>}
  </form>;
}
