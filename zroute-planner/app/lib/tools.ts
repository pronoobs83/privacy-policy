// Single source of truth for the tool list (nav + home grid).
export type ToolLink = { to: string; label: string; blurb: string; image: string };

export const TOOLS: ToolLink[] = [
  { to: "/buildings", label: "Buildings", blurb: "HQ and every building, level 1 to 30", image: "/img/themes/zroute/assets/buildings/zr_base.webp" },
  { to: "/research", label: "Research", blurb: "All research trees with costs and buffs", image: "/img/themes/zroute/assets/research/zr_icon_technologytype_build.png" },
  { to: "/heroes", label: "Heroes", blurb: "Levels, stars and skills", image: "/img/themes/zroute/assets/heroes/zr_hero_aria_portrait.png" },
  { to: "/equipment", label: "Equipment", blurb: "Gear enhance and promotion costs", image: "/img/themes/zroute-theme/assets/equipment/zr_equip_wuqi_level_4.webp" },
  { to: "/exclusive", label: "Exclusive Weapons", blurb: "Shards and strengthen plans", image: "/img/themes/zroute-theme/assets/exclusive/zr_exclusiveweapon_icon_marilynmonroe.webp" },
  { to: "/skyfighter", label: "Sky Fighter", blurb: "Levels, components and wingmen", image: "/img/themes/zroute/assets/skyfighter/zr_skyfighter_skin_1.png" },
  { to: "/alliance-tech", label: "Alliance Tech", blurb: "Alliance research costs", image: "/img/uploads/zr-res/zr_atech_automaticassembly.webp" },
  { to: "/decorations", label: "Decorations", blurb: "Decoration levels and stars", image: "/img/uploads/zr-res/zr_deco_10001_tesla_tower.webp" },
  { to: "/vip", label: "VIP", blurb: "VIP points and privileges", image: "/img/uploads/zr-res/zr_ico_icon-item-vip-pts.webp" },
  { to: "/survivors", label: "Survivors", blurb: "Track the survivors you own", image: "/img/themes/zroute-theme/assets/survivors/cards/zr_image_emma_farmer_legendary_10001-320.webp" },
];
