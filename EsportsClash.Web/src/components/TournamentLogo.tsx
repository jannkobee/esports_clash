/** Original vector marks derived from stable registry identities; no external logo assets. */
export function TournamentLogo({id,name,size=30,kind='tournament'}:{id:string|number;name:string;size?:number;kind?:'tournament'|'organizer'|'sponsor'}) {
  let hash=2166136261;for(const c of kind+':'+id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  const palettes=[['#d83b47','#ffd2d4'],['#b89a53','#fff0be'],['#6389bd','#d8e9ff'],['#9d79b4','#efe0ff'],['#6eaa9b','#d8fff1'],['#c67b4c','#ffe1c4']];
  const [base,ink]=palettes[hash%palettes.length];
  const shapes=[<path d="m15 17 5 8 5-12 5 12 5-8-3 17H18z"/>,<path d="m12 32 13-19 13 19h-8l-5-8-5 8z"/>,<path d="m25 11 5 9 10 2-7 8 1 10-9-5-9 5 1-10-7-8 10-2z"/>,<path d="m13 17 12 5 12-5v8l-12 8-12-8zm5 14 7 5 7-5v6l-7 5-7-5z"/>,<path d="m24 10-11 19h10l-3 13 17-22H27l3-10z"/>,<path d="m25 11 13 14-13 14-13-14zm0 9-5 5 5 5 5-5z" fillRule="evenodd"/>];
  return <svg className={'tournament-logo tournament-logo--'+kind} width={size} height={size} viewBox="0 0 50 52" role="img" aria-label={name+' '+kind+' mark'}><title>{name}</title><path d="M25 2 46 12v21L25 50 4 33V12z" fill="#191b20" stroke={base} strokeWidth="2"/><path d="M8 15v16l17 14 17-14V15L25 6z" fill={base} opacity=".15"/><g fill={ink} stroke={base} strokeWidth=".6" strokeLinejoin="round">{shapes[(hash>>>4)%shapes.length]}</g><path d="m8 36 17 13 17-13" fill="none" stroke={base} strokeWidth="2"/></svg>;
}
