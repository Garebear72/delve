// Sound effects, synthesised with the Web Audio API (no audio files). Each sound is a few short
// oscillator / noise envelopes. Sounds are throttled per kind so busy moments never turn into noise.
import { prefs } from '../ui/prefs';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const lastAt: Record<string, number> = {};

/** Browsers only allow audio after a user gesture; call this from any tap. */
export function unlockAudio() {
  // Phones pause audio in two ways ("suspended", and "interrupted" e.g. by a call or another app); resume from either.
  if (ctx) { if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22 * prefs.volume;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

export function setVolume(v: number) { if (master) master.gain.value = 0.22 * v; }

type Wave = OscillatorType;
/** One tone: frequency glides from f0 to f1 over `dur` seconds with a quick attack and exponential decay. */
function tone(f0: number, f1: number, dur: number, wave: Wave = 'square', vol = 0.5, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

/** A burst of filtered noise (thuds, crunches, rattles). */
function noise(dur: number, freq: number, vol = 0.5, delay = 0, type: BiquadFilterType = 'lowpass') {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
}

const notes = (base: number, steps: number[], gap: number, wave: Wave = 'square', vol = 0.35, dur = 0.12) =>
  steps.forEach((st, i) => tone(base * Math.pow(2, st / 12), base * Math.pow(2, st / 12), dur, wave, vol, i * gap));

const SOUNDS: Record<string, { gap: number; play: (arg?: number) => void }> = {
  tap: { gap: 0.035, play: (combo = 0) => { noise(0.07, 500 + Math.min(combo, 50) * 20, 0.6); tone(140 + Math.min(combo, 50) * 4, 70, 0.06, 'triangle', 0.4); } },
  crit: { gap: 0.05, play: () => { noise(0.12, 1400, 0.7); tone(520, 180, 0.1, 'square', 0.3); } },
  blocked: { gap: 0.08, play: () => { tone(90, 60, 0.08, 'triangle', 0.5); noise(0.05, 300, 0.4); } },
  dug: { gap: 0.2, play: () => { noise(0.25, 220, 0.8); notes(392, [0, 7], 0.07, 'triangle', 0.3); } },
  biome: { gap: 1, play: () => notes(262, [0, 4, 7, 12, 16], 0.09, 'triangle', 0.35, 0.25) },
  hit: { gap: 0.07, play: () => tone(320 + Math.random() * 60, 140, 0.05, 'square', 0.18) },
  hitCrit: { gap: 0.08, play: () => { tone(700, 200, 0.09, 'sawtooth', 0.25); noise(0.06, 2000, 0.3, 0, 'highpass'); } },
  hurt: { gap: 0.12, play: () => tone(160, 80, 0.12, 'sawtooth', 0.2) },
  kill: { gap: 0.1, play: () => { noise(0.08, 900, 0.4); notes(523, [0, 7], 0.05, 'square', 0.18, 0.07); } },
  wipe: { gap: 1, play: () => notes(330, [0, -3, -7, -12], 0.12, 'sawtooth', 0.25, 0.18) },
  coin: { gap: 0.06, play: () => notes(988, [0, 5], 0.06, 'square', 0.2, 0.09) },
  loot: { gap: 0.15, play: () => notes(784, [0, 4, 7], 0.05, 'triangle', 0.3, 0.1) },
  build: { gap: 0.1, play: () => { noise(0.06, 1200, 0.5); noise(0.06, 1200, 0.4, 0.09); tone(200, 160, 0.08, 'triangle', 0.3); } },
  epic: { gap: 0.6, play: () => notes(523, [0, 4, 7, 12], 0.08, 'triangle', 0.35, 0.2) },
  good: { gap: 0.25, play: () => notes(659, [0, 7], 0.07, 'triangle', 0.25, 0.12) },
  bad: { gap: 0.4, play: () => notes(220, [0, -2], 0.1, 'sawtooth', 0.18, 0.15) },
  click: { gap: 0.03, play: () => tone(900, 700, 0.025, 'square', 0.08) },
  dice: { gap: 0.2, play: () => { for (let i = 0; i < 5; i++) noise(0.03, 2500, 0.35, i * 0.045, 'bandpass'); } },
  win: { gap: 0.2, play: () => notes(659, [0, 4, 7, 12], 0.06, 'square', 0.22, 0.1) },
  lose: { gap: 0.2, play: () => { tone(300, 120, 0.35, 'sawtooth', 0.2); } },
  peg: { gap: 0.03, play: () => tone(1200 + Math.random() * 600, 900, 0.03, 'triangle', 0.12) },
  land: { gap: 0.05, play: (m = 1) => notes(m >= 5 ? 784 : m >= 1 ? 523 : 262, m >= 5 ? [0, 4, 7, 12] : [0, 4], 0.05, 'triangle', 0.25, 0.1) },
  cart: { gap: 0.3, play: () => { noise(0.4, 180, 0.35); tone(110, 90, 0.4, 'triangle', 0.2); } },
  crash: { gap: 0.5, play: () => { noise(0.6, 600, 0.9); tone(200, 40, 0.5, 'sawtooth', 0.3); } },
  tick: { gap: 0.02, play: () => tone(1800, 1500, 0.015, 'square', 0.12) },
  door: { gap: 0.2, play: () => { tone(180, 120, 0.25, 'sawtooth', 0.12); noise(0.2, 400, 0.3); } },
  curio: { gap: 0.4, play: () => notes(880, [0, 4, 7, 11, 14], 0.06, 'triangle', 0.3, 0.18) },
};

/** Play a sound effect (if sound is on and this kind hasn't played too recently). */
export function sfx(name: string, arg?: number) {
  if (!prefs.sound || !ctx || ctx.state !== 'running') return;
  const s = SOUNDS[name];
  if (!s) return;
  const now = ctx.currentTime;
  if (now - (lastAt[name] ?? -1) < s.gap) return;
  lastAt[name] = now;
  try { s.play(arg); } catch { /* audio is optional */ }
}
