import { Link } from "react-router";
import type { Route } from "./+types/home";
import { TOOLS } from "~/lib/tools";
import { useUser } from "~/root";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Z Route Planner – plan buildings, research, heroes and more" },
    { name: "description", content: "Plan your Z Route: Redemption upgrades with costs for buildings, research, heroes, equipment, Sky Fighter, alliance tech, decorations and VIP. Saves to your device and syncs across devices." },
  ];
}

export default function Home() {
  const user = useUser();
  return (
    <>
      <section className="mb-8 rounded-2xl border border-line bg-gradient-to-br from-surface to-bg p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Plan every upgrade in <span className="text-primary">Z Route</span></h1>
        <p className="mt-2 max-w-2xl text-muted">
          Enter where you are and where you want to be. The planner adds up resources, time and power. Your progress is
          saved per game account on this device{user ? " and synced to your login." : "; sign in to sync it across devices."}
        </p>
        {!user && (
          <div className="mt-4 flex gap-2">
            <Link to="/auth/sign-up" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-[#1a0d08]">Create free account</Link>
            <Link to="/auth/sign-in" className="rounded-lg border border-line px-4 py-2 text-sm">Sign in</Link>
          </div>
        )}
      </section>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TOOLS.map((t) => (
          <li key={t.to}>
            <Link to={t.to} className="group flex h-full flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-center transition hover:border-primary">
              <img src={t.image} alt="" className="size-16 object-contain transition group-hover:scale-105" loading="lazy" />
              <span className="font-display font-semibold">{t.label}</span>
              <span className="text-xs text-muted">{t.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
