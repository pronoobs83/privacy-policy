import { useState } from "react";
import { Link } from "react-router";
import { Button, Card, CostList, NumberField, PageHeader, Stat, duration, fmt } from "~/components/ui";
import { useToolState } from "~/lib/store";
import { addTotals, buffSummary, emptyTotals, nodeTotals, progress, type Category, type Node } from "./calc";

type State = { lv: Record<string, number>; tg: Record<string, number> };
const INITIAL: State = { lv: {}, tg: {} };
const CW = 104, RH = 132;

function prune(o: Record<string, number>, ids: Set<string>, value: (id: string) => number) {
  const out = { ...o };
  for (const id of ids) if (value(id) <= 0) delete out[id];
  return out;
}

export function ResearchTree({ category, nodes, external }: {
  category: Category; nodes: Node[]; external: Record<string, { name: string; category: string }>;
}) {
  const [st, setSt] = useToolState<State>("research", INITIAL);
  const [selId, setSel] = useState<string | null>(null);
  const lv = st.lv ?? {}, tg = st.tg ?? {};
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cur = (n: Node) => Math.min(lv[n.id] ?? 0, n.max);
  const tgt = (n: Node) => Math.min(Math.max(tg[n.id] ?? 0, cur(n)), n.max);
  const levelOfId = (id: string) => Math.min(lv[id] ?? 0, byId.get(id)?.max ?? 99);

  const setCur = (n: Node, v: number) => {
    const nl = { ...lv, [n.id]: v };
    if (v <= 0) delete nl[n.id];
    const nt = { ...tg };
    if ((nt[n.id] ?? 0) <= v) delete nt[n.id];
    setSt({ lv: nl, tg: nt });
  };
  const setTgt = (n: Node, v: number) => {
    const nt = { ...tg, [n.id]: v };
    if (v <= cur(n)) delete nt[n.id];
    setSt({ lv, tg: nt });
  };
  const ids = new Set(nodes.map((n) => n.id));
  const setAll = (fn: (n: Node) => number) => {
    const nl = { ...lv };
    for (const n of nodes) nl[n.id] = fn(n);
    setSt({ lv: prune(nl, ids, (id) => nl[id]), tg: prune(tg, ids, () => 0) });
  };

  const rows = Math.max(1, ...nodes.map((n) => n.row));
  const cols = Math.max(1, ...nodes.map((n) => n.col));
  const pos = (n: Node) => ({ x: (n.col - 1) * CW + CW / 2, y: (n.row - 1) * RH + 40 });
  const edges = nodes.flatMap((n) => n.prereqs.filter((p) => byId.has(p.id)).map((p) => [byId.get(p.id)!, n] as const));

  const spent = nodes.reduce((t, n) => addTotals(t, nodeTotals(n, 0, cur(n))), emptyTotals());
  const remaining = nodes.reduce((t, n) => addTotals(t, nodeTotals(n, cur(n), n.max)), emptyTotals());
  const plan = nodes.reduce((t, n) => addTotals(t, nodeTotals(n, cur(n), tgt(n))), emptyTotals());
  const planned = nodes.filter((n) => tgt(n) > cur(n));
  const prog = progress(nodes, lv);
  const buffs = buffSummary(nodes, lv);
  const sel = selId ? byId.get(selId) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader title={`${category.name} Research`} image={category.icon}
        subtitle={<>{category.gates[0]} · <Link to="/research" className="text-accent hover:underline">All categories</Link></>}>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setAll((n) => n.max)}>Max all</Button>
          <Button variant="ghost" onClick={() => setAll(() => 0)}>Reset</Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Progress" value={`${prog.have}/${prog.max} · ${prog.pct}%`} />
        <Stat label="Time to finish" value={duration(remaining.timeSec)} />
        <Stat label="Power to gain" value={`+${fmt(remaining.power)}`} />
        <Stat label="Power earned" value={fmt(spent.power)} />
      </div>

      <Card title="Remaining to finish category"><CostList costs={remaining.costs} /></Card>

      {planned.length > 0 && (
        <Card title={`Selected upgrades (${planned.length})`} actions={<Button variant="ghost" onClick={() => setSt({ lv, tg: {} })}>Clear</Button>}>
          <p className="mb-2 text-sm text-muted">{duration(plan.timeSec)} · +{fmt(plan.power)} power</p>
          <CostList costs={plan.costs} />
          <ul className="mt-3 divide-y divide-line text-sm">
            {planned.map((n) => (
              <li key={n.id} className="flex items-center gap-2 py-1.5">
                <img src={n.icon} alt="" className="size-7 object-contain" />
                <button className="flex-1 truncate text-left hover:text-accent" onClick={() => setSel(n.id)}>{n.name}</button>
                <span className="tabular-nums text-muted">Lv {cur(n)} → {tgt(n)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="overflow-auto rounded-2xl border border-line bg-surface p-3">
        <div className="relative" style={{ width: cols * CW, height: rows * RH }}>
          <svg className="pointer-events-none absolute inset-0" width={cols * CW} height={rows * RH} aria-hidden>
            {edges.map(([a, b]) => {
              const p = pos(a), q = pos(b);
              const ok = cur(a) >= (b.prereqs.find((x) => x.id === a.id)?.level ?? 1);
              const my = (p.y + q.y) / 2;
              return <path key={a.id + b.id} d={`M${p.x} ${p.y + 28} V${my} H${q.x} V${q.y - 30}`} fill="none" strokeWidth={2}
                className={ok ? "stroke-success/70" : "stroke-line-strong"} />;
            })}
          </svg>
          {nodes.map((n) => {
            const c = cur(n), done = c === n.max;
            const unmet = n.prereqs.some((p) => (byId.has(p.id) ? levelOfId(p.id) : 0) < p.level && byId.has(p.id));
            return (
              <button key={n.id} type="button" onClick={() => setSel(n.id === selId ? null : n.id)}
                style={{ left: (n.col - 1) * CW + 4, top: (n.row - 1) * RH + 4, width: CW - 8 }}
                className={`absolute flex flex-col items-center gap-1 rounded-xl border p-1.5 text-center ${selId === n.id ? "border-accent" : done ? "border-success/70" : "border-line"} bg-surface-2 ${unmet && c === 0 ? "opacity-60" : ""}`}>
                <img src={n.icon} alt="" loading="lazy" className="size-12 object-contain" />
                <span className="line-clamp-2 h-7 text-[11px] leading-[14px]">{n.name}</span>
                <span className="flex w-full gap-0.5">
                  {Array.from({ length: Math.min(n.max, 10) }, (_, i) => (
                    <span key={i} className={`h-1 flex-1 rounded ${i < Math.round((c / n.max) * Math.min(n.max, 10)) ? "bg-primary" : "bg-line"}`} />
                  ))}
                </span>
                <span className="text-[11px] tabular-nums text-muted">{c}/{n.max}</span>
              </button>
            );
          })}
        </div>
      </div>

      {sel && <NodeDetail n={sel} cur={cur(sel)} tgt={tgt(sel)} external={external} byId={byId} levelOf={levelOfId}
        onCur={(v) => setCur(sel, v)} onTgt={(v) => setTgt(sel, v)} onClose={() => setSel(null)} />}

      <Card title="Current buffs from this category">
        {buffs.length === 0 ? <p className="text-sm text-muted">Set some research levels to see buffs.</p> : (
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {buffs.map((b) => <li key={b.label} className="flex justify-between border-b border-line py-1"><span>{b.label}</span><strong className="tabular-nums text-success">{b.value}</strong></li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}

function NodeDetail({ n, cur, tgt, external, byId, levelOf, onCur, onTgt, onClose }: {
  n: Node; cur: number; tgt: number; external: Record<string, { name: string; category: string }>;
  byId: Map<string, Node>; levelOf: (id: string) => number;
  onCur: (v: number) => void; onTgt: (v: number) => void; onClose: () => void;
}) {
  const t = nodeTotals(n, cur, tgt > cur ? tgt : n.max);
  return (
    <Card title={<span className="flex items-center gap-2"><img src={n.icon} alt="" className="size-9 object-contain" />{n.name}</span>}
      actions={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      {n.desc && <p className="mb-3 text-sm text-muted">{n.desc.replace(/<[^>]*>/g, "")}</p>}
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <NumberField label="Current level" value={cur} min={0} max={n.max} onChange={onCur} />
        <NumberField label="Target level" value={tgt} min={cur} max={n.max} onChange={onTgt} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => onTgt(n.max)}>Target max</Button>
        <Button variant="ghost" onClick={() => onCur(n.max)}>Set current to max</Button>
      </div>

      <h3 className="mt-4 mb-2 text-sm font-semibold">{tgt > cur ? `Cost to reach level ${tgt}` : "Cost to max"} · {duration(t.timeSec)} · +{fmt(t.power)} power</h3>
      <CostList costs={t.costs} />

      <h3 className="mt-4 mb-2 text-sm font-semibold">Requirements</h3>
      <ul className="space-y-1 text-sm">
        {n.prereqs.map((p) => {
          const local = byId.get(p.id);
          const name = local?.name ?? external[p.id]?.name ?? "Research";
          const have = local ? levelOf(p.id) : null;
          return (
            <li key={p.id}>
              {name} Lv {p.level}{!local && external[p.id] ? ` (${external[p.id].category})` : ""}
              {have != null && <span className={have >= p.level ? " text-success" : " text-danger"}> · yours {have}</span>}
            </li>
          );
        })}
        {n.buildings.map((b) => <li key={b.name}>{b.name} Lv {b.level}</li>)}
        {!n.prereqs.length && !n.buildings.length && <li className="text-muted">No further requirements.</li>}
      </ul>

      <h3 className="mt-4 mb-2 text-sm font-semibold">Levels</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">Lv</th><th>Buff</th><th>Time</th><th className="text-right">Power</th><th className="text-right">Costs</th></tr></thead>
          <tbody>
            {n.levels.map((l) => (
              <tr key={l.level} onClick={() => onCur(l.level)} className={`cursor-pointer border-t border-line ${l.level <= cur ? "text-success" : ""} ${l.level > cur && l.level <= tgt ? "bg-surface-2" : ""}`}>
                <td className="py-1.5 tabular-nums">{l.level}</td>
                <td>{l.buffs.map((b) => `${b.label} ${b.value}`).join(", ") || "–"}</td>
                <td className="whitespace-nowrap">{duration(l.timeSec)}</td>
                <td className="text-right tabular-nums">{fmt(l.power)}</td>
                <td className="text-right text-xs tabular-nums">{l.costs.map((c) => `${fmt(c.count)} ${c.label}`).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted">Tap a row to set your current level.</p>
      </div>
    </Card>
  );
}
