import { PageHeader, SourceNote } from "~/components/ui";
import { equipment } from "~/tools/equipment/data.server";
import { EquipmentCalculator } from "~/tools/equipment/EquipmentCalculator";
import type { Route } from "./+types/equipment";

export function meta() {
  return [
    { title: "Equipment Calculator — Z Route Planner" },
    { name: "description", content: "Plan Last War gear: enhance levels, promotion stars and materials to max for every slot and quality." },
  ];
}

export async function loader() {
  return equipment;
}

export default function Page({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageHeader title="Equipment Calculator" subtitle="Pick a plate per slot, set its level and stars, and see the materials left to max." />
      <EquipmentCalculator config={loaderData.config} data={loaderData.data} />
      <SourceNote href="https://zrouteguide.com/tools/equipment-calculator/" />
    </>
  );
}
