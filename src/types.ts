export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PowerKind = "speed" | "jump" | "shield" | "fly";

export interface PowerUp extends Rect {
  kind: PowerKind;
  collected: boolean;
}

export interface Hazard extends Rect {}

export interface Platform extends Rect {}

export interface Level {
  widthPx: number;
  heightPx: number;
  playerStart: { x: number; y: number };
  platforms: Platform[];
  hazards: Hazard[];
  powerUps: PowerUp[];
  goal: Rect;
}

export interface ActivePower {
  kind: PowerKind;
  remainingSec: number;
}
