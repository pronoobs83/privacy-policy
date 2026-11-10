import { useState } from "react";
import { Link } from "react-router";
import { PageHeader, SearchBox, SourceNote } from "~/components/ui";
import { useToolState } from "~/lib/store";
import { starLabel, type HeroState } from "~/tools/heroes/calc";
import { heroCards } from "~/tools/heroes/data.server";
import type { Route } from "./+types/heroes";

export async function loader() {
  return { heroes: heroCards() };
}

export function meta() {
  return [
    { title: "Hero Calculator – Z Route Planner" },
    { name: "description", content: "Pick a hero to plan hero EXP, star medals and skill books for Z Route." },
  ];
}

const QUALITY = ["UR", "SSR", "SR"];

export default function Heroes({ loaderData }: Route.ComponentProps) {
  const [saved] = useToolState<Record<string, HeroState>>("heroes", {});
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const list = loaderData.heroes.filter((h) => !term || `${h.name} ${h.meta}`.toLowerCase().includes(term));

  return (
    <>
      <PageHeader title="Hero Calculator" subtitle="Choose a hero. Levels and stars you enter are saved per hero." />
      <div className="mb-4"><SearchBox value={q} onChange={setQ} placeholder="Search heroes" /></div>
      {QUALITY.map((quality) => {
        const group = list.filter((h) => h.meta.startsWith(quality));
        if (!group.length) return null;
        return (
          <section key={quality} className="mb-6">
            <h2 className="mb-2 font-display text-lg font-semibold">{quality}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {group.map((h) => {
                const s = saved[h.id];
                return (
                  <li key={h.id}>
                    <Link to={`/heroes/${h.slug}`} className="block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-primary">
                      <picture>
                        {h.webp && <source type="image/webp" srcSet={h.webp} />}
                        <img src={h.portrait} alt={h.name} loading="lazy" className="aspect-[3/4] w-full bg-surface-2 object-cover object-top" />
                      </picture>
                      <div className="p-2">
                        <p className="truncate font-semibold">{h.name}</p>
                        <p className="truncate text-xs text-muted">{h.meta.split(" · ").slice(1).join(" · ")}</p>
                        <p className="mt-1 text-xs text-muted">
                          {s ? <>Lv {s.level ?? 1} · {starLabel(s.recruit ? 0 : s.piece ?? 0)}</> : "Not saved yet"}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <SourceNote href="https://zrouteguide.com/tools/hero-calculator/" />
    </>
  );
}
