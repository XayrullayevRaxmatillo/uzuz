/** Tiny original sound effects synthesised with Web Audio — no audio files, no licensing. */
let ctx: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(v: boolean) {
  enabled = v;
  if (v && !ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
  if (ctx?.state === 'suspended') void ctx.resume();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const sfx = {
  tick() {
    if (enabled) tone(880, 0, 0.08, 'triangle', 0.06);
  },
  go() {
    if (enabled) tone(1320, 0, 0.18, 'triangle', 0.1);
  },
  correct() {
    if (!enabled) return;
    tone(660, 0, 0.12, 'sine');
    tone(990, 0.1, 0.2, 'sine');
  },
  wrong() {
    if (!enabled) return;
    tone(220, 0, 0.18, 'sawtooth', 0.06);
    tone(165, 0.14, 0.24, 'sawtooth', 0.05);
  },
  win() {
    if (!enabled) return;
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle', 0.1));
  },
  join() {
    if (enabled) tone(740, 0, 0.1, 'sine', 0.06);
  }
};
