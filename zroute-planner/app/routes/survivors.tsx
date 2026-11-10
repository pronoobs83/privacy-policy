import { useMemo, useState } from "react";
import { Button, Card, PageHeader, SearchBox, SourceNote, Stat } from "~/components/ui";
import { useToolState } from "~/lib/store";
import { survivors, type Survivor } from "~/tools/survivors/data.server";
import type { Route } from "./+types/survivors";

export function meta() {
  return [
    { title: "Survivor Roster – Z Route Planner" },
    { name: "description", content: "Browse every Z Route survivor by quality and job, and mark the ones you own." },
  ];
}

export async function loader() {
  return { survivors };
}

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-[#1a0d08]" : "border-line bg-surface text-muted hover:text-ink"}`;

export default function Survivors({ loaderData }: Route.ComponentProps) {
  const list: Survivor[] = loaderData.survivors;
  const [state, setState] = useToolState<{ owned: string[] }>("survivors", { owned: [] });
  const [quality, setQuality] = useState("");
  const [job, setJob] = useState("");
  const [text, setText] = useState("");
  const [onlyOwned, setOnlyOwned] = useState<"all" | "owned" | "missing">("all");

  const owned = useMemo(() => new Set(state.owned), [state.owned]);
  const qualities = useMemo(() => [...new Set(list.map((s) => s.quality))], [list]);
  const jobs = useMemo(() => [...new Set(list.map((s) => s.job))].sort(), [list]);
  const count = (key: "quality" | "job", v: string) => {
    const all = list.filter((s) => s[key] === v);
    return `${all.filter((s) => owned.has(s.slug)).length}/${all.length}`;
  };

  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    return list.filter((s) =>
      (!quality || s.quality === quality) && (!job || s.job === job) &&
      (!t || `${s.name} ${s.job} ${s.quality}`.toLowerCase().includes(t)) &&
      (onlyOwned === "all" || (onlyOwned === "owned") === owned.has(s.slug)));
  }, [list, quality, job, text, onlyOwned, owned]);

  const toggle = (slug: string) =>
    setState((p) => ({ owned: p.owned.includes(slug) ? p.owned.filter((x) => x !== slug) : [...p.owned, slug] }));

  return (
    <div>
      <PageHeader title="Survivor Roster" subtitle="Filter by quality and job, and tick the survivors you own." />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Owned" value={`${owned.size} / ${list.length}`} />
        {qualities.slice(0, 3).map((q) => <Stat key={q} label={q} value={count("quality", q)} />)}
      </div>
      <Card>
        <SearchBox value={text} onChange={setText} placeholder="Search survivors" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={chip(!quality)} onClick={() => setQuality("")}>All qualities</button>
          {qualities.map((q) => <button key={q} type="button" className={chip(quality === q)} onClick={() => setQuality(q)}>{q} · {count("quality", q)}</button>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={chip(!job)} onClick={() => setJob("")}>All jobs</button>
          {jobs.map((j) => <button key={j} type="button" className={chip(job === j)} onClick={() => setJob(j)}>{j} · {count("job", j)}</button>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["all", "owned", "missing"] as const).map((v) => <button key={v} type="button" className={chip(onlyOwned === v)} onClick={() => setOnlyOwned(v)}>{v === "all" ? "Show all" : v === "owned" ? "Owned" : "Not owned"}</button>)}
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => setState((p) => ({ owned: [...new Set([...p.owned, ...shown.map((s) => s.slug)])] }))}>Own shown</Button>
          <Button variant="ghost" onClick={() => setState((p) => ({ owned: p.owned.filter((x) => !shown.some((s) => s.slug === x)) }))}>Clear shown</Button>
        </div>
      </Card>

      <p className="my-3 text-sm text-muted">{shown.length} survivor{shown.length === 1 ? "" : "s"}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {shown.map((s) => {
          const has = owned.has(s.slug);
          return (
            <li key={s.slug} className={`overflow-hidden rounded-xl border bg-surface ${has ? "border-success" : "border-line"}`}>
              <a href={`https://zrouteguide.com/tools/survivor-calculator/${s.slug}/`} target="_blank" rel="noreferrer">
                <img src={s.image} alt={s.name} width={160} height={200} loading="lazy" decoding="async" className="aspect-[4/5] w-full bg-surface-2 object-cover" />
              </a>
              <div className="p-2">
                <div className="truncate text-sm font-semibold">{s.name}</div>
                <div className="truncate text-xs text-muted">{s.quality} · {s.job}</div>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
                  <input type="checkbox" checked={has} onChange={() => toggle(s.slug)} className="size-4 accent-[var(--color-primary)]" />
                  {has ? "Owned" : "Mark owned"}
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <SourceNote href="https://zrouteguide.com/tools/survivor-calculator/" />
    </div>
  );
}
