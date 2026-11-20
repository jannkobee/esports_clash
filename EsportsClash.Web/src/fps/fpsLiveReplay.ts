/**
 * Compact public replays of official live matches.
 *
 * The server records a deterministic headless run at 10 frames per second in 10-second chunks: each
 * chunk starts with a full public keyframe and continues with structural deltas, new events, new team
 * reports and the audio cues of each frame. Viewers play chunks back through `FpsLiveReplaySource`,
 * which offers the same `step()` / `snapshot()` / `drainAudioCues()` surface the broadcast uses for a
 * live simulation, interpolating bodies and grenades between frames at the broadcast's 30 Hz.
 *
 * Public means public: private identity (DNA-derived tendency values, skill profiles, mental state,
 * diagnostics, observed-behaviour counts, learning state) never enters a replay.
 */
import type { FpsAudioCue } from './fpsBroadcastAudio.ts';
import type { LiveMapId } from './fpsLiveMapTypes.ts';
import type { LiveEvent, LiveSnapshot, LiveTeamReport } from './fpsLiveSimulation.ts';

export const FPS_REPLAY_VERSION = 1;
/** Simulation steps per recorded frame (30 Hz simulation, 10 Hz replay). */
export const FPS_REPLAY_STEPS_PER_FRAME = 3;
export const FPS_REPLAY_FRAMES_PER_CHUNK = 100;
const STEP = 1 / 30;

export interface FpsReplayHeader {
  version: 1; mapId: LiveMapId; seed: number; frameSeconds: number; framesPerChunk: number;
  frames: number; chunks: number; broadcastSeconds: number;
  /** Optional broadcast timestamps (seconds) where each round's live phase started (for round-jump seeking). */
  roundStartSeconds?: number[];
  players: { id: string; name: string; team: 'blue' | 'red' }[];
  /** Served headers: false while the broadcast is still being shown live (frames grow). */
  complete?: boolean;
  /** Served headers while live: seconds of broadcast already shown. */
  liveSeconds?: number | null;
}
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Delta = Json;
export interface FpsReplayChunk {
  version: 1; index: number; startFrame: number;
  /** Full public snapshot of the chunk's first frame (events and team reports included). */
  key: LiveSnapshot;
  /** For each later frame: the structural change from the previous frame. */
  deltas: Delta[];
  /** Per frame (including the first): events and team reports that appeared, and audio cues heard. */
  events: LiveEvent[][]; reports: LiveTeamReport[][]; audio: FpsAudioCue[][];
}

// `+ 0` turns -0 into 0, so equal values always compare (and encode) equal.
const round3 = (n: number) => Math.round(n * 1000) / 1000 + 0;
function quantize(value: unknown): Json {
  if (typeof value === 'number') return Number.isFinite(value) ? round3(value) : null;
  if (value === null || typeof value !== 'object') return value === undefined ? null : value as Json;
  if (Array.isArray(value)) { const out: Json[] = new Array(value.length); for (let i = 0; i < value.length; i++) out[i] = quantize(value[i]); return out; }
  const out: Record<string, Json> = {}, source = value as Record<string, unknown>;
  for (const k in source) { const v = source[k]; if (v !== undefined) out[k] = quantize(v); }
  return out;
}
const PRIVATE_PLAYER_FIELDS = ['diagnostics', 'mental', 'skillProfile', 'behavior', 'observedIdentity'] as const;
const PRIVATE_SNAPSHOT_FIELDS = ['learning', 'mechanicsLearning', 'movementLearning', 'utilityLearning', 'utilityLearningByTeam'] as const;
/** A broadcast snapshot reduced to public match state, numbers rounded to millimetres / milliradians. */
export function publicLiveSnapshot(snapshot: LiveSnapshot): LiveSnapshot {
  const copy = { ...snapshot } as Record<string, unknown>;
  for (const key of PRIVATE_SNAPSHOT_FIELDS) delete copy[key];
  copy.players = snapshot.players.map(p => {
    const player = { ...p } as Record<string, unknown>;
    for (const key of PRIVATE_PLAYER_FIELDS) delete player[key];
    // Scouting shows tendencies only as whole 1–10 levels; raw 0–100 values stay private.
    if (p.topTendencies) player.topTendencies = p.topTendencies.map(t => ({ key: t.key, label: t.label, value: Math.max(1, Math.min(10, Math.round(t.value / 10))) }));
    return player;
  });
  return quantize(copy) as unknown as LiveSnapshot;
}

const isObject = (v: Json): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Structural delta: primitives replace; {$o,$x} patches an object; {$a} patches an array by index; {$r} replaces. */
export function diffReplay(prev: Json, next: Json): Delta | undefined {
  if (prev === next) return undefined;
  if (isObject(prev) && isObject(next)) {
    const changed: Record<string, Delta> = {}, removed: string[] = [];
    let any = false;
    for (const k in next) {
      const v = next[k];
      // A key that did not exist is always written (even when its value is null).
      const d = k in prev ? diffReplay(prev[k], v) : (v !== null && typeof v === 'object' ? { $r: v } : v);
      if (d !== undefined) { changed[k] = d; any = true; }
    }
    for (const k in prev) if (!(k in next)) removed.push(k);
    if (!any && !removed.length) return undefined;
    return removed.length ? { $o: changed, $x: removed } : { $o: changed };
  }
  if (Array.isArray(prev) && Array.isArray(next) && prev.length === next.length) {
    const changed: Record<string, Delta> = {};
    let any = false;
    for (let i = 0; i < next.length; i++) { const d = diffReplay(prev[i], next[i]); if (d !== undefined) { changed[i] = d; any = true; } }
    return any ? { $a: changed } : undefined;
  }
  if (typeof next !== 'object' || next === null) return next;
  return { $r: next };
}
export function applyReplayDelta(base: Json, delta: Delta): Json {
  if (!isObject(delta)) return delta;
  if ('$r' in delta) return delta.$r;
  if ('$a' in delta && Array.isArray(base)) {
    const out = base.slice();
    for (const [i, d] of Object.entries(delta.$a as Record<string, Delta>)) out[+i] = applyReplayDelta(out[+i], d);
    return out;
  }
  if ('$o' in delta) {
    const out: Record<string, Json> = isObject(base) ? { ...base } : {};
    for (const [k, d] of Object.entries(delta.$o as Record<string, Delta>)) out[k] = applyReplayDelta(out[k] ?? null, d);
    for (const k of (delta.$x as string[] | undefined) ?? []) delete out[k];
    return out;
  }
  return delta;
}

const withoutRolling = (s: LiveSnapshot): Json => { const { events: _e, teamReports: _r, ...rest } = s as LiveSnapshot & Record<string, unknown>; void _e; void _r; return rest as unknown as Json; };

/** Records frames from an official run; call `tick` after every simulation step. */
export class FpsLiveReplayRecorder {
  private chunk?: FpsReplayChunk;
  private previous?: Json;
  private steps = 0; private frames = 0; private chunks = 0;
  private lastEvent = 0; private lastReport = 0;
  private pendingAudio: FpsAudioCue[] = [];
  private readonly onChunk: (chunk: FpsReplayChunk) => void;
  constructor(onChunk: (chunk: FpsReplayChunk) => void) { this.onChunk = onChunk; }
  tick(snapshotOf: () => LiveSnapshot, cues: readonly FpsAudioCue[]): void {
    this.pendingAudio.push(...cues);
    if (this.steps++ % FPS_REPLAY_STEPS_PER_FRAME !== 0) return;
    this.capture(snapshotOf());
  }
  /** Flush the final frame and chunk. Returns the totals for the header. */
  finish(final: LiveSnapshot): { frames: number; chunks: number } {
    this.capture(final);
    if (this.chunk) { this.onChunk(this.chunk); this.chunk = undefined; this.chunks++; }
    return { frames: this.frames, chunks: this.chunks };
  }
  private capture(raw: LiveSnapshot): void {
    const snap = publicLiveSnapshot(raw);
    const newEvents = snap.events.filter(e => e.id > this.lastEvent), newReports = (snap.teamReports ?? []).filter(r => r.id > this.lastReport);
    if (newEvents.length) this.lastEvent = newEvents[newEvents.length - 1].id;
    if (newReports.length) this.lastReport = newReports[newReports.length - 1].id;
    const audio = this.pendingAudio.map(c => quantize(c) as unknown as FpsAudioCue); this.pendingAudio = [];
    const body = withoutRolling(snap);
    if (!this.chunk || this.chunk.deltas.length + 1 >= FPS_REPLAY_FRAMES_PER_CHUNK) {
      if (this.chunk) { this.onChunk(this.chunk); this.chunks++; }
      this.chunk = { version: 1, index: this.chunks, startFrame: this.frames, key: snap, deltas: [], events: [newEvents], reports: [newReports], audio: [audio] };
    } else {
      this.chunk.deltas.push(diffReplay(this.previous!, body) ?? { $o: {} });
      this.chunk.events.push(newEvents); this.chunk.reports.push(newReports); this.chunk.audio.push(audio);
    }
    this.previous = body; this.frames++;
  }
}

/** Decodes every frame of a chunk into public snapshots (events and team reports rebuilt as rolling lists). */
export function decodeReplayChunk(chunk: FpsReplayChunk): LiveSnapshot[] {
  const frames: LiveSnapshot[] = [chunk.key];
  let body = withoutRolling(chunk.key), events = chunk.key.events.slice(), reports = (chunk.key.teamReports ?? []).slice();
  chunk.deltas.forEach((delta, i) => {
    body = applyReplayDelta(body, delta);
    events = [...events, ...chunk.events[i + 1]].slice(-100);
    reports = [...reports, ...chunk.reports[i + 1]].slice(-40);
    frames.push({ ...(body as unknown as LiveSnapshot), events, teamReports: reports });
  });
  return frames;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
/** Interpolates bodies and grenades between two consecutive frames (everything else holds the earlier frame). */
export function interpolateReplayFrames(a: LiveSnapshot, b: LiveSnapshot, t: number): LiveSnapshot {
  if (t <= 0) return a;
  const players = a.players.map((p, i) => {
    const q = b.players[i];
    if (!q || q.id !== p.id || p.hp <= 0 || Math.hypot(q.x - p.x, q.z - p.z) > 3) return p;
    return { ...p, x: lerp(p.x, q.x, t), z: lerp(p.z, q.z, t), yaw: lerpAngle(p.yaw, q.yaw, t), pitch: lerp(p.pitch ?? 0, q.pitch ?? 0, t), jumpY: lerp(p.jumpY ?? 0, q.jumpY ?? 0, t) };
  });
  const grenades = a.grenades.map(g => {
    const h = b.grenades.find(x => x.id === g.id);
    return h ? { ...g, x: lerp(g.x, h.x, t), y: lerp(g.y, h.y, t), z: lerp(g.z, h.z, t) } : g;
  });
  return { ...a, time: lerp(a.time, b.time, t), players, grenades };
}

/** The server no longer has this replay (HTTP 410: removed after its retention period, or missing). */
export function isReplayGone(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 410;
}

/**
 * A replay as a broadcast frame source. `step()` advances one 30 Hz tick when the needed chunk is loaded
 * (otherwise it waits: buffering), `snapshot()` returns the interpolated public state.
 */
export class FpsLiveReplaySource {
  private tick = 0;
  private readonly loaded = new Map<number, LiveSnapshot[]>();
  private readonly audio = new Map<number, FpsAudioCue[][]>();
  private readonly requested = new Set<number>();
  private pendingAudio: FpsAudioCue[] = [];
  private lastFrame = -1;
  header: FpsReplayHeader;
  /** The server removed this replay (HTTP 410): playback stops instead of retrying forever. */
  unavailable = false;
  private readonly load: (index: number) => Promise<FpsReplayChunk>;
  private readonly onUnavailable?: () => void;
  constructor(header: FpsReplayHeader, load: (index: number) => Promise<FpsReplayChunk>, startSeconds = 0, onUnavailable?: () => void) {
    this.header = header; this.load = load; this.onUnavailable = onUnavailable;
    this.tick = Math.max(0, Math.min(header.frames - 1, Math.floor(startSeconds / header.frameSeconds))) * FPS_REPLAY_STEPS_PER_FRAME;
    this.lastFrame = Math.floor(this.tick / FPS_REPLAY_STEPS_PER_FRAME) - 1;
    this.prefetch();
  }
  /** Seconds of the broadcast already shown. */
  get seconds(): number { return this.tick * STEP; }
  /** Maximum currently available seek timestamp (respects the live-edge ceiling while on air). */
  get maxSeekSeconds(): number {
    const frameLimit = Math.max(0, (this.header.frames - 1) * this.header.frameSeconds);
    if (this.header.complete === false && typeof this.header.liveSeconds === 'number') {
      return Math.max(0, Math.min(frameLimit, this.header.liveSeconds));
    }
    return frameLimit;
  }
  get buffering(): boolean { return !this.frameAt(this.frameIndex()); }
  get finished(): boolean { return this.header.complete !== false && this.frameIndex() >= this.header.frames - 1; }
  /** Playback speed multiplier (0.5x – 4x) used by replay controls when advancing ticks. */
  playbackRate = 1;
  private rateCarry = 0;
  /** A live broadcast grows: accept the newer header (more frames and chunks) and keep playing. */
  updateHeader(header: FpsReplayHeader): void {
    if (header.frames < this.header.frames) return;
    this.header = header; this.prefetch();
  }
  /** Jump to any already-aired broadcast timestamp and load its chunk cleanly. */
  async seek(seconds: number): Promise<boolean> {
    if (this.unavailable || this.header.frames <= 0) return false;
    const clamped = Math.max(0, Math.min(this.maxSeekSeconds, Number.isFinite(seconds) ? seconds : 0));
    const targetFrame = Math.max(0, Math.min(this.header.frames - 1, Math.floor(clamped / this.header.frameSeconds)));
    const targetChunk = Math.floor(targetFrame / this.header.framesPerChunk);
    if (targetChunk >= this.header.chunks) return false;
    this.tick = targetFrame * FPS_REPLAY_STEPS_PER_FRAME;
    this.lastFrame = targetFrame;
    this.pendingAudio = [];
    this.rateCarry = 0;
    this.prefetch();
    if (!this.loaded.has(targetChunk)) {
      let chunkData: FpsReplayChunk;
      try { chunkData = await this.load(targetChunk); }
      catch (error) { if (isReplayGone(error)) this.markUnavailable(); return false; }
      if (!this.loaded.has(targetChunk)) {
        this.loaded.set(targetChunk, decodeReplayChunk(chunkData));
        this.audio.set(targetChunk, chunkData.audio);
      }
    }
    return true;
  }
  /** Jump directly to the start of a 1-indexed round if its timestamp has aired. */
  async seekToRound(roundNumber: number): Promise<boolean> {
    const starts = this.header.roundStartSeconds;
    if (!starts || roundNumber < 1 || roundNumber > starts.length) return false;
    const at = starts[roundNumber - 1];
    if (typeof at !== 'number' || at > this.maxSeekSeconds) return false;
    return this.seek(at);
  }
  private frameIndex(): number { return Math.floor(this.tick / FPS_REPLAY_STEPS_PER_FRAME); }
  private frameAt(index: number): LiveSnapshot | undefined {
    const chunk = Math.floor(index / this.header.framesPerChunk);
    return this.loaded.get(chunk)?.[index - chunk * this.header.framesPerChunk];
  }
  private prefetch(): void {
    if (this.unavailable) return;
    const current = Math.floor(this.frameIndex() / this.header.framesPerChunk);
    for (const index of [current, current + 1]) {
      if (index >= this.header.chunks || this.requested.has(index)) continue;
      this.requested.add(index);
      void this.load(index).then(chunk => { this.loaded.set(index, decodeReplayChunk(chunk)); this.audio.set(index, chunk.audio); })
        .catch(error => { if (isReplayGone(error)) this.markUnavailable(); else this.requested.delete(index); });
    }
    // Evict distant chunks AND clear `requested` so seeking back reloads them cleanly.
    for (const index of [...this.loaded.keys()]) {
      if (index < current - 1 || index > current + 2) {
        this.loaded.delete(index); this.audio.delete(index); this.requested.delete(index);
      }
    }
  }
  step(): void {
    this.prefetch();
    const rate = Math.max(0.25, Math.min(4, this.playbackRate || 1));
    this.rateCarry += rate;
    const ticks = Math.floor(this.rateCarry + 1e-9);
    if (ticks <= 0) return;
    this.rateCarry -= ticks;
    for (let s = 0; s < ticks; s++) {
      const next = this.frameIndex() + 1;
      // At the end of what is available: finished, or waiting for the live broadcast to continue.
      if (next >= this.header.frames || !this.frameAt(next)) return;
      this.tick++;
      const frame = this.frameIndex();
      if (frame !== this.lastFrame) {
        for (let f = this.lastFrame + 1; f <= frame; f++) {
          const chunk = Math.floor(f / this.header.framesPerChunk);
          this.pendingAudio.push(...(this.audio.get(chunk)?.[f - chunk * this.header.framesPerChunk] ?? []));
        }
        this.lastFrame = frame;
      }
    }
  }
  snapshot(): LiveSnapshot {
    const index = this.frameIndex(), a = this.frameAt(index);
    if (!a) return this.frameAt(Math.max(0, index - 1)) ?? this.placeholder();
    const b = this.frameAt(index + 1);
    return b ? interpolateReplayFrames(a, b, (this.tick % FPS_REPLAY_STEPS_PER_FRAME) / FPS_REPLAY_STEPS_PER_FRAME) : a;
  }
  drainAudioCues(): FpsAudioCue[] { const cues = this.pendingAudio; this.pendingAudio = []; return cues; }
  learningDiagnostics(): undefined { return undefined; }
  /** Wait until the first frames are loaded (the broadcast shows its loading state meanwhile). */
  async ready(): Promise<void> {
    const chunk = Math.floor(this.frameIndex() / this.header.framesPerChunk);
    this.prefetch();
    let chunkData: FpsReplayChunk;
    try { chunkData = await this.load(chunk); }
    catch (error) { if (isReplayGone(error)) this.markUnavailable(); throw error; }
    if (!this.loaded.has(chunk)) { this.loaded.set(chunk, decodeReplayChunk(chunkData)); this.audio.set(chunk, chunkData.audio); }
  }
  private markUnavailable(): void {
    if (this.unavailable) return;
    this.unavailable = true;
    this.onUnavailable?.();
  }
  private placeholder(): LiveSnapshot {
    throw new Error('Replay frames are not loaded yet; await ready() first.');
  }
}
