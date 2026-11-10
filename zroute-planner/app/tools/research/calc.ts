export type Cost = { label: string; count: number };
export type Buff = { n: number; label: string; value: string };
export type Level = {
  level: number; power: number; timeSec: number; costs: Cost[]; buffs: Buff[];
  needs: { tech: { id: string; name: string; level: number }[]; buildings: { name: string; level: number }[] };
};
export type Node = {
  id: string; category: string; name: string; slug: string; max: number; row: number; col: number;
  icon: string; desc: string; prereqs: { id: string; level: number }[]; buildings: { name: string; level: number }[];
  levels: Level[];
};
export type Category = { id: string; name: string; slug: string; icon: string; gates: string[] };
export type Totals = { costs: Cost[]; timeSec: number; power: number };

const RANK: Record<string, number> = { Food: 0, Metal: 1, Oil: 2, "Research Data": 3 };
const sortLabels = (a: string, b: string) => (RANK[a] ?? 50) - (RANK[b] ?? 50) || a.localeCompare(b);

export const emptyTotals = (): Totals => ({ costs: [], timeSec: 0, power: 0 });

export function addTotals(a: Totals, b: Totals): Totals {
  const m = new Map<string, number>();
  for (const c of [...a.costs, ...b.costs]) m.set(c.label, (m.get(c.label) ?? 0) + c.count);
  return {
    costs: [...m].sort((x, y) => sortLabels(x[0], y[0])).map(([label, count]) => ({ label, count })),
    timeSec: a.timeSec + b.timeSec,
    power: a.power + b.power,
  };
}

/** Sum of levels from+1..to */
export function nodeTotals(n: Node, from: number, to: number): Totals {
  let t = emptyTotals();
  for (const l of n.levels) if (l.level > from && l.level <= to) t = addTotals(t, { costs: l.costs, timeSec: l.timeSec, power: l.power });
  return t;
}

export function sumNodes(items: { node: Node; from: number; to: number }[]): Totals {
  return items.reduce((t, i) => addTotals(t, nodeTotals(i.node, i.from, i.to)), emptyTotals());
}

export function progress(nodes: { id: string; max: number }[], levels: Record<string, number>) {
  let have = 0, max = 0;
  for (const n of nodes) { have += Math.min(levels[n.id] ?? 0, n.max); max += n.max; }
  return { have, max, pct: max ? Math.round((have / max) * 100) : 0 };
}

/** Parse "+3.5%", "−30", "60" into sign/number/unit so values can be summed. */
function parseBuff(v: string) {
  const m = String(v).trim().match(/^([+\-−])?\s*([\d.,]+)\s*(%?)$/);
  if (!m) return null;
  const neg = m[1] === "-" || m[1] === "−";
  return { n: (neg ? -1 : 1) * Number(m[2].replace(/,/g, "")), unit: m[3], plus: m[1] === "+" };
}

/** Buff values already shown per level are cumulative, so sum the value at each node's current level. */
export function buffSummary(nodes: Node[], levels: Record<string, number>) {
  const out = new Map<string, { n: number; unit: string; plus: boolean }>();
  for (const node of nodes) {
    const lv = Math.min(levels[node.id] ?? 0, node.max);
    const row = node.levels.find((l) => l.level === lv);
    for (const b of row?.buffs ?? []) {
      const p = parseBuff(b.value);
      if (!p) continue;
      const k = b.label;
      const prev = out.get(k);
      out.set(k, { n: (prev?.n ?? 0) + p.n, unit: p.unit, plus: p.plus || !!prev?.plus });
    }
  }
  return [...out].sort((a, b) => a[0].localeCompare(b[0])).map(([label, v]) => ({
    label,
    value: `${v.n < 0 ? "−" : v.plus ? "+" : ""}${Math.round(Math.abs(v.n) * 100) / 100}${v.unit}`,
  }));
}
