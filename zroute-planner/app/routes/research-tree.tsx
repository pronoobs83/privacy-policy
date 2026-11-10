import { data } from "react-router";
import type { Route } from "./+types/research-tree";
import { SourceNote } from "~/components/ui";
import { ResearchTree } from "~/tools/research/ResearchTree";
import { getCategory } from "~/tools/research/data.server";

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.category.name ?? "Research";
  return [
    { title: `${name} Research – Z Route Planner` },
    { name: "description", content: `${name} research tree: costs, time and buffs for every level.` },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const d = getCategory(params.category);
  if (!d) throw data("Category not found", { status: 404 });
  return d;
}

export default function ResearchCategory({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <ResearchTree key={loaderData.category.id} {...loaderData} />
      <SourceNote href={`https://zrouteguide.com/tools/research-calculator/${loaderData.category.slug}/`} />
    </>
  );
}
