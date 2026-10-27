# PowerPlatformer

A 2D browser platformer about chaining temporary power-ups through a level.

**Keyboard**: Arrow keys / WASD to move, Up / W to jump, Space to attack, R to
restart. **Touch**: hold the left/right half of the screen to move, double-tap
to jump, swipe right to attack.

Power-ups (collected by running into their glowing orb):

- **Speed** (yellow, 6s) — faster movement
- **Jump** (blue, 6s) — higher jump
- **Shield** (cyan, 6s) — absorbs one hazard hit
- **Fly** (wing icon, 8s) — ignore gravity; Up/Down (or W/S) controls altitude
- **Bean soup** (bowl icon) — instantly refills Farting Power

**Farting Power** is a stamina meter (top HUD bar) that regenerates on its
own and is spent by every action — moving, jumping, attacking. At zero it
doesn't lock you out, but movement, jump height and attack range are all
weaker until it recovers (or you grab bean soup).

**Attack** swings in front of the player (the direction they're facing) and
defeats enemies caught in range; it's on a short cooldown.

Falling off the level, touching an enemy, or hitting a hazard without a
shield costs a life; running out of lives ends the run.

## Dev

```bash
npm install
npm run dev      # Vite dev server
npm run build    # type-check + production bundle
```
