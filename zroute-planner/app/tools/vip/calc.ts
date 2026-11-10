export type Item = { n: string; c: number; i?: string };
export type Pack = { n: string; usd: number; reb?: number; lim: number; i?: string; r: Item[]; vc: number };
export type VipLevel = { lv: number; exp: number; step: number; pv: Record<string, number>; new: string[]; free: Item[]; pack: Pack };
export type Priv = { id: number; n: string; k: string };
export type VipData = {
  max: number; cap: number; base: string; pbase: string;
  login: { d: number; p: number }[]; privs: Priv[]; levels: VipLevel[];
};

export const lvOfPoints = (L: VipLevel[], p: number) => {
  let r = 1;
  for (const l of L) if (p >= l.exp) r = l.lv;
  return r;
};

export const privName = (s: string) => s.replace(/\s*\(.*\)\s*$/, "").replace(/\s*\+$/, "");
export const privValue = (p: Priv, v: number | undefined) => (v == null ? "—" : p.k === "unlock" ? "On" : `+${v}%`);
export const usd = (x: number) => "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function plan(D: VipData, points: number, target: number, loginDay: number) {
  const L = D.levels;
  const p = Math.max(0, Math.min(L[D.max - 1].exp, Math.floor(points) || 0));
  const a = lvOfPoints(L, p);
  const tg = L[target - 1];
  const need = Math.max(0, tg.exp - p);
  let packUsd = 0, vc = 0, count = 0;
  for (let i = a + 1; i <= target; i++) { packUsd += L[i - 1].pack.usd; vc += L[i - 1].pack.vc; count++; }
  let loginPts = 0, loginDays = 0;
  if (loginDay) for (const x of D.login) if (x.d >= loginDay) { loginPts += x.p; loginDays++; }
  return {
    p, a, need, count, packUsd, vc, loginPts, loginDays,
    days: Math.ceil(need / D.cap),
    pct: Math.min(100, Math.max(0, (p / tg.exp) * 100)),
    loginTotal: D.login.reduce((s, x) => s + x.p, 0),
  };
}
