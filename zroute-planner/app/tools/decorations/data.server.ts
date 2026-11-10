import raw from "~/data/decorations.json";
import type { Deco } from "./calc";

export const decorations = raw as unknown as { imgBase: string; data: { base: string; univ: string; decos: Deco[] } };
