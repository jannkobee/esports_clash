import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useAccount } from '../AccountContext';
import { openAuthentication } from '../authNavigation';
import './public-site.css';
import { HexatrickMark } from './HexatrickBrand';

export function BrandMark() {
  return <HexatrickMark/>;
}

export function PublicSiteLayout({ children }: { children: ReactNode }) {
  const { session } = useAccount();
  return <div className="public-site">
    <a className="public-skip" href="#public-main" onClick={event => { event.preventDefault(); document.getElementById('public-main')?.focus(); }}>Skip to content</a>
    <header className="public-header public-container">
      <a className="public-brand" href="#welcome" aria-label="Hexatrick home"><BrandMark /><span>hexatrick<small>ESPORTS CLUB MANAGER</small></span></a>
      <nav className="public-nav" aria-label="Main navigation">
        <a className="public-nav-about" href="#how-it-works">How it works</a>
        <a className="public-nav-about" href="#hexapedia">Hexapedia</a>
        {session ? <a className="public-button public-button-primary" href="#match-centre">Open your club <ArrowUpRight size={15} /></a> : <>
          <a href="#sign-in" onClick={event => { event.preventDefault(); openAuthentication(); }}>Sign in</a>
          <a className="public-button public-button-primary" href="#register" onClick={event => { event.preventDefault(); openAuthentication('register'); }}>Create a club <ArrowUpRight size={15} /></a>
        </>}
      </nav>
    </header>
    <main id="public-main" tabIndex={-1}>{children}</main>
    <footer className="public-footer public-container">
      <div><strong>Hexatrick</strong><p>A club to build. A matchday to look forward to.</p></div>
      <nav aria-label="Footer navigation"><a href="#how-it-works">How it works</a><a href="#hexapedia">Hexapedia</a><a href={session ? '#match-centre' : '#sign-in'}>{session ? 'Your club' : 'Sign in'}</a></nav>
      <span>Philippine pilot · Manila time</span>
    </footer>
  </div>;
}
