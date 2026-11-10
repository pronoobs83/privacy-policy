import raw from "~/data/exclusive.json";
import type { ExclusiveData } from "./calc";

export function exclusiveData() {
  return { img: raw.config.img, data: raw.data as unknown as ExclusiveData };
}
