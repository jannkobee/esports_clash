const RETURN_KEY = 'esports-clash-auth-return';
const workspaceRoutes = new Set(['home', 'squad', 'play', 'market', 'finances', 'codex', 'settings']);

export function readRoute(): string {
  return window.location.hash.slice(1).trim() || 'welcome';
}

export function isWorkspaceRoute(route: string): boolean {
  return workspaceRoutes.has(route.split('?')[0].split('/')[0]);
}

function safeDestination(route: string): string {
  if(/^(?:avatarpedia|codex)\/(?:guide|laboratory|catalog)$/.test(route))return route;
  if (/^(?:avatarpedia|codex)(?:\/(?:tournaments|teams|nations|players|coaches|avatars|items|releases|organizers|sponsors|talent)(?:\/[a-zA-Z0-9_:%-]{1,150})?)?$/.test(route)) return route;
  if (!isWorkspaceRoute(route)) return 'play';
  const [section, query = ''] = route.split('?');
  if(section.includes('/'))return section.split('/')[0];
  const params=new URLSearchParams(query),allowed=new URLSearchParams();
  const match=params.get('match');
  if(section==='play'){
    if(params.get('community')==='cups')allowed.set('community','cups');
    if(params.get('tool')==='practice')allowed.set('tool','practice');
    if(match&&/^[a-f0-9-]{36}$/i.test(match))allowed.set('match',match);
    const post=params.get('post');if(post&&/^[1-9][0-9]{0,12}$/.test(post))allowed.set('post',post);
    const world=params.get('world');if(world&&['news','broadcasts','archive'].includes(world))allowed.set('world',world);
    const club=params.get('club');if(club&&['calendar','lineup','identity','friendly'].includes(club))allowed.set('club',club);
    const competitions=params.get('competitions');if(competitions&&['circuit','calendar','rankings','nations','organizer'].includes(competitions))allowed.set('competitions',competitions);
  }
  if(section==='market'){const tab=params.get('tab');if(tab&&['auctions','sell','trades','academy'].includes(tab))allowed.set('tab',tab);const player=params.get('player');if(player&&/^[a-f0-9-]{36}$/i.test(player))allowed.set('player',player);}
  if(section==='squad'){const tab=params.get('tab');if(tab&&['lineup','training','staff'].includes(tab))allowed.set('tab',tab);}
  if(section==='home'){const office=params.get('office');if(office&&['inbox','reports'].includes(office))allowed.set('office',office);}
  return section+(allowed.size?'?'+allowed.toString():'');
}

export function openAuthentication(mode: 'sign-in' | 'register' = 'sign-in', returnTo = 'play'): void {
  sessionStorage.setItem(RETURN_KEY, safeDestination(returnTo));
  window.location.hash = mode;
}

export function authenticationDestination(): string {
  const destination = safeDestination(sessionStorage.getItem(RETURN_KEY) ?? 'play');
  sessionStorage.removeItem(RETURN_KEY);
  return destination;
}
