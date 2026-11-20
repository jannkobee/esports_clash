import {useState} from 'react';
import {ChevronDown, ExternalLink, Volume2} from 'lucide-react';
import {sound} from '../audio';
import {backendPageUrl} from '../cloudPersistence';
import type {ClubSnapshot} from '../cloudPersistence';
import type {PlayerCard} from '../types';
import {AppIcon} from './ui/AppIcon';
import {Switch} from './ui/Switch';
import {EmailSettings} from './EmailSettings';
import {CloudSavePanel} from './CloudSavePanel';
import {OnlineNormalView} from './OnlineNormalView';
import './settings-page.css';

/**
 * Account settings, in the order a manager looks for them: who we email and about what, sound,
 * the practice roster backup, then the simulation lab and diagnostics.
 */
export function SettingsPage({roster, startingFive, onRestore, isAdmin, fpsEnabled}: {
  roster: PlayerCard[];
  startingFive: PlayerCard[];
  onRestore: (snapshot: ClubSnapshot) => boolean;
  isAdmin: boolean;
  fpsEnabled: boolean;
}) {
  const [muted, setMuted] = useState(() => sound.isMuted());
  const [music, setMusic] = useState(() => sound.isMusicEnabled());
  const [sandbox, setSandbox] = useState(false);

  return (
    <div className="settings-page">
      <EmailSettings />

      <section className="cm-panel" aria-labelledby="settings-sound">
        <h2 className="cm-panel-header" id="settings-sound"><Volume2 size={15} aria-hidden="true" /> Sound</h2>
        <div className="cm-panel-body settings-switches">
          <Switch label="Sound" description="Clicks, match audio and music. Turning this off silences everything." checked={!muted}
            onChange={on => { if (on === muted) setMuted(sound.toggleMuted()); }} />
          <Switch label="Background music" description={muted ? 'Turn sound on to choose music.' : 'Music while you manage the club.'} checked={music && !muted} disabled={muted}
            onChange={on => { if (on !== music) { setMusic(sound.toggleMusic()); sound.playClick(); } }} />
        </div>
      </section>

      <CloudSavePanel roster={roster} startingFive={startingFive} onRestore={onRestore} />

      <section className="cm-panel" aria-labelledby="settings-lab">
        <h2 className="cm-panel-header" id="settings-lab"><AppIcon name="broadcastLab" size={15} /> Simulation and 3D lab</h2>
        <div className="cm-panel-body settings-lab">
          <p className="settings-lead">Matches are played by the tactical FPS simulation{fpsEnabled ? '' : ' (configured, not yet active)'}. The lab runs live 3D exhibitions on Fontessa and Spillway; exhibitions never change your club's records.</p>
          <div className="settings-links">
            <a className="settings-link" href="#fps-simulation"><strong>3D Broadcast Lab</strong><span>Watch a live exhibition with free, player and director cameras.</span></a>
            <a className="settings-link" href="#arena-practice"><strong>Practice match</strong><span>Your practice five against a practice side.</span></a>
            <a className="settings-link" href="#hexapedia/liveSimulation"><strong>How the 3D simulation works</strong><span>Decisions, information and roles, explained.</span></a>
            <a className="settings-link" href="#hexapedia/fps"><strong>FPS reference</strong><span>Maps, weapons, economy and rules.</span></a>
            {isAdmin && <a className="settings-link" href={backendPageUrl('/evolution/game-modes')}><strong>Game-mode settings <ExternalLink size={12} aria-hidden="true" /></strong><span>Owner controls on the backend.</span></a>}
          </div>
          <details className="settings-diagnostics" onToggle={event => setSandbox((event.target as HTMLDetailsElement).open)}>
            <summary><ChevronDown size={14} aria-hidden="true" /> Diagnostics: online normal sandbox</summary>
            <p>An unscheduled copy of the match workspace, for checking lineups and matchmaking outside your fixtures.</p>
            {sandbox && <OnlineNormalView />}
          </details>
        </div>
      </section>
    </div>
  );
}
