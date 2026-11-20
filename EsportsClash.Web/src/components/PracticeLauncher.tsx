import {ArrowRight, Info} from 'lucide-react';
import type {PlayerCard} from '../types';
import type {LiveMapId} from '../fps/fpsLiveMapTypes';
import type {FpsMapId} from '../fps/fpsTypes';
import {listLiveMaps} from '../fps/fpsLiveMapRegistry';
import {FPS_MAPS} from '../fps/fpsMaps';
import {AppIcon} from './ui/AppIcon';
import './practice-launcher.css';

/** Who plays: the practice five against the practice side, named, so there is no surprise on launch. */
function Side({label, players}: {label: string; players: PlayerCard[]}) {
  return (
    <div className="practice-side">
      <span className="practice-side__label">{label}</span>
      {players.length ? <ul>{players.map(player => <li key={player.id}>{player.name}</li>)}</ul> : <p>No players available.</p>}
    </div>
  );
}

/** Practice: pick a format and a map, then play. Nothing here changes the club's records. */
export function PracticeLauncher({five, opponents, liveMap, onLiveMap, recordedMap, onRecordedMap, onLaunchLive, onLaunchRecorded, error}: {
  five: PlayerCard[];
  opponents: PlayerCard[];
  liveMap: LiveMapId;
  onLiveMap: (map: LiveMapId) => void;
  recordedMap: FpsMapId;
  onRecordedMap: (map: FpsMapId) => void;
  onLaunchLive: () => void;
  onLaunchRecorded: () => void;
  error: string;
}) {
  return (
    <div className="practice">
      <section className="practice-lineup" aria-label="Who plays">
        <Side label="Your practice five" players={five} />
        <span className="practice-lineup__vs" aria-hidden="true">vs</span>
        <Side label="Practice side" players={opponents} />
        <p className="practice-lineup__note"><Info size={13} aria-hidden="true" /> Practice uses your practice collection, saved in this browser. Results, finances, form and careers never change.</p>
      </section>

      {error && <p role="alert" className="club-notice practice-error">{error}</p>}

      <div className="practice-modes">
        <section className="practice-mode practice-mode--featured" aria-labelledby="practice-live">
          <div className="practice-mode__head">
            <span className="practice-mode__icon"><AppIcon name="broadcastLab" size={18} /></span>
            <div>
              <h2 id="practice-live">Live 3D scrimmage</h2>
              <p>Watch the match play out in real time. Follow any player, or let the director pick the action.</p>
            </div>
          </div>
          <label className="practice-field">
            <span className="ui-field-label">Map</span>
            <select aria-label="Live 3D practice map" className="cm-select" value={liveMap} onChange={event => onLiveMap(event.target.value as LiveMapId)}>
              {listLiveMaps().map(map => <option key={map.id} value={map.id}>{map.name}</option>)}
            </select>
          </label>
          <div className="practice-mode__actions">
            <button type="button" onClick={onLaunchLive} className="cm-btn cm-btn-primary">Start 3D scrimmage <ArrowRight size={14} aria-hidden="true" /></button>
            <a className="practice-link" href="#hexapedia/liveSimulation">How the 3D simulation works</a>
          </div>
        </section>

        <section className="practice-mode" aria-labelledby="practice-recorded">
          <div className="practice-mode__head">
            <span className="practice-mode__icon"><AppIcon name="practice" size={18} /></span>
            <div>
              <h2 id="practice-recorded">Recorded 2D match</h2>
              <p>A full MR15 match in seconds, with the round log, economy and role decisions to inspect afterwards.</p>
            </div>
          </div>
          <label className="practice-field">
            <span className="ui-field-label">Map</span>
            <select aria-label="FPS exhibition map" className="cm-select" value={recordedMap} onChange={event => onRecordedMap(event.target.value as FpsMapId)}>
              {Object.values(FPS_MAPS).map(map => <option key={map.id} value={map.id}>{map.name}</option>)}
            </select>
          </label>
          <div className="practice-mode__actions">
            <button type="button" onClick={onLaunchRecorded} className="cm-btn">Run 2D match</button>
          </div>
        </section>
      </div>

      <p className="practice-more">Want a longer look? The <a href="#fps-simulation">3D Broadcast Lab</a> runs exhibitions with every camera and the full diagnostics.</p>
    </div>
  );
}
