import { useMemo, useState } from "react";
import { Card, NumberField, Select, Stat, fmt, compact } from "~/components/ui";
import { useToolState } from "~/lib/store";
import {
  MAX_PIECE, lockText, quote, skillLocked, starLabel, wholeOf,
  type HeroState, type SkillQuote,
} from "./calc";
import type { HeroDetail } from "./data.server";

const HERO_DIR = "/img/themes/zroute/assets/heroes/";
const SHARD_DIR = "/img/themes/zroute/assets/shards/";
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));

function Portrait({ webp, src, alt, w, h, className }: { webp?: string; src: string; alt: string; w?: number; h?: number; className?: string }) {
  return (
    <picture>
      {webp && <source type="image/webp" srcSet={webp} />}
      <img src={src} alt={alt} width={w} height={h} className={className} />
    </picture>
  );
}

/** Five stars, each filled by how many of its 5 segments are collected. */
function Stars({ piece, onPick, size = "text-3xl" }: { piece: number; onPick?: (star: number) => void; size?: string }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Hero stars">
      {[0, 1, 2, 3, 4].map((i) => {
        const pct = (Math.max(0, Math.min(5, piece - i * 5)) / 5) * 100;
        const star = (
          <span className={`relative inline-block leading-none ${size}`}>
            <span className="text-line-strong">★</span>
            <span className="absolute inset-0 overflow-hidden text-gold" style={{ width: `${pct}%` }}>★</span>
          </span>
        );
        return onPick ? (
          <button key={i} type="button" aria-label={`Set to ${i + 1} stars`} onClick={() => onPick(i)} className="rounded p-0.5 hover:bg-surface-2">
            {star}
          </button>
        ) : <span key={i}>{star}</span>;
      })}
    </div>
  );
}

function Rich({ text, mark }: { text: string; mark: string }) {
  const at = mark ? text.indexOf(mark) : -1;
  if (!mark || at < 0) return <>{text}</>;
  let shown = mark;
  if (text.charAt(at + mark.length) === "%") shown += "%";
  return <>{text.slice(0, at)}<span className="font-semibold text-gold">{shown}</span>{text.slice(at + shown.length)}</>;
}

export function HeroCalculator({ detail }: { detail: HeroDetail }) {
  const { meta, hero: baseHero, variant, bookLabel } = detail;
  const [all, setAll] = useToolState<Record<string, HeroState>>("heroes", {});
  const st = all[meta.id] ?? {};
  const patch = (p: Partial<HeroState>) => setAll((prev) => ({ ...prev, [meta.id]: { ...prev[meta.id], ...p } }));
  const [slot, setSlot] = useState(1);

  const awake = !!variant && !!st.awake;
  const hero = awake && variant ? variant.zr_hero : baseHero;
  const maxLevel = hero.zr_max_level;

  const level = clamp(st.level ?? 1, 1, maxLevel);
  const recruit = !!st.recruit;
  const piece = recruit ? 0 : clamp(st.piece ?? 0, 0, MAX_PIECE);
  const tLevel = clamp(st.tLevel ?? maxLevel, level, maxLevel);
  const tPiece = clamp(st.tPiece ?? MAX_PIECE, piece, MAX_PIECE);

  const rows = useMemo(
    () =>
      meta.skills.map((m) => {
        const vc = awake && variant ? variant.zr_skills.find((s) => s.zr_slot === m.slot) : undefined;
        const max = vc?.zr_max || m.max;
        return {
          ...m,
          max,
          name: vc?.zr_name || m.name,
          icon: awake ? (vc?.zr_icon ? HERO_DIR + vc.zr_icon : "") : m.icon,
        };
      }),
    [meta, awake, variant],
  );
  const skillFrom = (slotNo: number, max: number) => clamp(st.skills?.[slotNo] ?? 1, 1, max);
  const skillTo = (slotNo: number, max: number) => clamp(st.tSkills?.[slotNo] ?? max, skillFrom(slotNo, max), max);

  const q = quote(hero, level, piece, tLevel, tPiece, rows.map((r) => ({ slot: r.slot, from: skillFrom(r.slot, r.max), to: skillTo(r.slot, r.max) })));
  if (!q) return <p className="text-sm text-danger">Those numbers are not available.</p>;

  const medals = q.fragments + (recruit ? q.summon : 0);
  const books = q.skills.reduce((s, k) => s + k.booksToTarget, 0);
  const active = rows.find((r) => r.slot === slot) ?? rows[0];
  const activeQ = q.skills.find((s) => s.slot === active.slot) as SkillQuote;
  const activeLocked = skillLocked(active.unlock, active.unlockStar, level, piece);
  const portrait = awake && variant ? HERO_DIR + variant.zr_portrait : meta.portrait;
  const layer = awake && variant ? SHARD_DIR + variant.zr_layer : meta.layer;
  const qualityMeta =
    awake && variant && meta.meta.startsWith(variant.zr_base_quality)
      ? `${variant.zr_quality}${meta.meta.slice(variant.zr_base_quality.length)} · Awakened`
      : meta.meta;

  return (
    <div className="space-y-4">
      {variant && (
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1" role="group" aria-label="Hero form">
          {[false, true].map((a) => (
            <button
              key={String(a)} type="button" aria-pressed={awake === a} onClick={() => patch({ awake: a })}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${awake === a ? "bg-primary text-[#1a0d08]" : "text-muted hover:text-ink"}`}
            >
              {a ? variant.zr_label : variant.zr_base_label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
          <Portrait
            webp={awake ? undefined : meta.webp} src={portrait} alt={meta.name}
            w={awake && variant ? variant.zr_portrait_w : meta.pw} h={awake && variant ? variant.zr_portrait_h : meta.ph}
            className="mx-auto max-h-80 w-auto object-contain md:max-h-none md:w-full"
          />
          <div className="bg-gradient-to-t from-bg/95 to-transparent p-3 md:absolute md:inset-x-0 md:bottom-0">
            <p className="font-display text-xl font-bold">{meta.name}</p>
            <p className="text-xs text-muted">{qualityMeta}</p>
            <p className="mt-1 text-sm font-semibold">Lv. {level}</p>
            <Stars piece={piece} size="text-lg" />
          </div>
        </div>

        <div className="space-y-4">
          <Card title="Total to target">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Hero EXP" value={compact(q.expToTarget)} hint={fmt(q.expToTarget)} />
              <Stat label={meta.medal || "Hero medals"} value={compact(medals)} hint={fmt(medals)} />
              <Stat label={bookLabel} value={compact(books)} hint={fmt(books)} />
            </div>
            <p className="mt-2 text-xs text-muted">Level cost is Hero EXP. Star cost is hero medals (fragments). Skill cost is {bookLabel}.</p>
          </Card>

          <Card title="Hero level">
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Level now" min={1} max={maxLevel} value={level} onChange={(n) => patch({ level: n, tLevel: Math.max(tLevel, n) })} />
              <NumberField label="Level target" min={level} max={maxLevel} value={tLevel} onChange={(n) => patch({ tLevel: n })} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-muted">EXP</span>
              <span>Next level: <strong className="tabular-nums" title={fmt(q.expNext)}>{fmt(q.expNext)}</strong></span>
              <span>To target: <strong className="tabular-nums" title={fmt(q.expToTarget)}>{fmt(q.expToTarget)}</strong></span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {([["ATK", q.atk], ["DEF", q.def], ["Troop capacity", q.command]] as const).map(([l, v]) =>
                v === undefined ? null : (
                  <div key={l} className="rounded-lg bg-surface-2 px-3 py-2">
                    <dt className="text-xs text-muted">{l}</dt>
                    <dd className="font-semibold tabular-nums">{fmt(v)}</dd>
                  </div>
                ))}
            </dl>
            {q.maxSample && (
              <p className="mt-2 text-xs text-muted">
                Hero maximum without equipment (level {q.maxSample.level}, {q.maxSample.star} star): ATK {fmt(q.maxSample.atk)} · DEF {fmt(q.maxSample.def)} · Troop capacity {fmt(q.maxSample.command)}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">These numbers are kept by the community and can differ from the game, so do not trust them blindly.</p>
          </Card>
        </div>
      </div>

      <Card title="Stars">
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={recruit} onChange={(e) => patch({ recruit: e.target.checked, piece: 0 })} />
          <span>Not recruited yet (+{q.summon} medals)</span>
        </label>
        <div className={`flex flex-wrap items-center gap-3 ${recruit ? "pointer-events-none opacity-50" : ""}`}>
          <button type="button" aria-label="Lower star piece" disabled={piece <= 0 || recruit} onClick={() => patch({ piece: piece - 1 })}
            className="size-9 rounded-lg border border-line text-lg hover:bg-surface-2 disabled:opacity-40">−</button>
          <Stars piece={piece} onPick={(i) => patch({ piece: (i + 1) * 5 === piece ? i * 5 : (i + 1) * 5, tPiece: Math.max(tPiece, (i + 1) * 5) })} />
          <button type="button" aria-label="Raise star piece" disabled={piece >= MAX_PIECE || recruit} onClick={() => patch({ piece: piece + 1, tPiece: Math.max(tPiece, piece + 1) })}
            className="size-9 rounded-lg border border-line text-lg hover:bg-surface-2 disabled:opacity-40">+</button>
          <span className="font-semibold tabular-nums">{starLabel(piece)}</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="relative inline-block size-14 shrink-0">
            <img src={layer} alt="" className="absolute inset-0 size-full object-contain" />
            <img src={meta.face} alt="" className="absolute inset-0 size-full object-contain" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{meta.medal || "Hero Medal"}</p>
            <p className="text-sm text-muted">
              Next level: <strong className="text-ink tabular-nums">{fmt(q.fragmentsNext)}</strong> · To target:{" "}
              <strong className="text-ink tabular-nums">{fmt(medals)}</strong>
            </p>
          </div>
          <Select label="Target stars" value={tPiece} className="w-36"
            options={Array.from({ length: MAX_PIECE - piece + 1 }, (_, i) => piece + i).map((p) => ({ value: p, label: starLabel(p) }))}
            onChange={(v) => patch({ tPiece: v })} />
        </div>
        {q.skillCap !== undefined && (
          <p className="mt-2 text-xs text-muted">With {wholeOf(piece)} stars, skills go up to level {q.skillCap}</p>
        )}
      </Card>

      <Card title="Skills">
        <div role="tablist" aria-label="Skills" className="mb-4 flex gap-2">
          {rows.map((r) => {
            const locked = skillLocked(r.unlock, r.unlockStar, level, piece);
            return (
              <button
                key={r.slot} type="button" role="tab" aria-selected={r.slot === active.slot} onClick={() => setSlot(r.slot)}
                className={`relative size-16 shrink-0 overflow-hidden rounded-xl border bg-surface-2 ${r.slot === active.slot ? "border-primary" : "border-line"} ${locked ? "opacity-50" : ""}`}
                title={r.name}
              >
                {r.icon ? <img src={r.icon} alt={r.name} className="size-full object-cover" /> : <span className="text-xs text-muted">{r.slot}</span>}
                {locked ? (
                  <span className="absolute inset-0 grid place-items-center bg-bg/50 text-lg" aria-label="Locked">🔒</span>
                ) : (
                  <span className="absolute bottom-0 right-0 rounded-tl bg-bg/80 px-1 text-[10px] font-semibold">Lv.{skillFrom(r.slot, r.max)}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{active.name}</h3>
            {active.pill && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted">{active.pill}</span>}
          </div>

          {activeLocked ? (
            <p className="text-sm text-muted">{lockText(active.unlock, active.unlockStar)}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Skill level now" min={1} max={active.max} value={skillFrom(active.slot, active.max)}
                onChange={(n) => patch({ skills: { ...st.skills, [active.slot]: n } })} />
              <NumberField label="Skill level target" min={skillFrom(active.slot, active.max)} max={active.max} value={skillTo(active.slot, active.max)}
                onChange={(n) => patch({ tSkills: { ...st.tSkills, [active.slot]: n } })} />
            </div>
          )}

          <p className="whitespace-pre-line text-sm"><Rich text={activeQ.text} mark={activeQ.mark} /></p>
          {activeQ.cd && <p className="text-xs text-muted">CD {activeQ.cd}s</p>}

          {activeQ.maxLine && (activeQ.cd || activeQ.starLines.length > 0) && (
            <p className="rounded-lg bg-surface-2 p-2 text-sm">
              <span className="block text-xs text-muted">At level {activeQ.maxLine.level} with {activeQ.maxLine.star} star</span>
              <Rich text={activeQ.maxLine.text} mark={activeQ.maxLine.mark} />
            </p>
          )}

          {activeQ.starLines.length > 0 && (
            <ul className="space-y-1">
              {activeQ.starLines.map((l) => (
                <li key={l.star} className="flex items-center gap-2 text-sm">
                  <Stars piece={l.star * 5} size="text-xs" />
                  <span className="text-muted">{l.text}</span>
                </li>
              ))}
            </ul>
          )}

          {!activeLocked && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <span className="text-muted">{bookLabel}</span>
              <span>Next level: <strong className="tabular-nums" title={fmt(activeQ.booksNext)}>{compact(activeQ.booksNext)}</strong></span>
              <span>To target: <strong className="tabular-nums" title={fmt(activeQ.booksToTarget)}>{compact(activeQ.booksToTarget)}</strong></span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
