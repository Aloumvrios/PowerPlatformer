import { Game } from "./game";

const canvas = document.getElementById("game") as HTMLCanvasElement;

// Scales the canvas's CSS size to fit the viewport while keeping its
// intrinsic (960x540) aspect ratio, so getBoundingClientRect() — which
// input.ts relies on to map clicks/taps into canvas-local coordinates —
// always matches exactly what's drawn, with no clipped or letterboxed gap
// inside the element itself (centering for any leftover space is done by
// the surrounding flexbox in style.css instead).
function fitCanvas(): void {
  const aspect = canvas.width / canvas.height;
  let w = window.innerWidth;
  let h = w / aspect;
  if (h > window.innerHeight) {
    h = window.innerHeight;
    w = h * aspect;
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

fitCanvas();
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", fitCanvas);

new Game(canvas).start();
