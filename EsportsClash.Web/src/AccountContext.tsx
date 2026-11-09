import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { API_SESSION_CHANGED, isCloudPersistenceConfigured, loadApiSession, logoutCloudAccount, persistApiSession, request, type ApiSession } from './cloudPersistence';

interface AccountState {
  session: ApiSession | null;
  checking: boolean;
  connectionError: string;
  retry: () => void;
  signOut: () => Promise<void>;
}

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(loadApiSession);
  const [checking, setChecking] = useState(() => Boolean(loadApiSession()));
  const [connectionError, setConnectionError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const next = loadApiSession();
      setConnectionError('');
      setChecking(Boolean(next));
      setSession(next);
      setAttempt(value => value + 1);
    };
    const storage = (event: StorageEvent) => { if (!event.key || event.key === 'esports-clash-api-session-v1') refresh(); };
    window.addEventListener(API_SESSION_CHANGED, refresh);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(API_SESSION_CHANGED, refresh); window.removeEventListener('storage', storage); };
  }, []);

  useEffect(() => {
    setConnectionError('');
    if (!session) { setChecking(false); return; }
    if (!isCloudPersistenceConfigured()) { setChecking(false); setConnectionError('The club server is currently unavailable.'); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    let disposed = false;
    setChecking(true);
    void request<{ data: ApiSession['user'] }>('/me', session, { signal: controller.signal })
      .then(result => {
        if (disposed) return;
        if (result.data.id !== session.user.id) { persistApiSession(null); return; }
        setSession(current => current?.token === session.token ? { ...current, user: result.data } : current);
      })
      .catch(() => {
        if (!disposed && loadApiSession()?.token === session.token) setConnectionError('We could not reconnect to your club account. Please try again.');
      })
      .finally(() => { if (!disposed) setChecking(false); window.clearTimeout(timeout); });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [session?.token, attempt]);

  useEffect(()=>{const timer=window.setInterval(()=>setSession(current=>{const member=current?.user.supporter;if(!current||!member?.active||!member.ends_at||Date.parse(member.ends_at)>Date.now())return current;return {...current,user:{...current.user,supporter:{...member,active:false,kind:'free',level:'free',label:'Free',features:{custom_logo:false,custom_jerseys:false,themes:false,custom_theme:false,player_identity:false}}}};}),60000);return()=>clearInterval(timer);},[]);
  const signOut = async () => {
    try {
      if (session) await logoutCloudAccount(session);
      else persistApiSession(null);
    } catch (error) { if (loadApiSession()) throw error; }
    window.location.hash = 'welcome';
  };

  return <AccountContext.Provider value={{ session, checking, connectionError, retry: () => setAttempt(value => value + 1), signOut }}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  const account = useContext(AccountContext);
  if (!account) throw new Error('AccountProvider must wrap the application.');
  return account;
}
