import raw from "~/data/heroes.json";
import metaJson from "./meta.json";
import type { HeroData, HeroVariant } from "./calc";

export type HeroSkillMeta = {
  slot: number; unlock: number; unlockStar: number; max: number; icon: string; name: string; pill: string; type: string;
};
export type HeroMeta = {
  id: string; slug: string; name: string; meta: string; portrait: string; webp: string; pw: number; ph: number;
  layer: string; face: string; medal: string; skills: HeroSkillMeta[]; equip: string[];
};
export type HeroCard = Pick<HeroMeta, "id" | "slug" | "name" | "meta" | "portrait" | "webp"> & { maxLevel: number };
export type HeroDetail = {
  meta: HeroMeta;
  hero: HeroData;
  variant: HeroVariant | null;
  bookLabel: string;
};

const data = raw.data as unknown as { zr_book_label: string; zr_heroes: Record<string, HeroData> };
const variants = raw.variants as unknown as Record<string, HeroVariant>;
const metas = metaJson as unknown as Record<string, Omit<HeroMeta, "id">>;
const withId = (id: string): HeroMeta => ({ id, ...metas[id] });

export function heroCards(): HeroCard[] {
  return raw.heroes.map((h) => {
    const m = withId(h.id);
    return { id: h.id, slug: m.slug, name: m.name, meta: m.meta, portrait: m.portrait, webp: m.webp, maxLevel: data.zr_heroes[h.id].zr_max_level };
  });
}

export function heroDetail(slug: string): HeroDetail | null {
  const entry = raw.heroes.find((h) => h.slug === slug);
  if (!entry || !metas[entry.id] || !data.zr_heroes[entry.id]) return null;
  return {
    meta: withId(entry.id),
    hero: data.zr_heroes[entry.id],
    variant: variants[entry.id] ?? null,
    bookLabel: data.zr_book_label || "Skill Books",
  };
}
