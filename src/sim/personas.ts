// Simulated player types. The "player base" is a weighted mix of these;
// adjust the weights (or add personas) to match who actually plays.
//
// None of them is an optimal player: each one hesitates, mis-aims, and
// only sometimes thinks of flying or attacking, which is what makes the
// timings and failure rates look like people rather than a solver.
export interface Persona {
  name: string;
  weight: number; // share of the player base
  thinkSec: [number, number]; // hesitation before each action once landed
  aimNoise: number; // std dev of the aim angle error, radians
  holdNoise: number; // relative std dev of how long a fly-hold lasts
  greed: number; // how much beans/bananas/power-ups pull them off the route
  economy: number; // 0..1, how much they understand the meters (banana value, gas cost)
  flyiness: number; // chance of considering hold-to-fly on any given decision
  aggression: number; // chance of attacking an enemy in reach instead of avoiding it
  caution: number; // how strongly they avoid jumps that only just work
  randomness: number; // how often they take a "good enough" option rather than their best
  fumble: number; // chance an action is a poorly-judged one (any option that doesn't kill them outright)
  doubleTapMiss: number; // chance a double-tap comes out as a single tap
  misjudge: number; // relative error in how far they think a launch / fly-hold will carry them
}

export const PERSONAS: Persona[] = [
  {
    name: "speedrunner",
    weight: 0.1,
    thinkSec: [0.25, 0.6],
    aimNoise: 0.03,
    holdNoise: 0.08,
    greed: 0.1,
    economy: 0.9,
    flyiness: 0.8,
    aggression: 0.5,
    caution: 0.4,
    randomness: 0.2,
    fumble: 0.03,
    doubleTapMiss: 0.02,
    misjudge: 0.05,
  },
  {
    name: "casual",
    weight: 0.35,
    thinkSec: [0.9, 1.9],
    aimNoise: 0.09,
    holdNoise: 0.2,
    greed: 0.6,
    economy: 0.3,
    flyiness: 0.35,
    aggression: 0.3,
    caution: 1,
    randomness: 0.6,
    fumble: 0.15,
    doubleTapMiss: 0.1,
    misjudge: 0.22,
  },
  {
    name: "collector",
    weight: 0.2,
    thinkSec: [0.7, 1.5],
    aimNoise: 0.06,
    holdNoise: 0.15,
    greed: 1.6,
    economy: 0.5,
    flyiness: 0.4,
    aggression: 0.6,
    caution: 1,
    randomness: 0.4,
    fumble: 0.08,
    doubleTapMiss: 0.06,
    misjudge: 0.15,
  },
  {
    name: "cautious",
    weight: 0.15,
    thinkSec: [1.2, 2.4],
    aimNoise: 0.05,
    holdNoise: 0.12,
    greed: 0.3,
    economy: 0.6,
    flyiness: 0.2,
    aggression: 0.1,
    caution: 2.5,
    randomness: 0.3,
    fumble: 0.05,
    doubleTapMiss: 0.05,
    misjudge: 0.12,
  },
  {
    name: "newbie",
    weight: 0.2,
    thinkSec: [1.1, 2.6],
    aimNoise: 0.2,
    holdNoise: 0.3,
    greed: 0.5,
    economy: 0.1,
    flyiness: 0.25,
    aggression: 0.2,
    caution: 0.6,
    randomness: 0.9,
    fumble: 0.3,
    doubleTapMiss: 0.2,
    misjudge: 0.35,
  },
];

// Deterministic, stratified assignment: session i of n gets the persona
// whose cumulative-weight slice contains (i + 0.5) / n.
export function personaFor(i: number, n: number, personas: Persona[] = PERSONAS): Persona {
  const total = personas.reduce((a, p) => a + p.weight, 0);
  let u = ((i + 0.5) / n) * total;
  for (const p of personas) {
    u -= p.weight;
    if (u < 0) return p;
  }
  return personas[personas.length - 1];
}
