import raw from "~/data/survivors.json";

export type Survivor = { slug: string; name: string; quality: string; job: string; image: string };
export const survivors = (raw as { survivors: Survivor[] }).survivors;
