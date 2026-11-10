// Pure exclusive weapon logic, ported from zrouteguide.com exclusive.js.
export type Bonus = [string, string];
export type WeaponLevel = { zr_l: number; zr_s: number; zr_m?: number[]; zr_b: Bonus[] };
export type WeaponSkill = { zr_n: string; zr_d: string; zr_i: string; zr_slot: number; zr_fl: [number, string, number?][] };
export type Weapon = {
  zr_id: number; zr_n: string; zr_i: string; zr_si: string; zr_sn: string; zr_sd: string; zr_open: number;
  zr_ui: string; zr_un: string; zr_ud: string; zr_star: number; zr_cap: number;
  zr_unlock: number[]; zr_preview: number[]; zr_lv: WeaponLevel[]; zr_sk: WeaponSkill[];
};
export type TrackRow = { zr_l: number; zr_s: number; zr_n1: number; zr_n2: number; zr_n3: number; zr_p: Bonus[]; zr_g: Bonus[] };
export type Track = { zr_t: number; zr_n: string; zr_rows: TrackRow[] };
export type ExclusiveData = { zr_weapons: Weapon[]; zr_tracks: Track[] };

export const TRACK_COL = ["#ff4f9a", "#7ee0ff", "#b8ff6a"];
export const TRACK_SHORT = ["ATK", "HP", "DEF"];
export const MILESTONES = [50, 100, 150, 200];

export type Levels = number[]; // [ATK, HP, DEF]

export const num = (n: unknown) => Math.round(Number(n) || 0).toLocaleString("en-US");

function putNumber(desc: string, index: number, number: unknown, percent: boolean) {
  const token = `{${index}}`;
  let out = String(number == null ? "" : number);
  if (percent && !new RegExp(`\\{${index}\\}[ \\t\\n\\r\\v\\f]*%`).test(desc)) out += "%";
  return desc.split(token).join(out);
}
export function skillDesc(sk: WeaponSkill) {
  let desc = String(sk.zr_d || "");
  for (const pair of sk.zr_fl || []) desc = putNumber(desc, pair[0], pair[1], !!pair[2]);
  return desc;
}

export function statText(v: unknown) {
  const s = String(v == null ? "" : v);
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    let body = Math.abs(n) >= 100 ? num(n) : String(Math.round(n * 100) / 100);
    if (n > 0 && body.charAt(0) !== "+") body = "+" + body;
    return body;
  }
  return s;
}

export function trackRows(tracks: Track[], ti: number) {
  return tracks[ti]?.zr_rows ?? [];
}
export function trackMax(tracks: Track[], ti: number) {
  const rows = trackRows(tracks, ti);
  return rows.length ? rows[rows.length - 1].zr_l : 0;
}
export const trackName = (tracks: Track[], ti: number) => tracks[ti]?.zr_n || TRACK_SHORT[ti];
export const rowAt = (tracks: Track[], ti: number, level: number) => trackRows(tracks, ti).find((r) => r.zr_l === level) ?? null;

/** Named shards for a weapon climb (activation counts when starting from 0). */
export function climbCost(w: Weapon, from: number, to: number) {
  let named = 0;
  if (from === 0) named += w.zr_open || 0;
  for (const row of w.zr_lv || []) if (row.zr_l > from && row.zr_l <= to) named += (row as WeaponLevel).zr_s || 0;
  return named;
}
export function trackSpend(rows: TrackRow[], from: number, to: number) {
  let spend = 0;
  for (const r of rows) if (r.zr_l > from && r.zr_l <= to) spend += r.zr_s || 0;
  return spend;
}
export function trackSpendTotal(rows: TrackRow[], level: number) {
  let spend = 0;
  for (const r of rows) if (r.zr_l <= level) spend += r.zr_s || 0;
  return spend;
}

function rowNeeds(row: TrackRow) {
  return [row.zr_n1, row.zr_n2, row.zr_n3];
}

/** Whether `level` on track `ti` is reachable with the other two lines at `now`. */
export function rowGatesMet(tracks: Track[], ti: number, level: number, now: Levels) {
  const row = rowAt(tracks, ti, level);
  if (!row) return true;
  const needs = rowNeeds(row);
  for (let ni = 0; ni < 3; ni++) {
    if (ni === ti) continue;
    const need = Number(needs[ni]) || 0;
    if (need && (Number(now[ni]) || 0) < need) return false;
  }
  return true;
}
export function maxValidLevel(tracks: Track[], ti: number, now: Levels) {
  let max = 0;
  for (const r of trackRows(tracks, ti)) {
    if (rowGatesMet(tracks, ti, r.zr_l, now)) max = r.zr_l;
    else break;
  }
  return max;
}

export type GatePart = { track: number; name: string; short: string; need: number; have: number; shortfall: number; ok: boolean };
export function gateParts(tracks: Track[], ti: number, level: number, now: Levels) {
  const row = rowAt(tracks, ti, level);
  if (!row) return { blocked: false, parts: [] as GatePart[] };
  let blocked = false;
  const parts: GatePart[] = [];
  rowNeeds(row).forEach((need, ni) => {
    if (ni === ti || !need) return;
    const have = Number(now[ni]) || 0;
    const ok = have >= need;
    if (!ok) blocked = true;
    parts.push({ track: ni, name: trackName(tracks, ni), short: TRACK_SHORT[ni], need, have, shortfall: Math.max(0, need - have), ok });
  });
  return { blocked, parts };
}

/** Plain-text gate explanation; `forNext` checks the row after `level`. */
export function gateMessage(tracks: Track[], ti: number, level: number, now: Levels, forNext: boolean) {
  const check = forNext ? level + 1 : level;
  if (!rowAt(tracks, ti, check)) return "";
  const gs = gateParts(tracks, ti, check, now);
  if (!gs.parts.length) return "";
  const name = trackName(tracks, ti);
  const intro = forNext ? `To reach ${name} ${check}, raise ` : `At ${name} ${level}, you need `;
  const reqs = gs.parts.map((g) => `${g.name} to ${g.need}`).join(" and ");
  const shorts = gs.parts.filter((g) => !g.ok).map((g) => `${g.short} -${g.shortfall}`);
  const tail = gs.blocked ? (shorts.length ? ` You're short: ${shorts.join(", ")}.` : "") : " All gates clear.";
  return `${intro}${reqs} first.${tail}`;
}

export function anyInvalid(tracks: Track[], now: Levels) {
  for (let ti = 0; ti < 3; ti++) if ((Number(now[ti]) || 0) > maxValidLevel(tracks, ti, now)) return true;
  return false;
}

function parseBonusValue(text: string) {
  const m = String(text || "").replace(/,/g, "").match(/^\+?(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}
export function combinedStrengthenStats(tracks: Track[], now: Levels): Bonus[] {
  const totals: Record<string, number> = {};
  for (let ti = 0; ti < 3; ti++) {
    const row = rowAt(tracks, ti, Number(now[ti]) || 0);
    if (!row) continue;
    for (const b of (row.zr_p || []).concat(row.zr_g || [])) totals[b[0]] = (totals[b[0]] || 0) + parseBonusValue(b[1]);
  }
  return Object.keys(totals).map((k) => {
    const v = totals[k];
    return [k, (v >= 0 ? "+" : "") + (Math.abs(v) >= 100 ? num(v) : String(Math.round(v * 100) / 100))] as Bonus;
  });
}

function gateNeeds(tracks: Track[], ti: number, level: number) {
  const row = rowAt(tracks, ti, level);
  if (!row) return [0, 0, 0];
  const needs = [Number(row.zr_n1) || 0, Number(row.zr_n2) || 0, Number(row.zr_n3) || 0];
  needs[ti] = 0;
  return needs;
}

export type PlanLine = {
  ti: number; cur: number; typed: number; goal: number; cost: number;
  reqs: { track: number; name: string; need: number }[]; pulled: boolean; neededBy: string[];
};
/** Shards to hit the typed targets, raising other lines where the gates demand it. */
export function strengthenShardPlan(tracks: Track[], now: Levels, goal: Levels) {
  let total = 0;
  const lines: PlanLine[] = [];
  const curs: number[] = [], typed: number[] = [], levels: number[] = [];
  for (let ti = 0; ti < 3; ti++) {
    curs[ti] = Number(now[ti]) || 0;
    typed[ti] = Math.max(0, Number(goal[ti]) || 0);
    levels[ti] = Math.max(curs[ti], typed[ti]);
  }
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (let tj = 0; tj < 3; tj++) {
      if (!levels[tj]) continue;
      const needs = gateNeeds(tracks, tj, levels[tj]);
      for (let ni = 0; ni < 3; ni++) {
        const floor = Math.min(trackMax(tracks, ni), needs[ni]);
        if (floor > levels[ni]) {
          levels[ni] = floor;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (let tk = 0; tk < 3; tk++) {
    const g = levels[tk];
    const cost = trackSpend(trackRows(tracks, tk), curs[tk], g);
    const reqs: PlanLine["reqs"] = [];
    gateNeeds(tracks, tk, g).forEach((need, ni) => {
      if (need) reqs.push({ track: ni, name: trackName(tracks, ni), need });
    });
    total += cost;
    lines.push({ ti: tk, cur: curs[tk], typed: typed[tk], goal: g, cost, reqs, pulled: g > Math.max(curs[tk], typed[tk]), neededBy: [] });
  }
  for (const ln of lines) {
    for (const req of ln.reqs) {
      const other = lines[req.track];
      if (other.pulled && req.need === other.goal) other.neededBy.push(`${trackName(tracks, ln.ti)} ${ln.goal}`);
    }
  }
  return { total, lines };
}

export function planLineText(tracks: Track[], ln: PlanLine) {
  let text = `${trackName(tracks, ln.ti)} ${ln.goal}`;
  text += ln.reqs.length
    ? ` requires ${ln.reqs.map((r) => `${r.name} ${r.need}`).join(" and ")}`
    : " has no other-line requirement";
  if (ln.pulled && ln.neededBy.length) text += `, so ${ln.neededBy.join(" and ")} can be reached`;
  return `${text}. Shards ${ln.cur} → ${ln.goal}`;
}

export type ExclusiveState = {
  id?: number; // weapon id, default first weapon
  mode?: "weapon" | "strengthen";
  from?: number; // weapon level now
  to?: number; // weapon level wanted, default cap
  tr?: Levels; // strengthen levels now
  trT?: Levels; // strengthen targets
  pv?: Levels; // preview sliders
  tab?: number;
};
