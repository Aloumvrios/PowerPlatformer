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

export interface Level {
  widthPx: number;
  heightPx: number;
  playerStart: { x: number; y: number };
  platforms: Platform[];
  hazards: Hazard[];
  powerUps: PowerUp[];
  enemies: Enemy[];
  goal: Rect;
}

export interface ActivePower {
  kind: PowerKind;
  remainingSec: number;
}
