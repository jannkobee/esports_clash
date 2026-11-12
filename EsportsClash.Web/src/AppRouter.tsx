import {RouteErrorBoundary} from './components/RouteErrorBoundary';
import {startWorldLive} from './worldLive';
import {ClubLoader} from './components/ClubLoader';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAccount } from './AccountContext';
import { authenticationDestination, isWorkspaceRoute, openAuthentication, readRoute } from './authNavigation';
import { PublicSiteLayout } from './components/PublicSiteLayout';
import { LandingPage } from './components/LandingPage';
import { AuthenticationPage } from './components/AuthenticationPage';
import './components/club-management.css';

const FpsSimulationLab=lazy(()=>import('./components/FpsSimulationLab').then(module=>({default:module.FpsSimulationLab})));
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

function RouterContent() {
  useEffect(startWorldLive,[]);
  const [route, setRoute] = useState(readRoute);
  const { session, checking, connectionError, retry, signOut } = useAccount();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const referencePath=route.split('?')[0];
  const reference=referencePath==='hexapedia'||referencePath.startsWith('hexapedia/');
  const workspace=(isWorkspaceRoute(route)&&!reference)||Boolean(session&&reference);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    const title = route === 'fps-simulation' ? 'FPS broadcast room' : reference ? 'Hexapedia' : workspace ? 'Your club' : route === 'register' ? 'Create an account' : route === 'sign-in' ? 'Sign in' : 'Build your esports club';
    if(!reference)document.title = `${title} · Hexatrick`;
    if (route !== 'how-it-works') window.scrollTo({ top: 0 });
  }, [route, workspace]);
  useEffect(() => {
    if (workspace && !checking && !session && readRoute() === route) openAuthentication('sign-in', route);
  }, [workspace, checking, session, route]);

  if ((workspace || route === 'sign-in' || route === 'register') && checking) return <ClubLoader label="Reconnecting to your club"/>;
  if ((workspace || route === 'sign-in' || route === 'register') && session && connectionError) return <PublicSiteLayout><section className="public-loading"><h1>Reconnect to your club</h1><p role="alert">{connectionError}</p>{signOutError && <p role="alert">{signOutError}</p>}<div><button className="public-button public-button-primary" onClick={retry}>Try again</button><button className="public-button" disabled={signingOut} onClick={async () => {
    setSigningOut(true); setSignOutError('');
    try { await signOut(); } catch (error) { setSignOutError((error as Error).message); } finally { setSigningOut(false); }
  }}>Sign out</button><a className="public-text-link" href="#welcome">Back to the landing page</a></div></section></PublicSiteLayout>;

  if (route==='fps-simulation') return <PublicSiteLayout><Suspense fallback={<ClubLoader label="Opening the FPS simulation"/>}><FpsSimulationLab/></Suspense></PublicSiteLayout>;
  if (workspace) return session ? <Suspense fallback={<ClubLoader label="Opening your club"/>}><Workspace /></Suspense> : <ClubLoader label="Opening sign-in"/>;
  if (route === 'sign-in' || route === 'register') return session ? <AccountRedirect /> : <PublicSiteLayout><AuthenticationPage mode={route} /></PublicSiteLayout>;
  if (reference) return <PublicSiteLayout><section className="public-avatarpedia"><Suspense fallback={<ClubLoader label="Opening Hexapedia"/>}><Hexapedia onWatch={id => {
    const destination = `match-centre?match=${encodeURIComponent(id)}`;
    if (session) window.location.hash = destination;
    else openAuthentication('sign-in', destination);
  }} /></Suspense></section></PublicSiteLayout>;
  return <PublicSiteLayout><LandingPage /></PublicSiteLayout>;
}

export default function AppRouter(){return <RouteErrorBoundary><RouterContent/></RouteErrorBoundary>;}
