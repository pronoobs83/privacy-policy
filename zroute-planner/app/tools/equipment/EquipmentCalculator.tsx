import { useMemo } from "react";
import { useToolState } from "~/lib/store";
import { Button, Card, Collapsible, fmt } from "~/components/ui";
import {
  TAG, addMats, enhanceBag, fitOf, findPiece, initialState, levelRow, materialIcons, matRank, mergeBags, nextEnh,
  owe, promoteBag, starLabel, statText, type Bag, type ConvRow, type EquipData, type EquipState, type Fit, type MatRow, type Piece,
} from "./logic";

type Cfg = { img: string; res: string };
type Ctx = { config: Cfg; icons: Record<string, string> };
type Held = NonNullable<ReturnType<typeof fitOf>>;
const QCOLOR: Record<number, string> = { 2: "border-success/60", 3: "border-accent/60", 4: "border-primary/70", 5: "border-gold/80" };
const btn = "rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm hover:border-line-strong disabled:opacity-40";

export function EquipmentCalculator({ config, data }: { config: Cfg; data: EquipData }) {
  const init = useMemo(() => initialState(data), [data]);
  const [stored, setState] = useToolState<EquipState>("equipment", init);
  const icons = useMemo(() => materialIcons(data), [data]);
  const s = stored && stored.fit ? stored : init;
  const patch = (fn: (x: EquipState) => EquipState) => setState((prev) => fn(prev && prev.fit ? prev : init));
  const setFit = (slot: number, p: Partial<Fit>) =>
    patch((x) => {
      const cur = fitOf(data, x, slot)?.f ?? x.fit[slot];
      return { ...x, fit: { ...x.fit, [slot]: { ...cur, ...p } } };
    });
  const ctx = { config, icons };
  const openHeld = s.open != null ? fitOf(data, s, s.open) : null;

  if (s.open != null && openHeld) {
    const slot = s.open;
    return (
      <Detail
        {...ctx} data={data} slot={slot} held={openHeld}
        onClose={() => patch((x) => ({ ...x, open: null }))}
        onRemove={() => patch((x) => {
          const fit = { ...x.fit };
          delete fit[String(slot)];
          return { ...x, fit, open: null };
        })}
        setFit={(p) => setFit(slot, p)}
      />
    );
  }

  const bags: Bag[] = [];
  const cols = data.zr_slots.map((slot) => {
    const held = fitOf(data, s, slot.zr_id);
    if (held) bags.push(owe(held.p, held.f.lv, held.f.pi, held.f.n));
    return { slot, held };
  });
  const totals = mergeBags(bags);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cols.map(({ slot, held }) => (
          <section key={slot.zr_id} className="rounded-2xl border border-line bg-surface p-3">
            <header className="mb-2 flex items-center justify-between text-sm">
              <b>{slot.zr_n}</b>
              {held && <span className="text-muted">×{held.f.n}</span>}
            </header>
            <div className="flex items-stretch gap-2">
              {held && (
                <button
                  type="button"
                  onClick={() => patch((x) => ({ ...x, open: slot.zr_id, pick: null }))}
                  className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border-2 bg-surface-2 p-2 ${QCOLOR[held.p.zr_q] ?? "border-line"}`}
                >
                  <span className="absolute left-1 top-1 text-[10px] font-semibold text-muted">Lv.{held.f.lv}</span>
                  <span className="absolute right-1 top-1 rounded bg-bg px-1 text-[10px] font-bold">{TAG[held.p.zr_q]}</span>
                  <Pic cfg={config} p={held.p} className="mt-3 size-16 object-contain" />
                  {held.pr.length > 1 && <Stars piece={held.f.pi} small />}
                </button>
              )}
              <button
                type="button"
                aria-label={`Choose a ${slot.zr_n}`}
                onClick={() => patch((x) => ({ ...x, pick: x.pick === slot.zr_id ? null : slot.zr_id }))}
                className="flex w-10 items-center justify-center rounded-xl border border-dashed border-line-strong text-xl text-muted hover:text-ink"
              >+</button>
            </div>
            {s.pick === slot.zr_id && (
              <div className="mt-2 flex flex-wrap gap-1">
                {[2, 3, 4, 5].map((q) => findPiece(data, slot.zr_id, q) && (
                  <button key={q} type="button" className={btn}
                    onClick={() => patch((x) => ({ ...x, fit: { ...x.fit, [slot.zr_id]: { q, lv: 0, pi: 0, n: 1 } }, pick: null }))}>
                    {TAG[q]}
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <Card title="Everything to the maximum">
        {!totals.length ? (
          <p className="text-sm text-muted">The bench is empty. Drop a piece into a slot and the stone, oil, and blueprints for the rest of its climb show up here.</p>
        ) : (
          <>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
              {totals.map(([name, n]) => (
                <li key={name} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
                  <MatIcon {...ctx} name={name} />
                  <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                  <b className="tabular-nums">{fmt(n)}</b>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Adds every enhance step still ahead. Orange pieces also include each promotion segment still ahead, through 5★.</p>
          </>
        )}
      </Card>

      <Card title="Breakthrough and fusion">
        <div className="space-y-2">
          <Collapsible title="Break down (materials you get back)"><ConvList rows={data.zr_break} {...ctx} /></Collapsible>
          <Collapsible title="Fuse (materials needed)"><ConvList rows={data.zr_fuse} {...ctx} /></Collapsible>
        </div>
      </Card>
    </div>
  );
}

function MatIcon({ config, icons, name }: Ctx & { name: string }) {
  const stem = icons[name];
  if (stem) return <img src={`${config.img}${stem}.webp`} alt="" width={20} height={20} className="size-5 object-contain" loading="lazy" />;
  if (/^oil$/i.test(name)) return <img src={`${config.res}zr_stone.png`} alt="" width={20} height={20} className="size-5 object-contain" />;
  return <span className="size-5 rounded bg-surface-2" aria-hidden />;
}

function ConvList({ rows, config, icons }: Ctx & { rows: ConvRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.zr_n} className="flex items-start gap-3 rounded-lg bg-surface-2 p-2 text-sm">
          <img src={`${config.img}${r.zr_i}.webp`} alt="" className="size-10 object-contain" loading="lazy" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{r.zr_n}</div>
            <div className="text-xs text-muted">{r.zr_d}</div>
            {r.zr_rw.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                {r.zr_rw.map((m: MatRow) => (
                  <span key={m[0]} className="flex items-center gap-1"><MatIcon config={config} icons={icons} name={m[0]} />{m[1]}× {m[0]}</span>
                ))}
              </div>
            ) : <div className="mt-1 text-xs text-muted">Nothing to {r.zr_k === "down" ? "break down into" : "fuse from"}.</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pic({ cfg, p, className }: { cfg: Cfg; p: Piece; className: string }) {
  const stem = p.zr_ti || p.zr_i;
  return stem ? <img src={`${cfg.img}${stem}.webp`} alt={p.zr_n} className={className} loading="lazy" /> : <span className={className} />;
}

function Star({ pct, size }: { pct: number; size: number }) {
  const id = `eqst${pct}-${size}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={id}><stop offset={`${pct}%`} stopColor="#f5b83d" /><stop offset={`${pct}%`} stopColor="transparent" /></linearGradient>
      </defs>
      <path d="M50 7L64.69 33.77L94.7 39.48L73.78 61.73L77.63 92.02L50 79L22.37 92.02L26.22 61.73L5.3 39.48L35.31 33.77Z" fill={`url(#${id})`} stroke="#f5b83d" strokeWidth={6} strokeLinejoin="round" />
    </svg>
  );
}

function Stars({ piece, small, onSet }: { piece: number; small?: boolean; onSet?: (target: number) => void }) {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const pct = Math.round((Math.max(0, Math.min(5, piece - i * 5)) / 5) * 5) * 20;
        const st = <Star pct={pct} size={small ? 12 : 28} />;
        return onSet ? (
          <button key={i} type="button" aria-label={`Set to ${i + 1} stars`} onClick={() => onSet((i + 1) * 5)}>{st}</button>
        ) : <span key={i}>{st}</span>;
      })}
    </span>
  );
}

function MatTable({ nextRows, bag, times, config, icons }: Ctx & { nextRows: MatRow[]; bag: Bag; times: number }) {
  const names = new Set<string>([...nextRows.map((c) => c[0]), ...Object.keys(bag)]);
  const list = [...names].sort((a, b) => matRank(a) - matRank(b));
  if (!list.length) return <p className="text-sm text-muted">Nothing left on this track.</p>;
  const next: Bag = {};
  addMats(next, nextRows, times);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="py-1">Material</th><th className="py-1 text-right">Next</th><th className="py-1 text-right">To max</th></tr></thead>
        <tbody>
          {list.map((name) => (
            <tr key={name} className="border-t border-line">
              <td className="py-1.5"><span className="flex items-center gap-2"><MatIcon config={config} icons={icons} name={name} />{name}</span></td>
              <td className="py-1.5 text-right tabular-nums">{next[name] ? fmt(next[name]) : "—"}</td>
              <td className="py-1.5 text-right tabular-nums">{bag[name] ? fmt(bag[name]) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <li className="flex justify-between rounded bg-surface-2 px-3 py-1.5"><span className="text-muted">{k}</span><b className={strong ? "text-gold" : ""}>{v}</b></li>;
}

function Detail({ config, icons, data, slot, held, onClose, onRemove, setFit }: Ctx & {
  data: EquipData; slot: number; held: Held; onClose: () => void; onRemove: () => void; setFit: (p: Partial<Fit>) => void;
}) {
  const { f, p, cap, pr } = held;
  const at = levelRow(p, f.lv);
  const promo = pr[f.pi] || null;
  const times = f.n;
  const enhBag = enhanceBag(p, f.lv, times);
  const proBag = promoteBag(pr, f.pi, times);
  const nxt = nextEnh(p, f.lv);
  const nxtPro = pr[f.pi + 1] || null;
  const slotName = data.zr_slots.find((x) => x.zr_id === p.zr_slot)?.zr_n || p.zr_sn;
  const power = (at ? at.zr_a : 0) + (promo && f.pi > 0 ? promo.zr_a : 0);
  const maxPiece = pr.length - 1;
  const lines = at?.zr_b || [];

  return (
    <article className="space-y-4">
      <header className="flex items-center gap-3">
        <h2 className="flex-1 font-display text-xl font-semibold">{p.zr_n}</h2>
        <button type="button" onClick={onClose} className={btn}>← Back to slots</button>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className={`flex items-center gap-3 rounded-xl border-2 bg-surface-2 p-3 ${QCOLOR[p.zr_q] ?? ""}`}>
            <Pic cfg={config} p={p} className="size-20 object-contain" />
            <div className="flex-1">
              <p className="text-xs text-muted">{slotName} · {p.zr_qn}</p>
              <p className="text-lg font-semibold">Lv.{f.lv}</p>
              {pr.length > 1 && <p className="text-sm text-gold">{starLabel(f.pi)}</p>}
            </div>
            <Button variant="danger" onClick={onRemove}>Remove</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[2, 3, 4, 5].map((q) => findPiece(data, slot, q) && (
              <button key={q} type="button" onClick={() => setFit({ q, lv: 0, pi: 0 })}
                className={`${btn} ${q === p.zr_q ? "!border-primary !bg-primary !text-primary-ink" : ""}`}>{TAG[q]}</button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="mr-auto text-muted">Count</span>
            <button type="button" className={btn} aria-label="One fewer" onClick={() => setFit({ n: Math.max(1, f.n - 1) })}>−</button>
            <b className="w-8 text-center tabular-nums">{f.n}</b>
            <button type="button" className={btn} aria-label="One more" onClick={() => setFit({ n: Math.min(99, f.n + 1) })}>+</button>
            <button type="button" className={btn} onClick={() => setFit({ n: 99 })}>MAX</button>
          </div>

          <h3 className="mb-2 mt-4 font-semibold">Enhance</h3>
          {cap > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <button type="button" className={btn} onClick={() => setFit({ lv: Math.max(0, f.lv - 10) })}>−10</button>
                <button type="button" className={btn} onClick={() => setFit({ lv: Math.max(0, f.lv - 1) })}>−</button>
                <b className="flex-1 text-center">Lv.{f.lv}</b>
                <button type="button" className={btn} onClick={() => setFit({ lv: Math.min(cap, f.lv + 1) })}>+</button>
                <button type="button" className={btn} onClick={() => setFit({ lv: Math.min(cap, f.lv + 10) })}>+10</button>
                <button type="button" className={btn} onClick={() => setFit({ lv: cap })}>MAX</button>
              </div>
              <p className="my-2 text-xs text-muted">Highest enhance on this plate is Lv.{cap}. “Next” is one step; “To max” is the rest of the climb{times > 1 ? `, multiplied by ${times}` : ""}.</p>
              <MatTable nextRows={nxt ? nxt.zr_c : []} bag={enhBag} times={times} config={config} icons={icons} />
            </>
          ) : (
            <p className="text-sm text-muted">This quality ships as a finished plate. It does not drink refined stone.</p>
          )}

          <h3 className="mb-2 mt-4 font-semibold">Stats</h3>
          <ul className="space-y-1 text-sm">
            {!lines.length && <li className="text-muted">No combat lines stored at this level.</li>}
            {lines.map((b) => <Row key={b[0]} k={b[0]} v={statText(b[1])} />)}
            {p.zr_lv.filter((r) => r.zr_l > 0 && r.zr_l <= f.lv && r.zr_x?.length).flatMap((r) =>
              r.zr_x.map((x) => <Row key={`${r.zr_l}-${x[0]}`} k={`${x[0]} · Lv.${r.zr_l}`} v={statText(x[1])} />))}
            {promo && f.pi > 0 && promo.zr_b?.map((b) => <Row key={`p-${b[0]}`} k={`${b[0]} · stars`} v={statText(b[1])} />)}
            <Row k="Power" v={fmt(power)} strong />
          </ul>
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold">Promote</h3>
          {pr.length > 1 ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <button type="button" className={btn} aria-label="Lower star piece" disabled={f.pi <= 0} onClick={() => setFit({ pi: Math.max(0, f.pi - 1) })}>−</button>
                <Stars piece={f.pi} onSet={(t) => setFit({ pi: Math.min(maxPiece, t) })} />
                <button type="button" className={btn} aria-label="Raise star piece" disabled={f.pi >= maxPiece} onClick={() => setFit({ pi: Math.min(maxPiece, f.pi + 1) })}>+</button>
              </div>
              <p className="mt-1 text-center text-sm">{starLabel(f.pi)}</p>
              <p className="my-2 text-xs text-muted">Five stars with five segments each. Tap a star to jump to that tier; − and + move one segment.</p>
              {promo?.zr_x?.length && f.pi > 0 ? (
                <p className="mb-2 text-xs text-muted">This step also grants {promo.zr_x.map((x) => `${x[0]} ${statText(x[1])}`).join(", ")}.</p>
              ) : null}
              <MatTable nextRows={nxtPro ? nxtPro.zr_c : []} bag={proBag} times={times} config={config} icons={icons} />
            </>
          ) : (
            <p className="text-sm text-muted">Only the orange plate has promotion stages. {TAG[p.zr_q] || p.zr_qn} stops at enhance.</p>
          )}
        </Card>
      </div>
    </article>
  );
}
