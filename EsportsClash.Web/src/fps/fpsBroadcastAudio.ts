import type { LiveWeapon } from './fpsLiveWeapons.ts';
import type { LiveGrenadeKind, LiveThrowStyle } from './fpsLiveGrenades.ts';

export type FpsAudioCue =
  | { kind: 'gunshot'; weapon: LiveWeapon; x: number; z: number }
  | { kind: 'reload'; x: number; z: number }
  | { kind: 'footstep'; stance: 'walk' | 'run' | 'crouch'; x: number; z: number }
  | { kind: 'jump'; phase: 'takeoff' | 'landing'; x: number; z: number }
  | { kind: 'bombTick'; urgency: 'normal' | 'urgent' | 'final'; x: number; z: number }
  | { kind: 'impact'; region: 'head' | 'body'; lethal: boolean; x: number; z: number }
  | { kind: 'nearMiss'; x: number; z: number }
  | { kind: 'grenadeThrow'; grenade: LiveGrenadeKind; x: number; z: number; throwStyle?: LiveThrowStyle }
  | { kind: 'smokeBloom'; x: number; z: number }
  | { kind: 'flashPop'; x: number; z: number }
  | { kind: 'heExplode'; x: number; z: number }
  | { kind: 'fireIgnite'; x: number; z: number }
  | { kind: 'bombPlant'; phase: 'start' | 'complete'; x: number; z: number }
  | { kind: 'bombDefuse'; phase: 'start' | 'tick' | 'complete'; x: number; z: number }
  | { kind: 'bombExplode'; x: number; z: number };

export interface FpsAudioListener { x: number; z: number; yaw: number }

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function createSoftClipCurve(): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(x * 1.45);
  }
  return curve;
}

export interface FootstepSlice {
  start: number;
  duration: number;
  rms: number;
  style: 'walk' | 'run' | 'crouch';
}

const FOOTSTEP_FALLBACK_ONSETS: readonly number[] = [
  0.04, 0.56, 1.07, 1.58, 2.09, 2.61, 3.12, 3.63,
  4.15, 4.66, 5.18, 5.69, 6.21, 6.72, 7.24, 7.75,
];

export function extractFootstepSlices(
  buffer: Pick<AudioBuffer, 'getChannelData' | 'sampleRate' | 'duration'>,
): FootstepSlice[] {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;
  const windowSamples = Math.max(1, Math.floor(sampleRate * 0.012));
  const hopSamples = Math.max(1, Math.floor(windowSamples * 0.5));
  const frames: { idx: number; rms: number }[] = [];
  let maxFrameRms = 0;

  for (let i = 0; i + windowSamples <= data.length; i += hopSamples) {
    let sumSq = 0;
    for (let j = 0; j < windowSamples; j++) {
      const s = data[i + j];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / windowSamples);
    if (rms > maxFrameRms) maxFrameRms = rms;
    frames.push({ idx: i, rms });
  }

  const peakRadFrames = Math.max(1, Math.round((0.14 * sampleRate) / hopSamples));
  const valleyLookback = Math.max(2, Math.round((0.11 * sampleRate) / hopSamples));
  const minGapFrames = Math.max(1, Math.round((0.24 * sampleRate) / hopSamples));
  const minRms = Math.max(0.015, maxFrameRms * 0.11);
  const candidates: { start: number; duration: number; rms: number }[] = [];
  let lastPeakFrame = -minGapFrames;

  for (let f = 0; f < frames.length; f++) {
    const peakRms = frames[f].rms;
    if (peakRms < minRms || f - lastPeakFrame < minGapFrames) continue;

    // Require a true local maximum inside +-0.14s so multiple steps never merge.
    const leftBound = Math.max(0, f - peakRadFrames);
    const rightBound = Math.min(frames.length - 1, f + peakRadFrames);
    let isLocalMax = true;
    for (let k = leftBound; k <= rightBound; k++) {
      if (k === f) continue;
      if ((k < f && frames[k].rms >= peakRms) || (k > f && frames[k].rms > peakRms)) {
        isLocalMax = false;
        break;
      }
    }
    if (!isLocalMax) continue;

    // Require a clear preceding valley (< 55% peak RMS) to confirm a clean transient edge.
    let prevMinRms = f === 0 ? 0 : peakRms;
    const valleyStart = Math.max(0, f - valleyLookback);
    for (let k = valleyStart; k < f; k++) {
      if (frames[k].rms < prevMinRms) prevMinRms = frames[k].rms;
    }
    if (prevMinRms >= peakRms * 0.55) continue;

    let onsetFrame = f;
    const onsetStop = Math.max(prevMinRms * 1.35, peakRms * 0.25);
    for (let k = f - 1; k >= valleyStart; k--) {
      onsetFrame = k;
      if (frames[k].rms <= onsetStop) break;
    }

    const startSec = Math.max(0, (frames[onsetFrame].idx - Math.floor(sampleRate * 0.006)) / sampleRate);
    if (duration - startSec >= 0.14) {
      candidates.push({
        start: startSec,
        duration: Math.min(0.21, duration - startSec),
        rms: peakRms,
      });
      lastPeakFrame = f;
    }
  }

  const raw = candidates.length >= 4
    ? candidates
    : FOOTSTEP_FALLBACK_ONSETS
        .filter((start) => start + 0.16 < duration)
        .map((start, idx) => ({
          start,
          duration: Math.min(0.21, duration - start),
          rms: idx % 3 === 0 ? 0.22 : idx % 3 === 1 ? 0.42 : 0.68,
        }));

  if (raw.length === 0) return [];
  const sortedRms = raw.map((s) => s.rms).sort((a, b) => a - b);
  const p33 = sortedRms[Math.floor((sortedRms.length - 1) * 0.33)];
  const p67 = sortedRms[Math.floor((sortedRms.length - 1) * 0.67)];
  const hasSpread = sortedRms[sortedRms.length - 1] > sortedRms[0] * 1.15;

  return raw.map((item, idx) => ({
    start: item.start,
    duration: item.duration,
    rms: item.rms,
    style: !hasSpread
      ? (idx % 3 === 0 ? 'crouch' : idx % 3 === 1 ? 'walk' : 'run')
      : item.rms <= p33
        ? 'crouch'
        : item.rms <= p67
          ? 'walk'
          : 'run',
  }));
}

/** Procedural + sampled tactical Web Audio sound stage with dynamics, courtyard reflections, and weapon/utility signatures. */
export class FpsBroadcastAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private dryBus?: GainNode;
  private wetBus?: GainNode;
  private noise?: AudioBuffer;
  private pinkNoise?: AudioBuffer;
  private footstepsBuffer?: AudioBuffer;
  private footstepSlices: FootstepSlice[] = [];
  private footstepSliceIndex = 0;
  private recentSliceIndices: number[] = [];
  private lastFootstepAt = -1;
  private explosionBuffer?: AudioBuffer;
  private sampleLoadStarted = false;
  private enabled = true;
  private activeVoices = 0;
  private footstepParity = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!this.master || !this.context) return;
    const at = this.context.currentTime;
    this.master.gain.cancelScheduledValues(at);
    this.master.gain.setTargetAtTime(enabled ? .76 : 0, at, .025);
  }

  activate(): void {
    const context = this.getContext();
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
  }

  dispose(): void {
    const context = this.context;
    this.context = undefined;
    this.master = undefined;
    this.dryBus = undefined;
    this.wetBus = undefined;
    this.noise = undefined;
    this.pinkNoise = undefined;
    this.footstepsBuffer = undefined;
    this.footstepSlices = [];
    this.recentSliceIndices = [];
    this.lastFootstepAt = -1;
    this.explosionBuffer = undefined;
    this.sampleLoadStarted = false;
    this.activeVoices = 0;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }

  play(cue: FpsAudioCue, listener: FpsAudioListener): void {
    if (!this.enabled || this.activeVoices > 110) return;
    const context = this.getContext();
    if (!context || context.state !== 'running') return;
    const spatial = cue.kind === 'bombExplode'
      ? { ...this.spatial(cue.x, cue.z, listener), gain: clamp(1 - Math.hypot(cue.x - listener.x, cue.z - listener.z) / 145, .24, 1) }
      : this.spatial(cue.x, cue.z, listener);
    if ((cue.kind === 'footstep' && spatial.range > (cue.stance === 'crouch' ? 11 : cue.stance === 'run' ? 30 : 22))
      || (cue.kind === 'bombTick' && spatial.range > 24)
      || (cue.kind === 'jump' && spatial.range > 26)
      || (cue.kind === 'impact' && spatial.range > 26)
      || (cue.kind === 'nearMiss' && spatial.range > 17)
      || (cue.kind === 'grenadeThrow' && spatial.range > 22)
      || (cue.kind === 'bombPlant' && spatial.range > 36)
      || (cue.kind === 'bombDefuse' && spatial.range > 38)) return;
    if (spatial.gain < .004) return;
    switch (cue.kind) {
      case 'gunshot': this.playGunshot(context, cue.weapon, spatial.gain, spatial.pan, spatial.range); break;
      case 'reload': this.playReload(context, spatial.gain, spatial.pan); break;
      case 'footstep': this.playFootstep(context, cue.stance, spatial.gain, spatial.pan, spatial.range); break;
      case 'jump': this.playJump(context, cue.phase, spatial.gain, spatial.pan); break;
      case 'bombTick': this.playBombTick(context, cue.urgency, spatial.gain, spatial.pan); break;
      case 'impact': this.playImpact(context, cue.region, cue.lethal, spatial.gain, spatial.pan); break;
      case 'nearMiss': this.playNearMiss(context, spatial.gain, spatial.pan); break;
      case 'grenadeThrow': this.playGrenadeThrow(context, spatial.gain, spatial.pan, cue.throwStyle); break;
      case 'smokeBloom': this.playSmokeBloom(context, spatial.gain, spatial.pan); break;
      case 'flashPop': this.playFlashPop(context, spatial.gain, spatial.pan, spatial.range); break;
      case 'heExplode': this.playHeExplode(context, spatial.gain, spatial.pan); break;
      case 'fireIgnite': this.playFireIgnite(context, spatial.gain, spatial.pan); break;
      case 'bombPlant': this.playBombPlant(context, cue.phase, spatial.gain, spatial.pan); break;
      case 'bombDefuse': this.playBombDefuse(context, cue.phase, spatial.gain, spatial.pan); break;
      case 'bombExplode': this.playBombExplode(context, spatial.gain, spatial.pan); break;
    }
  }

  private getContext(): AudioContext | undefined {
    if (this.context) return this.context;
    if (typeof window === 'undefined') return undefined;
    const AudioContextConstructor = (window as AudioWindow).AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) return undefined;
    let context: AudioContext;
    try { context = new AudioContextConstructor(); } catch { return undefined; }

    const master = context.createGain();
    master.gain.value = this.enabled ? .76 : 0;

    const shaper = context.createWaveShaper();
    shaper.curve = createSoftClipCurve();
    shaper.oversample = '2x';

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = .002;
    compressor.release.value = .14;

    shaper.connect(compressor);
    compressor.connect(master);
    master.connect(context.destination);

    const dryBus = context.createGain();
    dryBus.gain.value = 1;
    dryBus.connect(shaper);

    // Subtle stone-courtyard early-reflection slapback bus
    const wetBus = context.createGain();
    wetBus.gain.value = .19;
    const impulseLen = Math.ceil(context.sampleRate * .42);
    const impulse = context.createBuffer(2, impulseLen, context.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < impulseLen; i++) {
        const t = i / context.sampleRate;
        const earlyTap = (i === Math.floor(.024 * context.sampleRate) || i === Math.floor(.052 * context.sampleRate)) ? .45 : 0;
        const tail = Math.exp(-t * 11) * (Math.random() * 2 - 1) * .28;
        data[i] = earlyTap + tail;
      }
    }
    const convolver = context.createConvolver();
    convolver.buffer = impulse;
    const wetFilter = context.createBiquadFilter();
    wetFilter.type = 'bandpass';
    wetFilter.frequency.value = 950;
    wetFilter.Q.value = .55;
    wetBus.connect(convolver);
    convolver.connect(wetFilter);
    wetFilter.connect(shaper);

    const sampleCount = Math.ceil(context.sampleRate * 1.6);
    const noise = context.createBuffer(1, sampleCount, context.sampleRate);
    const pinkNoise = context.createBuffer(1, sampleCount, context.sampleRate);
    const white = noise.getChannelData(0);
    const pink = pinkNoise.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < sampleCount; i++) {
      const w = Math.random() * 2 - 1;
      white[i] = w;
      b0 = .99765 * b0 + w * .099046;
      b1 = .96300 * b1 + w * .2965164;
      b2 = .57000 * b2 + w * 1.0526913;
      pink[i] = clamp((b0 + b1 + b2 + w * .1848) * .16, -1, 1);
    }

    this.context = context;
    this.master = master;
    this.dryBus = dryBus;
    this.wetBus = wetBus;
    this.noise = noise;
    this.pinkNoise = pinkNoise;
    void this.loadAudioSamples(context);
    return context;
  }

  private async loadAudioSamples(context: AudioContext): Promise<void> {
    if (this.sampleLoadStarted || typeof fetch !== 'function') return;
    this.sampleLoadStarted = true;
    const decode = async (url: string): Promise<AudioBuffer | undefined> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return undefined;
        const arr = await res.arrayBuffer();
        return await context.decodeAudioData(arr);
      } catch {
        return undefined;
      }
    };
    const [footsteps, explosion] = await Promise.all([
      decode('/audio/footsteps.mp3'),
      decode('/audio/bomb-explode.mp3'),
    ]);
    if (this.context !== context) return;
    if (footsteps) {
      this.footstepsBuffer = footsteps;
      this.footstepSlices = extractFootstepSlices(footsteps);
    }
    if (explosion) {
      this.explosionBuffer = explosion;
    }
  }

  private playBufferSlice(
    context: AudioContext,
    buffer: AudioBuffer,
    startAt: number,
    offset: number,
    duration: number,
    pan: number,
    level: number,
    playbackRate = 1,
    filterType?: BiquadFilterType,
    filterFreq = 3600,
    reflectWeight = .14,
    highpassFreq?: number,
  ): void {
    const src = context.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = playbackRate;
    const safeDuration = Math.max(.04, Math.min(duration, Math.max(.04, buffer.duration - offset)));
    const realDuration = safeDuration / Math.max(.25, playbackRate);
    const env = context.createGain();
    env.gain.setValueAtTime(.0001, startAt);
    env.gain.linearRampToValueAtTime(Math.max(.0002, level), startAt + Math.min(.012, realDuration * .15));
    env.gain.setValueAtTime(Math.max(.0002, level), startAt + Math.max(.015, realDuration * .72));
    env.gain.exponentialRampToValueAtTime(.0001, startAt + realDuration);
    let tail: AudioNode = src;
    if (highpassFreq && highpassFreq > 0) {
      const hp = context.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = highpassFreq;
      tail.connect(hp);
      tail = hp;
    }
    if (filterType) {
      const filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFreq;
      tail.connect(filter);
      tail = filter;
    }
    tail.connect(env);
    this.voice(env, pan, 1, reflectWeight);
    src.start(startAt, offset, safeDuration);
    this.releaseVoice(src, startAt + realDuration + .02);
  }

  private spatial(x: number, z: number, listener: FpsAudioListener): { gain: number; pan: number; range: number } {
    const dx = x - listener.x, dz = z - listener.z;
    const range = Math.hypot(dx, dz);
    const direction = range > .001 ? Math.atan2(dx, dz) : listener.yaw;
    const pan = clamp(Math.sin(direction - listener.yaw), -1, 1);
    const falloff = clamp(1 - range / 76, 0, 1);
    return { gain: falloff * falloff, pan, range };
  }

  private voice<T extends AudioNode>(node: T, pan: number, gain: number, reflectWeight = .28): T {
    const context = this.context!;
    const output = context.createGain();
    output.gain.value = gain;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    node.connect(output);
    output.connect(panner);
    panner.connect(this.dryBus!);
    if (reflectWeight > 0) {
      const send = context.createGain();
      send.gain.value = reflectWeight;
      panner.connect(send);
      send.connect(this.wetBus!);
    }
    this.activeVoices++;
    return node;
  }

  private releaseVoice(source: AudioScheduledSourceNode, endAt: number): void {
    source.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
    source.stop(endAt);
  }

  private playNoiseBurst(
    context: AudioContext,
    start: number,
    duration: number,
    pan: number,
    level: number,
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd: number,
    q = 1,
    warm = false,
    reflectWeight = .28,
  ): void {
    const src = context.createBufferSource();
    src.buffer = warm ? this.pinkNoise! : this.noise!;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(25, freqStart), start);
    if (freqEnd !== freqStart) filter.frequency.exponentialRampToValueAtTime(Math.max(25, freqEnd), start + duration);
    const env = context.createGain();
    env.gain.setValueAtTime(.0001, start);
    env.gain.linearRampToValueAtTime(Math.max(.0002, level), start + Math.min(.005, duration * .15));
    env.gain.exponentialRampToValueAtTime(.0001, start + duration);
    src.connect(filter);
    filter.connect(env);
    this.voice(env, pan, 1, reflectWeight);
    src.start(start, Math.random() * 1.1);
    this.releaseVoice(src, start + duration + .01);
  }

  private playTone(
    context: AudioContext,
    type: OscillatorType,
    start: number,
    duration: number,
    freqStart: number,
    freqEnd: number,
    level: number,
    pan: number,
    reflectWeight = .18,
  ): void {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), start);
    if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + duration);
    const env = context.createGain();
    env.gain.setValueAtTime(.0001, start);
    env.gain.linearRampToValueAtTime(Math.max(.0002, level), start + Math.min(.004, duration * .15));
    env.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(env);
    this.voice(env, pan, 1, reflectWeight);
    osc.start(start);
    this.releaseVoice(osc, start + duration + .01);
  }

  private playGunshot(context: AudioContext, weapon: LiveWeapon, distanceGain: number, pan: number, range: number): void {
    const now = context.currentTime;
    const distanceMute = clamp(1 - range / 90, .42, 1);

    if (weapon === 'usp_s' || weapon === 'm4a1_s') {
      const m4 = weapon === 'm4a1_s';
      // Crisp bolt/slide clack + tight suppressed baffle gas hiss
      this.playNoiseBurst(context, now, .048, pan, (m4 ? .44 : .34) * distanceGain, 'bandpass', m4 ? 2350 : 2750, 950, 1.4, false, .08);
      this.playTone(context, 'triangle', now, .055, m4 ? 140 : 165, 58, (m4 ? .22 : .16) * distanceGain, pan, .06);
      this.playNoiseBurst(context, now + .014, .035, pan, .14 * distanceGain, 'highpass', 3200, 2100, .9, false, .05);
      return;
    }

    if (weapon === 'sniper' || weapon === 'scout') {
      const awp = weapon === 'sniper';
      this.playNoiseBurst(context, now, .09, pan, (awp ? 1.05 : .78) * distanceGain, 'highpass', (awp ? 1550 : 1850) * distanceMute, 720, .8, false, .55);
      this.playTone(context, 'triangle', now, awp ? .44 : .26, awp ? 105 : 142, awp ? 28 : 48, (awp ? .64 : .42) * distanceGain, pan, .35);
      this.playNoiseBurst(context, now + .012, awp ? .48 : .28, pan, (awp ? .62 : .38) * distanceGain, 'lowpass', 1400 * distanceMute, 240, .6, true, .65);
      // Mechanical bolt cycle click-clack after shot
      const rackDelay = awp ? .48 : .35;
      if (range < 32) {
        this.playNoiseBurst(context, now + rackDelay, .045, pan, .11 * distanceGain, 'bandpass', 2200, 1600, 2.2, false, .08);
        this.playNoiseBurst(context, now + rackDelay + .065, .055, pan, .12 * distanceGain, 'bandpass', 1750, 2600, 2.4, false, .08);
      }
      return;
    }

    if (weapon === 'mag7' || weapon === 'nova') {
      this.playNoiseBurst(context, now, .11, pan, .92 * distanceGain, 'bandpass', 1150 * distanceMute, 420, .7, false, .45);
      this.playTone(context, 'triangle', now, .28, 86, 30, .58 * distanceGain, pan, .3);
      this.playNoiseBurst(context, now + .015, .28, pan, .5 * distanceGain, 'lowpass', 1200 * distanceMute, 260, .6, true, .5);
      if (weapon === 'nova' && range < 26) {
        this.playNoiseBurst(context, now + .27, .05, pan, .1 * distanceGain, 'bandpass', 1500, 2100, 1.8, false, .06);
      }
      return;
    }

    if (weapon === 'deagle') {
      this.playNoiseBurst(context, now, .075, pan, .92 * distanceGain, 'highpass', 1100 * distanceMute, 620, .85, false, .45);
      this.playNoiseBurst(context, now, .14, pan, .56 * distanceGain, 'bandpass', 1250, 520, 1.5, true, .45);
      this.playTone(context, 'triangle', now, .24, 152, 42, .48 * distanceGain, pan, .28);
      return;
    }

    if (weapon === 'fiveseven') {
      this.playNoiseBurst(context, now, .048, pan, .74 * distanceGain, 'highpass', 1950 * distanceMute, 920, 1.1, false, .32);
      this.playTone(context, 'triangle', now, .09, 210, 74, .26 * distanceGain, pan, .14);
      this.playNoiseBurst(context, now + .008, .12, pan, .26 * distanceGain, 'bandpass', 1650, 680, .8, false, .30);
      return;
    }

    if (weapon === 'tec9') {
      this.playNoiseBurst(context, now, .054, pan, .72 * distanceGain, 'bandpass', 1480 * distanceMute, 760, 1.0, false, .30);
      this.playTone(context, 'sine', now, .10, 158, 54, .30 * distanceGain, pan, .17);
      this.playNoiseBurst(context, now + .01, .11, pan, .24 * distanceGain, 'bandpass', 1120, 510, .75, false, .28);
      return;
    }

    if (weapon === 'cz75') {
      this.playNoiseBurst(context, now, .042, pan, .64 * distanceGain, 'bandpass', 1820 * distanceMute, 840, 1.15, false, .22);
      this.playTone(context, 'sine', now, .075, 174, 62, .22 * distanceGain, pan, .12);
      this.playNoiseBurst(context, now + .008, .085, pan, .20 * distanceGain, 'bandpass', 1320, 540, .85, false, .22);
      return;
    }

    if (weapon === 'p250') {
      this.playNoiseBurst(context, now, .056, pan, .72 * distanceGain, 'highpass', 1360 * distanceMute, 820, .95, false, .31);
      this.playTone(context, 'triangle', now, .12, 168, 56, .31 * distanceGain, pan, .19);
      this.playNoiseBurst(context, now + .01, .13, pan, .26 * distanceGain, 'bandpass', 1240, 540, .72, false, .34);
      return;
    }

    if (weapon === 'smg' || weapon === 'mp9' || weapon === 'mac10') {
      const mac = weapon === 'mac10';
      this.playNoiseBurst(context, now, .055, pan, .62 * distanceGain, 'bandpass', (mac ? 1350 : 1750) * distanceMute, 740, 1.1, false, .25);
      this.playTone(context, 'sine', now, .09, mac ? 128 : 148, 52, .26 * distanceGain, pan, .15);
      this.playNoiseBurst(context, now + .01, .11, pan, .24 * distanceGain, 'bandpass', 960, 480, .7, true, .32);
      return;
    }

    if (weapon === 'glock' || weapon === 'pistol') {
      this.playNoiseBurst(context, now, .052, pan, .68 * distanceGain, 'highpass', 1250 * distanceMute, 780, .9, false, .28);
      this.playTone(context, 'sine', now, .11, 165, 58, .28 * distanceGain, pan, .18);
      this.playNoiseBurst(context, now + .01, .13, pan, .24 * distanceGain, 'bandpass', 1150, 520, .7, false, .35);
      return;
    }

    // AK-47 / Rifle / Negev: full-bore 7.62mm punch + aggressive midrange bark + outdoor slapback
    const negev = weapon === 'negev';
    this.playNoiseBurst(context, now, .068, pan, (negev ? .72 : .84) * distanceGain, 'highpass', 1320 * distanceMute, 680, .85, false, .38);
    this.playNoiseBurst(context, now + .004, .12, pan, (negev ? .44 : .52) * distanceGain, 'bandpass', 820 * distanceMute, 420, 1.15, true, .42);
    this.playTone(context, 'triangle', now, .17, negev ? 98 : 132, 42, (negev ? .38 : .44) * distanceGain, pan, .24);
    this.playNoiseBurst(context, now + .016, .22, pan, .32 * distanceGain, 'bandpass', 920 * distanceMute, 380, .6, true, .48);
  }

  private synthesizeBootImpact(
    context: AudioContext,
    at: number,
    level: number,
    pan: number,
    pitch: number,
    soleDelay: number,
    gritGain: number,
  ): void {
    // 1. Damped boot heel weight: ultra-short sub pulse (<20ms) + pink-noise body (no synth bongo tone)
    this.playTone(context, 'triangle', at, .018, 108 * pitch, 44, level * .28, pan, .03);
    this.playNoiseBurst(context, at, .026, pan, level * .88, 'lowpass', 240 * pitch, 75, 1.15, true, .05);
    // 2. Crisp heel strike on Mediterranean limestone
    this.playNoiseBurst(context, at, .011, pan, level * .62, 'bandpass', 2100 * pitch, 1150, 2.0, false, .06);
    // 3. Forefoot sole roll + stone/sand grit scuff
    this.playNoiseBurst(context, at + soleDelay, .024, pan, level * .52, 'bandpass', 1280 * pitch, 780, 1.6, false, .05);
    this.playNoiseBurst(context, at + soleDelay + .004, .032, pan, level * gritGain, 'bandpass', 3050 * pitch, 1850, 1.85, false, .04);
  }

  private pickFootstepSliceIndex(stance: 'walk' | 'run' | 'crouch'): number {
    let candidates = this.footstepSlices
      .map((s, idx) => (s.style === stance ? idx : -1))
      .filter((idx) => idx >= 0);
    if (candidates.length === 0) {
      const fallbackStyle = stance === 'walk' ? undefined : 'walk';
      candidates = this.footstepSlices
        .map((s, idx) => (!fallbackStyle || s.style === fallbackStyle ? idx : -1))
        .filter((idx) => idx >= 0);
    }
    if (candidates.length === 0) {
      candidates = this.footstepSlices.map((_, idx) => idx);
    }
    const fresh = candidates.filter((idx) => !this.recentSliceIndices.includes(idx));
    const pool = fresh.length > 0 ? fresh : candidates;
    const pickPos = (this.footstepSliceIndex + (this.footstepParity ? 1 : 0)) % pool.length;
    this.footstepSliceIndex = (this.footstepSliceIndex + 1) % Math.max(1, this.footstepSlices.length);
    const chosen = pool[pickPos];
    this.recentSliceIndices.push(chosen);
    if (this.recentSliceIndices.length > 3) this.recentSliceIndices.shift();
    return chosen;
  }

  private playFootstep(context: AudioContext, stance: 'walk' | 'run' | 'crouch', _distanceGain: number, pan: number, range: number): void {
    const now = context.currentTime;
    const run = stance === 'run', crouch = stance === 'crouch';
    const maxRange = crouch ? 11 : run ? 30 : 22;
    const stepFalloff = clamp(1 - range / maxRange, 0, 1);
    const stepGain = Math.pow(stepFalloff, 2.1);
    if (stepGain < .004) return;
    const crowdScale = this.lastFootstepAt >= 0 && now - this.lastFootstepAt < .042 ? .48 : 1;
    this.lastFootstepAt = now;
    this.footstepParity ^= 1;
    const parityPitch = this.footstepParity ? 1.035 : .965;
    const microPan = clamp(pan + (this.footstepParity ? .035 : -.035) * stepGain, -1, 1);
    const soleDelay = crouch ? .044 : run ? .026 : .034;
    const gritGain = crouch ? .22 : run ? .34 : .26;
    if (this.footstepsBuffer && this.footstepSlices.length > 0) {
      const idx = this.pickFootstepSliceIndex(stance);
      const slice = this.footstepSlices[idx];
      const sampleLevel = (crouch ? .085 : run ? .24 : .145) * stepGain * crowdScale;
      const filterFreq = crouch ? 1750 : run ? 4400 : 3200;
      const rate = parityPitch * (run ? 1.05 : crouch ? .92 : .985);
      this.playBufferSlice(context, this.footstepsBuffer, now, slice.start, slice.duration, microPan, sampleLevel, rate, 'lowpass', filterFreq, .09, 95);
      const heelLevel = (crouch ? .028 : run ? .062 : .042) * stepGain * crowdScale;
      this.synthesizeBootImpact(context, now, heelLevel, microPan, parityPitch, soleDelay, gritGain);
      return;
    }
    const level = (crouch ? .06 : run ? .16 : .095) * stepGain * crowdScale;
    this.synthesizeBootImpact(context, now, level, microPan, parityPitch, soleDelay, gritGain);
    this.playNoiseBurst(context, now + .008, crouch ? .04 : .05, microPan, level * (run ? .18 : .14), 'bandpass', 580 * parityPitch, 400, 1.15, true, .03);
  }

  private playReload(context: AudioContext, distanceGain: number, pan: number): void {
    const now = context.currentTime;
    // Mag release -> mag insert -> slide/bolt snap
    this.playNoiseBurst(context, now, .035, pan, .11 * distanceGain, 'bandpass', 2400, 1200, 2.2, false, .06);
    this.playNoiseBurst(context, now + .085, .075, pan, .09 * distanceGain, 'bandpass', 1350, 2100, 1.9, false, .08);
    this.playTone(context, 'triangle', now + .09, .045, 580, 260, .06 * distanceGain, pan, .05);
    this.playNoiseBurst(context, now + .18, .048, pan, .12 * distanceGain, 'bandpass', 2600, 1500, 2.5, false, .08);
  }

  private playJump(context: AudioContext, phase: 'takeoff' | 'landing', distanceGain: number, pan: number): void {
    const now = context.currentTime, landing = phase === 'landing';
    if (landing) {
      if (this.footstepsBuffer && this.footstepSlices.length > 0) {
        const idx = this.pickFootstepSliceIndex('run');
        const slice = this.footstepSlices[idx];
        this.playBufferSlice(context, this.footstepsBuffer, now, slice.start, Math.min(.22, slice.duration), pan, .28 * distanceGain, .88, 'lowpass', 3600, .14, 95);
        this.playNoiseBurst(context, now + .012, .085, pan, .075 * distanceGain, 'bandpass', 640, 380, 1.1, true, .06);
        return;
      }
      // Staggered two-boot stone landing + gear settle
      const heavy = .22 * distanceGain;
      this.synthesizeBootImpact(context, now, heavy, pan, .92, .022, .42);
      this.synthesizeBootImpact(context, now + .026, heavy * .82, pan, 1.03, .022, .38);
      this.playNoiseBurst(context, now + .01, .085, pan, .085 * distanceGain, 'bandpass', 640, 380, 1.1, true, .06);
    } else {
      // Push-off boot scuff + cloth shift
      this.playNoiseBurst(context, now, .048, pan, .11 * distanceGain, 'bandpass', 1750, 820, 1.35, false, .06);
      this.playNoiseBurst(context, now + .006, .065, pan, .08 * distanceGain, 'lowpass', 520, 240, .9, true, .05);
    }
  }

  private playBombTick(context: AudioContext, urgency: 'normal' | 'urgent' | 'final', distanceGain: number, pan: number): void {
    const now = context.currentTime;
    const tone = urgency === 'final' ? 1620 : urgency === 'urgent' ? 1280 : 980;
    const gain = (urgency === 'final' ? .21 : urgency === 'urgent' ? .16 : .12) * distanceGain;
    const pairs: readonly [number, number][] = urgency === 'final' ? [[0, tone], [.055, tone * 1.12]] : [[0, tone], [.068, tone * .84]];
    for (const [offset, freq] of pairs) {
      this.playTone(context, 'square', now + offset, .036, freq, freq, gain * .55, pan, .14);
      this.playTone(context, 'sine', now + offset, .04, freq * 2, freq * 2, gain * .35, pan, .1);
    }
  }

  private playImpact(context: AudioContext, region: 'head' | 'body', lethal: boolean, distanceGain: number, pan: number): void {
    const now = context.currentTime, head = region === 'head';
    if (head) {
      // Signature metallic helmet dink + crisp impact crunch
      this.playTone(context, 'triangle', now, lethal ? .15 : .11, 2450, 1380, (lethal ? .22 : .16) * distanceGain, pan, .15);
      this.playNoiseBurst(context, now, .09, pan, (lethal ? .24 : .18) * distanceGain, 'bandpass', 1850, 720, 1.4, false, .12);
    } else {
      this.playTone(context, 'sine', now, .095, 165, 52, .16 * distanceGain, pan, .1);
      this.playNoiseBurst(context, now, .11, pan, (lethal ? .25 : .19) * distanceGain, 'bandpass', 780, 340, .8, true, .12);
    }
  }

  private playNearMiss(context: AudioContext, distanceGain: number, pan: number): void {
    const now = context.currentTime;
    this.playNoiseBurst(context, now, .105, pan, .19 * distanceGain, 'bandpass', 2400, 620, 1.1, false, .12);
    this.playTone(context, 'sine', now, .085, 290, 92, .05 * distanceGain, pan, .06);
  }

  private playGrenadeThrow(context: AudioContext, distanceGain: number, pan: number, throwStyle?: LiveThrowStyle): void {
    const now = context.currentTime;
    const underhand = throwStyle === 'underhand';
    const armScale = underhand ? .65 : 1;
    // Spoon/pin metallic click + sleeve whoosh (softer wrist flick for underhand)
    this.playNoiseBurst(context, now, .018, pan, .075 * armScale * distanceGain, 'bandpass', 3200, 1900, 2.4, false, .04);
    this.playNoiseBurst(context, now + .01, underhand ? .06 : .09, pan, .11 * armScale * distanceGain, 'bandpass', underhand ? 520 : 780, underhand ? 1050 : 1750, 1.25, true, .07);
    this.playTone(context, 'triangle', now + .012, .042, underhand ? 185 : 230, underhand ? 240 : 350, .032 * armScale * distanceGain, pan, .04);
  }

  private playSmokeBloom(context: AudioContext, distanceGain: number, pan: number): void {
    const now = context.currentTime;
    // Initial canister pop + deep pressurized smoke cloud hiss
    this.playTone(context, 'triangle', now, .09, 260, 88, .22 * distanceGain, pan, .25);
    this.playNoiseBurst(context, now + .01, 1.05, pan, .38 * distanceGain, 'bandpass', 1650, 580, .65, true, .3);
    this.playNoiseBurst(context, now + .04, .75, pan, .18 * distanceGain, 'highpass', 2200, 1100, .7, false, .18);
  }

  private playFlashPop(context: AudioContext, distanceGain: number, pan: number, range: number): void {
    const now = context.currentTime;
    this.playNoiseBurst(context, now, .11, pan, .82 * distanceGain, 'highpass', 1100, 380, .7, false, .45);
    this.playTone(context, 'triangle', now, .09, 320, 90, .42 * distanceGain, pan, .32);
    if (range < 18) {
      this.playTone(context, 'sine', now + .02, .55, 3600, 2950, .065 * distanceGain, pan, .08);
    }
  }

  private playHeExplode(context: AudioContext, distanceGain: number, pan: number): void {
    const now = context.currentTime;
    // Crisp HE frag casing crack + tight concussive snap + shrapnel tail (distinct from C4 rumble)
    this.playNoiseBurst(context, now, .075, pan, .92 * distanceGain, 'bandpass', 2400, 680, .85, false, .52);
    this.playNoiseBurst(context, now + .004, .22, pan, .72 * distanceGain, 'bandpass', 1180, 320, .72, true, .38);
    this.playTone(context, 'triangle', now, .14, 158, 42, .68 * distanceGain, pan, .32);
    this.playNoiseBurst(context, now + .018, .32, pan, .36 * distanceGain, 'highpass', 3400, 1450, 1.05, false, .26);
    this.playNoiseBurst(context, now + .14, .24, pan, .22 * distanceGain, 'bandpass', 780, 290, .8, true, .2);
  }

  private playBombExplode(context: AudioContext, distanceGain: number, pan: number): void {
    const now = context.currentTime;
    if (this.explosionBuffer) {
      this.playBufferSlice(context, this.explosionBuffer, now, 0, this.explosionBuffer.duration, pan, 1.15 * distanceGain, .96, undefined, 8000, .55);
      this.playTone(context, 'triangle', now, .85, 55, 20, .42 * distanceGain, pan, .32);
      return;
    }
    this.playTone(context, 'triangle', now, .95, 58, 18, .95 * distanceGain, pan, .6);
    this.playNoiseBurst(context, now, 1.2, pan, 1.1 * distanceGain, 'lowpass', 1600, 180, .6, true, .75);
  }

  private playFireIgnite(context: AudioContext, distanceGain: number, pan: number): void {
    const now = context.currentTime;
    this.playNoiseBurst(context, now, .06, pan, .22 * distanceGain, 'highpass', 2400, 1200, 1.4, false, .18);
    this.playNoiseBurst(context, now + .03, .62, pan, .36 * distanceGain, 'bandpass', 620, 280, .75, true, .28);
    this.playTone(context, 'sine', now + .02, .22, 130, 56, .2 * distanceGain, pan, .18);
  }

  private playBombPlant(context: AudioContext, phase: 'start' | 'complete', distanceGain: number, pan: number): void {
    const now = context.currentTime;
    if (phase === 'start') {
      const notes = [1880, 2180, 1740, 2360];
      notes.forEach((freq, i) => this.playTone(context, 'square', now + i * .065, .042, freq, freq, .095 * distanceGain, pan, .12));
    } else {
      this.playTone(context, 'triangle', now, .11, 880, 1320, .2 * distanceGain, pan, .22);
      this.playTone(context, 'sine', now + .12, .16, 1320, 1760, .18 * distanceGain, pan, .22);
    }
  }

  private playBombDefuse(context: AudioContext, phase: 'start' | 'tick' | 'complete', distanceGain: number, pan: number): void {
    const now = context.currentTime;
    if (phase === 'start') {
      this.playTone(context, 'square', now, .055, 2240, 1780, .14 * distanceGain, pan, .11);
      this.playTone(context, 'triangle', now + .045, .075, 1680, 1340, .18 * distanceGain, pan, .14);
      this.playNoiseBurst(context, now + .015, .045, pan, .11 * distanceGain, 'highpass', 3100, 2000, 1.4, false, .08);
    } else if (phase === 'tick') {
      this.playTone(context, 'triangle', now, .04, 1920, 1520, .09 * distanceGain, pan, .09);
      this.playNoiseBurst(context, now + .01, .03, pan, .06 * distanceGain, 'highpass', 3000, 1900, 1.3, false, .06);
    } else {
      this.playTone(context, 'sine', now, .12, 1320, 1320, .18 * distanceGain, pan, .2);
      this.playTone(context, 'sine', now + .13, .22, 990, 880, .18 * distanceGain, pan, .22);
    }
  }
}
