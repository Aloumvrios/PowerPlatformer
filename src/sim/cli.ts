// Entry point for `npm run sim -- <command>`; see src/sim/README.md.
// main() resolves to the process exit code.
import { STAGES } from "../level";
import { DEFAULT_TUNING, DIFFICULTIES, PRESETS, isTuned, presetFor, type Difficulty, type StagePresets, type Tuning } from "../tuning";
import { runSession, summarize, summarizeByPersona, type StagePopulationRunner, type Summary } from "./metrics";
import { PERSONAS, type Persona } from "./personas";
import { renderReport, type ReportEntry, type ReportStage } from "./report";
import { inBand, targetFor } from "./targets";
import { calibrateDrain, tune } from "./tune";

export { runSlice } from "./metrics";

export interface Io {
  log(msg: string): void;
  readFile(path: string): string | null;
  writeFile(path: string, text: string): void;
  runPopulation: StagePopulationRunner; // spread across worker threads
}

// The difficulty check, the tuner's final drain calibration and its final
// validation all use the same players, so a tune that lands on target
// passes its own check.
const CHECK_SEED = 1001;
const CHECK_SESSIONS = 1000;
const BASELINE_PATH = "docs/difficulty-baseline.json";
const PRESETS_PATH = "src/difficulty-presets.json";
const REPORT_PATH = "docs/difficulty-tuning.md";

interface BaselineNumbers {
  finishRate: number;
  holdingMedian: number | null;
  timeMedian: number | null;
  livesLost: number | null;
}

interface Baseline {
  generated: string;
  pace: number;
  sessions: number;
  seed: number;
  stages: Record<string, Partial<Record<Difficulty, BaselineNumbers>>>;
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

// Pace scales every persona's hesitation, to calibrate bot speed against
// real players' times. The pace a tune used is saved in the baseline, and
// the check reuses it.
function personasWithPace(pace: number): Persona[] {
  return PERSONAS.map((p) => ({ ...p, thinkSec: [p.thinkSec[0] * pace, p.thinkSec[1] * pace] as [number, number] }));
}

function pickStages(opt: string | undefined): typeof STAGES {
  if (!opt) return STAGES;
  const ids = opt.split(",").map((s) => s.trim()).filter(Boolean);
  for (const id of ids) if (!STAGES.some((s) => s.id === id)) throw new Error(`unknown stage "${id}" (known: ${STAGES.map((s) => s.id).join(", ")})`);
  return STAGES.filter((s) => ids.includes(s.id));
}

function pickDifficulties(opt: string | undefined): Difficulty[] {
  if (!opt) return DIFFICULTIES;
  const ds = opt.split(",").map((s) => s.trim()) as Difficulty[];
  for (const d of ds) if (!DIFFICULTIES.includes(d)) throw new Error(`unknown difficulty "${d}"`);
  return ds;
}

// --set beanShare=0.5,holdingDrainPerSec=1.6: values to try on top of the presets.
function parseSet(opt: string | undefined): Partial<Tuning> {
  const overrides: Partial<Tuning> = {};
  for (const kv of opt?.split(",") ?? []) {
    const [k, v] = kv.split("=");
    if (!(k in DEFAULT_TUNING) || v === undefined || isNaN(Number(v))) throw new Error(`bad --set "${kv}"`);
    overrides[k as keyof Tuning] = Number(v);
  }
  return overrides;
}

const label = (d: string) => d[0].toUpperCase() + d.slice(1);

async function entry(
  io: Io,
  stageId: string,
  name: string,
  tuning: Tuning,
  sessions: number,
  seed: number,
  personas: Persona[],
  difficulty?: Difficulty,
): Promise<ReportEntry> {
  const results = await io.runPopulation(tuning, stageId, sessions, seed, personas);
  return {
    name,
    tuning,
    summary: summarize(results),
    byPersona: summarizeByPersona(results),
    target: difficulty ? targetFor(stageId, difficulty) : undefined,
  };
}

// Every stage × difficulty with its preset, on the check's players.
async function measureAll(io: Io, personas: Persona[], presets: Record<string, StagePresets>): Promise<Record<string, ReportEntry[]>> {
  const out: Record<string, ReportEntry[]> = {};
  for (const stage of STAGES) {
    out[stage.id] = [];
    for (const d of DIFFICULTIES) {
      const tuning = { ...DEFAULT_TUNING, ...presets[stage.id]?.[d] };
      out[stage.id].push(await entry(io, stage.id, d, tuning, CHECK_SESSIONS, CHECK_SEED, personas, d));
    }
  }
  return out;
}

function toBaseline(measured: Record<string, ReportEntry[]>, pace: number): Baseline {
  const n = (s: Summary): BaselineNumbers => ({
    finishRate: round(s.finishRate, 3),
    holdingMedian: s.holdingMedian === null ? null : round(s.holdingMedian, 1),
    timeMedian: s.timeMedian === null ? null : round(s.timeMedian, 1),
    livesLost: s.meanLivesLostFirstAttempt === null ? null : round(s.meanLivesLostFirstAttempt, 2),
  });
  return {
    generated: new Date().toISOString().slice(0, 10),
    pace,
    sessions: CHECK_SESSIONS,
    seed: CHECK_SEED,
    stages: Object.fromEntries(
      Object.entries(measured).map(([id, entries]) => [id, Object.fromEntries(entries.map((e) => [e.name, n(e.summary)]))]),
    ),
  };
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function readBaseline(io: Io): Baseline | null {
  const text = io.readFile(BASELINE_PATH);
  return text ? (JSON.parse(text) as Baseline) : null;
}

function writeReportAndBaseline(io: Io, measured: Record<string, ReportEntry[]>, personas: Persona[], pace: number, command: string): void {
  const stages: ReportStage[] = STAGES.map((s) => ({
    title: `${s.name} (\`${s.id}\`)${isTuned(s.id) ? "" : " — not tuned, default values"}`,
    entries: measured[s.id],
  }));
  io.writeFile(
    REPORT_PATH,
    renderReport("Difficulty tuning", stages, { generated: new Date().toISOString().slice(0, 10), command, "players per stage and difficulty": CHECK_SESSIONS, pace }, personas) + "\n",
  );
  io.writeFile(BASELINE_PATH, JSON.stringify(toBaseline(measured, pace), null, 2) + "\n");
}

// The PR comment / job summary for `check`.
function renderCheck(measured: Record<string, ReportEntry[]>, baseline: Baseline | null, pace: number, presets: Record<string, StagePresets>): { markdown: string; failures: number } {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const num = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "—" : v.toFixed(d));
  const arrow = (before: string | null, after: string) => (before === null || before === after ? after : `${before} → ${after}`);
  let failures = 0;
  const rows: string[] = [];
  for (const stage of STAGES) {
    const tuned = stage.id in presets;
    for (const e of measured[stage.id]) {
      const d = e.name as Difficulty;
      const t = targetFor(stage.id, d);
      const b = baseline?.stages[stage.id]?.[d];
      const finishOk = inBand(e.summary.finishRate, t.finishRate);
      const holdOk = inBand(e.summary.holdingMedian, t.holding);
      const ok = tuned && finishOk && holdOk;
      if (!ok) failures++;
      const problems = [!tuned && "stage not tuned yet", !finishOk && "finish rate", !holdOk && "Holding Power"].filter(Boolean).join(", ");
      rows.push(
        `| ${stage.name} | ${label(d)} | ${arrow(b ? pct(b.finishRate) : null, pct(e.summary.finishRate))} ${finishOk ? "" : "⚠️"} | ${pct(t.finishRate.min)}–${pct(t.finishRate.max)} | ${arrow(b ? num(b.holdingMedian) : null, num(e.summary.holdingMedian))} ${holdOk ? "" : "⚠️"} | ${t.holding.min}–${t.holding.max} | ${arrow(b ? num(b.timeMedian) : null, num(e.summary.timeMedian))} | ${ok ? "✅" : `❌ ${problems}`} |`,
      );
    }
  }
  const total = STAGES.length * DIFFICULTIES.length;
  const out = [
    "<!-- difficulty-check -->",
    failures === 0 ? "### 🚽 Difficulty check: ✅ every stage is on target" : `### 🚽 Difficulty check: ❌ ${failures} of ${total} presets off target`,
    "",
    `${CHECK_SESSIONS} simulated players per stage and difficulty (pace ${pace}). ` +
      (baseline ? `"Before" numbers are from the last tune (${baseline.generated}, \`${BASELINE_PATH}\`).` : "No baseline yet, so there are no before numbers."),
    "",
    "| Stage | Difficulty | Finish rate | target | Holding Power (median) | target | Time to finish (median s) | |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ];
  if (failures > 0) {
    out.push(
      "**To fix:** run the **Difficulty tune** workflow (Actions → Difficulty tune → Run workflow) on this branch, then merge the PR it opens into this one. " +
        "Or adjust the level, or the targets in `src/sim/targets.ts` if the new numbers are what you want.",
      "",
    );
  }
  return { markdown: out.join("\n"), failures };
}

const HELP = `Usage: npm run sim -- <command> [options]

  check     The difficulty check run on PRs: simulate every stage x difficulty
            and fail (exit 1) if any preset is off its target band or a stage
            has no presets. Prints a markdown summary.
              --out sim-out/check.md   also write the summary to a file
              --update-baseline        also rewrite ${BASELINE_PATH} and ${REPORT_PATH}
  tune      Search preset values, writing ${PRESETS_PATH},
            ${REPORT_PATH} and ${BASELINE_PATH}.
              --stages stage1,stage2   just these stages (default: all)
              --only easy,hard         just these difficulties (others keep their values)
              --sessions 500           simulated players per candidate
              --iterations 10          search rounds per difficulty
              --set k=v,k=v            start the search from these values (e.g. found with evaluate --set)
  evaluate  Simulate every stage with its presets and the default values, and
            write sim-out/report.md + report.json.
              --sessions 1000
              --stages stage2 --only hard   just these
              --set beanShare=0.5,holdingDrainPerSec=1.6   try values on top of the presets
  trace     Print one line per simulated run, for eyeballing bot behaviour.
              --stage stage1 --difficulty medium --persona casual --runs 5
              --verbose   also print the bot's position every 2 simulated seconds

  Common:   --seed 1    --pace 1 (scales bot hesitation; >1 = slower players.
                        Defaults to the pace saved in the baseline.)`;

export async function main(argv: string[], io: Io): Promise<number> {
  const { cmd, opts } = parseArgs(argv);
  const baseline = readBaseline(io);
  const seed = Number(opts.seed ?? 1);
  const pace = Number(opts.pace ?? baseline?.pace ?? 1);
  const personas = personasWithPace(pace);
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

  if (cmd === "check") {
    const measured = await measureAll(io, personas, PRESETS);
    const { markdown, failures } = renderCheck(measured, baseline, pace, PRESETS);
    io.log(markdown);
    if (opts.out) io.writeFile(opts.out, markdown);
    if (opts["update-baseline"] === "true") {
      writeReportAndBaseline(io, measured, personas, pace, `npm run sim -- ${argv.join(" ")}`);
      io.log(`Wrote ${BASELINE_PATH} and ${REPORT_PATH}`);
    }
    return failures > 0 ? 1 : 0;
  }

  if (cmd === "tune") {
    const stages = pickStages(opts.stages);
    const only = pickDifficulties(opts.only);
    const sessions = Number(opts.sessions ?? 500);
    const iterations = Number(opts.iterations ?? 10);
    const presets: Record<string, StagePresets> = structuredClone(PRESETS);
    for (const stage of stages) {
      const run = (t: Tuning, n: number, s: number, ps: Persona[]) => io.runPopulation(t, stage.id, n, s, ps);
      const results = Object.fromEntries(DIFFICULTIES.map((d) => [d, presetFor(stage.id, d)])) as Record<Difficulty, Tuning>;
      // Medium first; Easy and Hard start from tuned Medium, so the three
      // stay recognisably the same game. A stage that's already tuned
      // starts from its current values, keeping re-tunes small.
      const order = (["medium", "easy", "hard"] as Difficulty[]).filter((d) => only.includes(d));
      for (const d of order) {
        io.log(`Tuning ${stage.id} / ${d}…`);
        const start = { ...(isTuned(stage.id) ? results[d] : d === "medium" ? DEFAULT_TUNING : results.medium), ...parseSet(opts.set) };
        const target = targetFor(stage.id, d);
        const r = await tune(start, start, target, { sessions, iterations, lambda: 5, seed, personas, regularize: 0.5 }, run, io.log);
        // Calibrated on the check's own players: the check is the merge
        // gate, and on a hard difficulty only a small share finish, so the
        // median moves a few points between different samples of players.
        results[d] = await calibrateDrain(r.tuning, target, CHECK_SESSIONS, CHECK_SEED, personas, run, io.log);
        io.log(`  ${stage.id} / ${d} done after ${r.evaluations} evaluations (${elapsed()})`);
      }
      const diff = (t: Tuning) =>
        Object.fromEntries((Object.keys(t) as (keyof Tuning)[]).filter((k) => t[k] !== DEFAULT_TUNING[k]).map((k) => [k, t[k]]));
      presets[stage.id] = { easy: diff(results.easy), medium: diff(results.medium), hard: diff(results.hard) };
    }
    io.writeFile(PRESETS_PATH, JSON.stringify(presets, null, 2) + "\n");
    io.log(`Checking every stage with ${CHECK_SESSIONS} players per difficulty…`);
    const measured = await measureAll(io, personas, presets);
    writeReportAndBaseline(io, measured, personas, pace, `npm run sim -- ${argv.join(" ")}`);
    const { markdown, failures } = renderCheck(measured, baseline, pace, presets);
    io.writeFile("sim-out/check.md", markdown);
    io.log(markdown);
    io.log(`Wrote ${PRESETS_PATH}, ${REPORT_PATH} and ${BASELINE_PATH} (${elapsed()})`);
    return failures > 0 ? 1 : 0;
  }

  if (cmd === "evaluate") {
    const sessions = Number(opts.sessions ?? 1000);
    const overrides = parseSet(opts.set);
    const only = pickDifficulties(opts.only);
    const stages: ReportStage[] = [];
    const json: Record<string, ReportEntry[]> = {};
    for (const stage of pickStages(opts.stages)) {
      const entries = opts.only ? [] : [await entry(io, stage.id, "default", DEFAULT_TUNING, sessions, seed, personas)];
      for (const d of only) entries.push(await entry(io, stage.id, d, { ...presetFor(stage.id, d), ...overrides }, sessions, seed, personas, d));
      for (const e of entries)
        io.log(
          `${stage.id} ${e.name.padEnd(7)} finish ${(e.summary.finishRate * 100).toFixed(0)}%  holding ${e.summary.holdingMedian?.toFixed(1) ?? "—"}  time ${e.summary.timeMedian?.toFixed(1) ?? "—"}s`,
        );
      stages.push({ title: `${stage.name} (\`${stage.id}\`)`, entries });
      json[stage.id] = entries;
    }
    io.writeFile("sim-out/report.md", renderReport("Simulated play", stages, { generated: new Date().toISOString(), "players per tuning": sessions, seed, pace }, personas));
    io.writeFile("sim-out/report.json", JSON.stringify(json, null, 2));
    io.log(`Wrote sim-out/report.md and sim-out/report.json (${elapsed()})`);
    return 0;
  }

  if (cmd === "trace") {
    const stageId = opts.stage ?? STAGES[0].id;
    pickStages(stageId);
    const d = (opts.difficulty ?? "medium") as Difficulty;
    const ps = opts.persona ? personas.filter((p) => p.name === opts.persona) : personas;
    const runs = Number(opts.runs ?? 3);
    for (const p of ps) {
      for (let i = 0; i < runs; i++) {
        const s = runSession(presetFor(stageId, d), stageId, p, seed * 100003 + i, opts.verbose ? io.log : undefined);
        s.attempts.forEach((a, n) =>
          io.log(
            `${p.name.padEnd(12)} #${i} try${n + 1} ${a.won ? "WON " : "lost"} ${a.time.toFixed(1).padStart(5)}s  holding ${a.finalHolding.toFixed(0).padStart(3)}  hops ${a.hops} jumps ${a.jumps} fly ${a.flightSec.toFixed(1)}s  beans ${a.beans} bananas ${a.bananas}  deaths ${a.deathLog.map((x) => `${x.cause}@${Math.round(x.x)}`).join(",") || "-"}`,
          ),
        );
      }
    }
    return 0;
  }

  io.log(HELP);
  return cmd === "help" ? 0 : 1;
}
