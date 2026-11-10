import { useMemo, useState } from "react";
import { Button, Card, Collapsible, PageHeader, Select, SourceNote, Stat, compact, duration, fmt } from "~/components/ui";
import { useToolState } from "~/lib/store";
import { allianceTech } from "~/tools/alliance-tech/data.server";
import { catSum, cost, effect, fill, index, lvOf, missing, sanitize, unlocked, type Levels, type Tech } from "~/tools/alliance-tech/calc";
import type { Route } from "./+types/alliance-tech";

export function meta() {
  return [
    { title: "Alliance Tech Calculator – Z Route Planner" },
    { name: "description", content: "Track alliance tech levels and see the donation points, oil and research time left to max General, Resources and Troops techs." },
  ];
}

export async function loader() {
  const { data } = allianceTech;
  return { techs: data.techs, cats: data.cats, base: data.base, oil: data.oil };
}

export default function AllianceTech({ loaderData }: Route.ComponentProps) {
  const { techs, cats, base, oil } = loaderData;
  const by = useMemo(() => index(techs), [techs]);
  const [state, setState] = useToolState<{ levels: Levels }>("alliance-tech", { levels: {} });
  const [cat, setCat] = useState<string>(cats[0]);
  const [open, setOpen] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ id: number; level: number } | null>(null);
  const levels = useMemo(() => sanitize(state.levels, by), [state.levels, by]);
  const img = (f: string) => base + encodeURIComponent(f);

  const byCat = useMemo(() => {
    const m: Record<string, Tech[]> = {};
    for (const t of techs) (m[t.cat] ||= []).push(t);
    for (const c of Object.keys(m)) m[c].sort((a, b) => a.row - b.row || a.ord - b.ord);
    return m;
  }, [techs]);

  const commit = (next: Levels) => setState({ levels: sanitize(next, by) });
  const choose = (t: Tech, want: number) => {
    if (want > 0 && !unlocked(t, levels)) { setNotice({ id: t.id, level: want }); setOpen(t.id); return; }
    setNotice(null);
    const next = { ...levels };
    if (want) next[t.id] = want; else delete next[t.id];
    commit(next);
  };
  const completeEarlier = () => {
    if (!notice) return;
    const next = { ...levels };
    fill(notice.id, notice.level, next, by);
    next[notice.id] = notice.level;
    setNotice(null);
    commit(next);
  };
  const bulk = (toMax: boolean) => {
    const next = { ...levels };
    for (const t of byCat[cat]) { if (toMax) fill(t.id, t.max, next, by); else delete next[t.id]; }
    setNotice(null);
    commit(next);
  };

  const list = byCat[cat] || [];
  const sum = catSum(list, levels);
  const rows = [...new Set(list.map((t) => t.row))];

  return (
    <div>
      <PageHeader title="Alliance Tech Calculator" subtitle="Set each tech's level to see what is left in donation points, oil and research time." image={img(list[0]?.img ?? "")} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cats.map((c) => {
          const s = catSum(byCat[c] || [], levels);
          return (
            <button key={c} type="button" onClick={() => { setCat(c); setOpen(null); setNotice(null); }}
              className={`rounded-2xl border p-3 text-left ${c === cat ? "border-primary bg-surface-2" : "border-line bg-surface hover:border-line-strong"}`}>
              <div className="flex items-baseline justify-between"><span className="font-display font-semibold">{c}</span><span className="text-sm text-accent">{s.pct}%</span></div>
              <div className="text-xs text-muted">{s.done} of {s.n} techs maxed</div>
              <div className="mt-1 text-xs text-muted">{s.dp || s.oil || s.t ? `${compact(s.dp)} DP · ${compact(s.oil)} oil · ${duration(s.t)}` : "Everything here is maxed."}</div>
            </button>
          );
        })}
      </div>

      <Card title={`${cat} – remaining`} actions={<><Button variant="ghost" onClick={() => bulk(true)}>Max all</Button><Button variant="ghost" onClick={() => bulk(false)}>Reset</Button></>}>
        {sum.dp || sum.oil || sum.t ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Donation points" value={compact(sum.dp)} hint={fmt(sum.dp)} />
            <Stat label="Oil" value={<span className="flex items-center gap-1"><img src={img(oil)} alt="" className="size-4" />{compact(sum.oil)}</span>} hint={fmt(sum.oil)} />
            <Stat label="Time" value={duration(sum.t)} />
            <Stat label="Maxed" value={`${sum.done} / ${sum.n}`} />
          </div>
        ) : <p className="text-sm text-muted">Nothing left in this category.</p>}
      </Card>

      <div className="mt-4 space-y-4">
        {rows.map((r) => (
          <div key={r} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {list.filter((t) => t.row === r).map((t) => {
              const cur = lvOf(levels, t.id), ok = unlocked(t, levels), isOpen = open === t.id;
              const outside = t.req.filter((q) => !t.links.includes(q.id));
              const met = outside.every((q) => lvOf(levels, q.id) >= q.lv);
              const rem = cost(t, cur, t.max);
              return (
                <div key={t.id} className={`rounded-2xl border bg-surface p-3 ${cur === t.max ? "border-success" : "border-line"} ${ok || cur ? "" : "opacity-70"}`}>
                  <div className="flex items-center gap-3">
                    <img src={img(t.img)} alt="" width={56} height={56} loading="lazy" className="size-14 rounded-lg bg-surface-2 object-contain" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{t.n}</div>
                      <div className="text-xs text-muted">{ok || cur ? `Level ${cur} / ${t.max}` : `Locked · 0 / ${t.max}`}</div>
                      <div className="mt-1 flex gap-0.5">{Array.from({ length: t.max }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded ${i < cur ? "bg-primary" : "bg-line"}`} />)}</div>
                    </div>
                    <Select<number> value={cur} options={Array.from({ length: t.max + 1 }, (_, i) => ({ value: i, label: String(i) }))} onChange={(v) => choose(t, v)} />
                  </div>
                  {outside.length > 0 && (
                    <p className={`mt-2 text-xs ${met ? "text-success" : "text-warning"}`}>
                      {met ? "✓ " : "Needs "}{outside.map((q) => `${by[q.id].n} Lv. ${q.lv}`).join(", ")}
                    </p>
                  )}
                  <button type="button" className="mt-2 text-xs text-accent hover:underline" onClick={() => setOpen(isOpen ? null : t.id)}>{isOpen ? "Hide details" : "Details"}</button>
                  {isOpen && (
                    <div className="mt-2 space-y-2 border-t border-line pt-2 text-sm">
                      <p className="text-muted" dangerouslySetInnerHTML={{ __html: t.desc.replace(/\n/g, "<br>") }} />
                      {notice?.id === t.id && (
                        <div className="rounded-lg border border-warning/50 p-2">
                          <p className="font-medium">{t.n} Lv. {notice.level} needs:</p>
                          <ul className="list-disc pl-5 text-muted">{missing(t, levels, by).map((s) => <li key={s}>{s}</li>)}</ul>
                          <Button className="mt-2" onClick={completeEarlier}>Complete earlier techs</Button>
                        </div>
                      )}
                      {cur < t.max && <p className="text-xs text-muted">Left to max: {fmt(rem.dp)} DP · {fmt(rem.oil)} oil · {duration(rem.t)}</p>}
                      <Collapsible title="Levels">
                        <div className="overflow-x-auto"><table className="w-full text-xs">
                          <thead><tr className="text-left text-muted"><th>Lv</th><th>DP</th><th>Oil</th><th>Time</th><th>Effect</th></tr></thead>
                          <tbody>{t.lv.map((x) => (
                            <tr key={x.l} className={x.l <= cur ? "text-success" : ""}>
                              <td>{x.l}</td><td>{fmt(x.dp)}</td><td>{fmt(x.oil)}</td><td>{duration(x.t)}</td><td>{x.b.map(effect).join("; ")}</td>
                            </tr>
                          ))}</tbody>
                        </table></div>
                      </Collapsible>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <SourceNote href="https://zrouteguide.com/tools/alliance-tech-calculator/" />
    </div>
  );
}
