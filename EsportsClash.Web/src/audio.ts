import { AVATAR_SOUND_ASSETS, getAvatarSkillSoundCue } from './avatarSkillAudio';
import type { SkillSlot } from './avatarSkillAnimation';

// UI cues remain synthesized; avatar casts use licensed recorded sounds.

class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private activeVoices = 0;
  private lastCast = new Map<string, number>();
  private lastPreload = 0;
  private lastImpact = 0;
  private lastExplosion = 0;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.lastPreload) {
      this.lastPreload = Date.now();
      // A user click normally unlocks Web Audio before the first battle cast.
      AVATAR_SOUND_ASSETS.forEach(sample => { void this.loadSample(sample).catch(() => undefined); });
    }
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

  private playSample(buffer: AudioBuffer, gainValue: number, rate: number, delay: number): void {
    const ctx = this.ctx;
    if (!ctx || this.activeVoices >= 16) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const now = ctx.currentTime + delay;
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.012);
    gain.gain.setTargetAtTime(0.001, now + Math.min(buffer.duration / rate, 0.55), 0.08);
    source.connect(gain);
    gain.connect(ctx.destination);
    this.activeVoices++;
    source.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
    source.start(now);
    source.stop(now + Math.min(buffer.duration / rate + 0.12, 1.3));
  }

  playAvatarSkill(avatarName: string, slot: SkillSlot): void {
    try {
      this.initCtx();
      const cue = getAvatarSkillSoundCue(avatarName, slot);
      if (!cue || !this.ctx) return;
      const key = `${avatarName}:${slot}`;
      const now = performance.now();
      if (now - (this.lastCast.get(key) ?? -Infinity) < 145) return;
      this.lastCast.set(key, now);
      if (this.activeVoices >= (slot === 'ultimate' ? 16 : 12)) return;
      void this.loadSample(cue.sample)
        .then(buffer => this.playSample(buffer, cue.gain, cue.rate, 0))
        .catch(() => this.playSpellHit());
      void this.loadSample(cue.accent)
        .then(buffer => this.playSample(buffer, cue.gain * 0.34, cue.rate * 0.82, cue.accentDelay))
        .catch(() => undefined);
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
      gain.connect(this.ctx.destination);
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
      gain.connect(this.ctx.destination);
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
      gain.connect(this.ctx.destination);
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
        gain.connect(this.ctx!.destination);
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
        .then(buffer => this.playSample(buffer, 0.08, 1, 0))
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
      gain.connect(this.ctx.destination);
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
        .then(buffer => this.playSample(buffer, 0.23, 0.94, 0))
        .catch(() => this.playSynthExplosion());
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
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // ignore
    }
  }
}

export const sound = new SoundManager();

