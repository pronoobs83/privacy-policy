import { useToolState } from "~/lib/store";
import { Card, NumberField, Tabs } from "~/components/ui";
import {
  MILESTONES, TRACK_COL, TRACK_SHORT, anyInvalid, climbCost, combinedStrengthenStats, gateMessage, gateParts,
  maxValidLevel, num, planLineText, rowAt, skillDesc, statText, strengthenShardPlan, trackMax, trackName,
  trackRows, trackSpend, trackSpendTotal,
  type Bonus, type ExclusiveData, type ExclusiveState, type Levels, type Track, type Weapon,
} from "./calc";

const clamp = (n: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

function Pic({ img, stem, alt, className = "size-10" }: { img: string; stem: string; alt: string; className?: string }) {
  if (!stem) return <span className={`${className} inline-block rounded bg-surface-2`} aria-hidden />;
  return <img src={`${img}${stem}.webp`} alt={alt} loading="lazy" className={`${className} object-contain`} />;
}

function Bonuses({ rows, title }: { rows: Bonus[]; title?: string }) {
  if (!rows?.length) return null;
  return (
    <div className="mt-2">
      {title && <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>}
      <ul className="divide-y divide-line rounded-lg bg-surface-2 text-sm">
        {rows.map((b, i) => (
          <li key={i} className="flex justify-between gap-3 px-3 py-1.5"><span className="text-muted">{b[0]}</span><b className="tabular-nums">{statText(b[1])}</b></li>
        ))}
      </ul>
    </div>
  );
}

function BillRow({ label, count, pic, strong, need }: { label: React.ReactNode; count: number; pic?: React.ReactNode; strong?: boolean; need?: boolean }) {
  return (
    <li className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${strong ? "bg-surface-2 font-semibold" : ""} ${need ? "text-muted" : ""}`}>
      <span className="flex min-w-0 items-center gap-2">{pic}<span>{label}</span></span>
      <b className="tabular-nums">{num(count)}</b>
    </li>
  );
}

function GateList({ tracks, ti, level, now }: { tracks: Track[]; ti: number; level: number; now: Levels }) {
  const gs = gateParts(tracks, ti, level, now);
  if (!gs.parts.length) return null;
  return (
    <ul className="mt-1 space-y-1 text-sm">
      {gs.parts.map((g) => (
        <li key={g.track} className={`flex justify-between rounded px-2 py-1 ${g.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          <span>{g.name}</span><b className="tabular-nums">{g.have} / {g.need}</b>
        </li>
      ))}
    </ul>
  );
}

function Gate({ tracks, ti, level, now, title, message }: { tracks: Track[]; ti: number; level: number; now: Levels; title?: string; message: string }) {
  const blocked = gateParts(tracks, ti, level, now).blocked;
  return (
    <div className={`mt-3 rounded-lg border p-3 text-sm ${blocked ? "border-danger/50" : "border-success/40"}`}>
      {title && <h4 className="font-semibold">{title}</h4>}
      {message && <p className="text-muted">{message}</p>}
      <GateList tracks={tracks} ti={ti} level={level} now={now} />
    </div>
  );
}

export function ExclusiveCalculator({ data, img }: { data: ExclusiveData; img: string }) {
  const [st, setSt] = useToolState<ExclusiveState>("exclusive", {});
  const patch = (p: Partial<ExclusiveState>) => setSt((prev) => ({ ...prev, ...p }));
  const tracks = data.zr_tracks;

  const w: Weapon = data.zr_weapons.find((x) => x.zr_id === st.id) ?? data.zr_weapons[0];
  const mode = st.mode === "strengthen" ? "strengthen" : "weapon";
  const tab = clamp(st.tab ?? 0, 0, 2);
  const lim = (arr: number[] | undefined): Levels => [0, 1, 2].map((ti) => clamp(arr?.[ti] ?? 0, 0, trackMax(tracks, ti)));
  const now = lim(st.tr);
  const goal = lim(st.trT);
  const pv = lim(st.pv);
  const setLv = (key: "tr" | "trT" | "pv", ti: number, v: number) => {
    const cur = key === "tr" ? now : key === "trT" ? goal : pv;
    const next = cur.slice();
    next[ti] = v;
    patch({ [key]: next });
  };

  const cap = w.zr_cap || (w.zr_lv.length ? w.zr_lv[w.zr_lv.length - 1].zr_l : 30);
  const from = clamp(st.from ?? 0, 0, cap);
  const to = clamp(st.to ?? cap, from, cap);
  const named = climbCost(w, from, to);
  const at = w.zr_lv.find((r) => r.zr_l === (to || 1));

  const weaponPanel = (
    <div className="space-y-4">
      <header className="flex items-center gap-4">
        <Pic img={img} stem={w.zr_i} alt={`${w.zr_n} exclusive weapon`} className="size-24 shrink-0" />
        <div>
          <h2 className="font-display text-xl font-semibold">{w.zr_n} exclusive weapon</h2>
          <p className="text-sm text-muted">Skills + base stats · cap <b>Lv {cap}</b></p>
          <p className="mt-1 text-sm text-muted">{w.zr_sd}</p>
        </div>
      </header>

      <ul className="divide-y divide-line rounded-lg bg-surface-2 text-sm">
        {[
          ["Hero star gate", `${w.zr_star || 25}★`],
          ["Unlock weapon", `5★ hero · ${num(w.zr_open || 50)} named shards`],
          ["Weapon level cap", `Lv ${cap}`],
          ["Strengthen unlocks", `After weapon reaches Lv ${cap}`],
          ["Strengthen line cap", `Lv ${trackMax(tracks, 0)} each track`],
          ...(to < cap ? [["Strengthen note", `Reach weapon Lv ${cap} first`]] : []),
        ].map(([k, v]) => (
          <li key={k} className="flex justify-between gap-3 px-3 py-1.5"><span className="text-muted">{k}</span><b>{v}</b></li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Level now" min={0} max={cap} value={from} onChange={(n) => patch({ from: n, to: Math.max(to, n) })} />
        <NumberField label="Level wanted" min={from} max={cap} value={to} onChange={(n) => patch({ to: n })} />
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Weapon shard bill</h3>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {from === 0 && (
            <BillRow label={`Activation (${w.zr_sn || "named"})`} count={w.zr_open} pic={<Pic img={img} stem={w.zr_si} alt={w.zr_sn} className="size-6" />} />
          )}
          <BillRow label="Upgrade along this climb" count={named - (from === 0 ? w.zr_open || 0 : 0)} pic={<Pic img={img} stem={w.zr_si} alt={w.zr_sn} className="size-6" />} />
          <BillRow strong label="Named shards total" count={named} />
        </ul>
        <p className="mt-2 flex items-start gap-2 text-xs text-muted">
          <Pic img={img} stem={w.zr_ui} alt={w.zr_un} className="size-6 shrink-0" />
          <span>{w.zr_ud || "Universal shards upgrade an awake weapon only."}</span>
        </p>
      </div>

      {at && (
        <div>
          <h3 className="font-semibold">Stats at weapon level {at.zr_l}</h3>
          <Bonuses rows={at.zr_b} />
        </div>
      )}

      <div>
        <h3 className="mb-2 font-semibold">Exclusive skills <span className="text-xs font-normal text-muted">from weapon level</span></h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {w.zr_sk.map((sk, i) => {
            const gate = w.zr_preview?.[i] != null ? w.zr_preview[i] : (w.zr_unlock || [])[i] || 1;
            const live = to >= gate && to > 0;
            return (
              <article key={sk.zr_slot} className={`rounded-lg border p-3 ${live ? "border-primary/60" : "border-line opacity-70"}`}>
                <div className="flex items-center gap-3">
                  <Pic img={img} stem={sk.zr_i} alt={sk.zr_n} className="size-12 shrink-0" />
                  <div>
                    <h4 className="font-semibold">{sk.zr_n}</h4>
                    <span className="text-xs text-muted">{live ? `Live at weapon Lv ${to}` : `Unlocks at weapon Lv ${gate}`}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted">{skillDesc(sk)}</p>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );

  const invalid = anyInvalid(tracks, now);
  const plan = strengthenShardPlan(tracks, now, goal);
  const ordered = plan.lines.filter((l) => l.goal > l.cur && !l.pulled).concat(plan.lines.filter((l) => l.goal > l.cur && l.pulled));
  const combo = combinedStrengthenStats(tracks, now);

  const lineSummary = (
    <div className="space-y-3">
      <h3 className="font-semibold">All three lines</h3>
      <p className="text-sm text-muted">Set a target and the plan lists the level each line requires, the shards for that climb, and the total to get there.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((ti) => {
          const maxV = maxValidLevel(tracks, ti, now);
          const bad = now[ti] > maxV;
          return (
            <div key={ti} className={`rounded-lg border p-3 ${bad ? "border-danger" : "border-line"}`} style={{ borderTopColor: TRACK_COL[ti], borderTopWidth: 3 }}>
              <strong>{trackName(tracks, ti)}</strong>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NumberField label="Now" min={0} max={trackMax(tracks, ti)} value={now[ti]} onChange={(n) => setLv("tr", ti, n)} />
                <NumberField label="Target" min={0} max={trackMax(tracks, ti)} value={goal[ti]} onChange={(n) => setLv("trT", ti, n)} />
              </div>
              <span className="mt-2 block text-xs text-muted">Valid max <b className="text-ink">{maxV}</b></span>
            </div>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-2">
        {TRACK_SHORT.map((s, ti) => (
          <span key={s} className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${now[ti] > maxValidLevel(tracks, ti, now) ? "border-danger text-danger" : "border-line"}`} style={{ color: now[ti] > maxValidLevel(tracks, ti, now) ? undefined : TRACK_COL[ti] }}>
            {s} {now[ti]}
          </span>
        ))}
      </p>
      {invalid && <p className="rounded-lg bg-danger/10 p-2 text-sm text-danger">One or more <em>now</em> levels exceed what the other lines allow. Lower them or raise the other tracks first.</p>}
      <div>
        <h4 className="mb-2 font-semibold">To reach the targets</h4>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {!ordered.length && <BillRow label="Set a target above the current level." count={0} />}
          {ordered.map((l) => <BillRow key={l.ti} need label={planLineText(tracks, l)} count={l.cost} />)}
          <BillRow strong label="Total till that level" count={plan.total} />
        </ul>
      </div>
      {combo.length > 0 && (
        <div>
          <h4 className="font-semibold">Total from strengthen (all lines at now)</h4>
          <Bonuses rows={combo} />
        </div>
      )}
    </div>
  );

  const detail = (ti: number) => {
    const rows = trackRows(tracks, ti);
    const max = trackMax(tracks, ti);
    const cur = now[ti];
    const g = Math.max(cur, goal[ti]);
    const preview = pv[ti];
    const maxV = maxValidLevel(tracks, ti, now);
    const row = rowAt(tracks, ti, preview);
    const next = rowAt(tracks, ti, cur + 1);
    const mine = plan.lines[ti];
    const pvGates = gateParts(tracks, ti, preview, now);
    const shardStem = w.zr_ui || w.zr_si;
    return (
      <div className="rounded-lg border border-line p-3" style={{ borderTopColor: TRACK_COL[ti], borderTopWidth: 3 }}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{trackName(tracks, ti)}</h3>
          <span className="text-xs text-muted">Max Lv {max} · valid now <b className="text-ink">{maxV}</b></span>
        </div>
        <label className="block text-sm">
          <span className="text-muted">Preview level <b className="text-ink">{preview}</b></span>
          <input type="range" min={0} max={max} step={1} value={preview} onChange={(e) => setLv("pv", ti, Number(e.target.value))} className="mt-1 w-full accent-primary" />
        </label>
        <div className="relative mb-4 h-4 text-[10px] text-muted">
          {MILESTONES.filter((m) => m <= max).map((m) => (
            <button key={m} type="button" title={`Lv ${m} milestone`} onClick={() => setLv("pv", ti, m)} className="absolute -translate-x-1/2 hover:text-ink" style={{ left: `${(m / max) * 100}%` }}>{m}</button>
          ))}
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          <BillRow label="Shards sunk on this line (now)" count={trackSpendTotal(rows, cur)} pic={<Pic img={img} stem={shardStem} alt="" className="size-6" />} />
          {mine.goal > mine.cur ? (
            <>
              <BillRow need label={planLineText(tracks, mine)} count={mine.cost} />
              {plan.total !== mine.cost && <BillRow strong label="Total till that level, including the other lines" count={plan.total} />}
            </>
          ) : g > cur ? (
            <BillRow label={`Shards to reach target (${cur} → ${g})`} count={trackSpend(rows, cur, g)} />
          ) : null}
          {next && <BillRow label={`Next row cost (Lv ${cur + 1})`} count={next.zr_s || 0} />}
        </ul>
        {preview > 0 && (pvGates.blocked
          ? <Gate tracks={tracks} ti={ti} level={preview} now={now} title={`Preview Lv ${preview} is not reachable yet`} message={gateMessage(tracks, ti, preview, now, false)} />
          : <Gate tracks={tracks} ti={ti} level={preview} now={now} message={`Preview Lv ${preview} — the other lines cover this row.`} />)}
        {cur > maxV ? (
          <Gate tracks={tracks} ti={ti} level={cur} now={now} message={gateMessage(tracks, ti, cur, now, false)} />
        ) : next ? (
          gateParts(tracks, ti, cur + 1, now).blocked
            ? <Gate tracks={tracks} ti={ti} level={cur + 1} now={now} title="Blocked from advancing" message={gateMessage(tracks, ti, cur, now, true)} />
            : <Gate tracks={tracks} ti={ti} level={cur + 1} now={now} message={`Next row (Lv ${cur + 1}) — all gates clear.`} />
        ) : null}
        {row && (
          <>
            <Bonuses rows={row.zr_p} title="Personal bonus (milestone)" />
            <Bonuses rows={row.zr_g} title="Global bonus (cumulative on this line)" />
          </>
        )}
        {next && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Next row preview (Lv {next.zr_l}, {num(next.zr_s)} shards)</summary>
            <Bonuses rows={next.zr_p} title="Personal" />
            <Bonuses rows={next.zr_g} title="Global" />
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Exclusive weapons">
        {data.zr_weapons.map((x) => (
          <li key={x.zr_id}>
            <button type="button" onClick={() => patch({ id: x.zr_id })} aria-pressed={x.zr_id === w.zr_id}
              className={`flex w-full flex-col items-center gap-1 rounded-xl border bg-surface p-2 text-center ${x.zr_id === w.zr_id ? "border-primary" : "border-line hover:border-line-strong"}`}>
              <Pic img={img} stem={x.zr_i} alt={x.zr_n} className="size-16" />
              <strong className="text-sm">{x.zr_n}</strong>
              <span className="flex items-center gap-1 text-[11px] text-muted"><Pic img={img} stem={x.zr_si} alt="" className="size-4" /><span className="truncate">{x.zr_sn || "Exclusive shard"}</span></span>
            </button>
          </li>
        ))}
      </ul>

      <Tabs value={mode} onChange={(v) => patch({ mode: v })}
        tabs={[{ value: "weapon", label: "Weapon level" }, { value: "strengthen", label: `Strengthen lines (1–${trackMax(tracks, 0)})` }]} />

      {mode === "weapon" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>{weaponPanel}</Card>
          <Card title="Strengthen preview">
            <p className="mb-3 text-sm text-muted">Switch to <b>Strengthen lines</b> to plan all three tracks. Quick read of your current line levels:</p>
            {lineSummary}
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Strengthen lines">
            {lineSummary}
            <div className="my-4">
              <Tabs value={String(tab) as "0" | "1" | "2"} onChange={(v) => patch({ tab: Number(v) })}
                tabs={tracks.map((t, i) => ({ value: String(i) as "0" | "1" | "2", label: t.zr_n }))} />
            </div>
            {detail(tab)}
          </Card>
          <Card title="Weapon level">
            <p className="mb-3 text-sm text-muted">Skills and base stats come from weapon level, not strengthen rows.</p>
            {weaponPanel}
          </Card>
        </div>
      )}
    </div>
  );
}
