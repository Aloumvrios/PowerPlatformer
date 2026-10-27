# Balancing simulator

Plays the real game logic headless with scripted bot players, gathers
player-base metrics, and tunes the Easy / Medium / Hard presets.

```bash
npm run sim -- tune       # search presets → src/difficulty-presets.json + docs/difficulty-tuning.md
npm run sim -- evaluate   # report on the current presets → sim-out/report.md (+ .json)
npm run sim -- trace --difficulty hard --persona newbie --runs 5   # one line per run
npm run sim               # full option list
```

## How it works

- **Same game, no browser.** `Game` runs headless (`new Game(null, { headless:
  true, input })`) and is advanced with `tick(1/60)`. Bots drive it through the
  same `InputSource` interface as the mouse/touchscreen (single tap, double tap,
  hold, swipe), so they're subject to every rule a player is. `scripts/sim.mjs`
  loads this TypeScript through Vite's SSR loader and stubs the few browser
  globals that modules touch at import time.
- **Bots** (`agent.ts`) imagine a fan of candidate taps, double-taps and fly-holds
  with a forward model of the game's physics (`forward.ts`), score them by their
  persona, and perform the chosen one with aim, timing and judgement errors.
- **Personas** (`personas.ts`) — speedrunner, casual, collector, cautious,
  newbie — differ in hesitation, aim, greed, how well they understand the two
  meters, how often they fly or attack, and how often they fumble. Their
  `weight`s define the "player base".
- **Metrics** (`metrics.ts`): a session is one simulated player making up to 3
  attempts (each a full run with all lives). A player *finishes* if their first
  attempt reaches the toilet. Also tracked: time, retries, lives lost, causes
  and places of death, beans/bananas, time flying, time on an empty tank, …
- **Targets** (`targets.ts`): per difficulty, a band for the first-attempt
  finish rate and for the median final Holding Power of those who finish —
  plus which `Tuning` values the search may change, and their ranges.
- **Search** (`tune.ts`): Medium is tuned first, starting from the default
  values; Easy and Hard start from tuned Medium. Each round tries a direct
  correction of the Holding Power drain plus a few random mutations, keeping
  the best; every candidate is scored on the same simulated players. A mild
  pull toward the starting values keeps knobs that don't matter from
  drifting. The result is checked on fresh players before it's written.

## Calibrating against real players

The bots are only as good as their resemblance to people. The cheapest check
is **time to finish**: play a few runs yourself (or watch someone), compare
your times with the report's "Time to finish" row, and if real players are
slower, re-run with `--pace` (e.g. `--pace 1.8` makes every bot hesitate 1.8×
longer) — then re-tune. Persona weights and traits in `personas.ts` are the
next things to adjust.
