// The Farting Power / Holding Power economy, as one swappable object so
// each stage and difficulty can carry its own values and the balancing
// simulator (src/sim/) can try new ones. Both meters run 0-100.
import presets from "./difficulty-presets.json";

export interface Tuning {
  // Farting Power
  fartingStart: number; // at the start of a run and after each respawn
  fartingRegenPerSec: number;
  fartingWeakLaunchCost: number;
  fartingJumpCost: number;
  fartingAttackCost: number;
  fartingFlyCostPerSec: number; // while holding to fly
  beanFarting: number; // each bean tops up this much
  bananaFartingCost: number; // constipated: less gas
  // Holding Power
  holdingDrainPerSec: number; // at the start of the level
  holdingProgressExtra: number; // drain multiplier ramps up to 1 + this at the toilet
  holdingBeanCost: number;
  holdingBeansoupCost: number;
  holdingBanana: number;
  holdingRespawnMin: number; // a respawn never leaves you closer to an accident than this
}

// The values the game shipped with before difficulties existed, and what
// a stage plays with until it has been tuned.
export const DEFAULT_TUNING: Tuning = {
  fartingStart: 100,
  fartingRegenPerSec: 6,
  fartingWeakLaunchCost: 6,
  fartingJumpCost: 12,
  fartingAttackCost: 18,
  fartingFlyCostPerSec: 15,
  beanFarting: 5,
  bananaFartingCost: 10,
  holdingDrainPerSec: 1.1,
  holdingProgressExtra: 1.5,
  holdingBeanCost: 1,
  holdingBeansoupCost: 15,
  holdingBanana: 20,
  holdingRespawnMin: 40,
};

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

// What a stage's entry in difficulty-presets.json holds: per difficulty,
// only the values that differ from DEFAULT_TUNING.
export type StagePresets = Record<Difficulty, Partial<Tuning>>;

// Written by `npm run sim -- tune` (see src/sim/README.md), keyed by stage id.
export const PRESETS: Record<string, StagePresets> = presets;

export function isTuned(stageId: string): boolean {
  return stageId in PRESETS;
}

export function presetFor(stageId: string, difficulty: Difficulty): Tuning {
  return { ...DEFAULT_TUNING, ...PRESETS[stageId]?.[difficulty] };
}
