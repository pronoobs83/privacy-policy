import { Link } from "react-router";
import { PageHeader, SourceNote } from "~/components/ui";
import { HeroCalculator } from "~/tools/heroes/HeroCalculator";
import { heroDetail } from "~/tools/heroes/data.server";
import type { Route } from "./+types/hero";

export async function loader({ params }: Route.LoaderArgs) {
  const detail = heroDetail(params.slug);
  if (!detail) throw new Response("Hero not found", { status: 404 });
  return detail;
}

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.meta.name ?? "Hero";
  return [
    { title: `${name} Hero Calculator – Z Route Planner` },
    { name: "description", content: `${name} hero EXP, star medals and skill book costs from your current level to your target.` },
  ];
}

export default function Hero({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <p className="mb-2 text-sm"><Link to="/heroes" className="text-accent hover:underline">← All heroes</Link></p>
      <PageHeader title={`${loaderData.meta.name} Hero Calculator`} subtitle={`${loaderData.meta.meta}. Hero EXP, star medals and skill books to your target.`} />
      <HeroCalculator key={loaderData.meta.id} detail={loaderData} />
      <SourceNote href={`https://zrouteguide.com/tools/hero-calculator/${loaderData.meta.slug}/`} />
    </>
  );
}
