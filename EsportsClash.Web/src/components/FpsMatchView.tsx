import { useEffect, useMemo, useState } from 'react';
import {
  buildFpsMapLayout,
  formatFpsEventClock,
  getFpsHalfLabel,
  getFpsReplayState,
  getFpsRoundEvents
} from '../fps/fpsMatchViewModel.ts';
import { getFpsMap } from '../fps/maps.ts';
import { FPS_PERSONALITIES, FPS_ROLE_LABELS } from '../fps/fpsPersonality.ts';
import type { FpsMatchEvent, FpsMatchReport, FpsTeamId } from '../fps/types.ts';
import './fps-match-view.css';

export interface FpsMatchViewProps {
  report: FpsMatchReport;
  blueTeamName: string;
  redTeamName: string;
  onExit: () => void;
  autoPlay?: boolean;
}

function teamName(team: FpsTeamId, blueTeamName: string, redTeamName: string): string {
  return team === 'blue' ? blueTeamName : redTeamName;
}

function eventKind(event: FpsMatchEvent): string {
  if (event.type === 'set_piece_call') return 'SET PIECE';
  if (event.type === 'utility_deployed') return 'UTILITY';
  if (event.type === 'duel_engagement') return 'ENTRY';
  if (event.type === 'specialty_activated') return 'SPECIALTY';
  if (event.type === 'tactical_decision') return 'DECISION';
  if (event.type === 'trade_kill') return 'TRADE';
  if (event.type.startsWith('plant_')) return 'PLANT';
  if (event.type.startsWith('defuse_')) return 'DEFUSE';
  if (event.type === 'retake_initiated') return 'RETAKE';
  if (event.type === 'save_equipment') return 'SAVE';
  if (event.type === 'kill') return 'ELIMINATION';
  if (event.type === 'round_end') return 'ROUND';
  return event.type.replaceAll('_', ' ').toUpperCase();
}

function safeZonePoint(
  zoneId: string,
  layout: Record<string, { x: number; y: number }>
): { x: number; y: number } {
  const point = layout[zoneId] ?? { x: 50, y: 50 };
  return { x: 78 + point.x * 8.44, y: 74 + point.y * 4.42 };
}

export function FpsMatchView({ report, blueTeamName, redTeamName, onExit, autoPlay=false }: FpsMatchViewProps) {
  const map = getFpsMap(report.mapId);
  const layout = useMemo(() => buildFpsMapLayout(map), [map]);
  const rounds = useMemo(
    () => [...report.roundResults.map(result => result.roundNumber)],
    [report.roundResults]
  );
  const [selectedRound, setSelectedRound] = useState(rounds[0] ?? 1);
  const [eventIndex, setEventIndex] = useState(-1);
  const [playbackRate, setPlaybackRate] = useState<1 | 2 | 4 | 8 | 16>(autoPlay?4:1);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const events = useMemo(() => getFpsRoundEvents(report, selectedRound), [report, selectedRound]);
  const state = useMemo(
    () => getFpsReplayState(report, selectedRound, eventIndex),
    [report, selectedRound, eventIndex]
  );
  const visibleEvents = events.slice(0, state.eventIndex + 1);
  const roundResult = report.roundResults.find(result => result.roundNumber === selectedRound);
  const roundHasEnded = visibleEvents.some(event => event.type === 'round_end');
  const postRoundCash = roundResult && roundHasEnded
    ? { blue: roundResult.blueCashTotal, red: roundResult.redCashTotal }
    : undefined;
  const currentHalfScore = selectedRound > 30
    ? { blue: state.score.blue - 15, red: state.score.red - 15 }
    : selectedRound > 15
      ? {
          blue: state.score.blue - report.halfScore.blue,
          red: state.score.red - report.halfScore.red
        }
      : state.score;

  useEffect(() => {
    setEventIndex(-1);
  }, [selectedRound]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    if (eventIndex >= events.length - 1) {
      const next = rounds[rounds.indexOf(selectedRound)+1];
      if (next === undefined) { setIsPlaying(false); return undefined; }
      const timer = window.setTimeout(() => { setSelectedRound(next); setEventIndex(-1); }, 600 / playbackRate);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setInterval(() => {
      setEventIndex(index => Math.min(events.length - 1, index + 1));
    }, 180 / playbackRate);
    return () => window.clearInterval(timer);
  }, [isPlaying, eventIndex, events.length, playbackRate, rounds, selectedRound]);

  const uniqueEdges = new Set<string>();
  const edges = Object.values(map.zones).flatMap(zone => zone.connectedZones.flatMap(neighborId => {
    const key = [zone.id, neighborId].sort().join('|');
    if (!map.zones[neighborId] || uniqueEdges.has(key)) return [];
    uniqueEdges.add(key);
    return [{ from: zone.id, to: neighborId }];
  }));
  const playersByZone = new Map<string, typeof state.players>();
  for (const player of state.players) {
    if (!player.isAlive) continue;
    playersByZone.set(player.zone, [...(playersByZone.get(player.zone) ?? []), player]);
  }
  const statsByTeam = (['blue', 'red'] as const).map(team => ({
    team,
    players: Object.values(report.playerStats)
      .filter(player => player.team === team)
      .sort((a, b) => a.name.localeCompare(b.name))
  }));

  const changeRound = (round: number) => {
    setIsPlaying(false);
    setSelectedRound(round);
    setEventIndex(-1);
  };
  const reset = () => {
    setEventIndex(-1);
    setIsPlaying(false);
  };

  return (
    <section className="fps-view" aria-label="FPS match replay">
      <header className="fps-view__header">
        <div>
          <div className="fps-view__eyebrow">TACTICAL REPLAY · MR15</div>
          <h1>{report.mapName}</h1>
          <p>{map.description}</p>
        </div>
        <div className="fps-view__header-actions">
          <button type="button" className="fps-view__exit" onClick={onExit}>← Exit replay</button>
          <div className="fps-view__final">
            <span>FINAL</span>
            <strong className="fps-view__score">
              <b className="fps-blue-text">{report.finalScore.blue}</b>
              <i>:</i>
              <b className="fps-red-text">{report.finalScore.red}</b>
            </strong>
            <small>{report.winnerTeam === 'draw' ? 'MATCH DRAW' : `${teamName(report.winnerTeam, blueTeamName, redTeamName)} WIN`}</small>
          </div>
        </div>
      </header>

      <div className="fps-view__scorebar">
        <div className="fps-view__team-score fps-view__team-score--blue">
          <span>{blueTeamName}</span><strong>{state.score.blue}</strong>
          <small>POST-ROUND CASH&nbsp; {postRoundCash ? `$${postRoundCash.blue.toLocaleString()}` : '—'}</small>
        </div>
        <div className="fps-view__round-state">
          <span>{getFpsHalfLabel(selectedRound)}</span>
          <strong>ROUND {selectedRound}</strong>
          <small>HALF SCORE&nbsp; {currentHalfScore.blue} — {currentHalfScore.red}</small>
        </div>
        <div className="fps-view__team-score fps-view__team-score--red">
          <span>{redTeamName}</span><strong>{state.score.red}</strong>
          <small>POST-ROUND CASH&nbsp; {postRoundCash ? `$${postRoundCash.red.toLocaleString()}` : '—'}</small>
        </div>
      </div>

      <div className="fps-view__main">
        <section className="fps-view__radar-panel">
          <div className="fps-view__panel-heading">
            <div><span className="fps-view__eyebrow">LIVE TACTICAL RADAR</span><h2>{map.name}</h2></div>
            <div className="fps-view__clock"><span>ROUND CLOCK</span><strong>{state.clockText}</strong></div>
          </div>
          <div className="fps-view__radar-scroll">
            <svg className="fps-view__radar" viewBox="0 0 1000 600" role="img" aria-label={`${map.name} graph tactical radar`}>
              <defs>
                <pattern id="fps-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(129,164,188,.075)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect x="0" y="0" width="1000" height="600" fill="url(#fps-grid)" />
              {edges.map(edge => {
                const from = safeZonePoint(edge.from, layout);
                const to = safeZonePoint(edge.to, layout);
                return <line key={`${edge.from}-${edge.to}`} className="fps-view__edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
              })}
              {Object.values(map.zones).map(zone => {
                const point = safeZonePoint(zone.id, layout);
                const isSite = zone.isSiteArea;
                const occupants = playersByZone.get(zone.id) ?? [];
                const zoneUtility = state.utility.filter(marker => marker.zone === zone.id);
                return (
                  <g key={zone.id} className={`fps-view__zone${zone.isChoke ? ' is-choke' : ''}${isSite ? ` is-site site-${zone.site?.toLowerCase()}` : ''}${zone.isSpawn ? ' is-spawn' : ''}`}>
                    <circle className="fps-view__node" cx={point.x} cy={point.y} r={isSite ? 25 : zone.isChoke ? 18 : 15} />
                    {isSite && <text className="fps-view__site-tag" x={point.x} y={point.y + 5}>{zone.site}</text>}
                    {zone.isChoke && <path className="fps-view__choke-mark" d={`M ${point.x - 7} ${point.y - 7} L ${point.x + 7} ${point.y + 7} M ${point.x + 7} ${point.y - 7} L ${point.x - 7} ${point.y + 7}`} />}
                    <text className="fps-view__zone-label" x={point.x} y={point.y + (isSite ? 40 : 31)}>{zone.name}</text>
                    {zone.isSpawn && <text className="fps-view__spawn-label" x={point.x} y={point.y - 25}>{zone.isSpawn === 'attackers' ? 'T SPAWN' : 'CT SPAWN'}</text>}
                    {zoneUtility.map((marker, index) => (
                      <g key={`${marker.event.tick}-${index}`} className={`fps-view__utility fps-view__utility--${marker.kind}`} transform={`translate(${point.x + 27 + index * 23} ${point.y - 23})`}>
                        {marker.kind === 'smoke' ? <circle r="13" /> : <path d="M0 -13 L3 -3 L13 0 L3 3 L0 13 L-3 3 L-13 0 L-3 -3 Z" />}
                        <text y="4">{marker.kind === 'smoke' ? 'S' : 'F'}</text>
                      </g>
                    ))}
                    {occupants.map((player, index) => {
                      const sameTeamIndex = occupants.filter(other => other.team === player.team).findIndex(other => other.playerId === player.playerId);
                      const teamOffset = player.team === 'blue' ? -1 : 1;
                      const px = point.x + teamOffset * (18 + Math.floor(sameTeamIndex / 3) * 10);
                      const py = point.y - 7 + (sameTeamIndex % 3) * 17;
                      return (
                        <g key={player.playerId} className={`fps-view__player fps-view__player--${player.team}`} transform={`translate(${px} ${py})`}>
                          <circle r="10" />
                          <text y="3.5">{player.name.slice(0, 1).toUpperCase()}</text>
                          <title>{player.name} · {player.hp} HP · {zone.name}{player.loadout.hasBomb ? ' · BOMB' : ''}</title>
                          {player.loadout.hasBomb && <text className="fps-view__player-bomb" x="9" y="-8">B</text>}
                        </g>
                      );
                    })}
                    {(state.bomb.zone ? state.bomb.zone === zone.id : state.bomb.site === zone.site && (zone.site==='A'?map.siteAZones[0]:map.siteBZones[0]) === zone.id) && state.bomb.status !== 'carried' && state.bomb.status !== 'none' && (
                      <g className={`fps-view__bomb fps-view__bomb--${state.bomb.status}`} transform={`translate(${point.x + 30} ${point.y + 2})`}>
                        <path d="M0 -10 L10 0 L0 10 L-10 0 Z" /><text y="4">B</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="fps-view__legend">
            <span><i className="fps-view__legend-dot is-blue" /> BLUE PLAYER</span>
            <span><i className="fps-view__legend-dot is-red" /> RED PLAYER</span>
            <span><i className="fps-view__legend-dot is-choke" /> CHOKE</span>
            <span><i className="fps-view__legend-dot is-smoke" /> SMOKE</span>
            <span><i className="fps-view__legend-dot is-flash" /> FLASH</span>
            <span><i className="fps-view__legend-dot is-bomb" /> BOMB / SITE</span>
          </div>
          {state.bomb.status==='dropped'&&<p className="fps-view__bomb-state">Dropped device: {state.bomb.zone ? map.zones[state.bomb.zone]?.name : 'Unknown'}</p>}
          <div className="fps-view__bomb-state" data-state={state.bomb.status}>
            DEVICE&nbsp; {state.bomb.status.toUpperCase()}{state.bomb.site ? ` · SITE ${state.bomb.site}` : ''}
            {state.bomb.status === 'planted' && state.bomb.remainingSeconds !== undefined
              ? ` · DETONATES IN ${state.bomb.remainingSeconds.toFixed(1)}s`
              : ''}
          </div>
        </section>

        <aside className="fps-view__side-column">
          <section className="fps-view__panel fps-view__rosters">
            <div className="fps-view__panel-heading"><div><span className="fps-view__eyebrow">MATCH ROSTERS</span><h2>Player stats</h2></div></div>
            {statsByTeam.map(group => (
              <div className={`fps-view__team-roster fps-view__team-roster--${group.team}`} key={group.team}>
                <h3>{teamName(group.team, blueTeamName, redTeamName)} <span>{group.players.length} PLAYERS</span></h3>
                <div className="fps-view__player-list">
                  {group.players.map(player => {
                    const snapshot = state.players.find(item => item.playerId === player.playerId);
                    return (
                      <article className="fps-view__stat-player" key={player.playerId}>
                        <div className="fps-view__stat-player-main">
                          <span className="fps-view__player-avatar">{player.name.slice(0, 1).toUpperCase()}</span>
                          <strong title={player.name}>{player.name}</strong>
                          <span className={`fps-view__side-badge is-${snapshot?.side ?? 'unknown'}`}>{snapshot?.side === 'attackers' ? 'ATK' : snapshot?.side === 'defenders' ? 'DEF' : '—'}</span>
                          <span className="fps-view__kda">{player.kills}/{player.deaths}/{player.assists}</span>
                        </div>
                        <div className="fps-view__stat-player-detail">
                          {snapshot&&<span>{snapshot.isAlive ? `${snapshot.hp} HP` : 'ELIMINATED'}</span>}
                          <span>ADR <b>{player.adr}</b></span>
                          <span>HS <b>{player.headshotRate}%</b></span>
                          {snapshot && snapshot.loadout.armor > 0 && <span className="fps-view__gear-badge">ARMOR {snapshot.loadout.armor}</span>}
                          {snapshot?.loadout.hasHelmet && <span className="fps-view__gear-badge">HELMET</span>}
                          {snapshot?.loadout.hasDefuseKit && <span className="fps-view__gear-badge">KIT</span>}
                          {snapshot?.loadout.primaryWeapon && <span className="fps-view__gear-badge">{snapshot.loadout.primaryWeapon.replaceAll('_', ' ').toUpperCase()}</span>}
                          {snapshot?.loadout.hasBomb && <span className="fps-view__gear-badge is-bomb-carrier">BOMB</span>}
                        </div>
                        {snapshot?.tactics && <details className="fps-view__personality">
                          <summary>{snapshot.tactics.isCaller ? 'IGL · ' : ''}{FPS_ROLE_LABELS[snapshot.tactics.role]} · Round mindset</summary>
                          <p>{snapshot.tactics.reason}</p>
                          <div className="fps-view__mindset">
                            <span>Confidence <b>{Math.round(snapshot.tactics.mood.confidence)}</b></span>
                            <span>Composure <b>{Math.round(snapshot.tactics.mood.composure)}</b></span>
                            <span>Frustration <b>{Math.round(snapshot.tactics.mood.frustration)}</b></span>
                          </div>
                          {snapshot.tactics.traits.map(id => <p key={id}><strong>{FPS_PERSONALITIES[id].name}:</strong> {FPS_PERSONALITIES[id].description}</p>)}
                          {snapshot.tactics.identity&&<p><strong>{snapshot.tactics.identity.personality}</strong> · {snapshot.tactics.identity.intensity} tendency{snapshot.tactics.identity.specialty?' · '+snapshot.tactics.identity.specialty:''}</p>}
                        </details>}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
          <section className="fps-view__panel fps-view__log">
            <div className="fps-view__panel-heading"><div><span className="fps-view__eyebrow">RECORDED PLAY-BY-PLAY</span><h2>Action log</h2></div><span>{visibleEvents.length}/{events.length}</span></div>
            <div className="fps-view__event-list" aria-live="polite">
              {visibleEvents.length === 0 && <p className="fps-view__empty">Step into the round to reveal its recorded events.</p>}
              {visibleEvents.slice().reverse().map(event => (
                <article className={`fps-view__event${event === state.event ? ' is-current' : ''}`} key={`${event.roundNumber}-${event.tick}-${event.type}`}>
                  <span className="fps-view__event-time">{formatFpsEventClock(event)}</span>
                  <div><b>{eventKind(event)}</b><p>{event.text}</p></div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="fps-view__controls" aria-label="Replay controls">
        <div className="fps-view__control-buttons">
          <label>ROUND
            <select value={selectedRound} onChange={event => changeRound(Number(event.target.value))}>
              {rounds.map(round => <option value={round} key={round}>Round {round}</option>)}
            </select>
          </label>
          <button type="button" onClick={reset} aria-label="Reset round">↺</button>
          <button type="button" onClick={() => setEventIndex(index => Math.max(-1, index - 1))} disabled={eventIndex < 0} aria-label="Previous event">‹</button>
          <button type="button" className="fps-view__play" onClick={() => setIsPlaying(value => !value)} disabled={events.length === 0} aria-label={isPlaying ? 'Pause replay' : 'Play replay'}>{isPlaying ? 'Ⅱ' : '▶'}</button>
          <button type="button" onClick={() => setEventIndex(index => Math.min(events.length - 1, index + 1))} disabled={eventIndex >= events.length - 1} aria-label="Next event">›</button>
          <div className="fps-view__speed" aria-label="Playback speed">
            {([1, 2, 4, 8, 16] as const).map(rate => <button type="button" key={rate} className={playbackRate === rate ? 'is-selected' : ''} onClick={() => setPlaybackRate(rate)}>{rate}×</button>)}
          </div>
        </div>
        <div className="fps-view__scrubber">
          <span>{state.clockText}</span>
          <input
            aria-label="Replay event scrubber"
            type="range"
            min={-1}
            max={Math.max(-1, events.length - 1)}
            value={state.eventIndex}
            disabled={events.length === 0}
            onChange={event => setEventIndex(Number(event.target.value))}
          />
          <span>{events.length ? `${state.eventIndex + 1} / ${events.length}` : 'NO EVENTS'}</span>
        </div>
      </section>

      <footer className="fps-view__summary">
        <div><span className="fps-view__eyebrow">MATCH SUMMARY</span><strong>{report.mapName} · {report.totalRounds} ROUNDS</strong></div>
        <div><span>HALF 1</span><b>{report.halfScore.blue} — {report.halfScore.red}</b></div>
        <div><span>HALF 2</span><b>{report.secondHalfScore.blue} — {report.secondHalfScore.red}</b></div>
        {report.overtimeScore && <div><span>OVERTIME</span><b>{report.overtimeScore.blue} — {report.overtimeScore.red}</b></div>}
        <div className="fps-view__summary-winner"><span>WINNER</span><b>{report.winnerTeam === 'draw' ? 'DRAW' : teamName(report.winnerTeam, blueTeamName, redTeamName)}</b></div>
      </footer>
    </section>
  );
}
