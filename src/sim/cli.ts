// Entry point for `npm run sim -- <command>`; see src/sim/README.md.
import { DEFAULT_TUNING, DIFFICULTIES, PRESETS, type Difficulty, type Tuning } from "../tuning";
import { runSession, summarize, summarizeByPersona, type PopulationRunner } from "./metrics";
import { PERSONAS, type Persona } from "./personas";
import { renderReport, type ReportEntry } from "./report";
import { TARGETS } from "./targets";
import { calibrateDrain, tune } from "./tune";

export { runSlice } from "./metrics";

export interface Io {
  log(msg: string): void;
  writeFile(path: string, text: string): void;
  runPopulation: PopulationRunner; // spread across worker threads
}

function parseArgs(argv: string[]): { cmd: string; opts: Record<string, string> } {
  const [cmd = "help", ...rest] = argv;
  const opts: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) continue;
    const [k, v] = a.slice(2).split("=");
    opts[k] = v ?? (rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : "true");
  }
  return { cmd, opts };
}

// --pace scales every persona's hesitation, to calibrate bot speed
// against real players' times.
function personasWithPace(pace: number): Persona[] {
  return PERSONAS.map((p) => ({ ...p, thinkSec: [p.thinkSec[0] * pace, p.thinkSec[1] * pace] as [number, number] }));
}

async function entry(run: PopulationRunner, name: string, tuning: Tuning, sessions: number, seed: number, personas: Persona[], difficulty?: Difficulty): Promise<ReportEntry> {
  const results = await run(tuning, sessions, seed, personas);
  return {
    name,
    tuning,
    summary: summarize(results),
    byPersona: summarizeByPersona(results),
    target: difficulty ? TARGETS[difficulty] : undefined,
  };
}

const HELP = `Usage: npm run sim -- <command> [options]

  tune      Search tuning values for each difficulty and write them to
            src/difficulty-presets.json, plus docs/difficulty-tuning.md.
              --only easy,hard    tune just these (others keep their values)
              --sessions 500      simulated players per candidate
              --iterations 10     search rounds per difficulty
              --validate 1000     fresh players for drain calibration and the final check
  evaluate  Simulate the current presets (and the default tuning) and write
            sim-out/report.md + report.json.
              --sessions 1000
  trace     Print one line per simulated run, for eyeballing bot behaviour.
              --difficulty medium --persona casual --runs 5

  Common:   --seed 1    --pace 1 (scales bot hesitation; >1 = slower players)`;

export async function main(argv: string[], io: Io): Promise<void> {
  const { cmd, opts } = parseArgs(argv);
  const seed = Number(opts.seed ?? 1);
  const pace = Number(opts.pace ?? 1);
  const personas = personasWithPace(pace);
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

  if (cmd === "tune") {
    const only = (opts.only?.split(",") ?? DIFFICULTIES) as Difficulty[];
    const sessions = Number(opts.sessions ?? 500);
    const iterations = Number(opts.iterations ?? 10);
    const validate = Number(opts.validate ?? 1000);
    const results: Record<Difficulty, Tuning> = { ...PRESETS };
    // Medium first (anchored on the default values); Easy and Hard start
    // from tuned Medium, so the three stay recognisably the same game.
    const order = (["medium", "easy", "hard"] as Difficulty[]).filter((d) => only.includes(d));
    for (const d of order) {
      io.log(`Tuning ${d}…`);
      const start = d === "medium" ? DEFAULT_TUNING : results.medium;
      const r = await tune(start, start, TARGETS[d], { sessions, iterations, lambda: 5, seed, personas, regularize: 0.5 }, io.runPopulation, io.log);
      results[d] = await calibrateDrain(r.tuning, TARGETS[d], validate, seed + 500, personas, io.runPopulation, io.log);
      io.log(`  ${d} done after ${r.evaluations} evaluations (${elapsed()})`);
    }
    const diff = (t: Tuning) =>
      Object.fromEntries((Object.keys(t) as (keyof Tuning)[]).filter((k) => t[k] !== DEFAULT_TUNING[k]).map((k) => [k, t[k]]));
    io.writeFile(
      "src/difficulty-presets.json",
      JSON.stringify({ easy: diff(results.easy), medium: diff(results.medium), hard: diff(results.hard) }, null, 2) + "\n",
    );
    io.log(`Validating with ${validate} fresh players per difficulty…`);
    const entries: ReportEntry[] = [];
    for (const d of DIFFICULTIES) entries.push(await entry(io.runPopulation, d, results[d], validate, seed + 1000, personas, d));
    io.writeFile(
      "docs/difficulty-tuning.md",
      renderReport("Difficulty tuning", entries, { generated: new Date().toISOString().slice(0, 10), command: `npm run sim -- ${argv.join(" ")}`, "players per difficulty (validation)": validate, pace }, personas),
    );
    io.log(`Wrote src/difficulty-presets.json and docs/difficulty-tuning.md (${elapsed()})`);
    return;
  }

  if (cmd === "evaluate") {
    const sessions = Number(opts.sessions ?? 1000);
    const entries = [await entry(io.runPopulation, "default", DEFAULT_TUNING, sessions, seed, personas)];
    for (const d of DIFFICULTIES) entries.push(await entry(io.runPopulation, d, PRESETS[d], sessions, seed, personas, d));
    io.writeFile("sim-out/report.md", renderReport("Simulated play", entries, { generated: new Date().toISOString(), "players per tuning": sessions, seed, pace }, personas));
    io.writeFile("sim-out/report.json", JSON.stringify(entries, null, 2));
    io.log(`Wrote sim-out/report.md and sim-out/report.json (${elapsed()})`);
    return;
  }

  if (cmd === "trace") {
    const d = (opts.difficulty ?? "medium") as Difficulty;
    const ps = opts.persona ? personas.filter((p) => p.name === opts.persona) : personas;
    const runs = Number(opts.runs ?? 3);
    for (const p of ps) {
      for (let i = 0; i < runs; i++) {
        const s = runSession(PRESETS[d], p, seed * 100003 + i);
        s.attempts.forEach((a, n) =>
          io.log(
            `${p.name.padEnd(12)} #${i} try${n + 1} ${a.won ? "WON " : "lost"} ${a.time.toFixed(1).padStart(5)}s  holding ${a.finalHolding.toFixed(0).padStart(3)}  hops ${a.hops} jumps ${a.jumps} fly ${a.flightSec.toFixed(1)}s  beans ${a.beans} bananas ${a.bananas}  deaths ${a.deathLog.map((x) => `${x.cause}@${Math.round(x.x)}`).join(",") || "-"}`,
          ),
        );
      }
    }
    return;
  }

  io.log(HELP);
}
