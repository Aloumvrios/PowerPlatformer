// Markdown report of simulated play for a set of tunings.
import { DEFAULT_TUNING, type Tuning } from "../tuning";
import type { Summary } from "./metrics";
import type { Persona } from "./personas";
import type { Band, Target } from "./targets";

export interface ReportEntry {
  name: string;
  tuning: Tuning;
  summary: Summary;
  byPersona: Record<string, Summary>;
  target?: Target;
}

const num = (v: number | null, d = 1) => (v === null ? "—" : v.toFixed(d));
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const inBand = (v: number | null, b: Band) => (v !== null && v >= b.min && v <= b.max ? "✅" : "❌");

export interface ReportStage {
  title: string;
  entries: ReportEntry[];
}

export function renderReport(title: string, stages: ReportStage[], meta: Record<string, string | number>, personas: Persona[]): string {
  const out: string[] = [`# ${title}`, ""];
  out.push(Object.entries(meta).map(([k, v]) => `- **${k}:** ${v}`).join("\n"), "");
  out.push(
    "A player *finishes* if they reach the toilet on their first attempt (one run, all lives). " +
      "Final Holding Power is the median over those who finish. " +
      `Simulated player base: ${personas.map((p) => `${p.name} ${Math.round(p.weight * 100)}%`).join(", ")}.`,
    "",
  );
  for (const stage of stages) out.push(`## ${stage.title}`, "", ...renderStage(stage.entries));
  return out.join("\n");
}

function renderStage(entries: ReportEntry[]): string[] {
  const out: string[] = [];
  out.push("### Headline", "");
  out.push("| | " + entries.map((e) => e.name).join(" | ") + " |");
  out.push("|---|" + entries.map(() => "---").join("|") + "|");
  const row = (label: string, f: (e: ReportEntry) => string) => out.push(`| ${label} | ${entries.map(f).join(" | ")} |`);
  row("Finish rate (first attempt)", (e) => pct(e.summary.finishRate) + (e.target ? ` ${inBand(e.summary.finishRate, e.target.finishRate)} (${pct(e.target.finishRate.min)}–${pct(e.target.finishRate.max)})` : ""));
  row("Final Holding Power, median", (e) => num(e.summary.holdingMedian) + (e.target ? ` ${inBand(e.summary.holdingMedian, e.target.holding)} (${e.target.holding.min}–${e.target.holding.max})` : ""));
  row("Final Holding Power, p25–p75", (e) => `${num(e.summary.holdingP25)}–${num(e.summary.holdingP75)}`);
  row("Players finishing with Holding > 80", (e) => pct(e.summary.shareHoldingOver80));
  row("Finish within 3 attempts", (e) => pct(e.summary.eventualFinishRate));
  row("Attempts needed (eventual finishers)", (e) => num(e.summary.meanAttemptsToFinish, 2));
  row("Lives lost per first attempt", (e) => num(e.summary.meanLivesLostFirstAttempt, 2));
  row("Time to finish, median (s)", (e) => num(e.summary.timeMedian));
  row("Time to finish, p25–p75 (s)", (e) => `${num(e.summary.timeP25)}–${num(e.summary.timeP75)}`);
  row("Lowest Holding Power in run, median", (e) => num(e.summary.minHoldingMedian));
  row("Beans eaten (mean)", (e) => num(e.summary.beansMean));
  row("Bananas eaten (mean)", (e) => num(e.summary.bananasMean, 2));
  row("Seconds fart-flying (mean)", (e) => num(e.summary.flightSecMean));
  row("Seconds on an empty tank (mean)", (e) => num(e.summary.depletedSecMean));
  row("Times held up by stalls (mean)", (e) => num(e.summary.stallsMean, 2));
  row("Seconds held up by stalls (mean)", (e) => num(e.summary.stallSecMean));
  row("Enemies farted (mean)", (e) => num(e.summary.enemiesFartedMean, 2));
  row("Deaths: hit / fall / accident", (e) => `${e.summary.deathCauses.hit} / ${e.summary.deathCauses.fall} / ${e.summary.deathCauses.accident}`);
  out.push("");

  out.push("### Tuning values", "", "Bold = changed from the default.", "");
  const tuned = entries.filter((e) => e.name !== "default");
  out.push("| | default | " + tuned.map((e) => e.name).join(" | ") + " |");
  out.push("|---|---|" + tuned.map(() => "---").join("|") + "|");
  for (const k of Object.keys(DEFAULT_TUNING) as (keyof Tuning)[]) {
    out.push(`| \`${k}\` | ${DEFAULT_TUNING[k]} | ${tuned.map((e) => (e.tuning[k] === DEFAULT_TUNING[k] ? `${e.tuning[k]}` : `**${e.tuning[k]}**`)).join(" | ")} |`);
  }
  out.push("");

  for (const e of entries) {
    out.push(`### ${e.name}: by persona`, "");
    out.push("| persona | finish | holding (median) | time (median s) | lives lost | bananas | flying s | deaths hit/fall/accident |");
    out.push("|---|---|---|---|---|---|---|---|");
    for (const [name, s] of Object.entries(e.byPersona)) {
      out.push(
        `| ${name} | ${pct(s.finishRate)} | ${num(s.holdingMedian)} | ${num(s.timeMedian)} | ${num(s.meanLivesLostFirstAttempt, 2)} | ${num(s.bananasMean, 2)} | ${num(s.flightSecMean)} | ${s.deathCauses.hit}/${s.deathCauses.fall}/${s.deathCauses.accident} |`,
      );
    }
    const xs = Object.entries(e.summary.deathsByX).sort((a, b) => Number(a[0].split("-")[0]) - Number(b[0].split("-")[0]));
    if (xs.length) out.push("", `Where first-attempt deaths happen (level x): ${xs.map(([k, v]) => `${k}: ${v}`).join(", ")}`);
    out.push("");
  }
  return out;
}
