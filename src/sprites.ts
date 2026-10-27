import standingUrl from "./assets/player/standing.png";
import run1Url from "./assets/player/run1.png";
import run2Url from "./assets/player/run2.png";
import jump1Url from "./assets/player/jump1.png";
import jump2Url from "./assets/player/jump2.png";
import jump3Url from "./assets/player/jump3.png";
import jump4Url from "./assets/player/jump4.png";
import jump5Url from "./assets/player/jump5.png";
import jump6Url from "./assets/player/jump6.png";
import powerupUrl from "./assets/player/powerup.png";

export type SpriteName =
  | "standing"
  | "run1"
  | "run2"
  | "jump1"
  | "jump2"
  | "jump3"
  | "jump4"
  | "jump5"
  | "jump6"
  | "powerup";

const urls: Record<SpriteName, string> = {
  standing: standingUrl,
  run1: run1Url,
  run2: run2Url,
  jump1: jump1Url,
  jump2: jump2Url,
  jump3: jump3Url,
  jump4: jump4Url,
  jump5: jump5Url,
  jump6: jump6Url,
  powerup: powerupUrl,
};

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export const sprites: Record<SpriteName, HTMLImageElement> = Object.fromEntries(
  (Object.entries(urls) as [SpriteName, string][]).map(([name, url]) => [
    name,
    load(url),
  ]),
) as Record<SpriteName, HTMLImageElement>;

// Hand-drawn jump sequence: crouch, leap, tuck, flip, dive, recover — played
// once over the rise/fall of a jump and held on the last frame if still airborne.
export const JUMP_SEQUENCE: SpriteName[] = [
  "jump1",
  "jump2",
  "jump3",
  "jump4",
  "jump5",
  "jump6",
];
