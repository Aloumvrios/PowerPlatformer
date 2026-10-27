export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PowerKind = "speed" | "jump" | "shield" | "fly";

// Pickups include the timed PowerKinds plus bean soup, an instant
// Farting Power refill with no timer of its own.
export type PickupKind = PowerKind | "beansoup";

export interface PowerUp extends Rect {
  kind: PickupKind;
  collected: boolean;
}

export interface Hazard extends Rect {}

export interface Platform extends Rect {}

export interface Enemy extends Rect {
  minX: number;
  maxX: number;
  speed: number;
  dir: 1 | -1;
  alive: boolean;
}

// Small collectible beans: each tops up a little Farting Power and counts
// toward the end-of-level tally.
export interface Bean extends Rect {
  collected: boolean;
}

// Touching one makes it the respawn point for the rest of the run.
export interface Checkpoint extends Rect {
  reached: boolean;
}

// Pencilled-on instructions written into the level itself. `mouseText`
// replaces `text` when the player is on a mouse rather than a touchscreen.
export interface Hint {
  x: number;
  y: number;
  text: string;
  mouseText?: string;
}

export interface Level {
  widthPx: number;
  heightPx: number;
  playerStart: { x: number; y: number };
  platforms: Platform[];
  hazards: Hazard[];
  powerUps: PowerUp[];
  enemies: Enemy[];
  beans: Bean[];
  checkpoints: Checkpoint[];
  hints: Hint[];
  goal: Rect; // drawn as the toilet
}

export interface ActivePower {
  kind: PowerKind;
  remainingSec: number;
}
