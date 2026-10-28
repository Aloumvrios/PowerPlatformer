# Balancing simulator

Plays the real game logic headless with scripted bot players, gathers
player-base metrics, and tunes the Easy / Medium / Hard presets.

```bash
npm run sim -- check      # the PR check: every stage × difficulty on target? (exit 1 if not)
npm run sim -- tune       # search presets → src/difficulty-presets.json + docs/difficulty-*.{md,json}
npm run sim -- evaluate   # report on the current presets → sim-out/report.md (+ .json)
npm run sim -- trace --stage stage1 --difficulty hard --persona newbie --runs 5 [--verbose]
npm run sim               # full option list
```

## In CI

- **Difficulty check** (`.github/workflows/difficulty-check.yml`) runs on every
  PR. If the PR touches anything that can change difficulty (levels, `game.ts`,
  `tuning.ts`, presets, the sim…), it runs `check`, posts/updates a PR comment
  with before → after numbers per stage and difficulty, and fails if any preset
  is off its target band or a stage has no presets. With "Difficulty check" set
  as a required status check on `main`, that blocks the merge.
- **Difficulty tune** (`.github/workflows/difficulty-tune.yml`) is a "Run
  workflow" button in the Actions tab: pick a branch (and optionally stages,
  difficulties, pace), and it runs `tune` and opens a PR into that branch with
  the new presets, report and baseline. Typical flow for a new stage: add it
  to `STAGES` in `src/level.ts` → open a PR → the check fails ("not tuned") →
  run Difficulty tune on the PR's branch → merge its PR into yours → green.

## Stages, presets and the baseline

- Presets are per stage: `src/difficulty-presets.json` is keyed by stage id
  (`STAGES` in `src/level.ts`), then difficulty. A stage without an entry plays
  with `DEFAULT_TUNING` and fails the check until tuned.
- Targets are the same for every stage unless overridden in `STAGE_TARGETS`
  (`targets.ts`).
- `docs/difficulty-baseline.json` holds the headline numbers from the last
  tune (or `check --update-baseline`), plus the bot pace used. The check shows
  them as "before", and reuses that pace. The check and the tuner's final
  validation use the same simulated players, so a fresh tune passes its own
  check and results are exactly reproducible.

## How it works

- **Same game, no browser.** `Game` runs headless (`new Game(null, { headless:
  true, input })`) and is advanced with `tick(1/60)`. Bots drive it through the
  same `InputSource` interface as the mouse/touchscreen (single tap, double tap,
  hold, swipe), so they're subject to every rule a player is. `scripts/sim.mjs`
  loads this TypeScript through Vite's SSR loader and stubs the few browser
  globals that modules touch at import time.
- **Bots** (`agent.ts`) imagine a fan of candidate taps, double-taps and fly-holds
  (including "fly up, then steer over") with a forward model of the game's
  physics (`forward.ts`, which mirrors `moveAndCollide()` and shares the enemy
  patrol code), score them by their persona — progress is measured along the
  level's route via `src/nav.ts`, so they follow winding stages — and perform
  the chosen one with aim, timing and judgement errors.
- **Debugging a stage:** if bots keep failing somewhere, `trace --verbose`
  prints each bot's position every 2 simulated seconds — a bot hopping in
  place at the same spot means it can't find the way on from there.
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
  drifting. A difficulty stops early once it has been on target for two
  rounds; the drain is then calibrated on the check's own players. The result is checked on fresh players before it's written.

## Trying ideas by hand

`evaluate --stages stage2 --only hard --seed 1001 --set k=v,k=v` simulates a
preset with some values changed, on the check's own players (seed 1001), and
prints the headline numbers — handy for testing a hunch ("fewer beans?",
"weaker banana?") in a minute or two. Once something lands on target, start a
tune from it with `tune --stages stage2 --only hard --set k=v,k=v`, which
validates it, calibrates the drain and writes the presets, report and baseline.
That's how stage 2 Hard got on target: the drain alone couldn't do it (finishers
who'd end nearly empty have an accident instead), but a weaker banana — the
last refill before the toilet — plus fewer beans did.

## Calibrating against real players

The bots are only as good as their resemblance to people. The cheapest check
is **time to finish**: play a few runs yourself (or watch someone), compare
your times with the report's "Time to finish" row, and if real players are
slower, re-run with `--pace` (e.g. `--pace 1.8` makes every bot hesitate 1.8×
longer) — then re-tune. Persona weights and traits in `personas.ts` are the
next things to adjust.
