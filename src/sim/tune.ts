// Searches Tuning values for one difficulty target: a (1 + λ) evolution
// strategy — mutate the current best a few ways, keep whichever scores
// best — plus, each round, a direct correction of the Holding Power drain
// toward the target band (the drain is what mostly sets final Holding
// Power, so this converges much faster than waiting for a lucky mutation).
//
// Every candidate is scored against the same simulated players (same
// seeds), so differences come from the tuning, not from luck. Picking the
// best of many candidates on one set of players still flatters the winner
// a little, so calibrateDrain() then re-centres the result on a larger,
// fresh set of players.
import type { Tuning } from "../tuning";
import { summarize, type PopulationRunner, type Summary } from "./metrics";
import type { Persona } from "./personas";
import { Rng } from "./rng";
import { PARAM_BOUNDS, type Band, type Target } from "./targets";

export interface TuneOptions {
  sessions: number;
  iterations: number;
  lambda: number; // mutations per round
  seed: number;
  personas: Persona[];
  regularize: number; // pull toward the starting values, so untouched knobs don't drift
}

function bandDist(v: number, b: Band): number {
  return v < b.min ? b.min - v : v > b.max ? v - b.max : 0;
}

export function loss(summary: Summary, target: Target, tuning: Tuning, anchor: Tuning, regularize: number): number {
  const holding = summary.holdingMedian === null ? 20 : bandDist(summary.holdingMedian, target.holding) / 10;
  const finish = bandDist(summary.finishRate * 100, { min: target.finishRate.min * 100, max: target.finishRate.max * 100 }) / 10;
  let reg = 0;
  const keys = Object.keys(PARAM_BOUNDS) as (keyof Tuning)[];
  for (const k of keys) {
    const [lo, hi] = PARAM_BOUNDS[k]!;
    reg += ((tuning[k] - anchor[k]) / (hi - lo)) ** 2;
  }
  return holding + finish + regularize * (reg / keys.length);
}

function clampParam(k: keyof Tuning, v: number): number {
  const [lo, hi] = PARAM_BOUNDS[k]!;
  return Math.round(Math.max(lo, Math.min(hi, v)) * 100) / 100;
}

function mutate(t: Tuning, rng: Rng, sigma: number): Tuning {
  const keys = Object.keys(PARAM_BOUNDS) as (keyof Tuning)[];
  const out = { ...t };
  const n = 1 + Math.floor(rng.next() * 3);
  for (let i = 0; i < n; i++) {
    const k = keys[Math.floor(rng.next() * keys.length)];
    const [lo, hi] = PARAM_BOUNDS[k]!;
    out[k] = clampParam(k, out[k] + rng.normal() * sigma * (hi - lo));
  }
  return out;
}

// Scale the drain so the median Holding Power used up lands mid-band.
function drainCorrection(t: Tuning, s: Summary, target: Target): Tuning | null {
  if (s.holdingMedian === null) return { ...t, holdingDrainPerSec: clampParam("holdingDrainPerSec", t.holdingDrainPerSec * 0.8) };
  const used = 100 - s.holdingMedian;
  const want = 100 - (target.holding.min + target.holding.max) / 2;
  if (used < 1 || bandDist(s.holdingMedian, target.holding) === 0) return null;
  return { ...t, holdingDrainPerSec: clampParam("holdingDrainPerSec", t.holdingDrainPerSec * (want / used)) };
}

export interface TuneResult {
  tuning: Tuning;
  summary: Summary;
  loss: number;
  evaluations: number;
}

export async function tune(
  start: Tuning,
  anchor: Tuning,
  target: Target,
  opts: TuneOptions,
  run: PopulationRunner,
  log: (msg: string) => void,
): Promise<TuneResult> {
  const rng = new Rng(opts.seed * 7919 + 13);
  const evaluate = async (t: Tuning) => {
    const summary = summarize(await run(t, opts.sessions, opts.seed, opts.personas));
    return { tuning: t, summary, loss: loss(summary, target, t, anchor, opts.regularize) };
  };
  let best = await evaluate(start);
  let evaluations = 1;
  const fmt = (r: typeof best) =>
    `loss ${r.loss.toFixed(3)}  finish ${(r.summary.finishRate * 100).toFixed(0)}%  holding ${r.summary.holdingMedian?.toFixed(1) ?? "—"}  drain ${r.tuning.holdingDrainPerSec}`;
  log(`  start: ${fmt(best)}`);
  for (let it = 0; it < opts.iterations; it++) {
    const sigma = 0.25 * (1 - it / opts.iterations) + 0.04;
    const candidates: Tuning[] = [];
    const corrected = drainCorrection(best.tuning, best.summary, target);
    if (corrected) candidates.push(corrected);
    for (let i = 0; i < opts.lambda; i++) candidates.push(mutate(best.tuning, rng, sigma));
    for (const c of candidates) {
      const r = await evaluate(c);
      evaluations++;
      if (r.loss < best.loss) best = r;
    }
    log(`  round ${it + 1}/${opts.iterations}: ${fmt(best)}`);
  }
  return { ...best, evaluations };
}

// Final step: on a large population of players the search never saw, try
// the Holding Power drain a little either side of the search's pick and keep
// whichever scores best on the full target (holding band + finish-rate
// band). Lowering the drain raises both final Holding Power and the finish
// rate, so the two bands can pull against each other; this finds the best
// compromise rather than centring one of them.
export async function calibrateDrain(
  tuning: Tuning,
  target: Target,
  sessions: number,
  seed: number,
  personas: Persona[],
  run: PopulationRunner,
  log: (msg: string) => void,
): Promise<Tuning> {
  const score = async (drain: number) => {
    const t = { ...tuning, holdingDrainPerSec: clampParam("holdingDrainPerSec", drain) };
    const s = summarize(await run(t, sessions, seed, personas));
    const l = loss(s, target, t, t, 0);
    log(`  calibrate: drain ${t.holdingDrainPerSec} → holding ${s.holdingMedian?.toFixed(1) ?? "—"}, finish ${(s.finishRate * 100).toFixed(0)}%, loss ${l.toFixed(3)}`);
    return { t, l };
  };
  let best = await score(tuning.holdingDrainPerSec);
  // Pattern search: step either way, halve the step when neither helps.
  let step = 0.08;
  for (let i = 0; i < 8 && best.l > 0 && step > 0.01; i++) {
    const cur = best.t.holdingDrainPerSec;
    const tries = [cur * (1 + step), cur * (1 - step)].filter((d) => clampParam("holdingDrainPerSec", d) !== cur);
    const scored = [];
    for (const d of tries) scored.push(await score(d));
    const better = scored.filter((c) => c.l < best.l).sort((a, b) => a.l - b.l)[0];
    if (better) best = better;
    else step /= 2;
  }
  return best.t;
}
