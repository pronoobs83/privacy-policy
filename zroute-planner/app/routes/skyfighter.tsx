import { PageHeader, SourceNote } from "~/components/ui";
import { TABS, sliceFor, type Tab } from "~/tools/skyfighter/data.server";
import { SkyFighter } from "~/tools/skyfighter/SkyFighter";
import type { Route } from "./+types/skyfighter";

export function meta() {
  return [
    { title: "Sky Fighter Calculator — Z Route Planner" },
    { name: "description", content: "Sky Fighter calculator: fighter levels, upgrade EXP, components, wingman stars and fighter buildings." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const t = new URL(request.url).searchParams.get("tab") as Tab;
  return sliceFor(TABS.includes(t) ? t : "level");
}

export default function Page({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader title="Sky Fighter Calculator" subtitle="Levels, upgrade EXP, components, wingmen and buildings for your Sky Fighter." />
      <SkyFighter slice={loaderData} />
      <SourceNote href="https://zrouteguide.com/tools/skyfighter-calculator/" />
    </>
  );
}
