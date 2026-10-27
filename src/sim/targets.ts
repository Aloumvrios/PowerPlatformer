// What each difficulty should feel like, measured on the simulated player
// base (first attempt = one run with all lives):
//   - finishRate: share of players who reach the toilet
//   - holding: median final Holding Power among those who do
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
  medium: { holding: { min: 30, max: 40 }, finishRate: { min: 0.5, max: 0.7 } },
  hard: { holding: { min: 5, max: 10 }, finishRate: { min: 0.2, max: 0.4 } },
};

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
  holdingDrainPerSec: [0.2, 6],
  holdingProgressExtra: [0, 3],
  holdingBeanCost: [0, 3],
  holdingBeansoupCost: [0, 30],
  holdingBanana: [5, 40],
  holdingRespawnMin: [15, 60],
};
