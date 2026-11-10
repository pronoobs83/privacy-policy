import data from "~/data/buildings.json";
import type { Building } from "./calc";

export function getBuildings(): Building[] {
  return (data.buildings as Building[]).map(({ rewards: _r, ...b }: any) => ({
    ...b,
    steps: b.steps.map(({ rewards: _w, ...s }: any) => s),
  }));
}
