import type { LiveWeapon } from './fpsLiveWeapons.ts';

export type FpsAudioCue =
  | { kind: 'gunshot'; weapon: LiveWeapon; x: number; z: number }
  | { kind: 'reload'; x: number; z: number }
  | { kind: 'footstep'; stance: 'walk' | 'run' | 'crouch'; x: number; z: number };

export interface FpsAudioListener { x: number; z: number; yaw: number }

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Small, isolated sound stage for the local FPS exhibition. It never touches the app-wide music bus. */
export class FpsBroadcastAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private enabled = true;
  private activeVoices = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!this.master || !this.context) return;
    const at = this.context.currentTime;
    this.master.gain.cancelScheduledValues(at);
    this.master.gain.setTargetAtTime(enabled ? .7 : 0, at, .025);
  }

  activate(): void {
    const context = this.getContext();
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
  }

  dispose(): void {
    const context=this.context;
    this.context=undefined;this.master=undefined;this.noise=undefined;this.activeVoices=0;
    if(context&&context.state!=='closed')void context.close().catch(()=>undefined);
  }

  play(cue: FpsAudioCue, listener: FpsAudioListener): void {
    if (!this.enabled || this.activeVoices > 96) return;
    const context = this.getContext();
    if (!context || context.state !== 'running') return;
    const spatial = this.spatial(cue.x, cue.z, listener);
    if (spatial.gain < .004) return;
    if (cue.kind === 'gunshot') this.playGunshot(context, cue.weapon, spatial.gain, spatial.pan);
    else if (cue.kind === 'reload') this.playReload(context, spatial.gain, spatial.pan);
    else this.playFootstep(context, cue.stance, spatial.gain, spatial.pan);
  }

  private getContext(): AudioContext | undefined {
    if (this.context) return this.context;
    if (typeof window === 'undefined') return undefined;
    const AudioContextConstructor = (window as AudioWindow).AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) return undefined;
    let context:AudioContext;
    try { context = new AudioContextConstructor(); } catch { return undefined; }
    const master = context.createGain();
    master.gain.value = this.enabled ? .7 : 0;
    master.connect(context.destination);
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .55), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    this.context = context;
    this.master = master;
    this.noise = noise;
    return context;
  }

  private spatial(x: number, z: number, listener: FpsAudioListener): { gain: number; pan: number } {
    const dx = x - listener.x, dz = z - listener.z;
    const range = Math.hypot(dx, dz);
    const direction = range > .001 ? Math.atan2(dx, dz) : listener.yaw;
    const pan = clamp(Math.sin(direction - listener.yaw), -1, 1);
    // Map units are approximately metres. The quadratic falloff keeps distant reports audible without overpowering close cues.
    const falloff = clamp(1 - range / 72, 0, 1);
    return { gain: falloff * falloff, pan };
  }

  private voice<T extends AudioNode>(node: T, pan: number, gain: number): T {
    const context = this.context!;
    const output = context.createGain();
    output.gain.value = gain;
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    node.connect(output);
    output.connect(panner);
    panner.connect(this.master!);
    this.activeVoices++;
    return node;
  }

  private releaseVoice(source: AudioScheduledSourceNode, endAt: number): void {
    source.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };
    source.stop(endAt);
  }

  private playGunshot(context: AudioContext, weapon: LiveWeapon, distanceGain: number, pan: number): void {
    const now = context.currentTime;
    const sniper = weapon === 'sniper' || weapon === 'scout';
    const shotgun = weapon === 'mag7' || weapon === 'nova';
    const smg = weapon === 'smg' || weapon === 'mp9' || weapon === 'mac10' || weapon === 'negev';
    const pistol = weapon === 'pistol' || weapon === 'usp_s' || weapon === 'glock' || weapon === 'deagle';
    const crackLevel = sniper ? .95 : shotgun ? .76 : pistol ? .72 : smg ? .55 : .68;
    const bodyLevel = sniper ? .82 : shotgun ? .94 : pistol ? .43 : smg ? .45 : .67;
    const tail = sniper ? .42 : shotgun ? .32 : .22;

    const crack = context.createBufferSource(); crack.buffer = this.noise!;
    const crackFilter = context.createBiquadFilter(); crackFilter.type = 'highpass'; crackFilter.frequency.value = sniper ? 1450 : 920;
    const crackEnvelope = context.createGain(); crackEnvelope.gain.setValueAtTime(.0001, now); crackEnvelope.gain.linearRampToValueAtTime(crackLevel * distanceGain, now + .002); crackEnvelope.gain.exponentialRampToValueAtTime(.0001, now + .065);
    crack.connect(crackFilter); crackFilter.connect(crackEnvelope); this.voice(crackEnvelope, pan, 1); crack.start(now); this.releaseVoice(crack, now + .07);

    const body = context.createOscillator(); body.type = shotgun || sniper ? 'triangle' : 'sine';
    body.frequency.setValueAtTime(sniper ? 118 : shotgun ? 82 : pistol ? 104 : smg ? 96 : 88, now);
    body.frequency.exponentialRampToValueAtTime(42, now + tail);
    const bodyEnvelope = context.createGain(); bodyEnvelope.gain.setValueAtTime(.0001, now); bodyEnvelope.gain.linearRampToValueAtTime(bodyLevel * distanceGain * .36, now + .004); bodyEnvelope.gain.exponentialRampToValueAtTime(.0001, now + tail);
    body.connect(bodyEnvelope); this.voice(bodyEnvelope, pan, 1); body.start(now); this.releaseVoice(body, now + tail + .01);

    const tailNoise = context.createBufferSource(); tailNoise.buffer = this.noise!;
    const tailFilter = context.createBiquadFilter(); tailFilter.type = 'bandpass'; tailFilter.frequency.value = sniper ? 780 : shotgun ? 620 : 1100; tailFilter.Q.value = .55;
    const tailEnvelope = context.createGain(); tailEnvelope.gain.setValueAtTime(.0001, now + .012); tailEnvelope.gain.linearRampToValueAtTime(.3 * distanceGain, now + .026); tailEnvelope.gain.exponentialRampToValueAtTime(.0001, now + tail);
    tailNoise.connect(tailFilter); tailFilter.connect(tailEnvelope); this.voice(tailEnvelope, pan, 1); tailNoise.start(now + .012); this.releaseVoice(tailNoise, now + tail + .01);
  }

  private playFootstep(context: AudioContext, stance: 'walk' | 'run' | 'crouch', distanceGain: number, pan: number): void {
    const now = context.currentTime;
    const run = stance === 'run', crouch = stance === 'crouch';
    const duration = crouch ? .105 : run ? .13 : .15;
    const level = (crouch ? .095 : run ? .19 : .14) * distanceGain;
    const source = context.createBufferSource(); source.buffer = this.noise!;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = crouch ? 520 : run ? 1050 : 760;
    const envelope = context.createGain(); envelope.gain.setValueAtTime(.0001, now); envelope.gain.linearRampToValueAtTime(level, now + .008); envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter); filter.connect(envelope); this.voice(envelope, pan, 1); source.start(now); this.releaseVoice(source, now + duration + .005);

    const thud = context.createOscillator(); thud.type = 'sine'; thud.frequency.setValueAtTime(run ? 86 : 68, now); thud.frequency.exponentialRampToValueAtTime(38, now + .09);
    const thudEnvelope = context.createGain(); thudEnvelope.gain.setValueAtTime(.0001, now); thudEnvelope.gain.linearRampToValueAtTime(level * .48, now + .006); thudEnvelope.gain.exponentialRampToValueAtTime(.0001, now + .1);
    thud.connect(thudEnvelope); this.voice(thudEnvelope, pan, 1); thud.start(now); this.releaseVoice(thud, now + .11);
  }
  private playReload(context:AudioContext,distanceGain:number,pan:number):void {
    const now=context.currentTime;
    const click=context.createOscillator();click.type='square';click.frequency.setValueAtTime(660,now);click.frequency.exponentialRampToValueAtTime(230,now+.045);
    const envelope=context.createGain();envelope.gain.setValueAtTime(.0001,now);envelope.gain.linearRampToValueAtTime(.10*distanceGain,now+.003);envelope.gain.exponentialRampToValueAtTime(.0001,now+.06);
    click.connect(envelope);this.voice(envelope,pan,1);click.start(now);this.releaseVoice(click,now+.065);
    const metal=context.createBufferSource();metal.buffer=this.noise!;
    const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=1850;filter.Q.value=2.4;
    const rattle=context.createGain();rattle.gain.setValueAtTime(.0001,now+.09);rattle.gain.linearRampToValueAtTime(.065*distanceGain,now+.1);rattle.gain.exponentialRampToValueAtTime(.0001,now+.17);
    metal.connect(filter);filter.connect(rattle);this.voice(rattle,pan,1);metal.start(now+.09);this.releaseVoice(metal,now+.18);
  }
}
