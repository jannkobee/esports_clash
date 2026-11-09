import {canonicalRoute,canonicalizeLocation,workspacePath} from './frontendRoutes';
const RETURN_KEY='esports-clash-auth-return';
const workspaceSections=new Set(['home','squad','play','market','finances','hexapedia','history','supporter','settings']);
export const readRoute=()=>canonicalizeLocation();
export const isWorkspaceRoute=(route:string)=>workspaceSections.has(workspacePath(route).split(/[/?]/)[0]);
function safeDestination(value:string):string{
 const route=canonicalRoute(value);
 if(/^hexapedia\/(?:guide|laboratory|catalog)$/.test(route))return route;
 if(/^hexapedia\/awards(?:\?year=20[0-9]{2})?$/.test(route))return route;
 if(/^hexapedia(?:\/(?:tournaments|teams|nations|players|coaches|avatars|items|releases|organizers|sponsors|talent|managers)(?:\/[a-zA-Z0-9_:%-]{1,150})?)?$/.test(route))return route;
 if(!isWorkspaceRoute(route))return 'match-centre';
 const [section,query='']=workspacePath(route).split('?');
 if(section.includes('/'))return 'hexapedia';
 const params=new URLSearchParams(query),allowed=new URLSearchParams();
 if(section==='play'){
  if(params.get('community')==='cups')allowed.set('community','cups');
  if(params.get('tool')==='practice')allowed.set('tool','practice');
  const match=params.get('match');if(match&&/^[a-f0-9-]{36}$/i.test(match))allowed.set('match',match);
  for(const key of ['game','post']){const id=params.get(key);if(id&&/^[1-9][0-9]{0,12}$/.test(id))allowed.set(key,id);}
  const world=params.get('world');if(world&&['news','broadcasts','archive'].includes(world))allowed.set('world',world);
  const club=params.get('club');if(club&&['calendar','lineup','identity','friendly'].includes(club))allowed.set('club',club);
  const competitions=params.get('competitions');if(competitions&&['circuit','calendar','rankings','nations','organizer'].includes(competitions))allowed.set('competitions',competitions);
 }
 if(section==='market'){const tab=params.get('tab');if(tab&&['auctions','sell','trades','academy'].includes(tab))allowed.set('tab',tab);const player=params.get('player');if(player&&/^[a-f0-9-]{36}$/i.test(player))allowed.set('player',player);}
 if(section==='squad'){const tab=params.get('tab');if(tab&&['lineup','training','staff'].includes(tab))allowed.set('tab',tab);}
 if(section==='home'){const office=params.get('office');if(office&&['inbox','reports'].includes(office))allowed.set('office',office);}
 return canonicalRoute(section+(allowed.size?'?'+allowed.toString():''));
}
export function openAuthentication(mode:'sign-in'|'register'='sign-in',returnTo='match-centre'):void{
 sessionStorage.setItem(RETURN_KEY,safeDestination(returnTo));window.location.hash=mode;
}
export function authenticationDestination():string{
 const destination=safeDestination(sessionStorage.getItem(RETURN_KEY)??'match-centre');sessionStorage.removeItem(RETURN_KEY);return destination;
}
