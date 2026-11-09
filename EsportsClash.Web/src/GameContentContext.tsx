import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { GameContentSnapshot } from './gameContent';
import {createCatalogConnection,type CatalogConnection} from './gameContentConnection';

export const GAME_CONTENT_API = (import.meta.env.VITE_API_URL ?? '/backend/api/v1').replace(/\/$/, '');
const ContentContext = createContext<GameContentSnapshot | undefined>(undefined);
export const useGameContent = () => useContext(ContentContext);
const ConnectionContext=createContext<CatalogConnection & {refresh:()=>void}>({status:'loading',refresh:()=>{}});
export const useGameContentConnection=()=>useContext(ConnectionContext);

/** Load before interactive matches can start; private workers mount without this provider. */
export function GameContentProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [snapshot, setSnapshot] = useState<GameContentSnapshot>();
  const [connection,setConnection]=useState<CatalogConnection>({status:'loading'});
  const [refresh,setRefresh]=useState<()=>void>(()=>()=>{});
  useEffect(() => {
    let disposed=false;
    const client=createCatalogConnection(`${GAME_CONTENT_API}/game-content`,setSnapshot,state=>{setConnection(state);setLoaded(true);});
    const refresh=()=>{if(!disposed)void client.refresh();};
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    setRefresh(()=>refresh);refresh();
    const poll=window.setInterval(visible,15000);
    window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',visible);
    return()=>{disposed=true;client.dispose();window.clearInterval(poll);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',visible);};
  }, []);
  if (!loaded) return <main className="p-8 text-cyan-200" role="status">Loading game catalog…</main>;
  return <ConnectionContext.Provider value={{...connection,refresh}}><ContentContext.Provider value={snapshot}>{children}</ContentContext.Provider></ConnectionContext.Provider>;
}
