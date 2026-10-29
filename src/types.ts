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

// Spikes. `dir` is the way they point (default "up", i.e. on a floor);
// "down" hangs from a ceiling, "left"/"right" stick out of a wall.
export interface Hazard extends Rect {
  dir?: "up" | "down" | "left" | "right";
}

export interface Platform extends Rect {}

// Patrols back and forth between minX and maxX — or, with axis "y",
// up and down with minX/maxX meaning the top and bottom y.
export interface Enemy extends Rect {
  minX: number;
  maxX: number;
  speed: number;
  dir: 1 | -1;
  alive: boolean;
  axis?: "x" | "y";
  kind?: "urchin" | "crawler"; // floating spiky ball (default) / ground crawler
}

// A spot that holds the player up for a few seconds while Holding Power keeps
// draining — tapping hurries it along. Each happens once per run.
// "npc": a pants-insurance salesperson; the rect is where they'll catch you,
// and only a player standing on the ground gets caught, so jumping or flying
// past avoids them (at a gas cost).
// "door": a locked door, solid until unlocked; standing against it (on the
// ground) starts unlocking it. Once open it stays open.
// "shoes": a house's doormat — shoes come off before going in. Like the
// salesperson, it only catches a player on the ground; the shoes stay on the
// mat afterwards.
export interface Stall extends Rect {
  kind: "npc" | "door" | "shoes";
  done: boolean;
}

// Non-colliding scenery drawn behind everything else.
export interface Decor extends Rect {
  kind: "hall" | "house" | "wc" | "door";
}

// Small collectible beans: each tops up a little Farting Power and counts
// toward the end-of-level tally.
export interface Bean extends Rect {
  collected: boolean;
}

// Bananas refill Holding Power (they're constipating) at the cost of a
// little Farting Power. Like beans, they stay eaten after a respawn.
export interface Banana extends Rect {
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
  platforms: Platform[]; // one-way: you jump up through them and land on top
  solids: Rect[]; // solid terrain: walls, floors and ceilings you can't pass through
  hazards: Hazard[];
  powerUps: PowerUp[];
  enemies: Enemy[];
  beans: Bean[];
  bananas: Banana[];
  checkpoints: Checkpoint[];
  hints: Hint[];
  decor: Decor[];
  stalls: Stall[];
  goal: Rect; // drawn as the toilet
}

export interface ActivePower {
  kind: PowerKind;
  remainingSec: number;
}

// A playable stage: an id that keys its difficulty presets and saved best
// times (keep it stable once shipped), a display name, and its level.
export interface Stage {
  id: string;
  name: string;
  level: Level;
}
