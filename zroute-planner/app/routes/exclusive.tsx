import { PageHeader, SourceNote } from "~/components/ui";
import { ExclusiveCalculator } from "~/tools/exclusive/ExclusiveCalculator";
import { exclusiveData } from "~/tools/exclusive/data.server";
import type { Route } from "./+types/exclusive";

export async function loader() {
  return exclusiveData();
}

export function meta() {
  return [
    { title: "Exclusive Weapon Calculator – Z Route Planner" },
    { name: "description", content: "Exclusive weapon shard costs, universal shards, strengthen lines and stat gains for Z Route." },
  ];
}

export default function Exclusive({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader
        title="Exclusive Weapon Calculator"
        subtitle="Pick a weapon, set current and wanted level, and plan the three strengthen lines."
        image="/img/themes/zroute-theme/assets/exclusive/zr_exclusiveweapon_icon_marilynmonroe.webp"
      />
      <ExclusiveCalculator data={loaderData.data} img={loaderData.img} />
      <SourceNote href="https://zrouteguide.com/tools/exclusive-weapon-calculator/" />
    </>
  );
}
