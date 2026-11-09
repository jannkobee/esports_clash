import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {useAccount} from './AccountContext';
import {DEFAULT_THEME, type PersonalTheme} from './supporter';
const Context=createContext<{theme:PersonalTheme;apply:(theme:PersonalTheme)=>void}>({theme:DEFAULT_THEME,apply:()=>{}});
function valid(theme:PersonalTheme){return ['background','surface','text','accent'].every(k=>/^#[0-9a-f]{6}$/i.test(theme[k as keyof PersonalTheme]));}
export function PersonalThemeProvider({children}:{children:ReactNode}){
  const {session}=useAccount();const [theme,setTheme]=useState(DEFAULT_THEME);
  useEffect(()=>{setTheme(session?.user.supporter?.active&&session.user.theme&&valid(session.user.theme)?session.user.theme:DEFAULT_THEME);},[session?.user.id,session?.user.supporter?.active,session?.user.supporter?.level,session?.user.theme]);
  useEffect(()=>{
    const root=document.documentElement;root.dataset.hxTheme=theme.id;root.dataset.hxDensity=theme.density;
    Object.entries(theme).forEach(([k,v])=>{if(['background','surface','text','accent'].includes(k))root.style.setProperty('--personal-'+k,v);});
    // Button foreground follows the chosen accent; canvas text is checked on the server.
    const rgb=theme.accent.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];root.style.setProperty('--personal-on-accent',luminance>.179?'#101010':'#ffffff');
  },[theme]);
  return <Context.Provider value={{theme,apply:next=>{if(valid(next))setTheme(next);}}}>{children}</Context.Provider>;
}
export const usePersonalTheme=()=>useContext(Context);
