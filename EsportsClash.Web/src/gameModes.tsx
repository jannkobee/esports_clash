import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface GameModes { active: 'fps'; fps_enabled: boolean; moba_enabled: boolean; historical_replays_enabled: boolean }
const defaults: GameModes = { active: 'fps', fps_enabled: true, moba_enabled: false, historical_replays_enabled: true };
const Context = createContext(defaults);
export const useGameModes = () => useContext(Context);
export const isMobaReference = (kind?: string | null) => ['avatars', 'items', 'releases', 'laboratory', 'catalog'].includes(kind ?? '');

export function GameModesProvider({ children }: { children: ReactNode }) {
  const [modes, setModes] = useState(defaults);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => fetch(`${(import.meta.env.VITE_API_URL ?? '/backend/api/v1').replace(/\/$/, '')}/game-modes`, { signal: controller.signal, cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(({ data }) => { if (typeof data?.moba_enabled === 'boolean') setModes({ ...defaults, moba_enabled: data.moba_enabled }); })
      .catch(() => { if (!controller.signal.aborted) setModes(defaults); });
    void load();
    const timer = window.setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, []);
  return <Context.Provider value={modes}>{children}</Context.Provider>;
}
