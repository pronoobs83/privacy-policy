import raw from "~/data/vip.json";
import type { VipData } from "./calc";

export const vip = raw as unknown as { data: VipData };
