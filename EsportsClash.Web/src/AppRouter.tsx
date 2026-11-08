import {startWorldLive} from './worldLive';
import {ClubLoader} from './components/ClubLoader';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAccount } from './AccountContext';
import { authenticationDestination, isWorkspaceRoute, openAuthentication, readRoute } from './authNavigation';
import { GameContentProvider } from './GameContentContext';
import { PublicSiteLayout } from './components/PublicSiteLayout';
import { LandingPage } from './components/LandingPage';
import { AuthenticationPage } from './components/AuthenticationPage';
import './components/club-management.css';

const Workspace = lazy(() => import('./App'));
const Hexapedia = lazy(() => import('./components/Hexapedia').then(module => ({ default: module.Hexapedia })));

function AccountRedirect() {
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    redirected.current = true;
    window.location.replace(`#${authenticationDestination()}`);
  }, []);
  return <ClubLoader label="Opening your club"/>;
}

export default function AppRouter() {
  useEffect(startWorldLive,[]);
  const [route, setRoute] = useState(readRoute);
  const { session, checking, connectionError, retry, signOut } = useAccount();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const codexReference = route === 'codex' || route.startsWith('codex/');
  const reference = codexReference || route === 'avatarpedia' || route.startsWith('avatarpedia/') || route === 'discover';
  const workspace = (isWorkspaceRoute(route) && !codexReference) || Boolean(session && reference);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    const title = reference ? 'Hexapedia' : workspace ? 'Your club' : route === 'register' ? 'Create an account' : route === 'sign-in' ? 'Sign in' : 'Build your esports club';
    if(!reference)document.title = `${title} · Hexatrick`;
    if (route !== 'how-it-works') window.scrollTo({ top: 0 });
  }, [route, workspace]);
  useEffect(() => {
    if (workspace && !checking && !session && readRoute() === route) openAuthentication('sign-in', route);
  }, [workspace, checking, session, route]);
  useEffect(() => {
    if (session && !checking && reference && !codexReference && readRoute() === route) {
      window.history.replaceState(null, '', '#codex'+(route.startsWith('avatarpedia/') ? route.slice('avatarpedia'.length) : ''));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [session, checking, reference, route]);

  if ((workspace || route === 'sign-in' || route === 'register') && checking) return <ClubLoader label="Reconnecting to your club"/>;
  if ((workspace || route === 'sign-in' || route === 'register') && session && connectionError) return <PublicSiteLayout><section className="public-loading"><h1>Reconnect to your club</h1><p role="alert">{connectionError}</p>{signOutError && <p role="alert">{signOutError}</p>}<div><button className="public-button public-button-primary" onClick={retry}>Try again</button><button className="public-button" disabled={signingOut} onClick={async () => {
    setSigningOut(true); setSignOutError('');
    try { await signOut(); } catch (error) { setSignOutError((error as Error).message); } finally { setSigningOut(false); }
  }}>Sign out</button><a className="public-text-link" href="#welcome">Back to the landing page</a></div></section></PublicSiteLayout>;

  if (workspace) return session ? <Suspense fallback={<ClubLoader label="Opening your club"/>}><GameContentProvider><Workspace /></GameContentProvider></Suspense> : <ClubLoader label="Opening sign-in"/>;
  if (route === 'sign-in' || route === 'register') return session ? <AccountRedirect /> : <PublicSiteLayout><AuthenticationPage mode={route} /></PublicSiteLayout>;
  if (route === 'discover' || codexReference || route === 'avatarpedia' || route.startsWith('avatarpedia/')) return <PublicSiteLayout><section className="public-avatarpedia"><Suspense fallback={<ClubLoader label="Opening Hexapedia"/>}><Hexapedia onWatch={id => {
    const destination = `play?match=${encodeURIComponent(id)}`;
    if (session) window.location.hash = destination;
    else openAuthentication('sign-in', destination);
  }} /></Suspense></section></PublicSiteLayout>;
  return <PublicSiteLayout><LandingPage /></PublicSiteLayout>;
}
