import raw from "~/data/equipment.json";
import type { EquipData } from "./logic";

export const equipment = raw as unknown as { config: { img: string; res: string }; data: EquipData };
