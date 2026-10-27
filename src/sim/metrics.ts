// Running simulated sessions and turning them into player-base metrics.
import { Game, type DeathCause } from "../game";
import type { Tuning } from "../tuning";
import { Agent } from "./agent";
import { PERSONAS, personaFor, type Persona } from "./personas";
import { Rng } from "./rng";

const DT = 1 / 60;
const RUN_CAP_SEC = 400; // a run that hasn't ended by now counts as a give-up
export const MAX_ATTEMPTS = 3; // game overs before a simulated player gives up

export interface AttemptResult {
  won: boolean;
  time: number;
  deaths: number;
  deathLog: { cause: DeathCause; x: number; t: number }[];
  finalHolding: number;
  minHolding: number;
  finalFarting: number;
  beans: number;
  bananas: number;
  beanSoups: number;
  enemiesFarted: number;
  hops: number;
  jumps: number;
  attacks: number;
  flightSec: number;
  depletedSec: number;
  furthestX: number;
}

export interface SessionResult {
  persona: string;
  attempts: AttemptResult[];
}

export function runSession(tuning: Tuning, stageId: string, persona: Persona, seed: number): SessionResult {
  const rng = new Rng(seed);
  let agent: Agent;
  const game = new Game(null, {
    headless: true,
    input: {
      consumeClickTarget: () => agent.consumeClickTarget(),
      consumeJump: () => agent.consumeJump(),
      consumeAttack: () => agent.consumeAttack(),
      getFlyTarget: () => agent.getFlyTarget(),
      consumeAnyAction: () => agent.consumeAnyAction(),
    },
  });
  agent = new Agent(game, persona, tuning, rng);

  const attempts: AttemptResult[] = [];
  for (let a = 0; a < MAX_ATTEMPTS; a++) {
    game.startRun(tuning, stageId);
    agent.reset();
    let simTime = 0;
    while (simTime < RUN_CAP_SEC) {
      agent.update(DT);
      game.tick(DT);
      simTime += DT;
      const st = game.currentStatus;
      if (st === "winning" || st === "won" || st === "gameover") break;
    }
    const s = game.runSummary;
    const won = game.currentStatus === "winning" || game.currentStatus === "won";
    attempts.push({
      won,
      time: s.time,
      deaths: s.deaths,
      deathLog: s.deathLog,
      finalHolding: s.holding,
      minHolding: s.minHolding,
      finalFarting: s.farting,
      beans: s.beans,
      bananas: s.bananasEaten,
      beanSoups: s.beanSoups,
      enemiesFarted: s.enemiesFarted,
      hops: s.hops,
      jumps: s.jumps,
      attacks: s.attacks,
      flightSec: s.flightSec,
      depletedSec: s.depletedSec,
      furthestX: s.furthestX,
    });
    if (won) break;
  }
  return { persona: persona.name, attempts };
}

// Sessions [from, to) of a population of `sessions` players. Split so a
// population can be spread across worker threads (see scripts/sim.mjs).
export function runSlice(
  tuning: Tuning,
  stageId: string,
  sessions: number,
  seed: number,
  personas: Persona[],
  from: number,
  to: number,
): SessionResult[] {
  const out: SessionResult[] = [];
  for (let i = from; i < to; i++) out.push(runSession(tuning, stageId, personaFor(i, sessions, personas), seed * 100003 + i));
  return out;
}

export function runPopulation(tuning: Tuning, stageId: string, sessions: number, seed: number, personas: Persona[] = PERSONAS): SessionResult[] {
  return runSlice(tuning, stageId, sessions, seed, personas, 0, sessions);
}

// Runs a population on one stage (the tuner works one stage at a time).
export type PopulationRunner = (tuning: Tuning, sessions: number, seed: number, personas: Persona[]) => Promise<SessionResult[]>;
// The same, for any stage; scripts/sim.mjs spreads it across worker threads.
export type StagePopulationRunner = (
  tuning: Tuning,
  stageId: string,
  sessions: number,
  seed: number,
  personas: Persona[],
) => Promise<SessionResult[]>;

// --- aggregation ----------------------------------------------------------------

function quantile(xs: number[], q: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface Summary {
  sessions: number;
  // The headline numbers the difficulty targets are defined on: a
  // player "finishes" if they reach the toilet on their first attempt
  // (one run, all lives), and final Holding Power is taken over those.
  finishRate: number;
  holdingMedian: number | null;
  holdingP25: number | null;
  holdingP75: number | null;
  shareHoldingOver80: number; // of all players, first attempt
  // Retries and persistence.
  eventualFinishRate: number; // within MAX_ATTEMPTS attempts
  meanAttemptsToFinish: number | null; // among eventual finishers
  meanLivesLostFirstAttempt: number | null;
  // Pace and play style (first attempts).
  timeMedian: number | null; // finishers
  timeP25: number | null;
  timeP75: number | null;
  beansMean: number | null;
  bananasMean: number | null;
  flightSecMean: number | null;
  depletedSecMean: number | null;
  enemiesFartedMean: number | null;
  minHoldingMedian: number | null;
  deathCauses: Record<DeathCause, number>; // all deaths in first attempts
  deathsByX: Record<string, number>; // 200px buckets
}

export function summarize(sessions: SessionResult[]): Summary {
  const first = sessions.map((s) => s.attempts[0]);
  const winners = first.filter((a) => a.won);
  const eventual = sessions.filter((s) => s.attempts.some((a) => a.won));
  const causes: Record<DeathCause, number> = { hit: 0, fall: 0, accident: 0 };
  const byX: Record<string, number> = {};
  for (const a of first) {
    for (const d of a.deathLog) {
      causes[d.cause]++;
      const b = Math.floor(d.x / 200) * 200;
      const key = `${b}-${b + 200}`;
      byX[key] = (byX[key] ?? 0) + 1;
    }
  }
  return {
    sessions: sessions.length,
    finishRate: winners.length / first.length,
    holdingMedian: quantile(winners.map((a) => a.finalHolding), 0.5),
    holdingP25: quantile(winners.map((a) => a.finalHolding), 0.25),
    holdingP75: quantile(winners.map((a) => a.finalHolding), 0.75),
    shareHoldingOver80: winners.filter((a) => a.finalHolding > 80).length / first.length,
    eventualFinishRate: eventual.length / sessions.length,
    meanAttemptsToFinish: mean(eventual.map((s) => s.attempts.findIndex((a) => a.won) + 1)),
    meanLivesLostFirstAttempt: mean(first.map((a) => a.deaths)),
    timeMedian: quantile(winners.map((a) => a.time), 0.5),
    timeP25: quantile(winners.map((a) => a.time), 0.25),
    timeP75: quantile(winners.map((a) => a.time), 0.75),
    beansMean: mean(first.map((a) => a.beans)),
    bananasMean: mean(first.map((a) => a.bananas)),
    flightSecMean: mean(first.map((a) => a.flightSec)),
    depletedSecMean: mean(first.map((a) => a.depletedSec)),
    enemiesFartedMean: mean(first.map((a) => a.enemiesFarted)),
    minHoldingMedian: quantile(first.map((a) => a.minHolding), 0.5),
    deathCauses: causes,
    deathsByX: byX,
  };
}

export function summarizeByPersona(sessions: SessionResult[]): Record<string, Summary> {
  const groups: Record<string, SessionResult[]> = {};
  for (const s of sessions) (groups[s.persona] ??= []).push(s);
  return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, summarize(v)]));
}
