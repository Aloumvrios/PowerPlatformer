# PowerPlatformer

A 2D browser platformer about chaining temporary power-ups through a level.

Mouse and touch only — no keyboard:

- **Click / tap** — a light fart-propelled launch toward that point, aimed
  relative to the character (not a fixed screen side). Movement is
  discrete, not held: click again for another launch.
- **Double-click / double-tap** — a full-strength launch toward that point.
  Aim up-and-over to arc across a gap, or steep to climb.
- **Press and hold** (don't release) — fly, ascending at a constant rate
  for as long as it's held, regardless of the pointer's vertical
  position. Only which side of the character the pointer is on (left or
  right) steers horizontally while flying — how far it is doesn't matter.
  Costs Farting Power continuously while held — 2.5x a single click's
  cost every second — and unlike every other action, this one isn't a
  soft penalty: running out mid-flight forces a landing immediately, even
  if you keep holding. Let go and hold again once it's recovered.
- **Right-click / swipe right** — attack.
- Click/tap anywhere to dismiss the death/win screen and restart.

Power-ups (collected by running into their glowing orb):

- **Speed** (yellow, 6s) — faster light (single-click) launches
- **Jump** (blue, 6s) — stronger double-click launches
- **Shield** (cyan, 6s) — absorbs one hazard hit
- **Fly** (wing icon, 8s) — on top of the hold-to-fly ability everyone has,
  gravity is also mostly cancelled while grounded-or-not, and double-click
  works as an ascend flap even mid-air
- **Bean soup** (bowl icon) — instantly refills Farting Power

**Farting Power** is a stamina meter (top HUD bar) that regenerates on its
own and is spent by every action — moving, jumping, attacking, flying. At
zero, launches and attacks don't lock you out, just get weaker until it
recovers (or you grab bean soup) — flying is the one exception, since
running out mid-air forces an immediate landing.

**Attack** is a fart blast in front of the player (the direction they're
facing) and defeats enemies caught in range; it's on a short cooldown.

Falling off the level, touching an enemy, or hitting a hazard without a
shield costs a life; running out of lives ends the run.

## Dev

```bash
npm install
npm run dev      # Vite dev server
npm run build    # type-check + production bundle
```
