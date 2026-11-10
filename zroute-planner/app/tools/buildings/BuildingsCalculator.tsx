import { useMemo, useState } from "react";
import { Button, Card, CostList, NumberField, SearchBox, Stat, duration, fmt } from "~/components/ui";
import { useToolState } from "~/lib/store";
import { addTotals, emptyTotals, powerAt, prerequisiteChain, rangeTotals, collectRequires, stepsBetween, type Building } from "./calc";

type State = { lv: Record<string, number>; tg: Record<string, number>; sel?: string; pre?: boolean };
const INITIAL: State = { lv: {}, tg: {}, pre: true };

export function BuildingsCalculator({ buildings }: { buildings: Building[] }) {
  const [st, setSt] = useToolState<State>("buildings", INITIAL);
  const [q, setQ] = useState("");
  const [hq, setHq] = useState(30);

  const cur = (b: Building) => st.lv[b.id] ?? 1;
  const tgt = (b: Building) => Math.max(st.tg[b.id] ?? cur(b), cur(b));
  const owned = useMemo(() => Object.fromEntries(buildings.map((b) => [b.id, st.lv[b.id] ?? 1])), [buildings, st.lv]);
  const base = buildings.find((b) => b.name === "Base")!;

  const setLv = (b: Building, n: number) => setSt({ ...st, lv: { ...st.lv, [b.id]: n }, tg: n > (st.tg[b.id] ?? 0) ? omit(st.tg, b.id) : st.tg });
  const setTg = (b: Building, n: number) => setSt({ ...st, tg: { ...st.tg, [b.id]: n } });

  const planned = buildings.filter((b) => tgt(b) > cur(b));
  const grand = planned.reduce((t, b) => addTotals(t, rangeTotals(b, cur(b), tgt(b))), emptyTotals());
  const spentPower = buildings.reduce((n, b) => n + powerAt(b, cur(b)), 0);
  const maxPower = buildings.reduce((n, b) => n + b.powerMax, 0);

  const sel = buildings.find((b) => b.id === st.sel) ?? null;
  const shown = buildings.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));

  function planHq() {
    const row = prerequisiteChain(buildings, owned, base.id, cur(base), hq);
    const tg: Record<string, number> = {};
    for (const r of row) tg[r.id] = r.to;
    tg[base.id] = Math.max(hq, cur(base));
    setSt({ ...st, tg });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Power from buildings" value={fmt(spentPower)} hint={`Max ${fmt(maxPower)}`} />
        <Stat label="Planned upgrades" value={planned.length} />
        <Stat label="Plan power gain" value={`+${fmt(grand.power)}`} />
        <Stat label="Plan time (sequential)" value={duration(grand.timeSec)} />
      </div>

      <Card title="Plan to reach HQ (Base) level">
        <div className="flex flex-wrap items-end gap-3">
          <NumberField label="Base target" value={hq} min={2} max={30} onChange={setHq} className="w-40" />
          <Button onClick={planHq}>Plan prerequisites</Button>
          <Button variant="ghost" onClick={() => setSt({ ...st, tg: {} })}>Clear plan</Button>
        </div>
        <p className="mt-2 text-xs text-muted">Sets target levels on Base and every building that must be upgraded first, based on your current levels.</p>
      </Card>

      {planned.length > 0 && (
        <Card title="Plan totals">
          <CostList costs={grand.costs} />
          <ul className="mt-3 divide-y divide-line text-sm">
            {planned.map((b) => (
              <li key={b.id} className="flex items-center gap-2 py-1.5">
                <img src={b.image} alt="" className="size-7 rounded object-cover" />
                <button className="flex-1 truncate text-left hover:text-accent" onClick={() => setSt({ ...st, sel: b.id })}>{b.name}</button>
                <span className="tabular-nums text-muted">Lv {cur(b)} → {tgt(b)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sel && <Detail b={sel} all={buildings} owned={owned} from={cur(sel)} to={tgt(sel)} pre={st.pre ?? true}
        onPre={(pre) => setSt({ ...st, pre })} onFrom={(n) => setLv(sel, n)} onTo={(n) => setTg(sel, n)} onClose={() => setSt({ ...st, sel: undefined })} />}

      <Card title="Buildings" actions={<div className="w-40"><SearchBox value={q} onChange={setQ} placeholder="Search" /></div>}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((b) => (
            <li key={b.id} className={`rounded-xl border p-2 ${st.sel === b.id ? "border-accent" : "border-line"} bg-surface-2`}>
              <button className="flex w-full items-center gap-2 text-left" onClick={() => setSt({ ...st, sel: b.id })}>
                <img src={b.image} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg object-cover" />
                <span className="min-w-0 text-sm font-medium leading-tight">{b.name}</span>
              </button>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <NumberField label="Level" value={cur(b)} min={1} max={b.max} onChange={(n) => setLv(b, n)} />
                <NumberField label="Target" value={tgt(b)} min={cur(b)} max={b.max} onChange={(n) => setTg(b, n)} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function omit<T>(o: Record<string, T>, k: string) {
  const { [k]: _, ...rest } = o;
  return rest;
}

function Detail({ b, all, owned, from, to, pre, onPre, onFrom, onTo, onClose }: {
  b: Building; all: Building[]; owned: Record<string, number>; from: number; to: number; pre: boolean;
  onPre: (v: boolean) => void; onFrom: (n: number) => void; onTo: (n: number) => void; onClose: () => void;
}) {
  const own = rangeTotals(b, from, to);
  const reqs = collectRequires(stepsBetween(b, from, to));
  const chain = useMemo(() => (to > from ? prerequisiteChain(all, owned, b.id, from, to) : []), [all, owned, b.id, from, to]);
  const total = pre ? chain.reduce((t, r) => addTotals(t, r.totals), own) : own;
  const byName = new Map(all.map((x) => [x.name, x]));

  return (
    <Card title={<span className="flex items-center gap-2"><img src={b.image} alt="" className="size-8 rounded object-cover" />{b.name}</span>}
      actions={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <NumberField label="Current level" value={from} min={1} max={b.max} onChange={onFrom} />
        <NumberField label="Target level" value={to} min={from} max={b.max} onChange={onTo} />
      </div>
      {to > from ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Upgrade time" value={duration(own.timeSec)} />
            <Stat label="Power gained" value={`+${fmt(own.power)}`} />
            <Stat label="Levels" value={to - from} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Resources for {b.name}</h3>
            <CostList costs={own.costs} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Requirements</h3>
            {reqs.length === 0 ? <p className="text-sm text-muted">None.</p> : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted"><tr><th>Building</th><th className="text-right">Needs</th><th className="text-right">Yours</th></tr></thead>
                <tbody>
                  {reqs.map((r) => {
                    const have = byName.get(r.name) ? owned[byName.get(r.name)!.id] : 0;
                    return (
                      <tr key={r.name} className="border-t border-line">
                        <td className="py-1.5">{r.name}</td>
                        <td className="text-right tabular-nums">{r.level}</td>
                        <td className={`text-right tabular-nums ${have >= r.level ? "text-success" : "text-danger"}`}>{have}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {chain.length > 0 && (
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={pre} onChange={(e) => onPre(e.target.checked)} /> Include prerequisite upgrades in total
              </label>
              <ul className="divide-y divide-line text-sm">
                {chain.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-1.5">
                    <img src={r.image} alt="" className="size-7 rounded object-cover" />
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="tabular-nums text-muted">Lv {r.from} → {r.to}</span>
                  </li>
                ))}
              </ul>
              {pre && (
                <div className="mt-3">
                  <h3 className="mb-2 text-sm font-semibold">Total with prerequisites · {duration(total.timeSec)} · +{fmt(total.power)} power</h3>
                  <CostList costs={total.costs} />
                </div>
              )}
            </div>
          )}
        </div>
      ) : <p className="mt-3 text-sm text-muted">Choose a target level above the current one.</p>}
    </Card>
  );
}
