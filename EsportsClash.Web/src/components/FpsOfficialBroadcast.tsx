import { useEffect, useMemo, useState } from 'react';
import type { PlayerCard } from '../types';
import type { FpsIdentityExperiment } from '../fps/fpsTypes';
import { request, type ApiSession } from '../cloudPersistence';
import { FpsLiveReplaySource, isReplayGone, type FpsReplayChunk, type FpsReplayHeader } from '../fps/fpsLiveReplay';
import { FpsLiveBroadcast } from './FpsLiveBroadcast';
import { visibleInterval } from '../worldLive';

interface Props { matchId: string; session: ApiSession; initialRound?: number; onExit: () => void }

/**
 * An official match on the live 3D engine. The server simulated it (often ahead of kickoff) and serves
 * the broadcast in 10-second chunks as it airs; nothing here simulates or can see past the broadcast.
 */
export function FpsOfficialBroadcast({ matchId, session, initialRound, onExit }: Props) {
  const [source, setSource] = useState<FpsLiveReplaySource | null>(null);
  const [message, setMessage] = useState('Loading the broadcast…');
  // Old replays are removed from the match server after a retention period (HTTP 410); the result stays.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let loading = false;
    const fetchHeader = () => request<{ data: FpsReplayHeader }>(`/online/matches/${matchId}/live-replay`, session).then(r => r.data);
    const fetchChunk = (index: number) => request<FpsReplayChunk>(`/online/matches/${matchId}/live-replay/${index}`, session);
    const tryStart = async (): Promise<boolean> => {
      if (cancelled || loading) return false;
      loading = true;
      try {
        const first = await fetchHeader();
        if (cancelled) return true;
        if (!first.chunks) { setMessage('The broadcast starts shortly.'); return false; }
        // Live viewers join near the live edge; finished matches start from the beginning (or requested round).
        const requestedRoundAt = initialRound && first.roundStartSeconds?.[initialRound - 1];
        const liveStart = Math.max(0, first.chunks * first.framesPerChunk * first.frameSeconds - 20);
        const start = typeof requestedRoundAt === 'number'
          ? (first.complete ? requestedRoundAt : Math.min(requestedRoundAt, liveStart))
          : (first.complete ? 0 : liveStart);
        const replay = new FpsLiveReplaySource(first, fetchChunk, start, () => { if (!cancelled) setGone(true); });
        await replay.ready();
        if (!cancelled) setSource(replay);
        return true;
      } catch (problem) {
        if (cancelled) return true;
        if (isReplayGone(problem)) { setGone(true); return true; }
        setMessage((problem as Error).message || 'The broadcast is not available yet.');
        return false;
      } finally {
        loading = false;
      }
    };
    let stopWaiting: (() => void) | undefined;
    void tryStart().then(started => {
      if (cancelled || started) return;
      // Keep polling at kickoff when chunk 0 has not aired yet so viewers do not have to reload.
      stopWaiting = visibleInterval(() => {
        void tryStart().then(done => { if (done) stopWaiting?.(); });
      }, 4_000);
    });
    return () => { cancelled = true; stopWaiting?.(); };
  }, [matchId, session, initialRound]);
  // While the match is on air, newer chunks become available every ten seconds.
  useEffect(() => {
    if (!source || source.header.complete || gone) return;
    return visibleInterval(() => {
      void request<{ data: FpsReplayHeader }>(`/online/matches/${matchId}/live-replay`, session).then(r => source.updateHeader(r.data)).catch(() => undefined);
    }, 10_000);
  }, [source, matchId, session, gone]);
  const cards = useMemo(() => {
    if (!source) return null;
    const card = (p: FpsReplayHeader['players'][number]) => ({ id: p.id, name: p.name }) as unknown as PlayerCard;
    return { blue: source.header.players.filter(p => p.team === 'blue').map(card), red: source.header.players.filter(p => p.team === 'red').map(card) };
  }, [source]);
  if (gone) return <div className="club-notice" role="status">
    <strong>Replay no longer available.</strong> Broadcasts are kept on the match server for a limited time after they air. The result and match report remain on this page.
  </div>;
  if (!source || !cards || cards.blue.length !== 5 || cards.red.length !== 5) return <p className="club-help">{message}</p>;
  return <FpsLiveBroadcast mapId={source.header.mapId} blue={cards.blue} red={cards.red} seed={source.header.seed}
    identity={{ players: {}, teams: {} } as unknown as FpsIdentityExperiment} replay={source} onExit={onExit} />;
}
