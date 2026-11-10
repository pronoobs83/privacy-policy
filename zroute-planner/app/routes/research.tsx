import { Link } from "react-router";
import type { Route } from "./+types/research";
import { Card, PageHeader, SourceNote } from "~/components/ui";
import { useToolState } from "~/lib/store";
import { progress } from "~/tools/research/calc";
import { getIndex } from "~/tools/research/data.server";

export function meta() {
  return [
    { title: "Research Calculator – Z Route Planner" },
    { name: "description", content: "Track research progress by category and calculate the resources and time to finish every tech tree." },
  ];
}

export async function loader() {
  return getIndex();
}

export default function Research({ loaderData }: Route.ComponentProps) {
  const [st] = useToolState<{ lv: Record<string, number> }>("research", { lv: {} });
  const all = loaderData.counts.flatMap((c) => c.nodes);
  const total = progress(all, st.lv);
  return (
    <>
      <PageHeader title="Research Calculator" subtitle="Pick a category, set your research levels and see what is left to spend." />
      <Card title="Overall progress" className="mb-6">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-primary" style={{ width: `${total.pct}%` }} /></div>
        <p className="mt-2 text-sm text-muted">{total.have} / {total.max} levels · {total.pct}%</p>
      </Card>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {loaderData.categories.map((c) => {
          const p = progress(loaderData.counts.find((x) => x.id === c.id)!.nodes, st.lv);
          return (
            <li key={c.id}>
              <Link to={`/research/${c.slug}`} className="block rounded-2xl border border-line bg-surface p-3 hover:border-accent">
                <div className="flex items-center gap-3">
                  <img src={c.icon} alt="" loading="lazy" className="size-12 object-contain" />
                  <span className="font-semibold leading-tight">{c.name}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-primary" style={{ width: `${p.pct}%` }} /></div>
                <p className="mt-1 text-xs text-muted">{p.have}/{p.max} · {p.pct}%</p>
                {c.gates[0] && <p className="mt-1 text-xs text-muted">{c.gates[0]}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
      <SourceNote href="https://zrouteguide.com/tools/research-calculator/" />
    </>
  );
}
