// Shared building blocks for every calculator page. Keep tool pages consistent by using these.
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

// Same file mapping zrouteguide.com uses (metal/oil reuse the wood/stone art).
export const RES_ICON: Record<string, string> = {
  Food: "/img/themes/zroute/assets/zr_food.png",
  Metal: "/img/themes/zroute/assets/zr_wood.png",
  Oil: "/img/themes/zroute/assets/zr_stone.png",
};

const nf = new Intl.NumberFormat("en-US");
export const fmt = (n: number) => nf.format(Math.round(n));

/** 1.2K / 3.4M / 5.6B */
export function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 1 : 2).replace(/\.0+$/, "") + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, "") + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return fmt(n);
}

/** 3d 4h 5m */
export function duration(sec: number) {
  if (!sec) return "0m";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, (m || (!d && !h)) && `${m}m`].filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, image, children }: { title: string; subtitle?: ReactNode; image?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-4">
      {image && <img src={image} alt="" className="size-14 rounded-xl border border-line bg-surface object-contain p-1" />}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

export function Card({ title, children, className = "", actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center gap-2">
          {title && <h2 className="flex-1 font-display text-lg font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export type Cost = { label: string; count: number; icon?: string };

/** Resource totals with icons. Labels without a known icon fall back to text. */
export function CostList({ costs, className = "" }: { costs: Cost[]; className?: string }) {
  if (!costs.length) return <p className="text-sm text-muted">Nothing needed.</p>;
  return (
    <ul className={`grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2 ${className}`}>
      {costs.map((c) => (
        <li key={c.label} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
          {(c.icon || RES_ICON[c.label]) && <img src={c.icon || RES_ICON[c.label]} alt="" className="size-6 object-contain" />}
          <div className="min-w-0">
            <div className="truncate text-xs text-muted">{c.label}</div>
            <div className="font-semibold tabular-nums" title={fmt(c.count)}>{compact(c.count)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Sum cost lists by label. */
export function sumCosts(lists: Cost[][]): Cost[] {
  const m = new Map<string, Cost>();
  for (const list of lists) for (const c of list) {
    const prev = m.get(c.label);
    m.set(c.label, { ...c, count: (prev?.count ?? 0) + c.count });
  }
  return [...m.values()];
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2" title={hint}>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** Clamped integer input with -/+ buttons. */
export function NumberField({ label, value, min = 0, max, onChange, className = "" }: {
  label?: string; value: number; min?: number; max?: number; onChange: (n: number) => void; className?: string;
}) {
  const clamp = (n: number) => Math.max(min, max == null ? n : Math.min(max, n));
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      {label && <span className="text-muted">{label}</span>}
      <span className="flex items-stretch overflow-hidden rounded-lg border border-line bg-bg">
        <button type="button" className="px-3 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => onChange(clamp(value - 1))} aria-label="Decrease">−</button>
        <input
          type="number" inputMode="numeric" min={min} max={max} value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
          className="w-full min-w-0 bg-transparent px-2 py-2 text-center tabular-nums outline-none"
        />
        <button type="button" className="px-3 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => onChange(clamp(value + 1))} aria-label="Increase">+</button>
      </span>
    </label>
  );
}

export function Select<T extends string | number>({ label, value, options, onChange, className = "" }: {
  label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      {label && <span className="text-muted">{label}</span>}
      <select
        value={String(value)}
        onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}
        className="rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-accent"
      >
        {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Button({ children, variant = "primary", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-primary text-[#1a0d08] hover:bg-primary-ink",
    ghost: "border border-line text-ink hover:bg-surface-2",
    danger: "bg-danger/90 text-white hover:bg-danger",
  }[variant];
  return <button type="button" {...rest} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${styles} ${className}`}>{children}</button>;
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={t.value === value} type="button" onClick={() => onChange(t.value)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${t.value === value ? "bg-primary text-[#1a0d08]" : "text-muted hover:text-ink"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
  );
}

export function Collapsible({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left font-medium" aria-expanded={open}>
        {title}<span className="text-muted">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}

export function SourceNote({ href }: { href: string }) {
  return (
    <p className="mt-8 text-xs text-muted">
      Data from <a className="text-accent hover:underline" href={href} target="_blank" rel="noreferrer">zrouteguide.com</a>. Your plans save to this device and sync when you <Link to="/auth/sign-in" className="text-accent hover:underline">sign in</Link>.
    </p>
  );
}
