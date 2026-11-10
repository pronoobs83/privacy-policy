import type { Route } from "./+types/buildings";
import { PageHeader, SourceNote } from "~/components/ui";
import { BuildingsCalculator } from "~/tools/buildings/BuildingsCalculator";
import { getBuildings } from "~/tools/buildings/data.server";

export function meta() {
  return [
    { title: "Building Upgrade Calculator – Z Route Planner" },
    { name: "description", content: "Plan building upgrades: resources, time, power and the prerequisite chain, including the Base level you need." },
  ];
}

export async function loader() {
  return { buildings: getBuildings() };
}

export default function Buildings({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader title="Building Upgrade Calculator" subtitle="Set each building's current level, pick a target and see totals and prerequisites." image="/img/themes/zroute/assets/buildings/zr_base.webp" />
      <BuildingsCalculator buildings={loaderData.buildings} />
      <SourceNote href="https://zrouteguide.com/tools/hq-upgrade-calculator/" />
    </>
  );
}
