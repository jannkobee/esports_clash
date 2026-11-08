import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Check } from 'lucide-react';
import { authenticationDestination } from '../authNavigation';
import { isCloudPersistenceConfigured, loginCloudAccount, persistApiSession, registerCloudAccount } from '../cloudPersistence';

export function AuthenticationPage({ mode }: { mode: 'sign-in' | 'register' }) {
  const registering = mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setPassword(''); setConfirmation(''); setError(''); setVisible(false); }, [mode]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (registering && password !== confirmation) { setError('Your passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const input = { email: email.trim(), password, device_name: 'Hexatrick web client' };
      const session = registering ? await registerCloudAccount({ ...input, name: name.trim(), password_confirmation: confirmation }) : await loginCloudAccount(input);
      persistApiSession(session);
      window.location.hash = authenticationDestination();
    } catch (problem) { if (mounted.current) setError((problem as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  }

  return <section className="auth-page public-container">
    <div className="auth-introduction"><a className="public-text-link" href="#welcome"><ArrowLeft size={15} /> Back to Hexatrick</a><p className="public-eyebrow">{registering ? 'A new club. Your call.' : 'Your club is waiting'}</p><h1>{registering ? <>Every club starts<br />with a manager.</> : <>Back for the<br /><span>next matchday.</span></>}</h1><p>{registering ? 'Create your manager account, then make the club yours. Your starter roster gives you a place to begin.' : 'Sign in to set your lineup, follow your fixtures, and take care of the team you are building.'}</p><ul>{['A name, crest, and kit of your own', 'Fixtures that start on a real schedule', 'One account across your entire club'].map(text => <li key={text}><Check size={16} />{text}</li>)}</ul></div>
    <div className="auth-card">
      <p className="public-eyebrow">Manager account</p><h2>{registering ? 'Create your account' : 'Welcome back'}</h2><p>{registering ? 'Already a manager?' : 'New to Hexatrick?'} <a href={registering ? '#sign-in' : '#register'}>{registering ? 'Sign in' : 'Create an account'}</a></p>
      {!isCloudPersistenceConfigured() && <p className="auth-error" role="status">Accounts are unavailable while the club server is disconnected.</p>}
      <form onSubmit={submit} aria-busy={busy}>
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="auth-error">{error}</p>}
        {registering && <label htmlFor="manager-name">Manager name<input id="manager-name" name="name" autoComplete="name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>}
        <label htmlFor="account-email">Email address<input id="account-email" name="email" type="email" autoComplete="username" required maxLength={255} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
        <label htmlFor="account-password">Password<span className="auth-password"><input id="account-password" name="password" type={visible ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 12 : undefined} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>{registering && <small>Use at least 12 characters.</small>}</label>
        {registering && <label htmlFor="account-confirmation">Confirm password<input id="account-confirmation" name="password_confirmation" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={12} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>}
        <button type="submit" className="public-button public-button-primary" disabled={busy || !isCloudPersistenceConfigured()}>{busy ? 'Connecting…' : registering ? 'Create account & continue' : 'Sign in to your club'}{!busy && <ArrowRight size={17} />}</button>
      </form>
      <p className="auth-footnote">{registering ? 'Your starter club and five players are included. You can customize the club after signing up.' : 'Use the same account for Matchday, Money, and your club settings.'}</p>
    </div>
  </section>;
}
