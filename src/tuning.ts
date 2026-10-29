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
  beanShare: number; // 0..1: how many of the stage's beans are there (fewer = less gas to go round)
  // Holding Power
  holdingDrainPerSec: number; // at the start of the level
  holdingProgressExtra: number; // drain multiplier ramps up to 1 + this at the toilet
  holdingBeanCost: number;
  holdingBeansoupCost: number;
  holdingBanana: number;
  holdingRespawnMin: number; // a respawn never leaves you closer to an accident than this
  // Stalls: seconds each one holds you up if you don't tap to hurry
  stallNpcSec: number; // "do you have time to talk about pants insurance?"
  stallDoorSec: number; // unlocking a locked door
  stallShoesSec: number; // taking your shoes off before going into a house
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
  beanShare: 1,
  holdingDrainPerSec: 1.1,
  holdingProgressExtra: 1.5,
  holdingBeanCost: 1,
  holdingBeansoupCost: 15,
  holdingBanana: 20,
  holdingRespawnMin: 40,
  stallNpcSec: 4,
  stallDoorSec: 3,
  stallShoesSec: 2.5,
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

// Whether bean `i` is placed under a given beanShare. Golden-ratio spacing
// thins beans out evenly along the level rather than from one end.
export function beanPresent(i: number, share: number): boolean {
  return ((i * 0.6180339887) % 1) < share;
}
