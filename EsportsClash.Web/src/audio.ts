import { AVATAR_SOUND_ASSETS, getAvatarSkillSoundCue, type SoundCharacter } from './avatarSkillAudio';
import type { SkillSlot } from './avatarSkillAnimation';
import {
  BACKGROUND_MUSIC_BPM,
  BACKGROUND_MUSIC_LOOP_STEPS,
  getBackgroundMusicStep,
} from './backgroundMusic';

// UI cues remain synthesized; avatar casts use licensed recorded sounds.

function parseManifestFilename(line: string): string | null {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index++;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell);
  return /^[a-z0-9_]+\.wav$/.test(cells[3] ?? '') ? cells[3] : null;
}

function readMusicPreference(): boolean {
  try {
    return localStorage.getItem('esports-clash-music-enabled') !== 'false';
  } catch {
    return true;
  }
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private generatedFiles: Promise<Set<string>> | null = null;
  private activeVoices = 0;
  private lastCast = new Map<string, number>();
  private lastPreload = 0;
  private lastImpact = 0;
  private lastExplosion = 0;
  private masterGain: GainNode | null = null;
  private combatBus: GainNode | null = null;
  private impactBus: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambienceInput: DelayNode | null = null;
  private musicEnabled = readMusicPreference();
  private musicTimer: number | null = null;
  private musicStarting = false;
  private musicStep = 0;
  private musicNextStepAt = 0;
  private visibilityHandlerRegistered = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initMixer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.registerMusicVisibilityHandler();
    this.startMusic();
    if (!this.lastPreload) {
      this.lastPreload = Date.now();
      // A user click normally unlocks Web Audio before the first battle cast.
      AVATAR_SOUND_ASSETS.forEach(sample => { void this.loadSample(sample).catch(() => undefined); });
      void this.loadGeneratedFiles();
    }
  }

  private initMixer(): void {
    const ctx = this.ctx;
    if (!ctx || this.masterGain) return;

    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    master.gain.value = 0.82;
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    const makeBus = (gainValue: number) => {
      const bus = ctx.createGain();
      bus.gain.value = gainValue;
      bus.connect(master);
      return bus;
    };
    this.combatBus = makeBus(0.9);
    this.impactBus = makeBus(0.76);
    this.uiBus = makeBus(0.68);

    const music = ctx.createGain();
    music.gain.value = this.musicEnabled ? 0.28 : 0;
    music.connect(master);
    this.musicGain = music;

    // A short filtered delay supplies space without washing out rapid combat.
    const delay = ctx.createDelay(0.25);
    const filter = ctx.createBiquadFilter();
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    delay.delayTime.value = 0.085;
    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    feedback.gain.value = 0.16;
    wet.gain.value = 0.22;
    delay.connect(filter);
    filter.connect(feedback);
    feedback.connect(delay);
    filter.connect(wet);
    wet.connect(master);

    this.masterGain = master;
    this.ambienceInput = delay;
  }

  private registerMusicVisibilityHandler(): void {
    if (this.visibilityHandlerRegistered) return;
    this.visibilityHandlerRegistered = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopMusicScheduler();
        this.setMusicGain(0, 0.18);
      } else if (this.musicEnabled) {
        this.setMusicGain(0.28, 0.4);
        this.startMusic();
      }
    });
  }

  private setMusicGain(value: number, fadeSeconds: number): void {
    const gain = this.musicGain?.gain;
    const ctx = this.ctx;
    if (!gain || !ctx) return;
    const now = ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(value, now + fadeSeconds);
  }

  private startMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicEnabled || this.musicTimer !== null || document.hidden || this.musicStarting) return;
    if (ctx.state !== 'running') {
      this.musicStarting = true;
      void ctx.resume().then(() => {
        this.musicStarting = false;
        this.startMusic();
      }).catch(() => {
        this.musicStarting = false;
      });
      return;
    }
    this.musicNextStepAt = ctx.currentTime + 0.12;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  private stopMusicScheduler(): void {
    if (this.musicTimer === null) return;
    window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicEnabled || ctx.state !== 'running' || document.hidden) return;
    const stepDuration = 30 / BACKGROUND_MUSIC_BPM;
    const scheduleUntil = ctx.currentTime + 0.2;
    while (this.musicNextStepAt < scheduleUntil) {
      this.scheduleMusicStep(this.musicStep, this.musicNextStepAt, stepDuration);
      this.musicStep = (this.musicStep + 1) % BACKGROUND_MUSIC_LOOP_STEPS;
      this.musicNextStepAt += stepDuration;
    }
  }

  private scheduleMusicStep(stepIndex: number, startAt: number, stepDuration: number): void {
    const ctx = this.ctx;
    const output = this.musicGain;
    if (!ctx || !output) return;
    const step = getBackgroundMusicStep(stepIndex);
    if (step.startsBar) this.playMusicChord(step.chordNotes, startAt, stepDuration * 8);
    this.playMusicNote(step.arpeggioNote, startAt, stepDuration * 0.9, 0.022, 'triangle');
    if (step.bassNote !== null) {
      this.playMusicNote(step.bassNote, startAt, stepDuration * 1.8, 0.038, 'sine');
    }
  }

  private playMusicChord(notes: readonly number[], startAt: number, duration: number): void {
    const ctx = this.ctx;
    const output = this.musicGain;
    if (!ctx || !output) return;
    for (const note of notes) {
      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = this.midiFrequency(note);
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      filter.Q.value = 0.35;
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.linearRampToValueAtTime(0.009, startAt + 0.42);
      gain.gain.setValueAtTime(0.009, startAt + Math.max(0.45, duration - 0.48));
      gain.gain.linearRampToValueAtTime(0.001, startAt + duration);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.02);
    }
  }

  private playMusicNote(note: number, startAt: number, duration: number, peak: number, wave: OscillatorType): void {
    const ctx = this.ctx;
    const output = this.musicGain;
    if (!ctx || !output) return;
    const oscillator = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = this.midiFrequency(note);
    filter.type = 'lowpass';
    filter.frequency.value = wave === 'sine' ? 260 : 2400;
    filter.Q.value = 0.4;
    gain.gain.setValueAtTime(0.001, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.015);
  }

  private midiFrequency(note: number): number {
    return 440 * 2 ** ((note - 69) / 12);
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  toggleMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    try {
      localStorage.setItem('esports-clash-music-enabled', String(this.musicEnabled));
    } catch {
      // Music remains usable for this session if storage is unavailable.
    }
    this.initCtx();
    if (this.musicEnabled) {
      this.setMusicGain(0.28, 0.4);
      this.startMusic();
    } else {
      this.stopMusicScheduler();
      this.setMusicGain(0, 0.18);
    }
    return this.musicEnabled;
  }

  private bus(kind: 'combat' | 'impact' | 'ui'): AudioNode | null {
    if (kind === 'combat') return this.combatBus;
    if (kind === 'impact') return this.impactBus;
    return this.uiBus;
  }

  private loadSample(name: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(name);
    if (cached) return cached;
    const url = `${import.meta.env.BASE_URL}audio/kenney/${name}.ogg`;
    const loading = fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`Audio ${name}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(bytes => this.ctx!.decodeAudioData(bytes));
    this.buffers.set(name, loading);
    return loading;
  }

  private loadGeneratedSample(filename: string): Promise<AudioBuffer> {
    const key = `generated:${filename}`;
    const cached = this.buffers.get(key);
    if (cached) return cached;
    const url = `${import.meta.env.BASE_URL}audio/abilities/${filename}`;
    const loading = fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`Generated audio ${filename}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(bytes => this.ctx!.decodeAudioData(bytes));
    this.buffers.set(key, loading);
    return loading;
  }

  private loadGeneratedFiles(): Promise<Set<string>> {
    if (this.generatedFiles) return this.generatedFiles;
    const url = `${import.meta.env.BASE_URL}audio/abilities/manifest.csv`;
    const loading = fetch(url)
      .then(async response => {
        if (!response.ok) return new Set<string>();
        const csv = await response.text();
        return new Set(csv.split(/\r?\n/).slice(1).map(parseManifestFilename)
          .filter((filename): filename is string => filename !== null));
      })
      .catch(() => new Set<string>());
    this.generatedFiles = loading;
    return loading;
  }

  private playRecordedCue(cue: NonNullable<ReturnType<typeof getAvatarSkillSoundCue>>, slot: SkillSlot, pan: number): void {
    void this.loadGeneratedFiles().then(files => {
      if (files.has(cue.generatedFilename)) {
        void this.loadGeneratedSample(cue.generatedFilename)
          .then(buffer => this.playSample(buffer, slot === 'ultimate' ? 0.48 : 0.42, 1, 0, {
            bus: 'combat', pan, preserveTail: true,
          }))
          .catch(() => this.playLegacyCue(cue, slot, pan));
      } else {
        this.playLegacyCue(cue, slot, pan);
      }
    });
  }

  private playLegacyCue(cue: NonNullable<ReturnType<typeof getAvatarSkillSoundCue>>, slot: SkillSlot, pan: number): void {
    void this.loadSample(cue.sample)
      .then(buffer => this.playSample(buffer, cue.gain, cue.rate, 0, {
        bus: 'combat', pan, lowpassHz: cue.lowpassHz, reverb: cue.reverb,
      }))
      .catch(() => this.playSpellHit());
    void this.loadSample(cue.accent)
      .then(buffer => this.playSample(buffer, cue.accentGain, cue.accentRate, cue.accentDelay, {
        bus: 'combat', pan: pan * 0.72, lowpassHz: cue.lowpassHz * 0.78, reverb: cue.reverb * 1.15,
      }))
      .catch(() => undefined);
    this.playMaterialLayer(cue.character, slot, pan);
  }

  private playSample(buffer: AudioBuffer, gainValue: number, rate: number, delay: number, options: {
    bus?: 'combat' | 'impact' | 'ui'; pan?: number; lowpassHz?: number; reverb?: number;
    preserveTail?: boolean;
  } = {}): void {
    const ctx = this.ctx;
    if (!ctx || this.activeVoices >= 16) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    const now = ctx.currentTime + delay;
    source.buffer = buffer;
    source.playbackRate.value = rate;
    filter.type = 'lowpass';
    filter.frequency.value = options.lowpassHz ?? 7000;
    filter.Q.value = 0.45;
    panner.pan.value = Math.max(-0.85, Math.min(0.85, options.pan ?? 0));
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.009);
    const duration = buffer.duration / rate;
    const fadeAt = options.preserveTail ? Math.max(0, duration - 0.04) : Math.min(duration, 0.55);
    gain.gain.setTargetAtTime(0.001, now + fadeAt, options.preserveTail ? 0.018 : 0.08);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    const bus = this.bus(options.bus ?? 'combat');
    if (bus) panner.connect(bus);
    if (this.ambienceInput && (options.reverb ?? 0) > 0) {
      const send = ctx.createGain();
      send.gain.value = options.reverb ?? 0;
      panner.connect(send);
      send.connect(this.ambienceInput);
    }
    this.activeVoices++;
    source.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
    source.start(now);
    source.stop(now + Math.min(duration + 0.12, options.preserveTail ? 2.6 : 1.3));
  }

  private playMaterialLayer(character: SoundCharacter, slot: SkillSlot, pan: number): void {
    const ctx = this.ctx;
    const bus = this.combatBus;
    if (!ctx || !bus || this.activeVoices >= (slot === 'ultimate' ? 16 : 11)) return;
    const profiles: Record<SoundCharacter, { wave: OscillatorType; start: number; end: number }> = {
      arcane: { wave: 'sine', start: 430, end: 1120 },
      fire: { wave: 'sawtooth', start: 190, end: 58 },
      steel: { wave: 'triangle', start: 1380, end: 290 },
      organic: { wave: 'triangle', start: 270, end: 115 },
      void: { wave: 'sine', start: 105, end: 42 },
      wind: { wave: 'sine', start: 920, end: 245 },
      impact: { wave: 'square', start: 370, end: 88 },
    };
    const profile = profiles[character];
    const ultimate = slot === 'ultimate';
    const now = ctx.currentTime + 0.008;
    const duration = ultimate ? 0.42 : 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    osc.type = profile.wave;
    osc.frequency.setValueAtTime(profile.start, now);
    osc.frequency.exponentialRampToValueAtTime(profile.end, now + duration);
    filter.type = character === 'wind' || character === 'steel' ? 'highpass' : 'lowpass';
    filter.frequency.value = character === 'wind' ? 480 : character === 'steel' ? 340 : 1800;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(ultimate ? 0.055 : 0.026, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(bus);
    if (ultimate && this.ambienceInput) {
      const send = ctx.createGain();
      send.gain.value = 0.16;
      panner.connect(send);
      send.connect(this.ambienceInput);
    }
    this.activeVoices++;
    osc.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
    osc.start(now);
    osc.stop(now + duration);
  }

  preloadAvatarSkills(avatarNames: string[]): void {
    try {
      this.initCtx();
      if (!this.ctx) return;
      avatarNames.forEach(avatarName => {
        (['skill1', 'skill2', 'ultimate'] as const).forEach(slot => {
          const cue = getAvatarSkillSoundCue(avatarName, slot);
          if (cue) {
            void this.loadGeneratedSample(cue.generatedFilename).catch(() => undefined);
          }
        });
      });
    } catch {
      // AudioContext may be suspended prior to user interaction
    }
  }

  playAvatarSkill(avatarName: string, slot: SkillSlot, pan = 0): void {
    try {
      this.initCtx();
      const cue = getAvatarSkillSoundCue(avatarName, slot);
      if (!cue || !this.ctx) return;
      const key = `${avatarName}:${slot}`;
      const now = performance.now();
      if (now - (this.lastCast.get(key) ?? -Infinity) < 145) return;
      this.lastCast.set(key, now);
      if (this.activeVoices >= (slot === 'ultimate' ? 16 : 12)) return;
      const stereoPan = Math.max(-0.85, Math.min(0.85, pan));
      this.playRecordedCue(cue, slot, stereoPan);
    } catch {
      // Browsers may block playback until a user gesture.
    }
  }

  playClick() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.uiBus ?? this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // ignore
    }
  }

  playCoin() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(this.uiBus ?? this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // ignore
    }
  }

  playPackTear() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
      osc.connect(gain);
      gain.connect(this.uiBus ?? this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // ignore
    }
  }

  playWalkoutFanfare() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const now = this.ctx!.currentTime + idx * 0.12;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(this.uiBus ?? this.ctx!.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      });
    } catch {
      // ignore
    }
  }

  playSpellHit() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const stamp = performance.now();
      if (stamp - this.lastImpact < 75 || this.activeVoices >= 12) return;
      this.lastImpact = stamp;
      void this.loadSample('impact-impactGeneric_light_000')
        .then(buffer => this.playSample(buffer, 0.085, 1, 0, {
          bus: 'impact', lowpassHz: 5600, reverb: 0.035,
        }))
        .catch(() => this.playSynthHit());
    } catch {
      // ignore
    }
  }

  private playSynthHit() {
    try {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.impactBus ?? this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // ignore
    }
  }

  playUltimateExplosion() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const stamp = performance.now();
      if (stamp - this.lastExplosion < 120 || this.activeVoices >= 16) return;
      this.lastExplosion = stamp;
      void this.loadSample('sci-explosionCrunch_000')
        .then(buffer => this.playSample(buffer, 0.23, 0.94, 0, {
          bus: 'impact', lowpassHz: 4600, reverb: 0.16,
        }))
        .catch(() => this.playSynthExplosion());
      this.playMaterialLayer('fire', 'ultimate', 0);
    } catch {
      // ignore
    }
  }

  private playSynthExplosion() {
    try {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.connect(gain);
      gain.connect(this.impactBus ?? this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // ignore
    }
  }
}

export const sound = new SoundManager();
