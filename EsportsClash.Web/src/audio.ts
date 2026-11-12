import {
  BACKGROUND_MUSIC_BPM,
  BACKGROUND_MUSIC_LOOP_STEPS,
  getBackgroundMusicStep,
} from './backgroundMusic.ts';

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
  private masterGain: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private musicGain: GainNode | null = null;
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

    const uiBus = ctx.createGain();
    uiBus.gain.value = 0.68;
    uiBus.connect(master);
    this.uiBus = uiBus;

    const music = ctx.createGain();
    music.gain.value = this.musicEnabled ? 0.28 : 0;
    music.connect(master);
    this.musicGain = music;

    this.masterGain = master;
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
}

export const sound = new SoundManager();
