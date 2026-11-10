import raw from "~/data/alliance-tech.json";
import type { Tech } from "./calc";

export const allianceTech = raw as unknown as { imgBase: string; data: { techs: Tech[]; cats: string[]; oil: string; base: string } };
