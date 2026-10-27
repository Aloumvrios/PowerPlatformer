import "@fontsource/patrick-hand";
import "@fontsource/permanent-marker";
import { Game } from "./game";
import { unlockAudio } from "./audio";
import { VIEW_H, VIEW_W } from "./view";

const canvas = document.getElementById("game") as HTMLCanvasElement;

// Scales the canvas's CSS size to fit the viewport while keeping the game's
// 960x540 aspect ratio, so getBoundingClientRect() — which input.ts relies
// on to map clicks/taps into game coordinates — always matches exactly
// what's drawn, with no clipped or letterboxed gap inside the element
// itself (centering for any leftover space is done by the surrounding
// flexbox in style.css instead).
//
// The backing store (canvas.width/height) is then sized to that CSS size
// times devicePixelRatio, so the hand-drawn art and pencil lines render
// crisp instead of being bitmap-scaled. game.ts draws in 960x540 logical
// units and scales by canvas.width / VIEW_W.
function fitCanvas(): void {
  const aspect = VIEW_W / VIEW_H;
  let w = window.innerWidth;
  let h = w / aspect;
  if (h > window.innerHeight) {
    h = window.innerHeight;
    w = h * aspect;
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
}

fitCanvas();
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", fitCanvas);

// Audio may only start from a user gesture; any press counts.
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("pointerup", unlockAudio);

// Canvas text doesn't trigger web-font loading on its own everywhere.
void document.fonts?.load("20px 'Patrick Hand'");
void document.fonts?.load("20px 'Permanent Marker'");

const game = new Game(canvas);
game.start();

// Dev-only handle for poking at game state from Playwright / the console.
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
