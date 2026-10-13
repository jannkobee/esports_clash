import { useState } from 'react';
import type { PlayerCard } from '../types';
import type { ClubSnapshot } from '../cloudPersistence';
import {
  isCloudPersistenceConfigured,
  loadApiSession,
  loadCloudClub,
  loginCloudAccount,
  logoutCloudAccount,
  persistApiSession,
  registerCloudAccount,
  saveCloudClub,
} from '../cloudPersistence';

export function CloudSavePanel({ roster, startingFive, onRestore }: {
  roster: PlayerCard[];
  startingFive: PlayerCard[];
  onRestore: (snapshot: ClubSnapshot) => boolean;
}) {
  const [session, setSession] = useState(loadApiSession);
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!isCloudPersistenceConfigured()) {
    return <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-xs text-slate-400">
      <b className="text-slate-200">Cloud save is optional.</b> Add <code className="text-cyan-200">VITE_API_URL</code> to <code className="text-cyan-200">.env</code> after starting the Laravel API to enable account-backed saves. Local browser saves remain active.
    </section>;
  }

  const authenticate = async () => {
    setBusy(true); setMessage('');
    try {
      const next = registering
        ? await registerCloudAccount({ name, email, password, password_confirmation: password, device_name: 'Esports Clash web client' })
        : await loginCloudAccount({ email, password, device_name: 'Esports Clash web client' });
      persistApiSession(next);
      setSession(next);
      setPassword('');
      setMessage(`Connected as ${next.user.name}.`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally { setBusy(false); }
  };

  const upload = async () => {
    if (!session) return;
    setBusy(true); setMessage('');
    try {
      const saved = await saveCloudClub(session, roster, startingFive);
      setMessage(`Cloud roster saved (${saved.roster.length} cards).`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally { setBusy(false); }
  };

  const restore = async () => {
    if (!session) return;
    setBusy(true); setMessage('');
    try {
      const snapshot = await loadCloudClub(session);
      if (!snapshot) setMessage('No cloud roster has been saved for this account yet.');
      else if (onRestore(snapshot)) setMessage(`Restored ${snapshot.roster.length} cards from cloud.`);
      else setMessage('The cloud lineup was invalid and was not applied locally.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-black text-cyan-200">Cloud Save</h3><p className="text-[11px] text-slate-400">Laravel account storage for your roster, Starting 5, and future match history.</p></div>
      {session && <span className="rounded-full bg-cyan-400/15 px-2 py-1 text-[10px] font-bold text-cyan-100">Connected: {session.user.name}</span>}
    </div>
    {!session ? <div className="grid gap-2 sm:grid-cols-2">
      {registering && <input value={name} onChange={event => setName(event.target.value)} placeholder="Club owner name" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />}
      <input value={email} onChange={event => setEmail(event.target.value)} type="email" placeholder="Email" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
      <input value={password} onChange={event => setPassword(event.target.value)} type="password" placeholder="Password (12+ characters)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
      <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void authenticate()} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50">{registering ? 'Create account' : 'Sign in'}</button><button type="button" disabled={busy} onClick={() => { setRegistering(value => !value); setMessage(''); }} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200">{registering ? 'Use sign in' : 'Create account'}</button></div>
    </div> : <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void upload()} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50">Save roster to cloud</button>
      <button type="button" disabled={busy} onClick={() => void restore()} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-slate-100 disabled:opacity-50">Restore cloud roster</button>
      <button type="button" disabled={busy} onClick={() => void logoutCloudAccount(session).then(() => { setSession(null); setMessage('Signed out.'); }).catch(error => setMessage((error as Error).message))} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-300 disabled:opacity-50">Sign out</button>
    </div>}
    {message && <p role="status" className="text-[11px] text-slate-300">{message}</p>}
  </section>;
}
