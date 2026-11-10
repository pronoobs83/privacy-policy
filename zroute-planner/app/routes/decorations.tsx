import { useMemo, useState } from "react";
import { Card, PageHeader, SearchBox, Select, SourceNote, Stat, Tabs, fmt } from "~/components/ui";
import { useToolState } from "~/lib/store";
import { decorations } from "~/tools/decorations/data.server";
import { effects, fmtStat, hasStar, idx, label, plan } from "~/tools/decorations/calc";
import type { Route } from "./+types/decorations";

export function meta() {
  return [
    { title: "Decoration Calculator – Z Route Planner" },
    { name: "description", content: "Calculate decoration shards needed between any level and star, with stat gains and Universal Decor Component exchange value." },
  ];
}

export async function loader() {
  const { data } = decorations;
  return { decos: data.decos, base: data.base, univ: data.univ };
}

type State = { d: number; fl: number; fs: number; tl: number; ts: number };

export default function Decorations({ loaderData }: Route.ComponentProps) {
  const { decos, base, univ } = loaderData;
  const [st, setSt] = useToolState<State>("decorations", { d: decos[0].id, fl: 1, fs: 0, tl: decos[0].max, ts: 0 });
  const [q, setQ] = useState("ALL");
  const [text, setText] = useState("");
  const img = (f: string) => base + encodeURIComponent(f);

  const d = decos.find((x) => x.id === st.d) ?? decos[0];
  const clamp = (l: number) => Math.max(1, Math.min(d.max, l || 1));
  const fl = clamp(st.fl), tl = clamp(st.tl);
  const fs = hasStar(d, fl) ? st.fs : 0, ts = hasStar(d, tl) ? st.ts : 0;
  const a = idx(d, fl, fs), b = idx(d, tl, ts);

  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    return decos.filter((x) => (q === "ALL" || x.q === q) && (!t || `${x.n} ${x.q} ${x.bt.map((y) => y.t).join(" ")}`.toLowerCase().includes(t)));
  }, [decos, q, text]);
  const options = shown.some((x) => x.id === d.id) ? shown : [d, ...shown];

  const levelOpts = (min: number) => Array.from({ length: d.max - min + 1 }, (_, i) => ({ value: min + i, label: `Level ${min + i}` }));
  const starOpts = (l: number) => hasStar(d, l)
    ? [0, 1, 2, 3].map((s) => ({ value: s, label: `${s} star${s === 1 ? "" : "s"}` }))
    : [{ value: 0, label: "No stars at this level" }];

  const set = (p: Partial<State>) => setSt({ d: d.id, fl, fs, tl, ts, ...p });
  const pick = (id: number) => { const n = decos.find((x) => x.id === id)!; setSt({ d: id, fl: 1, fs: 0, tl: n.max, ts: 0 }); };
  const setFrom = (l: number) => {
    const next: Partial<State> = { fl: l, fs: 0 };
    if (tl < l) { next.tl = Math.min(d.max, l + 1); next.ts = 0; }
    set(next);
  };
  const setTo = (l: number) => set({ tl: l, ts: hasStar(d, l) ? 3 : 0 });

  const p = plan(d, a, b);
  const ea = effects(d, a), eb = effects(d, b);

  return (
    <div>
      <PageHeader title="Decoration Calculator" subtitle="Pick a decoration and a start and target level/star to see the shards needed." image={img(d.img)} />
      <Card>
        <Tabs value={q} tabs={["ALL", "UR", "SSR", "SR"].map((v) => ({ value: v, label: v === "ALL" ? "All" : v }))} onChange={setQ} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div><SearchBox value={text} onChange={setText} placeholder="Search name or stat" /></div>
          <Select<number> value={d.id} options={options.map((x) => ({ value: x.id, label: `${x.n} (${x.q})` }))} onChange={pick} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select<number> label="From level" value={fl} options={levelOpts(1)} onChange={setFrom} />
          <Select<number> label="From stars" value={fs} options={starOpts(fl)} onChange={(v) => set({ fs: v })} />
          <Select<number> label="To level" value={tl} options={levelOpts(1)} onChange={setTo} />
          <Select<number> label="To stars" value={ts} options={starOpts(tl)} onChange={(v) => set({ ts: v })} />
        </div>
      </Card>

      <Card className="mt-4" title={<span className="flex items-center gap-3"><img src={img(d.img)} alt={d.n} width={64} height={64} loading="lazy" className="size-16 object-contain" />{d.n} <span className="text-sm text-gold">{d.q}</span></span>}>
        {d.desc && <p className="text-sm text-muted">{d.desc}</p>}
        <p className="mb-3 text-sm text-muted">Max level {d.max}{d.star ? ` · stars on levels ${d.starlv.join(", ")}` : ""} · {d.size[0]}×{d.size[1]} · {fmt(d.tot)} shards to max</p>
        {b <= a ? (
          <p>Already at <strong>{label(d, b)}</strong> or past it. Pick a target above {label(d, a)}. From here to max is {fmt(d.tot - p.spent)} shards.</p>
        ) : (
          <>
            <p className="mb-3 text-lg"><strong className="text-accent">{fmt(p.total)}</strong> {d.n} shards from {label(d, a)} to {label(d, b)}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Shards needed" value={fmt(p.total)} />
              <Stat label={`Already in it (${label(d, a)})`} value={fmt(p.spent)} />
              <Stat label="Left after target, to max" value={fmt(p.left)} />
              {d.ex > 0 && <Stat label={`Universal Decor Component (${fmt(d.ex)}/shard)`} value={<span className="flex items-center gap-1">{univ && <img src={img(univ)} alt="" className="size-5" />}{fmt(p.total * d.ex)}</span>} />}
            </div>
            {!d.ex && <p className="mt-2 text-xs text-muted">No Universal Decor Component exchange is listed for this decoration.</p>}

            <h3 className="mb-2 mt-5 font-semibold">Stats: {label(d, a)} → {label(d, b)}</h3>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-muted"><th>Stat</th><th>Now</th><th>At target</th><th>Gain</th></tr></thead>
              <tbody>{d.bt.map((t, i) => {
                const x = ea[i] ?? { b: 0, x: 0 }, y = eb[i] ?? { b: 0, x: 0 };
                if (!x.b && !x.x && !y.b && !y.x) return null;
                const show = (v: { b: number; x: number }) => fmtStat(v.b, t.p) + (v.x ? ` + ${fmtStat(v.x, t.p).slice(1)} star` : "");
                const dl = y.b + y.x - (x.b + x.x);
                return <tr key={i} className="border-t border-line"><td className="py-1">{t.t}</td><td>{show(x)}</td><td>{show(y)}</td><td className={dl > 0 ? "text-success" : ""}>{dl >= 0 ? fmtStat(dl, t.p) : `−${fmtStat(-dl, t.p).slice(1)}`}</td></tr>;
              })}</tbody>
            </table></div>
            {d.star && <p className="mt-1 text-xs text-muted">"star" is the star bonus listed separately in the game data. Gain adds base and star bonus.</p>}

            <h3 className="mb-2 mt-5 font-semibold">Shards step by step</h3>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-muted"><th>Step</th><th>Shards</th><th>Running total</th></tr></thead>
              <tbody>{p.rows.map((r) => <tr key={r.to} className="border-t border-line"><td className="py-1">{label(d, r.from)} → {label(d, r.to)}</td><td className="tabular-nums">{fmt(r.c)}</td><td className="tabular-nums">{fmt(r.run)}</td></tr>)}</tbody>
            </table></div>
          </>
        )}
      </Card>
      <SourceNote href="https://zrouteguide.com/tools/decoration-calculator/" />
    </div>
  );
}
