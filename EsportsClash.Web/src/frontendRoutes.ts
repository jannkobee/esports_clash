/** Public module names. Old bookmarks are admitted here, then canonicalized once. */
export const MODULE_ROUTES={home:'club-home',squad:'squad',play:'match-centre',market:'transfer-exchange',finances:'finances',hexapedia:'hexapedia',history:'match-history',supporter:'supporter-studio',settings:'settings'} as const;
export type WorkspaceSection=keyof typeof MODULE_ROUTES;
const aliases:Record<string,string>={home:'club-home',play:'match-centre',market:'transfer-exchange',codex:'hexapedia',avatarpedia:'hexapedia',discover:'hexapedia',history:'match-history',supporter:'supporter-studio'};
const worldModules:Record<string,string>={news:'wire',broadcasts:'hexacast',archive:'launch-championship'};
export function canonicalRoute(value:string):string{
 const [path,...query]=value.replace(/^#/,'').split('?');const parts=path.split('/');parts[0]=aliases[parts[0]]??parts[0];let route=parts.join('/');const params=new URLSearchParams(query.join('?'));
 if(route==='match-centre'){
  const world=params.get('world');if(world&&worldModules[world]){route=worldModules[world];params.delete('world');}
  else if(params.get('community')==='cups'){route='community-cups';params.delete('community');}
  else if(params.has('competitions')){route='competitions';params.set('tab',params.get('competitions')!);params.delete('competitions');}
  else if(params.get('tool')==='practice'){route='arena-practice';params.delete('tool');}
  else if(params.get('club')==='friendly'){route='scrimmages';params.delete('club');}
 }
 return route+(params.size?'?'+params.toString():'');
}
/** Translate named module URLs into the workspace's existing view state. */
export function workspacePath(value:string):string{
 const [path,query='']=canonicalRoute(value).split('?');const params=new URLSearchParams(query);let route=path;
 const section=(Object.entries(MODULE_ROUTES) as [WorkspaceSection,string][]).find(([,name])=>name===path)?.[0];
 if(section)route=section;
 else if(['wire','hexacast','launch-championship'].includes(path)){route='play';params.set('world',({wire:'news',hexacast:'broadcasts','launch-championship':'archive'} as Record<string,string>)[path]);}
 else if(path==='competitions'){route='play';params.set('competitions',params.get('tab')??'circuit');params.delete('tab');}
 else if(path==='community-cups'){route='play';params.set('community','cups');}
 else if(path==='arena-practice'){route='play';params.set('tool','practice');}
 else if(path==='scrimmages'){route='play';params.set('club','friendly');}
 return route+(params.size?'?'+params.toString():'');
}
export const sectionHref=(section:WorkspaceSection)=>'#'+MODULE_ROUTES[section];
export function canonicalizeLocation():string{
 const raw=window.location.hash.slice(1).trim()||'welcome';const next=canonicalRoute(raw);
 if(raw!==next)window.history.replaceState(null,'','#'+next);
 return next;
}
