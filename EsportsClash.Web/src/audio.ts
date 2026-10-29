import { AVATAR_SOUND_ASSETS, getAvatarSkillSoundCue, type SoundCharacter } from './avatarSkillAudio.ts';
import type { SkillSlot } from './avatarSkillAnimation.ts';
import {
  BACKGROUND_MUSIC_BPM,
  BACKGROUND_MUSIC_LOOP_STEPS,
  getBackgroundMusicStep,
} from './backgroundMusic.ts';

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

function readMutePreference(): boolean {
  try {
    // Quiet by default while the game is being tested; explicit opt-in persists.
    return localStorage.getItem('esports-clash-audio-muted') !== 'false';
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
  private lastTurretShot = 0;
  private lastStructureCollapse = 0;
  private lastMinionAttack = 0;
  private lastDragonBreath = 0;
  private lastGolemSlam = 0;
  private lastFrogCroak = 0;
  private masterGain: GainNode | null = null;
  private combatBus: GainNode | null = null;
  private impactBus: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambienceInput: DelayNode | null = null;
  private musicEnabled = readMusicPreference();
  private muted = readMutePreference();
  private musicTimer: number | null = null;
  private musicStarting = false;
  private musicStep = 0;
  private musicNextStepAt = 0;
  private visibilityHandlerRegistered = false;

  private initCtx(): boolean {
    if (this.muted) return false;
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
    return true;
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
      } else if (this.musicEnabled && !this.muted) {
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
    if (!ctx || this.muted || !this.musicEnabled || this.musicTimer !== null || document.hidden || this.musicStarting) return;
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
    if (!ctx || this.muted || !this.musicEnabled || ctx.state !== 'running' || document.hidden) return;
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

  isMuted(): boolean { return this.muted; }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('esports-clash-audio-muted', String(this.muted));
    } catch {
      // The current session still respects mute when storage is unavailable.
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.82, this.ctx.currentTime);
    }
    if (this.muted) this.stopMusicScheduler();
    else {
      try { this.initCtx(); } catch { /* A later user gesture can unlock audio. */ }
    }
    return this.muted;
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
    if (this.muted) return;
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
    if (this.muted) return;
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
    if (!ctx || this.muted || this.activeVoices >= 16) return;
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
    if (!ctx || this.muted || !bus || this.activeVoices >= (slot === 'ultimate' ? 16 : 11)) return;
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
      if (!this.initCtx()) return;
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
      if (!this.initCtx()) return;
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
      if (!this.initCtx()) return;
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
      if (!this.initCtx()) return;
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
      if (!this.initCtx()) return;
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
      if (!this.initCtx()) return;
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
      if (!this.initCtx()) return;
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
      if (!this.ctx || this.muted) return;
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
      if (!this.initCtx()) return;
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
      if (!this.ctx || this.muted) return;
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

  /**
   * Calculates stereo panning [-0.85, 0.85] from world coordinates relative to the spectator camera.
   */
  calculateSpatialPan(worldX: number, cameraX: number, viewportHalfW = 400): number {
    const delta = worldX - cameraX;
    const normalized = delta / Math.max(100, viewportHalfW);
    return Math.max(-0.85, Math.min(0.85, normalized * 0.75));
  }

  /**
   * Calculates distance attenuation [0.25, 1.0] from world coordinates relative to the spectator camera.
   */
  calculateSpatialGain(worldX: number, worldY: number, cameraX: number, cameraY: number, maxDist = 1600): number {
    const dist = Math.hypot(worldX - cameraX, worldY - cameraY);
    const falloff = 1 - Math.min(1, dist / maxDist);
    return 0.25 + 0.75 * (falloff * falloff);
  }

  private createPannerNode(pan: number): StereoPannerNode | null {
    if (!this.ctx || typeof this.ctx.createStereoPanner !== 'function') return null;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    return panner;
  }

  playTurretShot(worldX = 1300, cameraX = 1300): void {
    try {
      if (!this.initCtx() || !this.ctx) return;
      const stamp = performance.now();
      if (stamp - this.lastTurretShot < 65 || this.activeVoices >= 14) return;
      this.lastTurretShot = stamp;

      const pan = this.calculateSpatialPan(worldX, cameraX);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const panner = this.createPannerNode(pan);

      // Energy beam laser sweep: 960Hz down to 240Hz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(960, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.16);

      // Resonant sub harmonic: 160Hz
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(160, now);
      subOsc.frequency.exponentialRampToValueAtTime(70, now + 0.16);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.16);
      filter.Q.value = 3.0;

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);

      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);

      const targetBus = this.combatBus ?? this.ctx.destination;
      if (panner) {
        gain.connect(panner);
        panner.connect(targetBus);
      } else {
        gain.connect(targetBus);
      }

      this.activeVoices += 2;
      osc.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 2); };

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + 0.18);
      subOsc.stop(now + 0.18);
    } catch {
      // ignore
    }
  }

  playStructureCollapse(worldX = 1300, cameraX = 1300): void {
    try {
      if (!this.initCtx() || !this.ctx) return;
      const stamp = performance.now();
      if (stamp - this.lastStructureCollapse < 150 || this.activeVoices >= 16) return;
      this.lastStructureCollapse = stamp;

      const pan = this.calculateSpatialPan(worldX, cameraX);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.createPannerNode(pan);

      // Deep rumble: 110Hz falling to 28Hz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.7);

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(65, now);
      subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.85);

      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.008, now + 0.85);

      osc.connect(gain);
      subOsc.connect(gain);

      const targetBus = this.impactBus ?? this.ctx.destination;
      if (panner) {
        gain.connect(panner);
        panner.connect(targetBus);
      } else {
        gain.connect(targetBus);
      }

      this.activeVoices += 2;
      osc.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 2); };

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + 0.85);
      subOsc.stop(now + 0.85);
    } catch {
      // ignore
    }
  }

  playDragonRoar(worldX = 1300, cameraX = 1300): void {
    try {
      if (!this.initCtx() || !this.ctx) return;
      const pan = this.calculateSpatialPan(worldX, cameraX);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      const panner = this.createPannerNode(pan);

      // Dragon roar: 140Hz up to 260Hz then down to 75Hz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(260, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.75);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.linearRampToValueAtTime(2200, now + 0.25);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.75);

      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.008, now + 0.75);

      osc.connect(filter);
      filter.connect(gain);

      const targetBus = this.impactBus ?? this.ctx.destination;
      if (panner) {
        gain.connect(panner);
        panner.connect(targetBus);
      } else {
        gain.connect(targetBus);
      }

      this.activeVoices++;
      osc.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };

      osc.start(now);
      osc.stop(now + 0.75);
    } catch {
      // ignore
    }
  }

  playDragonBreath(worldX = 1300, cameraX = 1300): void {
    try {
      if (!this.initCtx() || !this.ctx) return;
      const stamp = performance.now();
      if (stamp - this.lastDragonBreath < 180 || this.activeVoices >= 14) return;
      this.lastDragonBreath = stamp;

      const pan = this.calculateSpatialPan(worldX, cameraX);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      const panner = this.createPannerNode(pan);

      // Fire breath low-frequency whoosh: 280Hz down to 85Hz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.42);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.42);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);

      osc.connect(filter);
      filter.connect(gain);

      const targetBus = this.combatBus ?? this.ctx.destination;
      if (panner) {
        gain.connect(panner);
        panner.connect(targetBus);
      } else {
        gain.connect(targetBus);
      }

      this.activeVoices++;
      osc.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // ignore
    }
  }

  playGolemSlam(worldX = 1300, cameraX = 1300): void {
    try {
      if (!this.initCtx() || !this.ctx) return;
      const stamp = performance.now();
      if (stamp - this.lastGolemSlam < 200 || this.activeVoices >= 14) return;
      this.lastGolemSlam = stamp;

      const pan = this.calculateSpatialPan(worldX, cameraX);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.createPannerNode(pan);

      // Tectonic stone impact: 150Hz falling to 38Hz
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(80, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

      gain.gain.setValueAtTime(0.34, now);
      gain.gain.exponentialRampToValueAtTime(0.006, now + 0.42);

      osc.connect(gain);
      subOsc.connect(gain);

      const targetBus = this.impactBus ?? this.ctx.destination;
      if (panner) {
        gain.connect(panner);
        panner.connect(targetBus);
      } else {
        gain.connect(targetBus);
      }

      this.activeVoices += 2;
      osc.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 2); };

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + 0.42);
      subOsc.stop(now + 0.42);
    } catch {
      // ignore
    }
  }

  playMinionAttack(type: 'melee' | 'caster' | 'cannon', worldX = 1300, cameraX = 1300): void {
    try {
      if (!this.initCtx() || !this.ctx) return;
      const stamp = performance.now();
      if (stamp - this.lastMinionAttack < 90 || this.activeVoices >= 12) return;
      this.lastMinionAttack = stamp;

      const pan = this.calculateSpatialPan(worldX, cameraX);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.createPannerNode(pan);

      if (type === 'cannon') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.14);
      } else if (type === 'caster') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.003, now + 0.09);
      } else {
        // Melee sword clash
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.002, now + 0.06);
      }

      osc.connect(gain);

      const targetBus = this.combatBus ?? this.ctx.destination;
      if (panner) {
        gain.connect(panner);
        panner.connect(targetBus);
      } else {
        gain.connect(targetBus);
      }

      this.activeVoices++;
      osc.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };

      osc.start(now);
      osc.stop(now + (type === 'cannon' ? 0.14 : type === 'caster' ? 0.09 : 0.06));
    } catch {
      // ignore
    }
  }

  playFrogCroak(worldX = 1300, cameraX = 1300): void {
    try {
      if (!this.initCtx() || !this.ctx) return;
      const stamp = performance.now();
      if (stamp - this.lastFrogCroak < 1200 || this.activeVoices >= 10) return;
      this.lastFrogCroak = stamp;

      const pan = this.calculateSpatialPan(worldX, cameraX);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.createPannerNode(pan);

      // Natural organic frog croak: 160Hz -> 210Hz -> 140Hz
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(210, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(135, now + 0.18);

      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.18);

      osc.connect(gain);

      const targetBus = this.uiBus ?? this.ctx.destination;
      if (panner) {
        gain.connect(panner);
        panner.connect(targetBus);
      } else {
        gain.connect(targetBus);
      }

      this.activeVoices++;
      osc.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // ignore
    }
  }
}

export const sound = new SoundManager();
