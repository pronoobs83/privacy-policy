// Pure equipment math, ported from zrouteguide.com equipment.js.
export type MatRow = [name: string, count: number, icon: string];
export type Stat = [name: string, value: string];
export type LvRow = { zr_l: number; zr_a: number; zr_c: MatRow[]; zr_b: Stat[]; zr_x: Stat[] };
export type PrRow = { zr_a: number; zr_c: MatRow[]; zr_b?: Stat[]; zr_x?: Stat[] };
export type Piece = {
  zr_id: number; zr_n: string; zr_slot: number; zr_sn: string; zr_q: number; zr_qn: string; zr_d?: string;
  zr_i?: string; zr_ti?: string; zr_lv: LvRow[]; zr_pr?: PrRow[]; zr_cc?: MatRow[];
};
export type ConvRow = { zr_k: string; zr_n: string; zr_d: string; zr_i: string; zr_rw: MatRow[] };
export type EquipData = {
  zr_slots: { zr_id: number; zr_n: string }[];
  zr_pieces: Piece[];
  zr_break: ConvRow[];
  zr_fuse: ConvRow[];
};

export type Fit = { q: number; lv: number; pi: number; n: number };
export type EquipState = { fit: Record<string, Fit>; open: number | null; pick: number | null };

export const TAG: Record<number, string> = { 2: "R", 3: "SR", 4: "SSR", 5: "UR" };
const MAT_RANK: Record<string, number> = {
  "Refined Stone": 0, Oil: 1, "Conductive Crystal": 2, "UR Gear Blueprint": 3, "MR Gear Blueprint": 4,
};
const rank = (k: string) => MAT_RANK[k] ?? 50;

export function initialState(d: EquipData): EquipState {
  const fit: Record<string, Fit> = {};
  d.zr_slots.forEach((s) => (fit[String(s.zr_id)] = { q: 5, lv: 0, pi: 0, n: 1 }));
  return { fit, open: null, pick: null };
}

export const findPiece = (d: EquipData, slot: number, q: number) =>
  d.zr_pieces.find((p) => p.zr_slot === Number(slot) && p.zr_q === Number(q)) || null;
export const maxLv = (p: Piece) => p.zr_lv.reduce((m, r) => Math.max(m, r.zr_l), 0);
export const levelRow = (p: Piece, lv: number) => p.zr_lv.find((r) => r.zr_l === lv) || p.zr_lv[0] || null;
export const nextEnh = (p: Piece, lv: number) => p.zr_lv.find((r) => r.zr_l === lv + 1) || null;

export type Held = { f: Fit; p: Piece; cap: number; pr: PrRow[] };
/** Clamped view of a slot's fit (does not mutate state). */
export function fitOf(d: EquipData, state: EquipState, slot: number): Held | null {
  const f0 = state.fit[String(slot)];
  if (!f0) return null;
  const p = findPiece(d, slot, f0.q);
  if (!p) return null;
  const cap = maxLv(p);
  const pr = p.zr_pr || [];
  const f: Fit = {
    q: p.zr_q,
    lv: Math.max(0, Math.min(cap, Number(f0.lv) || 0)),
    pi: Math.max(0, Math.min(pr.length ? pr.length - 1 : 0, Number(f0.pi) || 0)),
    n: Math.max(1, Math.min(99, Number(f0.n) || 1)),
  };
  return { f, p, cap, pr };
}

export type Bag = Record<string, number>;
export function addMats(bag: Bag, rows: MatRow[] | undefined, times: number) {
  (rows || []).forEach((c) => {
    if (!c[0]) return;
    bag[c[0]] = (bag[c[0]] || 0) + (Number(c[1]) || 0) * times;
  });
}
export function enhanceBag(p: Piece, lv: number, times: number) {
  const bag: Bag = {};
  p.zr_lv.forEach((r) => r.zr_l > lv && addMats(bag, r.zr_c, times));
  return bag;
}
export function promoteBag(pr: PrRow[], pi: number, times: number) {
  const bag: Bag = {};
  for (let i = pi + 1; i < pr.length; i++) addMats(bag, pr[i].zr_c, times);
  return bag;
}
export function owe(p: Piece, lv: number, pi: number, times: number): Bag {
  const bag = enhanceBag(p, lv, times);
  const pro = promoteBag(p.zr_pr || [], pi, times);
  Object.keys(pro).forEach((k) => (bag[k] = (bag[k] || 0) + pro[k]));
  return bag;
}
export function mergeBags(list: Bag[]): [string, number][] {
  const bag: Bag = {};
  list.forEach((one) => Object.keys(one).forEach((k) => (bag[k] = (bag[k] || 0) + one[k])));
  return Object.keys(bag)
    .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1))
    .map((k) => [k, bag[k]]);
}

/** Material name -> icon stem, discovered from the data. */
export function materialIcons(d: EquipData) {
  const m: Record<string, string> = {};
  const note = (rows?: MatRow[]) => (rows || []).forEach((c) => c && c[0] && c[2] && !m[c[0]] && (m[c[0]] = c[2]));
  d.zr_pieces.forEach((p) => {
    p.zr_lv.forEach((r) => note(r.zr_c));
    (p.zr_pr || []).forEach((r) => note(r.zr_c));
    note(p.zr_cc);
  });
  d.zr_break.concat(d.zr_fuse).forEach((r) => note(r.zr_rw));
  return m;
}

export function statText(v: string | number) {
  const s = String(v ?? "");
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    let body = Math.abs(n) >= 100 ? Math.round(n).toLocaleString("en-US") : String(Math.round(n * 100) / 100);
    if (n > 0 && body[0] !== "+") body = "+" + body;
    return body;
  }
  return s;
}
export const starLabel = (piece: number) => {
  const whole = piece >= 25 ? 5 : piece < 0 ? 0 : Math.floor(piece / 5);
  const part = piece >= 25 || piece < 0 ? 0 : piece % 5;
  return `${whole}★${part > 0 ? ` (${part}/5)` : ""}`;
};
export const matRank = rank;
