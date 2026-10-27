// Balancing simulator launcher: `npm run sim -- <command> [options]`.
// See src/sim/README.md.
//
// Bundles src/sim/cli.ts for Node with Vite (so the game's asset imports
// and import.meta.glob resolve), then runs simulated sessions on a pool of
// worker threads, one per CPU core.
import { build } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

// input.ts adds pointer listeners and sprites.ts creates Image elements as
// soon as they're imported; headless runs never use either.
globalThis.window ??= { addEventListener() {}, matchMedia: () => ({ matches: false }) };
globalThis.document ??= { addEventListener() {}, fullscreenEnabled: false };
globalThis.Image ??= class {
  src = "";
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
};

if (!isMainThread) {
  const sim = await import(workerData.bundle);
  parentPort.on("message", ({ id, tuning, sessions, seed, personas, from, to }) => {
    parentPort.postMessage({ id, results: sim.runSlice(tuning, sessions, seed, personas, from, to) });
  });
} else {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = resolve(root, "sim-out/build");
  await build({
    root,
    logLevel: "warn",
    build: { ssr: "src/sim/cli.ts", outDir, emptyOutDir: true, copyPublicDir: false },
  });
  const bundle = pathToFileURL(resolve(outDir, "cli.js")).href;
  const sim = await import(bundle);

  const workers = Array.from(
    { length: Math.max(1, availableParallelism()) },
    () => new Worker(fileURLToPath(import.meta.url), { workerData: { bundle } }),
  );
  let nextId = 0;
  const pending = new Map();
  for (const w of workers) {
    w.on("message", ({ id, results }) => {
      pending.get(id)(results);
      pending.delete(id);
    });
    w.on("error", (e) => {
      console.error(e);
      process.exit(1);
    });
  }
  const call = (w, msg) =>
    new Promise((res) => {
      const id = nextId++;
      pending.set(id, res);
      w.postMessage({ id, ...msg });
    });

  // Same results as running every session in order on one thread.
  const runPopulation = async (tuning, sessions, seed, personas) => {
    const chunk = Math.ceil(sessions / workers.length);
    const parts = await Promise.all(
      workers.map((w, i) => {
        const from = i * chunk;
        const to = Math.min(sessions, from + chunk);
        return from < to ? call(w, { tuning, sessions, seed, personas, from, to }) : Promise.resolve([]);
      }),
    );
    return parts.flat();
  };

  try {
    await sim.main(process.argv.slice(2), {
      log: (msg) => process.stdout.write(msg + "\n"),
      writeFile: (path, text) => {
        const full = resolve(root, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, text);
      },
      runPopulation,
    });
  } finally {
    await Promise.all(workers.map((w) => w.terminate()));
  }
}
