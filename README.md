# PowerPlatformer

A 2D browser platformer about chaining temporary power-ups through a level.

Mouse and touch only — no keyboard:

- **Click / tap** the left or right half of the screen — one fart-propelled
  hop in that direction. Movement is discrete, not held: tap again for
  another hop.
- **Double-click / double-tap** — jump, launched toward that point. Aim
  up-and-over to arc across a gap, or steep to climb; the trajectory is
  always toward wherever you clicked relative to the character.
- **Right-click / swipe right** — attack.
- Click/tap anywhere to dismiss the death/win screen and restart.

Power-ups (collected by running into their glowing orb):

- **Speed** (yellow, 6s) — faster hops
- **Jump** (blue, 6s) — higher jump
- **Shield** (cyan, 6s) — absorbs one hazard hit
- **Fly** (wing icon, 8s) — gravity is mostly cancelled (slow float-fall);
  jump taps give an aimed flap even mid-air, instead of requiring solid
  ground
- **Bean soup** (bowl icon) — instantly refills Farting Power

**Farting Power** is a stamina meter (top HUD bar) that regenerates on its
own and is spent by every action — moving, jumping, attacking. At zero it
doesn't lock you out, but movement, jump height and attack range are all
weaker until it recovers (or you grab bean soup).

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
