export type Step = { l: number; s: number; c: number; b: [number, number][]; x: [number, number][] };
export type Deco = {
  id: number; n: string; q: string; star: boolean; starlv: number[]; max: number; desc: string; size: [number, number];
  ex: number; tot: number; img: string; bt: { t: string; p: string }[]; st: Step[];
};

export const hasStar = (d: Deco, l: number) => d.starlv.includes(l);

/** Index of the (level, star) step; falls back to the first step of that level. */
export function idx(d: Deco, l: number, s: number) {
  let k = d.st.findIndex((x) => x.l === l && x.s === s);
  if (k < 0) k = d.st.findIndex((x) => x.l === l);
  return Math.max(0, k);
}

export const label = (d: Deco, k: number) => {
  const s = d.st[k];
  return `Lv ${s.l}${hasStar(d, s.l) ? ` ★${s.s}` : ""}`;
};

export function effects(d: Deco, k: number) {
  const m: Record<number, { b: number; x: number }> = {};
  const s = d.st[k];
  for (const [i, v] of s.b) (m[i] ||= { b: 0, x: 0 }).b += v;
  for (const [i, v] of s.x) (m[i] ||= { b: 0, x: 0 }).x += v;
  return m;
}

export function fmtStat(v: number, p: string) {
  return p === "percent" ? `+${+(v * 100).toFixed(2)}%` : `+${Math.round(v).toLocaleString("en-US")}`;
}

/** Shards between step a (exclusive) and b (inclusive), with a running total per step. */
export function plan(d: Deco, a: number, b: number) {
  let spent = 0;
  for (let k = 1; k <= a; k++) spent += d.st[k].c;
  const rows: { from: number; to: number; c: number; run: number }[] = [];
  let run = 0;
  for (let k = a + 1; k <= b; k++) { run += d.st[k].c; rows.push({ from: k - 1, to: k, c: d.st[k].c, run }); }
  return { spent, total: run, rows, left: d.tot - spent - run };
}
