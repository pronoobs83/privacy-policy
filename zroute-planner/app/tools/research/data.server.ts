import data from "~/data/research.json";
import type { Category, Node } from "./calc";

const categories = data.categories as Category[];
const nodes = data.nodes as unknown as Node[];

export function getIndex() {
  return {
    categories,
    counts: categories.map((c) => ({
      id: c.id,
      nodes: nodes.filter((n) => n.category === c.id).map((n) => ({ id: n.id, max: n.max })),
    })),
  };
}

export function getCategory(slug: string) {
  const category = categories.find((c) => c.slug === slug);
  if (!category) return null;
  const list = nodes.filter((n) => n.category === category.id);
  const ids = new Set(list.map((n) => n.id));
  // Names of prerequisite nodes that live in other categories.
  const external: Record<string, { name: string; category: string }> = {};
  for (const n of list) {
    for (const p of n.prereqs) {
      const o = ids.has(p.id) ? null : nodes.find((x) => x.id === p.id);
      if (o) external[o.id] = { name: o.name, category: categories.find((c) => c.id === o.category)?.name ?? "" };
    }
  }
  return { category, nodes: list, external };
}
