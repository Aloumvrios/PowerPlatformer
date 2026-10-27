# PowerPlatformer

A 2D browser platformer about chaining temporary power-ups through a level.

- **Move**: Arrow keys / WASD
- **Jump**: Up / W / Space
- **Restart**: R (on death or after clearing the level)

Power-ups (collected by running into their glowing orb) last 6 seconds each:

- **Speed** (yellow) — faster movement
- **Jump** (blue) — higher jump
- **Shield** (cyan) — absorbs one hazard hit

Falling off the level or hitting a hazard without a shield costs a life;
running out of lives ends the run.

## Dev

```bash
npm install
npm run dev      # Vite dev server
npm run build    # type-check + production bundle
```
