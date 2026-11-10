import { Button, Card, Collapsible, PageHeader, Select, SourceNote, Stat, fmt } from "~/components/ui";
import { useToolState } from "~/lib/store";
import { vip } from "~/tools/vip/data.server";
import { lvOfPoints, plan, privName, privValue, usd, type Item, type Pack } from "~/tools/vip/calc";
import type { Route } from "./+types/vip";

export function meta() {
  return [
    { title: "VIP Calculator – Z Route Planner" },
    { name: "description", content: "How many VIP points you need for VIP 18 in Z Route: Redemption, with privileges, free packs and login streak points per level." },
  ];
}

export async function loader() {
  return vip.data;
}

type State = { p: number; to: number; day: number };

export default function Vip({ loaderData: D }: Route.ComponentProps) {
  const L = D.levels, MAX = D.max;
  const [st, setSt] = useToolState<State>("vip", { p: 0, to: MAX, day: 0 });
  const img = (base: string, f?: string, size = 22) => f ? <img src={base + encodeURIComponent(f)} alt="" width={size} height={size} loading="lazy" className="inline-block" /> : null;
  const chips = (a: Item[]) => (
    <ul className="flex flex-wrap gap-2">{a.map((x) => <li key={x.n} className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs">{img(D.base, x.i)}{x.n} ×{fmt(x.c)}</li>)}</ul>
  );
  const pack = (k: Pack) => (
    <div className="flex gap-3">
      {k.i && <img src={D.pbase + k.i} alt="" width={72} height={76} loading="lazy" className="h-[76px] w-[72px] shrink-0 object-contain" />}
      <div className="min-w-0 space-y-1">
        <p className="text-sm"><strong>{k.n}</strong> · <span className="text-gold">{usd(k.usd)}</span> · limit {k.lim}{k.vc ? ` · includes ${fmt(k.vc)} VIP Credit` : ""}</p>
        {chips(k.r)}
      </div>
    </div>
  );

  const p = Math.max(0, Math.min(L[MAX - 1].exp, Math.floor(st.p) || 0));
  const a = lvOfPoints(L, p);
  const to = Math.max(1, Math.min(MAX, st.to));
  const cur = L[a - 1], nx = a < MAX ? L[a] : null;
  const lvOpts = Array.from({ length: MAX }, (_, i) => ({ value: i + 1, label: `VIP ${i + 1}` }));
  const set = (n: Partial<State>) => setSt({ p, to, day: st.day, ...n });

  const r = to > a ? plan(D, p, to, st.day) : null;
  const tg = L[to - 1];
  const rows = D.privs.filter((q) => cur.pv[q.id] !== tg.pv[q.id]);

  return (
    <div>
      <PageHeader title="VIP Calculator" subtitle="Work out the VIP points you need, the free packs and the privileges at each level." />
      <Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Current VIP points</span>
            <input type="number" inputMode="numeric" min={0} max={L[MAX - 1].exp} value={p}
              onChange={(e) => set({ p: Math.max(0, Math.min(L[MAX - 1].exp, parseInt(e.target.value, 10) || 0)) })}
              className="rounded-lg border border-line bg-bg px-3 py-2 tabular-nums outline-none focus:border-accent" />
          </label>
          <Select<number> label="Or set VIP level" value={a} options={lvOpts} onChange={(v) => set({ p: L[v - 1].exp, to: to <= v ? Math.min(MAX, v + 1) : to })} />
          <Select<number> label="Target VIP" value={to} options={lvOpts} onChange={(v) => set({ to: v })} />
          <Select<number> label="Login streak day" value={st.day} options={[{ value: 0, label: "Not tracking" }, ...D.login.map((x) => ({ value: x.d, label: `Day ${x.d}` }))]} onChange={(v) => set({ day: v })} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => set({ to: Math.min(MAX, a + 1) })}>Next level</Button>
          <Button variant="ghost" onClick={() => set({ to: MAX })}>VIP {MAX}</Button>
        </div>
        <p className="mt-3 text-sm text-muted">You are <strong className="text-ink">VIP {a}</strong> with {fmt(p)} points{nx ? ` · ${fmt(nx.exp - p)} to VIP ${a + 1}` : " · max level"}.</p>
      </Card>

      <Card className="mt-4">
        {!r ? (
          <div className="space-y-3">
            <p>You already have <strong>VIP {to}</strong>. {a >= MAX ? "That is the top VIP level." : `Pick a target above VIP ${a} to see what is left.`}</p>
            <h3 className="font-semibold">Your VIP {a} daily free pack</h3>{chips(cur.free)}
            <h3 className="font-semibold">One-time pack listed for VIP {a}</h3>{pack(cur.pack)}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-lg"><strong className="text-accent">{fmt(r.need)}</strong> VIP points to reach VIP {to}</p>
            <div>
              <div className="h-2 overflow-hidden rounded bg-line" role="img" aria-label={`${r.pct.toFixed(1)}% of the way to VIP ${to}`}><span className="block h-full bg-primary" style={{ width: `${r.pct}%` }} /></div>
              <p className="mt-1 text-xs text-muted">{r.pct.toFixed(1)}% of the {fmt(tg.exp)} points VIP {to} needs in total.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={`Min days on Diamonds (${fmt(D.cap)}/day cap)`} value={`${fmt(r.days)} day${r.days === 1 ? "" : "s"}`} />
              <Stat label="Diamonds at 1 per point" value={fmt(r.need)} />
              <Stat label={`VIP ${a} → VIP ${to}`} value={`${to - a} level${to - a === 1 ? "" : "s"}`} />
              <Stat label={`One-time packs (${fmt(r.vc)} VIP Credit inside)`} value={`${r.count} · ${usd(r.packUsd)}`} />
            </div>
            <p className="text-sm text-muted">
              {st.day
                ? <><strong className="text-ink">Login tip:</strong> claiming days {st.day}–{D.login[D.login.length - 1].d} gives {fmt(r.loginPts)} points over {r.loginDays} day{r.loginDays === 1 ? "" : "s"}{r.loginPts >= r.need ? ", enough for this target." : `, ${fmt(Math.max(0, r.need - r.loginPts))} short of this target.`}</>
                : <><strong className="text-ink">Login tip:</strong> login days 1–{D.login.length} give {fmt(r.loginTotal)} points in total. Pick today's login day above to count what is left.</>}
            </p>
            <p className="text-xs text-muted">Privileges and free packs need active VIP time. Each level-up adds 60 minutes, and you can claim the new level's free pack again the same day.</p>

            <h3 className="font-semibold">Privileges that change (VIP {a} → VIP {to})</h3>
            {rows.length ? (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-muted"><th>Privilege</th><th>Now (VIP {a})</th><th>At VIP {to}</th></tr></thead>
                <tbody>{rows.map((q) => <tr key={q.id} className="border-t border-line"><td className="py-1">{privName(q.n)}</td><td>{privValue(q, cur.pv[q.id])}</td><td className="text-success">{privValue(q, tg.pv[q.id])}</td></tr>)}</tbody>
              </table></div>
            ) : <p className="text-sm text-muted">No privilege changes.</p>}

            <h3 className="font-semibold">Daily free pack: VIP {a} now vs VIP {to}</h3>
            <p className="text-xs text-muted">Now:</p>{chips(cur.free)}
            <p className="text-xs text-muted">At VIP {to}:</p>{chips(tg.free)}

            <h3 className="font-semibold">Level by level</h3>
            <div className="space-y-2">
              {L.slice(a, to).map((l) => (
                <Collapsible key={l.lv} defaultOpen={l.lv === a + 1 || l.lv === to} title={<span>VIP {l.lv} <span className="text-xs text-muted">{fmt(l.exp)} total · +{fmt(l.step)} from VIP {l.lv - 1} · {fmt(Math.max(0, l.exp - p))} from you</span></span>}>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">New privileges</h4>
                    {l.new.length ? <ul className="flex flex-wrap gap-2">{l.new.map((x) => <li key={x} className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-success">{x}</li>)}</ul> : <p className="text-sm text-muted">None.</p>}
                    <h4 className="text-sm font-semibold">Daily free pack</h4>{chips(l.free)}
                    <h4 className="text-sm font-semibold">One-time pack</h4>{pack(l.pack)}
                  </div>
                </Collapsible>
              ))}
            </div>
            {a >= 1 && <p className="text-xs text-muted">Still at VIP {a}? Its own one-time pack, {cur.pack.n} ({usd(cur.pack.usd)}), is not counted above.</p>}
          </div>
        )}
      </Card>
      <SourceNote href="https://zrouteguide.com/tools/vip-calculator/" />
    </div>
  );
}
