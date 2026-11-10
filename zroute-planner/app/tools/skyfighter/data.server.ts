import raw from "~/data/skyfighter.json";
import { scaleWingExp, type Building, type CompData, type Items, type LevelData, type UpData, type Wing } from "./logic";

export const TABS = ["level", "upgrade", "comp", "wing", "bld"] as const;
export type Tab = (typeof TABS)[number];

type Raw = {
  config: { img: string; res: string };
  data: { zr_lv: LevelData & { zr_faq?: unknown; zr_preview?: unknown }; zr_up: UpData; zr_comp: CompData; zr_wing: Wing[]; zr_bld: Building[]; zr_fac: number[][]; zr_it: Items };
};
const { config, data } = raw as unknown as Raw;
scaleWingExp(data.zr_wing);

export const MAXLV = data.zr_lv.zr_rows[data.zr_lv.zr_rows.length - 1][0];
export const MAXUP = data.zr_up.zr_rows.length;

/** Only the data the requested tab needs (the full set is ~250 KB). */
export function sliceFor(tab: Tab) {
  const items = data.zr_it;
  const base = { config, maxLv: MAXLV, maxUp: MAXUP, items };
  switch (tab) {
    case "level": {
      const { zr_rows, zr_skill, zr_skins, zr_stars } = data.zr_lv;
      return { ...base, tab, level: { zr_rows, zr_skill, zr_skins, zr_stars } };
    }
    case "upgrade":
      return {
        ...base, tab, up: data.zr_up,
        wingExp: data.zr_wing.map((w) => ({ zr_n: w.zr_n, zr_q: w.zr_q, zr_img: w.zr_img, exp: (w.zr_st[0]?.[5] as number) || 0 })),
      };
    case "comp":
      return { ...base, tab, comp: data.zr_comp, fac: data.zr_fac };
    case "wing":
      return { ...base, tab, wings: data.zr_wing };
    case "bld":
      return { ...base, tab, bld: data.zr_bld };
  }
}
export type Slice = ReturnType<typeof sliceFor>;
