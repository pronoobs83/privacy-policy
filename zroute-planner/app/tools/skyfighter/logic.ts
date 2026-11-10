// Pure Sky Fighter math, ported from zrouteguide.com skyfighter.js.
export type Item = { zr_n: string; zr_d?: string; zr_img: string; zr_exp?: number };
export type Items = Record<string, Item>;
export type SkillStar = [level: number, star: number];
export type Skin = { zr_id: number; zr_n: string; zr_lv: number; zr_d: string; zr_img: string };
export type LevelData = {
  zr_rows: number[][];
  zr_skill: { zr_n: string; zr_d: string[] };
  zr_skins: Skin[];
  zr_stars: SkillStar[];
};
export type UpData = {
  zr_rows: number[][];
  zr_stages: { zr_p: number; zr_lv: number; zr_t: string; zr_d: string[] }[];
};
export type CompLevel = { zr_q: number; zr_icon: string; zr_max: number; zr_merge: number; zr_give: number; zr_t: number[]; zr_r: number[][] };
export type CompSlot = { zr_s: number; zr_n: string; zr_lv: Record<string, CompLevel> };
export type CompData = { zr_slots: CompSlot[]; zr_bn: Record<string, string>; zr_pct: number[] };
export type Wing = {
  zr_id: number; zr_n: string; zr_c: string; zr_q: number; zr_img: string; zr_mt: number; zr_lab?: number; zr_desc?: string;
  zr_cost?: [string, number][]; zr_st: (number | string)[][]; zr_amp?: [number, string, number][];
};
export type Building = { zr_id: number; zr_n: string; zr_img: string; zr_lv: (number | string[])[][] };

export const clamp = (v: unknown, lo: number, hi: number) => {
  let n = Math.round(Number(v));
  if (!isFinite(n)) n = lo;
  return Math.max(lo, Math.min(hi, n));
};
export const num = (n: unknown) => Math.round(Number(n) || 0).toLocaleString("en-US");
export const stat = (n: unknown) => {
  const v = Number(n) || 0;
  return Math.abs(v) >= 100 ? num(v) : String(Math.round(v * 100) / 100);
};
export const pct = (v: number) => `${Math.round(v * 10000) / 100}%`;
export function clock(sec: number) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return m ? `${m}m ${s % 60}s` : `${s % 60}s`;
}

/** Wingman feed EXP follows the item description ("can provide 40000 EXP"); scale the star column when the data differs. */
export function scaleWingExp(wings: Wing[]) {
  wings.forEach((w) => {
    const m = /provide\s+([\d,]+)\s+EXP/i.exec(String(w.zr_desc || ""));
    const base = w.zr_st[0] ? (w.zr_st[0][5] as number) : 0;
    if (!m || !base) return;
    const want = Number(m[1].replace(/,/g, ""));
    if (want && want !== base) w.zr_st.forEach((row) => (row[5] = Math.round((row[5] as number) * want / base)));
  });
}

/* ---------- fighter level ---------- */
export function levelIndex(rows: number[][]) {
  const first: Record<number, number> = {}, stages: Record<number, number> = {};
  rows.forEach((r, i) => {
    if (!(r[0] in first)) first[r[0]] = i;
    if (r[1]) stages[r[0]] = (stages[r[0]] || 0) + 1;
  });
  return { first, stages, at: (level: number, stage: number) => first[level] + (stages[level] ? Math.min(stage, stages[level] - 1) : 0) };
}
export function levelCalc(rows: number[][], from: number, stage: number, to: number) {
  const idx = levelIndex(rows);
  const a = idx.at(from, stage), b = Math.max(a, idx.first[to]);
  let chips = 0, avg = 0, parts = 0, trains = 0;
  for (let i = a; i < b; i++) {
    const r = rows[i], n = r[3] ? r[2] / r[3] : 0;
    chips += n * r[4]; parts += n * r[5]; trains += n; avg += (r[13] || n) * r[4];
  }
  return { a, b, ra: rows[a], rb: rows[b], chips, avg, parts, trains, idx };
}
export const convStat = (r: number[], k: number) => (r[7 + k] * r[10 + k]) / 10000;
export function levelTable(rows: number[][], a: number, b: number) {
  const by: Record<number, { c: number; p: number; s: number; pw: number }> = {};
  const order: number[] = [];
  for (let i = a; i < b; i++) {
    const r = rows[i], n = r[3] ? r[2] / r[3] : 0;
    if (!by[r[0]]) { by[r[0]] = { c: 0, p: 0, s: 0, pw: 0 }; order.push(r[0]); }
    by[r[0]].c += n * r[4]; by[r[0]].p += n * r[5]; by[r[0]].s += r[1] ? 1 : 0;
    by[r[0]].pw = rows[i + 1] ? rows[i + 1][6] : r[6];
  }
  return order.map((lv) => ({ lv, ...by[lv] }));
}
export const SKILL_STAR: Record<number, [number, string[]]> = {
  1: [1, ["20.5", "3.2"]], 2: [2, ["22"]], 3: [1, ["26", "3.2"]], 4: [3, ["45"]], 5: [1, ["26", "4.2"]],
};
export const fillTemplate = (t: string, v: string[]) => String(t || "").replace(/\{(\d)\}/g, (m, i) => (v[+i] !== undefined ? v[+i] : m));

/* ---------- upgrade ---------- */
export function upNeed(rows: number[][], from: number, exp: number, to: number) {
  if (to <= from) return 0;
  let t = 0;
  for (let i = Math.max(from, 1); i < to; i++) t += rows[i - 1][0];
  return Math.max(0, t - (from > 0 ? exp : 0));
}
export const upAt = (rows: number[][], lv: number) => (lv > 0 ? rows[lv - 1] : [0, 0, 0, 0, 0, 0]);
export function upReach(rows: number[][], from: number, exp: number, have: number) {
  const max = rows.length;
  let lv = from, left = have + (from > 0 ? exp : 0);
  if (lv === 0 && left > 0) lv = 1;
  while (lv > 0 && lv < max && rows[lv - 1][0] > 0 && left >= rows[lv - 1][0]) { left -= rows[lv - 1][0]; lv++; }
  return { lv, left };
}
export type ExpSource = { k: string; name: string; exp: number; img: string; list?: string[]; q?: number };
export function expSources(items: Items, wings: { zr_n: string; zr_q: number; zr_img: string; exp: number }[]): ExpSource[] {
  const list: ExpSource[] = (["zr_modcard", "zr_guide_adv", "zr_guide_beg"] as const).map((k) => ({
    k, name: items[k].zr_n, exp: items[k].zr_exp!, img: items[k].zr_img,
  }));
  const groups: Record<string, ExpSource> = {};
  wings.forEach((w) => {
    if (!w.exp) return;
    const label = w.zr_q === 2 ? "SSR" : w.zr_q === 3 ? "Blue" : "Green";
    const g = `${label}|${w.exp}`;
    if (!groups[g]) groups[g] = { k: "w" + g.replace(/\W/g, ""), name: "", exp: w.exp, img: w.zr_img, list: [], q: w.zr_q };
    groups[g].list!.push(w.zr_n);
  });
  Object.values(groups).sort((x, y) => x.q! - y.q! || y.exp - x.exp).forEach((g) => {
    const label = g.q === 2 ? "SSR" : g.q === 3 ? "Blue" : "Green";
    const ewOnly = g.list!.every((n) => /Early Warning/.test(n));
    g.name = `${label}${ewOnly ? " Early Warning" : ""} wingman`;
    g.list = g.list!.map((n) => n.replace(/^(Warrior|Tactical|Assault) - /, (_m, c) => c + " "));
    list.push(g);
  });
  return list;
}

/* ---------- components ---------- */
export const CMAX = 12;
export type CompSt = { from: number; exp: number; to: number };
/** Lv.1-component equivalents to reach lv (+exp). */
export function worth(slot: CompSlot, lv: number, exp: number) {
  if (lv <= 0) return 0;
  const L = slot.zr_lv;
  if (lv <= 8) return L[lv].zr_give + (lv === 8 ? exp : 0);
  let w = L[8].zr_give;
  for (let k = 8; k < lv; k++) w += L[k].zr_max;
  return w + exp;
}
export function compRow(slot: CompSlot, lv: number, exp: number) {
  if (lv <= 0) return { L: { zr_q: 0, zr_icon: "", zr_max: 0, zr_t: [] as number[], zr_r: [[0]] } as CompLevel, r: [0] };
  const L = slot.zr_lv[lv];
  const p = L.zr_max ? Math.min(99, Math.floor((exp / L.zr_max) * 100)) : 0;
  return { L, r: L.zr_r[Math.min(p, L.zr_r.length - 1)] };
}
export function normComp(slot: CompSlot, st?: Partial<CompSt>): CompSt {
  const from = clamp(st?.from ?? 0, 0, CMAX);
  const to = Math.max(from, clamp(st?.to ?? CMAX, 0, CMAX));
  const mx = from > 0 ? slot.zr_lv[from].zr_max : 0;
  return { from, to, exp: mx ? clamp(st?.exp ?? 0, 0, mx - 1) : 0 };
}
export function compLine(slot: CompSlot, st: CompSt) {
  const a = compRow(slot, st.from, st.exp), b = compRow(slot, st.to, st.to > st.from ? 0 : st.exp);
  const need = Math.max(0, worth(slot, st.to, 0) - worth(slot, st.from, st.exp));
  return { slot, st, a, b, need };
}

/* ---------- wingmen ---------- */
export const RAR: Record<number, string> = { 1: "UR", 2: "SSR", 3: "Blue", 4: "Green" };
export const CAMPS = ["Warrior", "Tactical", "Assault", "Hybrid"];
export const SOCK = [
  { mt: 0, name: "Debut" }, { mt: 1, name: "Attack" }, { mt: 2, name: "Support" }, { mt: 3, name: "Defense" },
];
export const shortName = (w: Wing) => w.zr_n.replace(/^(Warrior|Tactical|Assault) - /, "");
export const starText = (v: number) => (v < 0 ? "Not owned" : `${v}★`);
export function copies(w: Wing, from: number, to: number) {
  if (to < 0 || to <= from) return 0;
  const base = from < 0 ? 1 : 0, f = Math.max(0, from);
  return base + ((w.zr_st[to][2] as number) - (w.zr_st[f][2] as number));
}
export const socketOptions = (wings: Wing[], camp: string, mt: number) =>
  wings.filter((w) => w.zr_c === camp && w.zr_mt === mt).sort((a, b) => a.zr_q - b.zr_q);
export function craftOf(w: Wing, items: Items) {
  const cost = w.zr_cost && w.zr_cost[0];
  if (!cost) return null;
  return { item: cost[0] === "item_fighter_jet_experience_card_2" ? items.zr_wc_adv : items.zr_wc_norm, n: cost[1] };
}
const allZero = (text: string) => {
  const vals = String(text || "").match(/\[[^\]]*\]/g);
  return !!vals && vals.every((v) => parseFloat(v.replace(/[\[\],+%KMB\s]/g, "")) === 0);
};
export const ampRows = (w: Wing) => (w.zr_amp || []).filter((a) => a[0] > 0 && !allZero(a[1]));
export function ampInfo(w: Wing, lvIn: number | undefined) {
  const rows = ampRows(w);
  if (!rows.length) return { lv: 0, text: "", power: 0, max: 0, on: false };
  const max = rows[rows.length - 1][0];
  const lv = clamp(lvIn ?? 0, 0, max);
  const row = (w.zr_amp || []).find((a) => a[0] === lv) || [0, "", 0];
  return { lv, text: row[1] || "", power: row[2] || 0, max, on: true };
}
export const starPower = (w: Wing, star: number) => (star < 0 ? 0 : (w.zr_st[star][4] as number));
export function normWing(w: Wing, st?: { from: number; to: number }) {
  const mx = w.zr_st.length - 1;
  let from = clamp(st?.from ?? 0, -1, mx);
  const to = clamp(st?.to ?? mx, 0, mx);
  if (from > to) from = to;
  return { from, to };
}

export type BonusRow = { label: string; val: string };
export function skillBonuses(text: string): BonusRow[] {
  const src = String(text || "").replace(/\s+for\s+\d+(?:\.\d+)?\s*s\b/gi, "").replace(/,?\s*lasting\s+\d+(?:\.\d+)?\s*seconds?/gi, "").replace(/\s+until the battle ends/gi, "");
  const rows: BonusRow[] = [];
  const add = (label: string, v: string) => {
    let val = String(v).replace(/[.,]$/, "");
    if (val[0] !== "+" && val[0] !== "-") val = "+" + val;
    rows.push({ label, val });
  };
  let m = /shield of\s+([0-9.]+[KMB]?)/i.exec(src); if (m) add("Shield", m[1]);
  m = /shield equal to\s+([0-9.]+%)/i.exec(src); if (m) add("Shield", m[1] + " Fighter HP");
  m = /damage your party takes by\s+([0-9.]+%)/i.exec(src); if (m) add("DMG Reduction", m[1]);
  m = /([0-9.]+%\+?)\s*ATK/i.exec(src);
  if (m) add("ATK", m[1]);
  else { m = /ATK equal to\s+([0-9.]+%)/i.exec(src); if (m) add("ATK", m[1] + " Fighter ATK"); }
  m = /([0-9.]+%\+?)\s*damage bonus/i.exec(src); if (m) add("Damage bonus", m[1]);
  m = /Battle Skill damage by\s+([0-9.]+%\+?)/i.exec(src); if (m) add("Enemy Battle Skill DMG", m[1]);
  m = /bombing targets\s+\+(\d+)/i.exec(src); if (m) add("Bombing targets", m[1]);
  m = /gain\s+([0-9.]+%\+?)\s*DEF/i.exec(src); if (m) add("DEF", m[1]);
  m = /additional\s+([0-9.]+%\+?)\s*DEF/i.exec(src); if (m) add("Frontline DEF", m[1]);
  m = /DEF equal to\s+([0-9.]+%)/i.exec(src); if (m) add("DEF", m[1] + " Fighter DEF");
  return rows;
}
export function ampBonuses(text: string): BonusRow[] {
  const src = String(text || "").replace(/\[|\]/g, "");
  const rows: BonusRow[] = [];
  const add = (label: string, v: string) => {
    let val = String(v).replace(/[.,]$/, "");
    if (!val || val === "0" || val === "0%") return;
    if (val[0] !== "+" && val[0] !== "-") val = "+" + val;
    rows.push({ label: "Amp: " + label, val });
  };
  let m = /additional\s+([0-9.]+[KMB]?)\s*Shield/i.exec(src); if (m) add("Shield", m[1]);
  m = /damage your party takes by\s+([0-9.]+%)/i.exec(src); if (m) add("DMG Reduction", m[1]);
  m = /ATK bonus by\s+([0-9.]+%)/i.exec(src); if (m) add("ATK", m[1]);
  m = /damage bonus by\s+([0-9.]+%)/i.exec(src); if (m) add("Damage bonus", m[1]);
  m = /Battle Skills by\s+([0-9.]+%)/i.exec(src); if (m) add("Enemy Battle Skill DMG", m[1]);
  m = /DEF bonus by\s+([0-9.]+%)/i.exec(src); if (m) add("DEF", m[1]);
  m = /frontline bonus DEF by\s+([0-9.]+%)/i.exec(src); if (m) add("Frontline DEF", m[1]);
  return rows;
}

/* ---------- buildings ---------- */
export function bSum(b: Building, from: number, to: number) {
  const t = { f: 0, m: 0, o: 0, s: 0, x: 0, pre: [] as string[] };
  const seen: Record<string, number> = {};
  b.zr_lv.forEach((l) => {
    const lv = l[0] as number;
    if (lv > from && lv <= to) {
      t.f += l[2] as number; t.m += l[3] as number; t.o += l[4] as number; t.s += l[1] as number; t.x += l[6] as number;
      (l[7] as string[]).forEach((p) => {
        const k = p.replace(/ Lv\.\d+$/, ""), n = Number(p.replace(/^.* Lv\./, ""));
        if (!seen[k] || seen[k] < n) seen[k] = n;
      });
    }
  });
  t.pre = Object.keys(seen).map((k) => `${k} Lv.${seen[k]}`);
  return t;
}
export const bMax = (b: Building) => b.zr_lv[b.zr_lv.length - 1][0] as number;

/* ---------- persisted state ---------- */
export type SFState = {
  lv: { from: number; stage: number; to: number };
  up: { from: number; exp: number; to: number; inv: Record<string, number> };
  comp: Record<string, CompSt>;
  compMode: "one" | "all";
  compSel: number;
  wing: Record<string, { from: number; to: number }>;
  wfit: Record<string, number>;
  wamp: Record<string, number>;
  wmode: "one" | "all";
  wcamp: string;
  wmt: number;
  bld: Record<string, { from: number; to: number }>;
};
export const initialState = (maxLv: number, maxUp: number): SFState => ({
  lv: { from: 1, stage: 0, to: maxLv },
  up: { from: 1, exp: 0, to: maxUp, inv: {} },
  comp: {}, compMode: "one", compSel: 0,
  wing: {}, wfit: {}, wamp: {}, wmode: "one", wcamp: "Warrior", wmt: 0,
  bld: {},
});
