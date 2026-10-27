# CLAUDE.md

Guidance for working in this repo — read this before making changes, and keep it
accurate as conventions change.

## What this is

**PowerPlatformer** — a 2D browser platformer about chaining temporary power-ups
through a hand-built level. Built with Vite + TypeScript + raw HTML5 Canvas 2D (no
game framework). Controls are **mouse/touch only, no keyboard** — this was an
explicit, repeated design decision; don't reintroduce keyboard input.

Theme: "Farting Power" — a stamina resource that fuels every action (movement,
jumping, attacking, flying), visualized as fart-propulsion effects. The player
sprite is a hand-drawn stick figure (see "Sprite pipeline" below), not procedural
art.

Deployed via GitHub Pages at `https://aloumvrios.github.io/PowerPlatformer/`,
auto-deployed by `.github/workflows/deploy-pages.yml` on every push to `main`
(`npm run build` → upload `dist/` → Pages). There is no separate staging step —
pushing to `main` ships.

## Stack & file layout

- `src/main.ts` — entry point. Creates the canvas, wires up `fitCanvas()` (see
  "Canvas scaling" below), starts `Game`.
- `src/game.ts` — the entire game: the `Game` class, its `update(dt)`/`render()`
  loop, all physics/economy constants, HUD updates, sprite selection. This file is
  intentionally a monolith; it has grown large through iterative feature work
  rather than being split into systems, and that's fine for this project's size —
  don't split it up preemptively.
- `src/input.ts` — translates raw Pointer Events into the game's four discrete
  input primitives (click target, jump target, attack direction, fly target). See
  "Controls model" below. Game logic never touches `PointerEvent` directly.
- `src/level.ts` — one hand-built `Level` object (`level1`): platforms, hazards,
  enemies, power-up placements. No level editor or loader — edit the array
  literals directly.
- `src/sprites.ts` — imports every player sprite PNG, exposes `sprites: Record<SpriteName, HTMLImageElement>` and the `JUMP_SEQUENCE` animation order.
- `src/types.ts` — shared interfaces (`Rect`, `Level`, `PowerUp`, `Enemy`, etc.).
- `src/style.css` — the whole page is just the HUD + the canvas, no other UI.
- `src/assets/player/*.png` — hand-drawn sprite frames (see pipeline below).

## Commands

```bash
npm install
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # tsc -b (type-check) + production bundle to dist/
npm run preview  # serve the built dist/ locally
```

There is **no test suite** (no Vitest/Jest/Playwright config in the repo). See
"Verifying changes" below for how this project actually gets tested.

## Controls model (`src/input.ts`)

Everything is driven by the Pointer Events API (`pointerdown`/`pointermove`/
`pointerup`/`pointercancel`), which unifies mouse and touch. A press is
disambiguated into exactly one of:

- **Single click/tap** → a short aimed "weak launch" toward the click point
  (`consumeClickTarget()`), direction computed relative to the player's on-screen
  position, not a fixed screen side.
- **Double-click/tap** (within `DOUBLE_CLICK_MS` and `DOUBLE_MAX_DX`) → a full-
  strength aimed launch/jump (`consumeJump()`).
- **Press and hold** past `HOLD_THRESHOLD_MS` without drifting past
  `HOLD_STATIONARY_PX` → flight, read continuously via `getFlyTarget()` (not
  consumed — it's live state for as long as the pointer is held).
- **Right-click, or a touch swipe** (`SWIPE_MIN_DX`/`SWIPE_MAX_DY`/`SWIPE_MAX_MS`)
  → an attack, resolved to a direction (`1 | -1`) via `consumeAttack(playerScreenX)`.
  A swipe already carries its own direction; a right-click's direction is resolved
  against the player's current screen x (right-click left of the player attacks
  left, right of the player attacks right) — `input.ts` doesn't know the player's
  position, so that resolution happens in `game.ts` at call time, not at click
  time.

All positions `input.ts` hands back are in **canvas-local pixel space**
(`canvasLocalPoint()`, using `canvas.width`/`canvas.height`, the internal
attributes — not CSS pixels), so `game.ts` can compare them directly against
`player.x`/`player.y` without any further conversion.

## Canvas scaling — a gotcha, read before touching layout

The canvas has a **fixed internal resolution** (960×540, set via its `width`/
`height` HTML attributes in `index.html`) but is **scaled to fit the real
viewport** by `main.ts`'s `fitCanvas()`, which sets `canvas.style.width/height` in
px on load and on `resize`/`orientationchange`, preserving the 960:540 aspect
ratio. `style.css` centers the (possibly letterboxed) canvas via flexbox on
`body`.

**This matters because `input.ts`'s `canvasLocalPoint()` relies on
`getBoundingClientRect()` exactly matching what's actually drawn.** If you ever
change canvas sizing to something like `width: 100vw; height: 100vh; object-fit:
contain;`, the element's layout box (what `getBoundingClientRect()` returns) and
the actual rendered/letterboxed content area diverge — `object-fit` scales the
*painted* content without shrinking the box, so click/tap coordinates go wrong in
exactly the regions that matter most (near screen edges). Keep canvas sizing as
explicit JS-computed pixel dimensions, not CSS-only `object-fit`.

This also used to break mobile progression: before `fitCanvas()` existed, the
canvas rendered at its raw 960×540 size unscaled, so on a narrow phone screen it
overflowed and got clipped by `overflow: hidden` on `html, body` — including
clipping off the player's spawn point — while the camera (which scrolls against
the full 960px-wide internal viewport in `game.ts`'s `update()`) only caught up
long after the player had already walked past what was visible. It read as "the
camera doesn't follow" / "the player gets stuck at the edge of the screen".

## The `Game.update(dt)` loop (`src/game.ts`)

Order of operations matters and has bitten this project before:

1. Decay active timed power-ups.
2. **Regenerate Farting Power first**, before any action this frame spends it.
   This ordering is deliberate — see "Farting Power" below.
3. Resolve flight (`getFlyTarget()`), else resolve buffered weak-launch/jump
   requests, else apply gravity.
4. Attack cooldown/flash decay, `consumeAttack()`.
5. Integrate position, clamp to level bounds, run platform collision.
6. Hazards, enemies, power-up pickups, goal, fall-death.
7. Clamp camera, update HUD.

### Farting Power (the stamina economy)

A 0–100 meter that regenerates passively (`FARTING_REGEN_PER_SEC`) and is spent by
every action. **Design rule: depletion is a soft penalty everywhere except
flying** — weak launches, jumps and attacks just get weaker (`DEPLETED_*_MULT`)
when it hits 0, they never lock you out. Flying is the one hard stop: running out
mid-flight forces an immediate landing, even if the pointer is still held.

Getting that hard stop to actually trigger required two fixes, both still load-
bearing:

- **Regen must run before costs are applied in the same frame's `update()`**, not
  after. Otherwise a cost that clamps the meter to exactly 0 gets topped back up
  by that same frame's regen before the *next* frame's depletion check ever sees
  the 0 — the meter visibly plateaus just above 0 and forced-landing never fires.
- **`flightExhausted` is sticky**, not a plain `fartingPower <= 0` check. It's set
  `true` once depletion happens mid-flight, and only cleared when the pointer is
  released (`getFlyTarget() === null`). A non-sticky check would let a single
  frame's regen tick re-engage flight immediately after exhaustion, since regen
  runs before the check each frame.

If you touch this again and the hard-stop regresses, it's almost certainly one of
these two orderings.

### Sprite selection

`currentSpriteName()` is a priority chain (attack flash > powerup flash > flying >
weak-launch hop > fly-power-up jump-flap > jump sequence by air time > standing).
`renderPlayerSprite()` flips the sprite horizontally via
`ctx.scale(-1, 1)` when `player.facing === -1` — this is also what makes the
attack-direction fix visible (facing is set from the resolved attack direction,
not just movement).

## Sprite pipeline (hand-drawn art)

The user supplies new player poses as **photos of hand-drawn stick figures on
paper**. The recipe used throughout this project to turn one into a usable sprite:

1. `PIL.ImageOps.exif_transpose` to fix phone camera rotation.
2. Overlay a coordinate grid on a preview to find the figure's bounding box by
   eye.
3. Crop to that box with a little padding.
4. Grayscale → alpha-threshold to key out the white paper background (typical
   thresholds used so far: white ≈142, black ≈45 — tune per photo's lighting/
   contrast), keeping ink as solid color (`(20, 20, 26)` used so far) with
   anti-aliased edges.
5. Downscale to roughly 300–420px target width.
6. Save as RGBA PNG into `src/assets/player/`, add the import + `SpriteName`
   entry in `src/sprites.ts`.
7. Preview against a dark background (not just a bare checkerboard) before
   committing — thresholding artifacts are easy to miss otherwise.

## Verifying changes

There's no automated test suite. Changes are verified by running the Vite dev
server and driving the page with **Playwright** (headless Chromium, already
available in this environment — see the top-level system docs on the pre-
installed browser): `page.mouse`/`page.touchscreen` to simulate input,
`page.screenshot()` to capture state, occasionally CDP `Input.dispatchTouchEvent`
for multi-touch gestures. Prefer `devices['iPhone 12']` (or similar) contexts when
checking anything mobile/camera/viewport-related, as in the canvas-scaling fix.

**Lesson learned the hard way**: don't eyeball downscaled/thumbnail screenshots to
judge small movements — a real ~50px player shift was once misdiagnosed as "the
player isn't moving at all" purely from misjudging a thumbnail. When a visual diff
is subtle, either crop/zoom the screenshot before viewing it, or pixel-diff two
screenshots (`PIL.ImageChops.difference`) to confirm something actually changed
before chasing a phantom bug.
