import {useEffect, useState} from 'react';
import {Mail, MailCheck} from 'lucide-react';
import {useAccount} from '../AccountContext';
import {request} from '../cloudPersistence';

interface Prefs {preferences: Record<string, boolean>; categories: Record<string, [string, string]>; email: string; email_verified: boolean}

/** Which emails the manager receives. Account emails (sign-in, recovery, your club's future) always arrive. */
export function EmailSettings() {
  const {session} = useAccount();
  const [data, setData] = useState<Prefs | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) return;
    const c = new AbortController();
    void request<{data: Prefs}>('/online/notifications', session, {signal: c.signal}).then(r => setData(r.data)).catch(e => { if (!c.signal.aborted) setError((e as Error).message); });
    if (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('unsubscribed') === '1') setNotice('You have been unsubscribed. Switch categories back on below at any time.');
    return () => c.abort();
  }, [session]);
  async function toggle(key: string, on: boolean) {
    if (!session || !data) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await request<{data: {preferences: Record<string, boolean>}}>('/online/notifications', session, {method: 'PUT', body: JSON.stringify({preferences: {[key]: on}})});
      setData({...data, preferences: r.data.preferences}); setNotice('Email preferences saved.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="cm-panel" id="email-settings"><h2 className="cm-panel-header"><Mail size={15} aria-hidden="true" /> Email</h2><div className="cm-panel-body space-y-3">
    {error && <p role="alert">{error}</p>}{notice && <p role="status" className="club-notice">{notice}</p>}
    {!data && !error && <p role="status">Loading email preferences…</p>}
    {data && <>
      <p>We write to <b>{data.email}</b>{data.email_verified ? <> <MailCheck size={13} aria-hidden="true" /> confirmed.</> : ' (not confirmed yet).'} Emails about signing in, account recovery, billing and your club's future always arrive.</p>
      <ul className="email-prefs">{Object.entries(data.categories).map(([key, [label, description]]) => <li key={key}>
        <label><input type="checkbox" checked={data.preferences[key] ?? true} disabled={busy} onChange={e => void toggle(key, e.target.checked)} /> <b>{label}</b></label>
        <small>{description}</small>
      </li>)}</ul>
    </>}
  </div></section>;
}

/** Shown in the workspace until the manager confirms their address. */
export function VerifyEmailBanner() {
  const {session} = useAccount();
  const [state, setState] = useState<'idle' | 'sent' | 'error' | 'hidden'>('idle');
  const verifiedNow = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('email') === 'verified';
  if (!session || session.user.email_verified !== false || state === 'hidden') return verifiedNow ? <p role="status" className="club-notice verify-banner">Thanks — your email address is confirmed.</p> : null;
  return <p role="status" className="club-notice verify-banner"><Mail size={14} aria-hidden="true" /> Confirm your email address so we can tell you about results, deadlines and anything that puts your club at risk.
    {state === 'sent' ? ' A new link is on its way.' : state === 'error' ? ' The link could not be sent; try again later.' : <> <button type="button" className="cm-btn cm-btn-sm" onClick={() => void request('/auth/email/resend', session, {method: 'POST'}).then(() => setState('sent')).catch(() => setState('error'))}>Send the link again</button></>}
    <button type="button" className="cm-btn cm-btn-ghost cm-btn-sm" onClick={() => setState('hidden')}>Later</button></p>;
}
