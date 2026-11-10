export type Cost = { label: string; count: number };
export type Req = { name: string; level: number };
export type Step = { level: number; timeSec: number; power: number; costs: Cost[]; requires: Req[] };
export type Building = { id: string; name: string; image: string; max: number; powerMax: number; steps: Step[] };

export type Totals = { costs: Cost[]; timeSec: number; power: number };

const RANK: Record<string, number> = { Food: 0, Metal: 1, Oil: 2 };
const rank = (l: string) => RANK[l] ?? 50;
export const sortLabels = (a: string, b: string) => rank(a) - rank(b) || a.localeCompare(b);

export function emptyTotals(): Totals {
  return { costs: [], timeSec: 0, power: 0 };
}

export function addTotals(a: Totals, b: Totals): Totals {
  const m = new Map<string, number>();
  for (const c of [...a.costs, ...b.costs]) m.set(c.label, (m.get(c.label) ?? 0) + c.count);
  return {
    costs: [...m].sort((x, y) => sortLabels(x[0], y[0])).map(([label, count]) => ({ label, count })),
    timeSec: a.timeSec + b.timeSec,
    power: a.power + b.power,
  };
}

/** Steps for levels from+1..to */
export function stepsBetween(b: Building, from: number, to: number): Step[] {
  return b.steps.filter((s) => s.level > from && s.level <= to);
}

export function rangeTotals(b: Building, from: number, to: number): Totals {
  let t = emptyTotals();
  for (const s of stepsBetween(b, from, to)) t = addTotals(t, { costs: s.costs, timeSec: s.timeSec, power: s.power });
  return t;
}

/** Highest required level per building name across the steps. */
export function collectRequires(steps: Step[]): Req[] {
  const best = new Map<string, number>();
  for (const s of steps) for (const r of s.requires) if (r.level > (best.get(r.name) ?? -1)) best.set(r.name, r.level);
  return [...best].sort((a, b) => a[0].localeCompare(b[0])).map(([name, level]) => ({ name, level }));
}

export type PrereqRow = { id: string; name: string; image: string; from: number; to: number; totals: Totals };

/**
 * Resolve the full prerequisite chain for raising `root` from→to: every other building that has to
 * reach some level first (recursively), taking `owned` levels (default 1) into account.
 */
export function prerequisiteChain(all: Building[], owned: Record<string, number>, rootId: string, from: number, to: number): PrereqRow[] {
  const byName = new Map(all.map((b) => [b.name, b]));
  const root = all.find((b) => b.id === rootId)!;
  const have = (b: Building) => owned[b.id] ?? 1;
  const need = new Map<string, number>(); // building id -> level required
  const add = (b: Building, f: number, t: number) => {
    for (const r of collectRequires(stepsBetween(b, f, t))) {
      const rb = byName.get(r.name);
      if (!rb || rb.id === root.id && r.level <= to) continue;
      if (r.level > rb.max || r.level <= have(rb)) continue;
      if (r.level > (need.get(rb.id) ?? 0)) {
        const prevFrom = Math.max(have(rb), need.get(rb.id) ?? 0);
        need.set(rb.id, r.level);
        add(rb, prevFrom, r.level);
      }
    }
  };
  add(root, from, to);
  const rows: PrereqRow[] = [];
  for (const [id, lvl] of need) {
    const b = all.find((x) => x.id === id)!;
    rows.push({ id, name: b.name, image: b.image, from: have(b), to: lvl, totals: rangeTotals(b, have(b), lvl) });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Power already earned from levels 2..current. */
export function powerAt(b: Building, level: number): number {
  return b.steps.reduce((n, s) => (s.level <= level ? n + s.power : n), 0);
}
