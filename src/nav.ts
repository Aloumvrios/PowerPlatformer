// How far the player is from the toilet *along the level*, not in a straight
// line: a distance field over the open space (anything not inside a solid),
// spread out from the goal. In a winding level (stage 2 goes right, up a
// shaft and back left) the straight-line or x distance would say the player
// is getting further away while they're making progress.
//
// Used for Holding Power's "the closer you get, the faster it drains" ramp,
// and by the balancing bots to judge which move gets them furthest.
import type { Level } from "./types";

const CELL = 16;

interface NavGrid {
  cols: number;
  rows: number;
  dist: Float32Array; // px to the goal, Infinity where blocked/unreachable
  startDist: number;
}

const cache = new WeakMap<Level, NavGrid>();

// Half-open bounds, so a cell centre lying exactly on the seam between two
// touching solids still counts as blocked (a strict test leaks through
// seams), and anything past the level's edge is blocked too.
function blockedAt(x: number, y: number, level: Level): boolean {
  if (x >= level.widthPx || y >= level.heightPx) return true;
  for (const s of level.solids) if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true;
  return false;
}

function build(level: Level): NavGrid {
  const cols = Math.ceil(level.widthPx / CELL);
  const rows = Math.ceil(level.heightPx / CELL);
  const n = cols * rows;
  const blocked = new Uint8Array(n);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) blocked[r * cols + c] = blockedAt((c + 0.5) * CELL, (r + 0.5) * CELL, level) ? 1 : 0;

  const dist = new Float32Array(n).fill(Infinity);
  // Dijkstra over 8-connected cells, seeded from every open cell touching the goal.
  const heap: number[] = [];
  const push = (i: number) => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (dist[heap[parent]] <= dist[heap[k]]) break;
      [heap[parent], heap[k]] = [heap[k], heap[parent]];
      k = parent;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && dist[heap[l]] < dist[heap[m]]) m = l;
        if (r < heap.length && dist[heap[r]] < dist[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const g = level.goal;
  for (let r = Math.floor((g.y - CELL) / CELL); r <= Math.floor((g.y + g.h + CELL) / CELL); r++)
    for (let c = Math.floor((g.x - CELL) / CELL); c <= Math.floor((g.x + g.w + CELL) / CELL); c++) {
      if (r < 0 || c < 0 || r >= rows || c >= cols || blocked[r * cols + c]) continue;
      dist[r * cols + c] = 0;
      push(r * cols + c);
    }
  const done = new Uint8Array(n);
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    const r = Math.floor(i / cols);
    const c = i % cols;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const j = rr * cols + cc;
        // No cutting diagonally between two blocked cells.
        if (blocked[j] || (dr && dc && (blocked[r * cols + cc] || blocked[rr * cols + c]))) continue;
        const d = dist[i] + (dr && dc ? CELL * Math.SQRT2 : CELL);
        if (d < dist[j]) {
          dist[j] = d;
          push(j);
        }
      }
  }
  const grid = { cols, rows, dist, startDist: 0 };
  grid.startDist = lookup(grid, level.playerStart.x + 16, level.playerStart.y + 22);
  return grid;
}

function lookup(grid: NavGrid, x: number, y: number): number {
  const c0 = Math.max(0, Math.min(grid.cols - 1, Math.floor(x / CELL)));
  const r0 = Math.max(0, Math.min(grid.rows - 1, Math.floor(y / CELL)));
  const d = grid.dist[r0 * grid.cols + c0];
  if (d !== Infinity) return d;
  // Right against a wall: use the nearest open cell.
  let best = Infinity;
  for (let rad = 1; rad <= 3 && best === Infinity; rad++)
    for (let r = r0 - rad; r <= r0 + rad; r++)
      for (let c = c0 - rad; c <= c0 + rad; c++) {
        if (r < 0 || c < 0 || r >= grid.rows || c >= grid.cols) continue;
        best = Math.min(best, grid.dist[r * grid.cols + c] + rad * CELL);
      }
  return best;
}

function gridFor(level: Level): NavGrid {
  let g = cache.get(level);
  if (!g) {
    g = build(level);
    cache.set(level, g);
  }
  return g;
}

// Px from (x, y) to the goal along the level's open space.
export function distanceToGoal(level: Level, x: number, y: number): number {
  return lookup(gridFor(level), x, y);
}

// 0 at the start, 1 at the toilet, measured along the level.
export function routeProgress(level: Level, x: number, y: number): number {
  const g = gridFor(level);
  const d = lookup(g, x, y);
  if (!isFinite(d) || g.startDist <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - d / g.startDist));
}
