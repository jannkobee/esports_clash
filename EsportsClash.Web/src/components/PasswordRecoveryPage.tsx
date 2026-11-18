import {useState, type FormEvent} from 'react';
import {ArrowLeft, ArrowRight} from 'lucide-react';
import {isCloudPersistenceConfigured, request} from '../cloudPersistence';

/** Forgot password (ask for a link) and reset password (set a new one from the emailed link). */
export function PasswordRecoveryPage({mode, query}: {mode: 'forgot-password' | 'reset-password'; query: string}) {
  const params = new URLSearchParams(query);
  const [email, setEmail] = useState(params.get('email') ?? ''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
  const resetting = mode === 'reset-password', token = params.get('token') ?? '';
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setDone('');
    if (resetting && password !== confirmation) { setError('Your passwords do not match.'); return; }
    setBusy(true);
    try {
      const r = resetting
        ? await request<{message: string}>('/auth/reset-password', null, {method: 'POST', body: JSON.stringify({token, email: email.trim(), password, password_confirmation: confirmation})})
        : await request<{message: string}>('/auth/forgot-password', null, {method: 'POST', body: JSON.stringify({email: email.trim()})});
      setDone(r.message);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="auth-page public-container">
    <div className="auth-introduction"><a className="public-text-link" href="#sign-in"><ArrowLeft size={15} /> Back to sign in</a>
      <p className="public-eyebrow">Account recovery</p><h1>{resetting ? <>Choose a<br />new password.</> : <>Locked out of<br /><span>your club?</span></>}</h1>
      <p>{resetting ? 'Set a new password for your manager account. You will be signed out on every device.' : 'Enter the email address of your manager account and we will send you a link to reset your password.'}</p></div>
    <div className="auth-card">
      <p className="public-eyebrow">Manager account</p><h2>{resetting ? 'Reset your password' : 'Forgot your password?'}</h2>
      {done ? <><p role="status" className="auth-success">{done}</p>{resetting && <a className="public-button public-button-primary" href="#sign-in">Sign in <ArrowRight size={17} /></a>}</>
        : <form onSubmit={submit} aria-busy={busy}>
          {error && <p role="alert" className="auth-error">{error}</p>}
          {resetting && !token && <p role="alert" className="auth-error">This link is missing its reset code. Open the link from your email again, or request a new one.</p>}
          <label htmlFor="recovery-email">Email address<input id="recovery-email" type="email" autoComplete="username" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
          {resetting && <>
            <label htmlFor="recovery-password">New password<input id="recovery-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /><small>At least 12 characters.</small></label>
            <label htmlFor="recovery-confirmation">Confirm new password<input id="recovery-confirmation" type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></label>
          </>}
          <button type="submit" className="public-button public-button-primary" disabled={busy || !isCloudPersistenceConfigured() || (resetting && !token)}>{busy ? 'Sending…' : resetting ? 'Set new password' : 'Email me a reset link'}{!busy && <ArrowRight size={17} />}</button>
        </form>}
    </div>
  </section>;
}
