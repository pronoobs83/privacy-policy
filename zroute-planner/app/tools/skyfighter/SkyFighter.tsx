import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useToolState } from "~/lib/store";
import { Card, Collapsible, NumberField, Select, Tabs, fmt } from "~/components/ui";
import type { Slice } from "./data.server";
import {
  CAMPS, CMAX, RAR, SKILL_STAR, SOCK, ampBonuses, ampInfo, bMax, bSum, clamp, clock, compLine, convStat, copies,
  craftOf, expSources, fillTemplate, initialState, levelCalc, levelTable, normComp, normWing, num, pct, shortName, skillBonuses,
  socketOptions, starPower, starText, stat, upAt, upNeed, upReach, worth, type BonusRow, type SFState, type Wing,
} from "./logic";

type Cfg = { img: string; res: string };
type Patch = (fn: (s: SFState) => SFState) => void;
const NOTE = "These numbers are kept by the community and can differ from the game, so do not trust them blindly.";
const TAB_LIST = [
  { value: "level", label: "Fighter level" },
  { value: "upgrade", label: "Upgrade" },
  { value: "comp", label: "Components" },
  { value: "wing", label: "Wingmen" },
  { value: "bld", label: "Buildings" },
] as const;

export function SkyFighter({ slice }: { slice: Slice }) {
  const init = useMemo(() => initialState(slice.maxLv, slice.maxUp), [slice.maxLv, slice.maxUp]);
  const [stored, setStored] = useToolState<SFState>("skyfighter", init);
  const navigate = useNavigate();
  const s: SFState = { ...init, ...(stored || {}) };
  const patch: Patch = (fn) => setStored((prev) => fn({ ...init, ...(prev || {}) }));
  const cfg = slice.config;
  const items = slice.items;

  return (
    <div className="space-y-4">
      <Tabs
        value={slice.tab}
        tabs={TAB_LIST as unknown as { value: string; label: string }[]}
        onChange={(v) => navigate(`?tab=${v}`, { preventScrollReset: true, replace: true })}
      />
      {slice.tab === "level" && <LevelTab s={s} patch={patch} cfg={cfg} d={slice.level} items={items} />}
      {slice.tab === "upgrade" && <UpgradeTab s={s} patch={patch} cfg={cfg} d={slice.up} wingExp={slice.wingExp} items={items} />}
      {slice.tab === "comp" && <CompTab s={s} patch={patch} cfg={cfg} d={slice.comp} fac={slice.fac} items={items} />}
      {slice.tab === "wing" && <WingTab s={s} patch={patch} cfg={cfg} wings={slice.wings} items={items} />}
      {slice.tab === "bld" && <BuildingTab s={s} patch={patch} cfg={cfg} bld={slice.bld} items={items} />}
      <p className="text-xs text-muted">{NOTE}</p>
    </div>
  );
}

/* ---------- shared bits ---------- */
function Pic({ cfg, name, size = 24, alt = "", className = "" }: { cfg: Cfg; name?: string; size?: number; alt?: string; className?: string }) {
  if (!name) return null;
  return <img src={`${cfg.img}${name}.png`} alt={alt} width={size} height={size} loading="lazy" className={`shrink-0 object-contain ${className}`} style={{ width: size, height: size }} />;
}
type CostItem = { label: string; v: number; icon?: ReactNode; text?: string; always?: boolean; soft?: boolean };
function Costs({ list }: { list: CostItem[] }) {
  const out = list.filter((c) => c.v || c.always);
  if (!out.length) return <p className="text-sm text-muted">Nothing left to spend in this range.</p>;
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
      {out.map((c) => (
        <li key={c.label} className={`flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 ${c.soft ? "opacity-80" : ""}`}>
          {c.icon}
          <div className="min-w-0">
            <div className="truncate text-xs text-muted">{c.label}</div>
            <div className="font-semibold tabular-nums" title={fmt(c.v)}>{c.text ?? fmt(c.v)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
type CmpRow = { label: string; a: number; b: number; f: (v: number) => string };
function Compare({ rows }: { rows: CmpRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-muted"><th className="py-1">Stat</th><th className="py-1 text-right">Now</th><th className="py-1 text-right">Target</th></tr></thead>
      <tbody>
        {rows.map((r) => {
          const up = r.b - r.a;
          return (
            <tr key={r.label} className="border-t border-line">
              <td className="py-1.5">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums">{r.f(r.a)}</td>
              <td className="py-1.5 text-right tabular-nums"><b>{r.f(r.b)}</b>{up > 0 && <small className="ml-1 text-success">+{r.f(up)}</small>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
const Small = ({ children }: { children: ReactNode }) => <p className="mt-2 text-xs text-muted">{children}</p>;
const BigNum = ({ kicker, value, sub }: { kicker: string; value: ReactNode; sub?: ReactNode }) => (
  <div className="rounded-xl bg-surface-2 p-4">
    <p className="text-xs uppercase tracking-wide text-muted">{kicker}</p>
    <p className="font-display text-3xl font-bold tabular-nums text-gold">{value}</p>
    {sub && <p className="text-xs text-muted">{sub}</p>}
  </div>
);
const Switch = <T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) => (
  <div className="inline-flex overflow-hidden rounded-lg border border-line" role="group">
    {options.map((o) => (
      <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
        className={`px-3 py-1.5 text-sm ${o.value === value ? "bg-primary text-primary-ink" : "bg-surface-2 text-muted hover:text-ink"}`}>{o.label}</button>
    ))}
  </div>
);
const StatList = ({ rows }: { rows: BonusRow[] }) =>
  rows.length ? (
    <ul className="space-y-1 text-sm">
      {rows.map((r, i) => <li key={i} className="flex justify-between rounded bg-surface-2 px-3 py-1.5"><span className="text-muted">{r.label}</span><b>{r.val}</b></li>)}
    </ul>
  ) : null;
const stateCls = (have: boolean, plan: boolean) => (have ? "opacity-60" : plan ? "border-l-2 border-primary pl-2" : "");

/* ---------- fighter level ---------- */
function LevelTab({ s, patch, cfg, d, items }: { s: SFState; patch: Patch; cfg: Cfg; d: Extract<Slice, { tab: "level" }>["level"]; items: Slice["items"] }) {
  const rows = d.zr_rows;
  const maxLv = rows[rows.length - 1][0];
  const from = clamp(s.lv.from, 1, maxLv), to = clamp(s.lv.to, 1, maxLv);
  const first = levelCalc(rows, from, 0, to).idx;
  const stagesHere = first.stages[from] || 0;
  const stage = stagesHere ? clamp(s.lv.stage, 0, stagesHere - 1) : 0;
  const c = levelCalc(rows, from, stage, to);
  const { ra, rb } = c;
  const set = (lv: Partial<SFState["lv"]>) => patch((x) => ({ ...x, lv: { ...x.lv, ...lv } }));
  const chip = items.zr_chip, part = items.zr_part;
  const cmp: CmpRow[] = [
    { label: "Power", a: ra[6], b: rb[6], f: num },
    { label: "Fighter HP", a: ra[7], b: rb[7], f: stat },
    { label: "Fighter ATK", a: ra[8], b: rb[8], f: stat },
    { label: "Fighter DEF", a: ra[9], b: rb[9], f: stat },
    { label: "Hero HP", a: convStat(ra, 0), b: convStat(rb, 0), f: stat },
    { label: "Hero ATK", a: convStat(ra, 1), b: convStat(rb, 1), f: stat },
    { label: "Hero DEF", a: convStat(ra, 2), b: convStat(rb, 2), f: stat },
    { label: "HP ratio", a: ra[10] / 10000, b: rb[10] / 10000, f: pct },
    { label: "ATK ratio", a: ra[11] / 10000, b: rb[11] / 10000, f: pct },
    { label: "DEF ratio", a: ra[12] / 10000, b: rb[12] / 10000, f: pct },
  ];
  const unlocks: string[] = [];
  d.zr_stars.forEach((st) => st[1] > 0 && st[0] > from && st[0] <= to && unlocks.push(`Lv.${st[0]}: ${d.zr_skill.zr_n} skill star ${st[1]}`));
  d.zr_skins.forEach((sk) => sk.zr_lv > from && sk.zr_lv <= to && unlocks.push(`Lv.${sk.zr_lv}: skin ${sk.zr_n}`));
  const table = useMemo(() => levelTable(rows, c.a, c.b), [rows, c.a, c.b]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField label="Current level" value={from} min={1} max={maxLv} onChange={(v) => set({ from: v, stage: 0, to: Math.max(to, v) })} />
        {stagesHere > 0 && (
          <NumberField label={`Key Upgrade stages done (of ${stagesHere})`} value={stage} min={0} max={stagesHere - 1} onChange={(v) => set({ stage: v })} />
        )}
        <NumberField label="Target level" value={to} min={1} max={maxLv} onChange={(v) => set({ to: v, ...(from > v ? { from: v, stage: 0 } : {}) })} />
      </div>

      <Card title="Needed">
        <Costs list={[
          { label: chip.zr_n, v: c.chips, icon: <Pic cfg={cfg} name={chip.zr_img} />, always: true },
          { label: `${chip.zr_n} (average with crits)`, v: c.avg, icon: <Pic cfg={cfg} name={chip.zr_img} />, soft: true, text: `≈ ${num(c.avg)}` },
          { label: part.zr_n, v: c.parts, icon: <Pic cfg={cfg} name={part.zr_img} /> },
          { label: "Trainings", v: c.trains },
        ]} />
        <Small>The first line assumes no crits. Under 80% progress, a {chip.zr_n} training has a 50% chance to add 2x progress, so the average line is an estimate. Training with {part.zr_n} cannot crit.</Small>
      </Card>

      <Card title="Stats">
        <Compare rows={cmp} />
        <Small>In battle, part of the Fighter stats turns into stats for all heroes. The ratio is that share.</Small>
      </Card>

      {unlocks.length > 0 && (
        <Card title="Unlocks on the way">
          <ul className="list-inside list-disc text-sm">{unlocks.map((m) => <li key={m}>{m}</li>)}</ul>
        </Card>
      )}

      <Card title="Skins">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {d.zr_skins.map((sk) => {
            const bonus = (sk.zr_d.split(/Unlock(?:ing)? to activate:\s*/)[1] || "").trim();
            return (
              <li key={sk.zr_id} className={`flex flex-col items-center gap-1 rounded-xl bg-surface-2 p-3 text-center text-sm ${sk.zr_lv <= from ? "ring-1 ring-success/50" : sk.zr_lv <= to ? "ring-1 ring-primary/60" : ""}`}>
                <Pic cfg={cfg} name={sk.zr_img} size={72} alt={sk.zr_n} />
                <b>{sk.zr_n}</b>
                <span className="text-xs text-muted">Lv.{sk.zr_lv}</span>
                {bonus && <span className="text-xs">{bonus}</span>}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title={`Skill: ${d.zr_skill.zr_n}`}>
        <p className="text-sm">{d.zr_skill.zr_d[0].replace("{0}%", "a share of").replace("{CD: 9s}", "Cooldown 9s.")}</p>
        <ol className="mt-3 space-y-1 text-sm">
          {d.zr_stars.filter((st) => st[1] > 0).map((st) => {
            const k = SKILL_STAR[st[1]];
            const txt = k ? fillTemplate(d.zr_skill.zr_d[k[0]], k[1]) : "";
            return (
              <li key={st[0]} className={`flex gap-3 rounded bg-surface-2 px-3 py-1.5 ${stateCls(st[0] <= from, st[0] <= to)}`}>
                <span className="text-gold">{"★".repeat(st[1])}</span>
                <span className="flex-1">{txt}</span>
                <span className="text-muted">Lv.{st[0]}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Collapsible title="Level by level">
        {c.b <= c.a ? <p className="text-sm text-muted">Pick a target above the current level.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-1">Level</th><th className="py-1 text-right">{chip.zr_n}</th><th className="py-1 text-right">{part.zr_n}</th><th className="py-1 text-right">Power after</th></tr></thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.lv} className="border-t border-line">
                    <td className="py-1">{r.lv}{r.s ? <small className="ml-1 text-muted">{r.s} stages</small> : null}</td>
                    <td className="py-1 text-right tabular-nums">{num(r.c)}</td>
                    <td className="py-1 text-right tabular-nums">{r.p ? num(r.p) : "—"}</td>
                    <td className="py-1 text-right tabular-nums">{num(r.pw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Collapsible>
    </div>
  );
}

/* ---------- upgrade fighter ---------- */
function UpgradeTab({ s, patch, cfg, d, wingExp, items }: {
  s: SFState; patch: Patch; cfg: Cfg; d: Extract<Slice, { tab: "upgrade" }>["up"]; wingExp: Extract<Slice, { tab: "upgrade" }>["wingExp"]; items: Slice["items"];
}) {
  const rows = d.zr_rows, MAXUP = rows.length;
  const from = clamp(s.up.from, 0, MAXUP);
  const to = Math.max(from, clamp(s.up.to, 0, MAXUP));
  const curT = from > 0 ? rows[from - 1][0] : 0;
  const exp = curT ? clamp(s.up.exp, 0, curT - 1) : 0;
  const need = upNeed(rows, from, exp, to);
  const ra = upAt(rows, from), rb = upAt(rows, to);
  const set = (u: Partial<SFState["up"]>) => patch((x) => ({ ...x, up: { ...x.up, ...u } }));
  const setFrom = (v: number) => set({ from: v, exp: 0, to: Math.max(to, v) });
  const setTo = (v: number) => set(v < from ? { to: v, from: v, exp: 0 } : { to: v });
  const sources = useMemo(() => expSources(items, wingExp), [items, wingExp]);
  let have = 0;
  sources.forEach((src) => (have += clamp(s.up.inv?.[src.k] || 0, 0, 999999) * src.exp));
  const reach = upReach(rows, from, exp, have);
  const modcard = items.zr_modcard, beg = items.zr_guide_beg;
  const delta = (i: number, f: (v: number) => string) => {
    const dd = rb[i] - ra[i];
    return !dd ? f(rb[i]) : `${dd > 0 ? "+" : ""}${f(dd)}`;
  };
  const verdict = have
    ? `With this you reach Lv.${reach.lv}${reach.lv < MAXUP && rows[reach.lv - 1] ? ` and ${num(reach.left)} of ${num(rows[reach.lv - 1][0])} EXP` : ""}. ${need ? (have >= need ? "That covers your target." : `${num(need - have)} EXP short of your target.`) : ""}`
    : "Enter what you own to see how far it gets you.";
  const reached = d.zr_stages.reduce((r, st, i) => (from >= st.zr_lv ? i : r), -1);
  const cur = reached >= 0 ? d.zr_stages[reached] : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Upgrade Fighter opens on server day 82. Lv.0 is before the first promotion. Feed EXP cards, guides, and wingmen to climb.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField label="Current level" value={from} min={0} max={MAXUP} onChange={setFrom} />
        {curT > 0 && <NumberField label={`EXP inside Lv.${from} (of ${num(curT)})`} value={exp} min={0} max={curT - 1} onChange={(v) => set({ exp: v })} />}
        <NumberField label="Target level" value={to} min={0} max={MAXUP} onChange={setTo} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`Needed up to Lv.${to}`}>
          <BigNum kicker="Upgrade EXP" value={num(need)} sub={`From Lv.${from} to Lv.${to}`} />
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Pic cfg={cfg} name={modcard.zr_img} size={36} alt={modcard.zr_n} />
            <b>× {num(Math.ceil(need / modcard.zr_exp!))}</b> {modcard.zr_n}
          </p>
          <Small>Or {num(Math.ceil(need / beg.zr_exp!))} {beg.zr_n}s. Each advanced guide matches one EXP card.</Small>
        </Card>
        <Card title="Stats at target">
          <div className="mb-2 flex items-center gap-3">
            <Pic cfg={cfg} name="zr_skyfighter_skin_1" size={56} alt="Sky Fighter" />
            <div className="flex-1"><b>Fighter Upgrade</b><p className="text-xs text-muted">Lv.{from} → Lv.{to}</p></div>
            <b className="text-xl tabular-nums text-gold">{num(rb[1])}</b>
          </div>
          <StatList rows={[
            { label: "Fighter HP", val: delta(2, stat) },
            { label: "Fighter ATK", val: delta(3, stat) },
            { label: "Fighter DEF", val: delta(4, stat) },
            { label: "Amplification", val: `+${rb[5]}` },
          ]} />
        </Card>
      </div>

      <Card title="Stages (tap to set target)">
        <div className="flex flex-wrap gap-2">
          {d.zr_stages.map((st) => {
            const roman = st.zr_t.match(/Stage ([IVX]+)/)?.[1] ?? String(st.zr_p);
            const on = to === st.zr_lv;
            return (
              <button key={st.zr_lv} type="button" aria-label={`${st.zr_t}, level ${st.zr_lv}`} onClick={() => setTo(st.zr_lv)}
                className={`flex flex-col items-center rounded-lg border px-3 py-1 text-sm ${on ? "border-primary bg-primary text-primary-ink" : st.zr_lv <= from ? "border-success/50 bg-surface-2" : "border-line bg-surface-2"}`}>
                <b>{roman}</b><small>{st.zr_lv}</small>
              </button>
            );
          })}
        </div>
        <ol className="mt-3 space-y-1 text-sm">
          {d.zr_stages.map((st) => (
            <li key={st.zr_lv} className={`flex gap-3 rounded bg-surface-2 px-3 py-1.5 ${st === cur ? "ring-1 ring-primary" : stateCls(st.zr_lv <= from, st.zr_lv <= to)}`}>
              <span className="w-14 shrink-0 text-muted">Lv.{st.zr_lv}</span>
              <span><b>{st.zr_t.replace("Fighter Promotion ", "")}</b> {st.zr_d.join(" ")}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="What you have">
        <div className="space-y-2">
          {sources.map((src) => (
            <div key={src.k} className="flex items-center gap-3 rounded-lg bg-surface-2 p-2">
              <Pic cfg={cfg} name={src.img} size={32} alt={src.name} />
              <div className="min-w-0 flex-1 text-sm">
                {src.name}<small className="block text-xs text-muted">{num(src.exp)} EXP each</small>
                {src.list && (
                  <details className="text-xs text-muted"><summary className="cursor-pointer">{src.list.length} {src.list.length === 1 ? "wingman" : "wingmen"}</summary>
                    <ul className="ml-4 list-disc">{src.list.map((n) => <li key={n}>{n}</li>)}</ul></details>
                )}
              </div>
              <input type="number" inputMode="numeric" min={0} max={999999} value={clamp(s.up.inv?.[src.k] || 0, 0, 999999)}
                aria-label={`How many ${src.name}, ${num(src.exp)} EXP each`}
                onChange={(e) => set({ inv: { ...s.up.inv, [src.k]: clamp(e.target.value, 0, 999999) } })}
                className="w-24 rounded-lg border border-line bg-bg px-2 py-1.5 text-right tabular-nums outline-none focus:border-accent" />
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm"><b>{num(have)} EXP</b> · {verdict}</p>
        <Small>Wingman EXP is the 0★ value. UR wingmen cannot be fed.</Small>
      </Card>
    </div>
  );
}

/* ---------- components ---------- */
function CompTab({ s, patch, cfg, d, fac, items }: {
  s: SFState; patch: Patch; cfg: Cfg; d: Extract<Slice, { tab: "comp" }>["comp"]; fac: number[][]; items: Slice["items"];
}) {
  const slots = d.zr_slots;
  const pctSet = new Set(d.zr_pct);
  const sel = slots.find((x) => x.zr_s === s.compSel) || slots[0];
  const lines = slots.map((slot) => compLine(slot, normComp(slot, s.comp["s" + slot.zr_s])));
  const focus = lines.find((l) => l.slot.zr_s === sel.zr_s)!;
  const setSt = (slot: typeof sel, p: Partial<{ from: number; exp: number; to: number }>) =>
    patch((x) => ({ ...x, comp: { ...x.comp, ["s" + slot.zr_s]: { ...normComp(slot, x.comp["s" + slot.zr_s]), ...p } } }));
  const lvOptions = (target: boolean) => {
    const o = target ? [] : [{ value: 0, label: "— No component" }];
    for (let lv = target ? 0 : 1; lv <= CMAX; lv++) o.push({ value: lv, label: lv === 0 ? "— None" : `Lv.${lv} (${num(worth(sel, lv, 0))} Lv.1)` });
    return o;
  };
  let totW = 0, totP = 0;
  lines.forEach((l) => { totW += l.need; totP += l.b.r[0] - l.a.r[0]; });
  const types = focus.b.L.zr_t?.length ? focus.b.L.zr_t : focus.a.L.zr_t;
  const benefit = (t: number, v: number) => (pctSet.has(t) ? pct(v) : stat(v));
  const cmp: CmpRow[] = [{ label: "Power", a: focus.a.r[0], b: focus.b.r[0], f: num }];
  (types || []).forEach((t, i) => cmp.push({ label: d.zr_bn[t] || `Stat ${t}`, a: focus.a.r[i + 1] || 0, b: focus.b.r[i + 1] || 0, f: (v) => benefit(t, v) }));
  const cbox = items.zr_cbox;
  const iconLv = focus.st.from > 0 ? focus.st.from : 1;

  return (
    <div className="space-y-4">
      <Switch value={s.compMode} options={[{ value: "one", label: "Selected" }, { value: "all", label: "All slots" }]}
        onChange={(v) => patch((x) => ({ ...x, compMode: v }))} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {slots.map((slot) => {
          const st = normComp(slot, s.comp["s" + slot.zr_s]);
          const on = slot.zr_s === sel.zr_s;
          const lvi = st.from > 0 ? st.from : 1;
          return (
            <button key={slot.zr_s} type="button" aria-pressed={on} onClick={() => patch((x) => ({ ...x, compSel: slot.zr_s }))}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs ${on ? "border-primary bg-surface-2" : "border-line bg-surface"} ${st.from ? "" : "opacity-60"}`}>
              <Pic cfg={cfg} name={slot.zr_lv[lvi].zr_icon} size={48} alt={slot.zr_n} />
              <span className="text-center">{slot.zr_n}</span>
              <b>{st.from ? `Lv.${st.from}` : "—"}</b>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={s.compMode === "all" ? "All slots to their target" : `${sel.zr_n}: needed up to Lv.${focus.st.to}`}>
          {s.compMode === "all" ? (
            <>
              <BigNum kicker="Lv.1 pieces" value={num(totW)} sub="Each slot only takes its own component." />
              <ul className="mt-3 space-y-1 text-sm">
                {lines.filter((l) => l.need).map((l) => (
                  <li key={l.slot.zr_s} className="flex items-center gap-2"><Pic cfg={cfg} name={l.slot.zr_lv[1].zr_icon} size={28} /><span className="flex-1">{l.slot.zr_n}</span><b>× {num(l.need)}</b></li>
                ))}
              </ul>
              <Small>Power gained {num(totP)}.</Small>
            </>
          ) : (
            <>
              <BigNum kicker="Lv.1 pieces" value={num(focus.need)}
                sub={`Lv.1 ${sel.zr_n} pieces${focus.need >= 2187 ? ` · ${Math.round((focus.need / 2187) * 100) / 100} × Lv.8` : ""}`} />
              <p className="mt-3 flex items-center gap-2 text-sm"><Pic cfg={cfg} name={sel.zr_lv[1].zr_icon} size={36} /><b>× {num(focus.need)}</b> Lv.1 {sel.zr_n}</p>
            </>
          )}
        </Card>
        <Card title={`${sel.zr_n} · Lv.${focus.st.from} → Lv.${focus.st.to}`}>
          <div className="mb-3 flex items-center gap-3">
            <Pic cfg={cfg} name={sel.zr_lv[iconLv].zr_icon} size={48} alt={sel.zr_n} />
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <Select label="Current" value={focus.st.from} options={lvOptions(false)}
                onChange={(v) => setSt(sel, { from: v, exp: 0, to: Math.max(focus.st.to, v) })} />
              <Select label="Target" value={focus.st.to} options={lvOptions(true)}
                onChange={(v) => setSt(sel, v < focus.st.from ? { to: v, from: v, exp: 0 } : { to: v })} />
            </div>
          </div>
          {focus.st.from > 0 && sel.zr_lv[focus.st.from].zr_max > 0 && (
            <NumberField className="mb-3" label={`EXP inside Lv.${focus.st.from} (of ${num(sel.zr_lv[focus.st.from].zr_max)})`}
              value={focus.st.exp} min={0} max={sel.zr_lv[focus.st.from].zr_max - 1} onChange={(v) => setSt(sel, { exp: v })} />
          )}
          <Compare rows={cmp} />
        </Card>
      </div>

      <Small>Up to Lv.7, three of the same component merge into the next level. From Lv.8 they are fed as EXP. A Lv.8 component is worth 2,187 Lv.1. The number on each level is that many Lv.1 pieces of the same slot.</Small>

      <Collapsible title="Component factory">
        <p className="mb-2 text-xs text-muted">The factory makes {cbox.zr_n}es and stores up to 24 hours of them. The data lists {fac.length} tiers but does not say what raises the tier.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1">Tier</th><th className="py-1 text-right">One chest every</th><th className="py-1 text-right">Per day</th></tr></thead>
            <tbody>
              {fac.map((f) => (
                <tr key={f[0]} className="border-t border-line"><td className="py-1">{f[0]}</td><td className="py-1 text-right">{clock(f[2])}</td><td className="py-1 text-right">{Math.round((86400 / f[2]) * 100) / 100}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Collapsible>
    </div>
  );
}

/* ---------- wingmen ---------- */
function WingTab({ s, patch, cfg, wings, items }: { s: SFState; patch: Patch; cfg: Cfg; wings: Wing[]; items: Slice["items"] }) {
  const camp = CAMPS.includes(s.wcamp) ? s.wcamp : "Warrior";
  const mt = clamp(s.wmt, 0, 3);
  const byId = useMemo(() => new Map(wings.map((w) => [w.zr_id, w])), [wings]);
  const fitted = (c: string, m: number) => {
    const opts = socketOptions(wings, c, m);
    const w = byId.get(s.wfit[`${c}-${m}`]);
    return w && w.zr_c === c && w.zr_mt === m ? w : opts[0];
  };
  const stOf = (w: Wing) => normWing(w, s.wing[w.zr_id]);
  const setSt = (w: Wing, p: Partial<{ from: number; to: number }>) =>
    patch((x) => ({ ...x, wing: { ...x.wing, [w.zr_id]: { ...normWing(w, x.wing[w.zr_id]), ...p } } }));

  const w = fitted(camp, mt);
  const st = stOf(w), mx = w.zr_st.length - 1;
  const amp = ampInfo(w, s.wamp[w.zr_id]);
  const tgtPow = starPower(w, st.to) + amp.power;
  const lines = SOCK.map((sk) => {
    const ww = fitted(camp, sk.mt), ss = stOf(ww);
    return { sock: sk, w: ww, st: ss, copies: copies(ww, ss.from, ss.to), craft: craftOf(ww, items) };
  });
  const starOpts = (from: boolean) => {
    const o = from ? [{ value: -1, label: "Not owned" }] : [];
    w.zr_st.forEach((r) => o.push({ value: r[0] as number, label: `${r[0]}★ (${num(r[4])} power)` }));
    return o;
  };
  const need = copies(w, st.from, st.to), craft = craftOf(w, items);
  const bonuses = skillBonuses(String(w.zr_st[Math.max(0, st.to < 0 ? st.from : st.to)][6]));
  if (bonuses.length) bonuses[0] = { ...bonuses[0], label: `${shortName(w)}: ${bonuses[0].label}` };
  const extra = amp.lv > 0 ? ampBonuses(amp.text) : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Each camp has four sockets: Debut, Attack, Support, and Defense. Pick the UR or the SSR in a socket, then set the stars you have and the stars you want.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Switch value={camp} options={CAMPS.map((c) => ({ value: c, label: c }))} onChange={(v) => patch((x) => ({ ...x, wcamp: v }))} />
        <Switch value={s.wmode} options={[{ value: "one", label: "Selected" }, { value: "all", label: "Whole camp" }]} onChange={(v) => patch((x) => ({ ...x, wmode: v }))} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {lines.map((l) => (
          <button key={l.sock.mt} type="button" aria-pressed={l.sock.mt === mt} onClick={() => patch((x) => ({ ...x, wmt: l.sock.mt }))}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs ${l.sock.mt === mt ? "border-primary bg-surface-2" : "border-line bg-surface"}`}>
            <span className="text-muted">{l.sock.name}</span>
            <Pic cfg={cfg} name={l.w.zr_img} size={56} alt={l.w.zr_n} />
            <span className="text-center">{shortName(l.w)}</span>
            <b>{l.st.from < 0 ? "—" : `${l.st.from}★`}</b>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={s.wmode === "all" ? `${camp} · all four sockets` : `${camp} · ${SOCK[mt].name}`}>
          {s.wmode === "all" ? (
            <WholeCamp lines={lines} cfg={cfg} />
          ) : (
            <>
              <BigNum kicker={shortName(w)} value={num(need)} sub={`Copies to reach ${starText(st.to)} from ${starText(st.from)}`} />
              <p className="mt-3 flex items-center gap-2 text-sm"><Pic cfg={cfg} name={w.zr_img} size={36} alt={w.zr_n} /><b>× {num(need)}</b> same wingman</p>
              {craft && need > 0 && <Small>Or craft them: {num(need * craft.n)} {craft.item.zr_n}{w.zr_lab ? ` from Wingman Lab Lv.${w.zr_lab}` : ""}.</Small>}
              {!need && <Small>Current stars already meet the target.</Small>}
            </>
          )}
        </Card>

        <Card title={w.zr_n}>
          <div className="mb-3 flex items-center gap-3">
            <Pic cfg={cfg} name={w.zr_img} size={64} alt={w.zr_n} />
            <p className="flex-1 text-xs text-muted">{RAR[w.zr_q]} · power at target</p>
            <b className="text-xl tabular-nums text-gold">{num(tgtPow)}</b>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <Select label="Quality" value={w.zr_id}
              options={socketOptions(wings, camp, mt).map((o) => ({ value: o.zr_id, label: `${RAR[o.zr_q]} · ${shortName(o)}` }))}
              onChange={(v) => patch((x) => ({ ...x, wfit: { ...x.wfit, [`${camp}-${mt}`]: v } }))} />
            {amp.on && (
              <Select label="Amplification" value={amp.lv}
                options={Array.from({ length: amp.max + 1 }, (_, a) => ({ value: a, label: `+${a}` }))}
                onChange={(v) => patch((x) => ({ ...x, wamp: { ...x.wamp, [w.zr_id]: v } }))} />
            )}
            {mx > 0 && (
              <>
                <Select label="Current stars" value={st.from} options={starOpts(true)}
                  onChange={(v) => setSt(w, { from: v, to: Math.max(st.to, v) })} />
                <Select label="Target stars" value={st.to} options={starOpts(false)}
                  onChange={(v) => setSt(w, v < st.from ? { to: v, from: v } : { to: v })} />
              </>
            )}
          </div>
          <StatList rows={bonuses.concat(extra)} />
        </Card>
      </div>
    </div>
  );
}

function WholeCamp({ lines, cfg }: { lines: { sock: { name: string }; w: Wing; copies: number; craft: ReturnType<typeof craftOf> }[]; cfg: Cfg }) {
  let ur = 0, ssr = 0, other = 0;
  const comp: Record<string, number> = {};
  lines.forEach((l) => {
    if (l.w.zr_q === 1) ur += l.copies; else if (l.w.zr_q === 2) ssr += l.copies; else other += l.copies;
    if (l.craft && l.copies) comp[l.craft.item.zr_n] = (comp[l.craft.item.zr_n] || 0) + l.copies * l.craft.n;
  });
  return (
    <>
      <h3 className="font-semibold">Copies to each target</h3>
      <p className="text-xs text-muted">UR {num(ur)} · SSR {num(ssr)}{other ? ` · other ${num(other)}` : ""}. Each socket uses copies of its own wingman.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {lines.map((l) => (
          <li key={l.sock.name} className="flex items-center gap-2"><Pic cfg={cfg} name={l.w.zr_img} size={28} /><span className="flex-1">{l.sock.name} · {shortName(l.w)}</span><b>× {num(l.copies)}</b></li>
        ))}
      </ul>
      {Object.keys(comp).map((n) => <Small key={n}>{n} if crafted: {num(comp[n])}.</Small>)}
    </>
  );
}

/* ---------- buildings ---------- */
function BuildingTab({ s, patch, cfg, bld, items }: { s: SFState; patch: Patch; cfg: Cfg; bld: Extract<Slice, { tab: "bld" }>["bld"]; items: Slice["items"] }) {
  const list = bld.filter((b) => b.zr_id !== 6002);
  const alt = bld.find((b) => b.zr_id === 6002);
  const res = (f: string, alt: string) => <img src={`${cfg.res}${f}`} alt={alt} width={20} height={20} className="size-5 object-contain" />;
  const G = { f: 0, m: 0, o: 0, s: 0, p: 0 };
  const cards = list.map((b) => {
    const mx = bMax(b);
    const cur = s.bld[b.zr_id];
    const from = clamp(cur?.from ?? 0, 0, mx);
    const to = Math.max(from, clamp(cur?.to ?? mx, 0, mx));
    const t = bSum(b, from, to);
    const pa = b.zr_lv[from][5] as number, pb = b.zr_lv[to][5] as number;
    G.f += t.f; G.m += t.m; G.o += t.o; G.s += t.s; G.p += pb - pa;
    const set = (p: { from: number; to: number }) => patch((x) => ({ ...x, bld: { ...x.bld, [b.zr_id]: p } }));
    return (
      <article key={b.zr_id} className="rounded-2xl border border-line bg-surface p-4">
        <header className="mb-3 flex items-center gap-3">
          <Pic cfg={cfg} name={b.zr_img} size={56} alt={b.zr_n} />
          <div><h3 className="font-semibold">{b.zr_n}</h3><p className="text-xs text-muted">Levels 0 to {mx}</p></div>
        </header>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <NumberField label="Current" value={from} min={0} max={mx} onChange={(v) => set({ from: v, to: Math.max(to, v) })} />
          <NumberField label="Target" value={to} min={0} max={mx} onChange={(v) => set(v < from ? { from: v, to: v } : { from, to: v })} />
        </div>
        <Costs list={[
          { label: "Food", v: t.f, icon: res("zr_food.png", "Food") },
          { label: "Metal", v: t.m, icon: res("zr_wood.png", "Metal") },
          { label: "Oil", v: t.o, icon: res("zr_stone.png", "Oil") },
          { label: "Time", v: t.s, text: clock(t.s) },
          { label: "Power", v: pb - pa, text: `+${num(pb - pa)}` },
          { label: "Hero Exp reward", v: t.x, soft: true, icon: <Pic cfg={cfg} name={items.zr_heroexp.zr_img} alt="Hero Exp" size={20} /> },
        ]} />
        {t.pre.length > 0 && <Small>Needs {t.pre.join(", ")}.</Small>}
        {b.zr_id === 5036 && alt && <Small>A second Fighter Command entry in the data lists {num(alt.zr_lv[1][2] as number)} Food, {num(alt.zr_lv[1][3] as number)} Metal, and {clock(alt.zr_lv[1][1] as number)}.</Small>}
      </article>
    );
  });
  return (
    <div className="space-y-4">
      <Card title="All fighter buildings">
        <Costs list={[
          { label: "Food", v: G.f, icon: res("zr_food.png", "Food"), always: true },
          { label: "Metal", v: G.m, icon: res("zr_wood.png", "Metal"), always: true },
          { label: "Oil", v: G.o, icon: res("zr_stone.png", "Oil"), always: true },
          { label: "Time", v: G.s, text: clock(G.s) },
          { label: "Power", v: G.p, text: `+${num(G.p)}` },
        ]} />
        <Small>Times are without speedups or research.</Small>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">{cards}</div>
    </div>
  );
}

