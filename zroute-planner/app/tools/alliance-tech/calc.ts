export type Level = { l: number; dp: number; t: number; oil: number; al?: number; show?: string; b: [string, string, string][] };
export type Tech = {
  id: number; n: string; cat: string; max: number; row: number; ord: number; desc: string; img: string;
  req: { id: number; lv: number }[]; links: number[]; lv: Level[];
};
export type Levels = Record<string, number>;

export const index = (techs: Tech[]) => Object.fromEntries(techs.map((t) => [t.id, t])) as Record<number, Tech>;

export const lvOf = (m: Levels, id: number) => m[id] || 0;
export const unlocked = (t: Tech, m: Levels) => t.req.every((r) => lvOf(m, r.id) >= r.lv);

/** Drop levels whose prerequisites are no longer met (repeat until stable). */
export function sanitize(map: Levels, by: Record<number, Tech>): Levels {
  const next: Levels = {};
  for (const id of Object.keys(map)) if (map[id] > 0 && by[+id]) next[id] = Math.min(map[id], by[+id].max);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of Object.keys(next)) {
      if (!unlocked(by[+id], next)) { delete next[id]; changed = true; }
    }
  }
  return next;
}

/** Raise a tech and all its prerequisites to the needed level. */
export function fill(id: number, need: number, map: Levels, by: Record<number, Tech>, seen: Record<string, 1> = {}) {
  const t = by[id];
  if (!t || seen[`${id}:${need}`]) return;
  seen[`${id}:${need}`] = 1;
  if (need > 0) t.req.forEach((r) => fill(r.id, r.lv, map, by, seen));
  if ((map[id] || 0) < need) map[id] = Math.min(need, t.max);
}

export function missing(t: Tech, m: Levels, by: Record<number, Tech>) {
  const out: string[] = [], seen: Record<number, 1> = {};
  const walk = (x: Tech) =>
    x.req.forEach((r) => {
      if (lvOf(m, r.id) >= r.lv || seen[r.id]) return;
      seen[r.id] = 1;
      walk(by[r.id]);
      out.push(`${by[r.id].n} Lv. ${r.lv}`);
    });
  walk(t);
  return out;
}

export function cost(t: Tech, from: number, to: number) {
  const r = { dp: 0, oil: 0, t: 0 };
  for (let l = from + 1; l <= to; l++) { const x = t.lv[l - 1]; r.dp += x.dp; r.oil += x.oil; r.t += x.t; }
  return r;
}

export function catSum(techs: Tech[], m: Levels) {
  const r = { dp: 0, oil: 0, t: 0, have: 0, max: 0, done: 0, n: 0, pct: 0 };
  for (const t of techs) {
    const x = cost(t, lvOf(m, t.id), t.max);
    r.dp += x.dp; r.oil += x.oil; r.t += x.t;
    r.have += lvOf(m, t.id); r.max += t.max; r.n++;
    if (lvOf(m, t.id) >= t.max) r.done++;
  }
  r.pct = r.max ? Math.floor((r.have / r.max) * 100) : 0;
  if (r.pct === 100 && r.have < r.max) r.pct = 99;
  return r;
}

/** "Name -" + "+0.5%" -> "Name −0.5%" */
export function effect(b: [string, string, string]) {
  let nm = String(b[0]).trim(), v = String(b[1]);
  if (/-$/.test(nm)) { nm = nm.slice(0, -1).trim(); v = "\u2212" + v.replace(/^\+/, ""); }
  else if (/\+$/.test(nm)) nm = nm.slice(0, -1).trim();
  return `${nm} ${v}`;
}
