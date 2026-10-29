// What each difficulty should feel like, measured on the simulated player
// base (first attempt = one run with all lives):
//   - finishRate: share of players who reach the toilet
//   - holding: median final Holding Power among those who do
// The difficulty check (`npm run sim -- check`, run on every PR) fails if
// any stage's preset falls outside these bands.
import type { Difficulty, Tuning } from "../tuning";

export interface Band {
  min: number;
  max: number;
}

export interface Target {
  holding: Band;
  finishRate: Band;
}

export const TARGETS: Record<Difficulty, Target> = {
  easy: { holding: { min: 80, max: 100 }, finishRate: { min: 0.8, max: 1 } },
  medium: { holding: { min: 25, max: 40 }, finishRate: { min: 0.5, max: 0.7 } },
  hard: { holding: { min: 10, max: 15 }, finishRate: { min: 0.15, max: 0.4 } },
};

// Per-stage exceptions to TARGETS, e.g. a deliberately tough final stage:
//   stage3: { hard: { holding: { min: 0, max: 8 }, finishRate: { min: 0.1, max: 0.3 } } },
export const STAGE_TARGETS: Record<string, Partial<Record<Difficulty, Target>>> = {};

export function targetFor(stageId: string, d: Difficulty): Target {
  return STAGE_TARGETS[stageId]?.[d] ?? TARGETS[d];
}

export function inBand(v: number | null, b: Band): boolean {
  return v !== null && v >= b.min && v <= b.max;
}

// The search space: which Tuning values the tuner may change, and within
// what range. Anything not listed keeps its starting value.
export const PARAM_BOUNDS: Partial<Record<keyof Tuning, [number, number]>> = {
  fartingStart: [30, 100],
  fartingRegenPerSec: [2, 12],
  fartingWeakLaunchCost: [2, 12],
  fartingJumpCost: [5, 25],
  fartingAttackCost: [8, 30],
  fartingFlyCostPerSec: [8, 40],
  beanFarting: [2, 12],
  bananaFartingCost: [0, 25],
  beanShare: [0, 1],
  holdingDrainPerSec: [0.2, 6],
  holdingProgressExtra: [0, 3],
  holdingBeanCost: [0, 3],
  holdingBeansoupCost: [0, 30],
  holdingBanana: [5, 40],
  holdingRespawnMin: [15, 60],
  stallNpcSec: [1.5, 8],
  stallDoorSec: [1, 6],
};
