// Sound effects. Every sound is synthesized live with WebAudio, so the game
// ships with no audio files — but any sound can be replaced by a real
// recording: drop a file named after the sound (e.g. `jump.mp3`, `fly.wav`)
// into src/assets/sfx/ and it's picked up automatically at build time and
// played instead of the synth version. See src/assets/sfx/README.md.
//
// Browsers only allow audio after a user gesture, so nothing plays until
// unlockAudio() is called from a pointer event (main.ts does that).

export type SfxName =
  | "hop"
  | "jump"
  | "attack"
  | "attackWeak"
  | "land"
  | "pickup"
  | "bean"
  | "beansoup"
  | "banana"
  | "rumble"
  | "accident"
  | "shield"
  | "death"
  | "checkpoint"
  | "win"
  | "enemy"
  | "empty"
  | "idle"
  | "ui";

const overrideUrls = import.meta.glob("./assets/sfx/*.{mp3,ogg,wav,m4a}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const MUTE_KEY = "powerplatformer.muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const overrides = new Map<string, AudioBuffer>();
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): void {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // private mode etc. — the toggle still works for this session
  }
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
}

export function unlockAudio(): void {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    loadOverrides(ctx);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function loadOverrides(ac: AudioContext): void {
  for (const [path, url] of Object.entries(overrideUrls)) {
    const name = path.split("/").pop()!.replace(/\.[^.]+$/, "");
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => ac.decodeAudioData(buf))
      .then((decoded) => overrides.set(name, decoded))
      .catch(() => {
        // a broken file just leaves the synth version in place
      });
  }
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// --- synth building blocks ---------------------------------------------

interface FartOpts {
  dur: number;
  f0: number; // start pitch, Hz
  f1: number; // end pitch, Hz
  vol: number;
  flutter: number; // Hz of the lip-flap amplitude wobble
  cutoff: number; // lowpass, Hz
  noise?: number; // 0..1 breathiness
}

// The core sound of the game: a buzzy sawtooth sliding in pitch, chopped by
// a fast amplitude "flutter", lowpassed so it's more raspberry than buzzer.
function fart(o: FartOpts, at = 0): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(o.vol, t + 0.015);
  out.gain.setValueAtTime(o.vol, t + o.dur * 0.6);
  out.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = o.cutoff;
  filter.Q.value = 3;
  filter.connect(out);
  out.connect(master);

  const flap = ctx.createGain();
  flap.gain.value = 0.6;
  flap.connect(filter);
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.setValueAtTime(o.flutter, t);
  lfo.frequency.linearRampToValueAtTime(o.flutter * rand(0.6, 1.3), t + o.dur);
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.4;
  lfo.connect(lfoDepth).connect(flap.gain);

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(o.f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
  osc.connect(flap);

  const nodes: AudioScheduledSourceNode[] = [osc, lfo];
  if (o.noise && noiseBuffer) {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = o.f0 * 3;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.value = o.noise;
    n.connect(bp).connect(ng).connect(flap);
    nodes.push(n);
  }
  for (const n of nodes) {
    n.start(t);
    n.stop(t + o.dur + 0.05);
  }
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = "triangle", at = 0, slideTo?: number): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(master);
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noiseBurst(dur: number, vol: number, freq: number, at = 0, sweepTo?: number): void {
  if (!ctx || !master || !noiseBuffer) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(freq, t);
  if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function playOverride(name: string, vol = 1, rate = 1): boolean {
  const buf = overrides.get(name);
  if (!buf || !ctx || !master) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start();
  return true;
}

// --- public one-shots ----------------------------------------------------

// `intensity` (0..1, default 1) scales loudness, e.g. for soft landings;
// `pitch` scales pitch, e.g. rising bean-combo blips.
export function sfx(name: SfxName, intensity = 1, pitch = 1): void {
  if (!ctx || muted) return;
  if (playOverride(name, intensity, pitch * rand(0.95, 1.05))) return;

  switch (name) {
    case "hop":
      fart({ dur: rand(0.12, 0.18), f0: rand(150, 190), f1: rand(90, 120), vol: 0.35, flutter: rand(28, 40), cutoff: 1400 });
      break;
    case "jump":
      fart({ dur: rand(0.32, 0.42), f0: rand(110, 140), f1: rand(60, 80), vol: 0.5, flutter: rand(22, 30), cutoff: 1100, noise: 0.25 });
      break;
    case "attack":
      fart({ dur: rand(0.45, 0.6), f0: rand(85, 105), f1: rand(45, 60), vol: 0.6, flutter: rand(18, 24), cutoff: 900, noise: 0.45 });
      break;
    case "attackWeak":
      fart({ dur: 0.12, f0: 220, f1: 170, vol: 0.2, flutter: 45, cutoff: 1800, noise: 0.5 });
      break;
    case "idle":
      fart({ dur: rand(0.08, 0.14), f0: rand(240, 300), f1: rand(200, 240), vol: 0.12, flutter: rand(40, 55), cutoff: 2000 });
      break;
    case "empty":
      fart({ dur: 0.5, f0: 160, f1: 50, vol: 0.35, flutter: 14, cutoff: 900, noise: 0.6 });
      break;
    case "land":
      tone(130, 0.09, 0.25 * intensity, "sine", 0, 55);
      noiseBurst(0.07, 0.12 * intensity, 600);
      break;
    case "bean":
      tone(880 * pitch, 0.08, 0.18, "square", 0, 1320 * pitch);
      tone(1320 * pitch, 0.1, 0.12, "triangle", 0.05);
      break;
    case "pickup":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 0.22, "triangle", i * 0.06));
      break;
    case "beansoup":
      noiseBurst(0.25, 0.25, 400, 0, 1200); // glug
      [392, 494, 587, 784].forEach((f, i) => tone(f, 0.12, 0.18, "triangle", 0.15 + i * 0.05));
      fart({ dur: 0.35, f0: 120, f1: 70, vol: 0.4, flutter: 24, cutoff: 1000 }, 0.4);
      break;
    case "banana":
      noiseBurst(0.1, 0.18, 900, 0, 400); // chomp
      [659, 523, 440].forEach((f, i) => tone(f, 0.12, 0.18, "triangle", 0.08 + i * 0.06));
      break;
    case "rumble":
      // A low stomach growl: slow flutter, heavily lowpassed.
      fart({ dur: 0.7 * intensity + 0.3, f0: rand(55, 70), f1: rand(40, 50), vol: 0.35 * intensity, flutter: rand(7, 10), cutoff: 320, noise: 0.5 });
      break;
    case "accident":
      fart({ dur: 1.1, f0: 120, f1: 35, vol: 0.6, flutter: 9, cutoff: 700, noise: 0.6 });
      tone(400, 0.7, 0.2, "square", 0.3, 80);
      break;
    case "shield":
      tone(1200, 0.25, 0.25, "sine", 0, 300);
      noiseBurst(0.2, 0.25, 2500, 0, 600);
      break;
    case "enemy":
      noiseBurst(0.12, 0.35, 1800, 0, 300);
      tone(700, 0.18, 0.25, "square", 0, 120);
      break;
    case "death":
      tone(500, 0.6, 0.25, "square", 0, 90);
      fart({ dur: 0.7, f0: 140, f1: 40, vol: 0.45, flutter: 12, cutoff: 900, noise: 0.3 }, 0.1);
      break;
    case "checkpoint":
      tone(659, 0.12, 0.22, "triangle");
      tone(988, 0.25, 0.22, "triangle", 0.1);
      break;
    case "win":
      fart({ dur: 0.9, f0: 160, f1: 45, vol: 0.55, flutter: 20, cutoff: 1000, noise: 0.3 });
      noiseBurst(1.2, 0.3, 300, 0.7, 3000); // flush
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.2, 0.22, "triangle", 1.5 + i * 0.1));
      break;
    case "ui":
      tone(1000, 0.05, 0.15, "square");
      break;
  }
}

// --- the flight jet: a continuous loop rather than a one-shot -------------

let flyNodes: { out: GainNode; osc: OscillatorNode; lfo: OscillatorNode; src?: AudioBufferSourceNode } | null = null;

// Called every frame with whether the player is fart-flying. `sputter`
// (true when the tank is nearly empty) makes the jet cut in and out.
export function setFlying(active: boolean, sputter: boolean): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  if (active && !muted) {
    if (!flyNodes) {
      const out = ctx.createGain();
      out.gain.value = 0.0001;
      out.connect(master);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1000;
      filter.Q.value = 2;
      filter.connect(out);
      const flap = ctx.createGain();
      flap.gain.value = 0.6;
      flap.connect(filter);
      const lfo = ctx.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = 26;
      const depth = ctx.createGain();
      depth.gain.value = 0.4;
      lfo.connect(depth).connect(flap.gain);
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 95;
      osc.connect(flap);
      osc.start();
      lfo.start();
      flyNodes = { out, osc, lfo };

      const buf = overrides.get("fly");
      if (buf) {
        // a recorded jet replaces the synth one; keep the synth nodes silent
        osc.disconnect();
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(out);
        src.start();
        flyNodes.src = src;
      }
    }
    const target = sputter && Math.random() < 0.45 ? 0.02 : 0.32;
    flyNodes.out.gain.setTargetAtTime(target, t, sputter ? 0.01 : 0.05);
    flyNodes.osc.frequency.setTargetAtTime(90 + Math.sin(t * 7) * 12, t, 0.05);
  } else if (flyNodes) {
    const nodes = flyNodes;
    flyNodes = null;
    nodes.out.gain.setTargetAtTime(0.0001, t, 0.04);
    for (const n of [nodes.osc, nodes.lfo, nodes.src]) n?.stop(t + 0.3);
  }
}
