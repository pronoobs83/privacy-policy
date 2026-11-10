// Pure hero calculator logic, ported from zrouteguide.com heroes.js (quote / skillFilled).
export type HeroSkill = {
  zr_slot: number;
  zr_max: number;
  zr_desc?: string;
  zr_costs: number[];
  zr_cd?: string;
  zr_p?: number[][];
  zr_pt?: number;
  zr_p2?: number[][];
  zr_p2i?: number;
  zr_p2t?: number;
  zr_flat?: [number, string][];
  zr_lines?: [number, string][];
};
export type HeroData = {
  zr_max_level: number;
  zr_exp: number[];
  zr_atk: number[];
  zr_def: number[];
  zr_cmd: number[];
  zr_frag: number[];
  zr_cap: number[];
  zr_skills: HeroSkill[];
  zr_sample?: number[];
  zr_summon?: number;
};
export type VariantSkillConf = { zr_slot: number; zr_name: string; zr_max: number; zr_icon: string };
export type HeroVariant = {
  zr_id: string;
  zr_key: string;
  zr_label: string;
  zr_base_label: string;
  zr_quality: string;
  zr_base_quality: string;
  zr_portrait: string;
  zr_portrait_w: number;
  zr_portrait_h: number;
  zr_layer: string;
  zr_skills: VariantSkillConf[];
  zr_hero: HeroData;
};

export type SkillRange = { slot: number; from: number; to: number };
export type SkillQuote = {
  slot: number;
  max: number;
  booksNext: number;
  booksToTarget: number;
  text: string;
  mark: string;
  cd?: string;
  starLines: { star: number; text: string }[];
  maxLine?: { level: number; star: number; text: string; mark: string };
};
export type HeroQuote = {
  expToTarget: number;
  expNext: number;
  fragments: number;
  fragmentsNext: number;
  summon: number;
  atk?: number;
  def?: number;
  command?: number;
  maxSample?: { level: number; star: number; atk: number; def: number; command: number };
  skillCap?: number;
  skills: SkillQuote[];
};

export const MAX_PIECE = 25;

export const wholeOf = (piece: number) => (piece >= 25 ? 5 : piece < 0 ? 0 : Math.floor(piece / 5));
export const partOf = (piece: number) => (piece >= 25 || piece < 0 ? 0 : piece % 5);
export function starLabel(piece: number) {
  const part = partOf(piece);
  return `${wholeOf(piece)}★${part > 0 ? ` (${part}/5)` : ""}`;
}

export function skillLocked(unlock: number, unlockStar: number, level: number, piece: number) {
  return (unlock > 0 && level < unlock) || (unlockStar > 0 && wholeOf(piece) < unlockStar);
}
export function lockText(unlock: number, unlockStar: number) {
  return `From hero level ${unlock}${unlockStar > 0 ? ` and ${unlockStar} stars` : ""}`;
}

function phpRound(value: number, places: number) {
  const f = Math.pow(10, places);
  const x = Number((value * f).toPrecision(15));
  const r = x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5);
  return r / f;
}

function skillValue(base: number, grow: number, factor: number, level: number, percent: boolean) {
  const value = (base + grow * level) * factor;
  if (percent) return phpRound(value * 100, 2).toFixed(2);
  const shown = phpRound(value, 4);
  if (Math.abs(shown - Math.round(shown)) < 0.00001) return String(Math.round(shown));
  return shown.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function putNumber(desc: string, index: number, number: string, percent: boolean) {
  const token = `{${index}}`;
  if (percent && !new RegExp(`\\{${index}\\}[ \\t\\n\\r\\v\\f]*%`).test(desc)) number += "%";
  return desc.split(token).join(number);
}

function paramRow(rows: number[][] | undefined, star: number): [number, number, number] | null {
  if (!Array.isArray(rows) || !Array.isArray(rows[star])) return null;
  const row = rows[star];
  return [Number(row[0]) || 0, Number(row[1]) || 0, row[2] === undefined || row[2] === null ? 1 : Number(row[2])];
}

export function skillFilled(skill: HeroSkill, piece: number, level: number) {
  const star = wholeOf(piece);
  const fills: [number, string, boolean][] = [];
  const setFill = (index: number, number: string, percent: boolean) => {
    const at = fills.findIndex((f) => f[0] === index);
    if (at >= 0) fills[at] = [index, number, percent];
    else fills.push([index, number, percent]);
  };
  const row = paramRow(skill.zr_p, star);
  if (row) {
    const raw = !!skill.zr_pt;
    if (raw || Math.abs(row[0]) > 0.0000001 || Math.abs(row[1]) > 0.0000001) {
      setFill(0, skillValue(row[0], row[1], row[2], level, !raw), !raw);
    }
  }
  const row2 = skill.zr_p2i === undefined ? null : paramRow(skill.zr_p2, star);
  if (row2) {
    const raw2 = !!skill.zr_p2t;
    setFill(Number(skill.zr_p2i), skillValue(row2[0], row2[1], row2[2], level, !raw2), !raw2);
  }
  for (const pair of skill.zr_flat || []) {
    const index = Number(pair[0]);
    if (!fills.some((f) => f[0] === index)) setFill(index, String(pair[1]), true);
  }
  let text = String(skill.zr_desc || "");
  let mark = "";
  for (const f of fills) {
    if (f[0] === 0) mark = f[1];
    text = putNumber(text, f[0], f[1], f[2]);
  }
  return { text, mark };
}

/** Totals from the current state to the targets. Returns null for out-of-range input. */
export function quote(
  hero: HeroData,
  level: number,
  piece: number,
  targetLevel: number,
  targetPiece: number,
  ranges: SkillRange[],
): HeroQuote | null {
  const max = Number(hero.zr_max_level) || 0;
  const exps = hero.zr_exp || [];
  const frags = hero.zr_frag || [];
  if (level < 1 || level > max || piece < 0 || piece > 25 || exps.length < max || frags.length < 26) return null;
  let exp = 0;
  for (let l = level + 1; l <= Math.min(max, targetLevel); l++) exp += Number(exps[l - 1]) || 0;
  let fragments = 0;
  for (let p = piece + 1; p <= Math.min(25, targetPiece); p++) fragments += Number(frags[p]) || 0;

  const skills: SkillQuote[] = [];
  for (const range of ranges) {
    const skill = hero.zr_skills.find((s) => s.zr_slot === range.slot);
    if (!skill) return null;
    const smax = Number(skill.zr_max) || 0;
    const from = range.from;
    if (from < 1 || from > smax) return null;
    const costs = skill.zr_costs || [];
    let books = 0;
    for (let step = from + 1; step <= Math.min(smax, range.to); step++) {
      const cost = costs[step - 2];
      if (typeof cost !== "number") return null;
      books += cost;
    }
    const view = skillFilled(skill, piece, from);
    const maxView = skillFilled(skill, 25, smax);
    skills.push({
      slot: Number(skill.zr_slot),
      max: smax,
      booksNext: from < smax ? costs[from - 1] : 0,
      booksToTarget: books,
      text: view.text,
      mark: view.mark,
      cd: skill.zr_cd || undefined,
      starLines: (skill.zr_lines || []).map((l) => ({ star: l[0], text: l[1] })),
      maxLine: maxView.text ? { level: smax, star: 5, text: maxView.text, mark: maxView.mark } : undefined,
    });
  }
  const out: HeroQuote = {
    expToTarget: exp,
    expNext: level < max ? Number(exps[level]) || 0 : 0,
    fragments,
    fragmentsNext: piece < 25 ? Number(frags[piece + 1]) || 0 : 0,
    summon: Number(hero.zr_summon) || 0,
    atk: hero.zr_atk?.[level - 1],
    def: hero.zr_def?.[level - 1],
    command: hero.zr_cmd?.[level - 1],
    skills,
  };
  if (Array.isArray(hero.zr_sample) && hero.zr_sample.length === 3) {
    out.maxSample = { level: max, star: 5, atk: hero.zr_sample[0], def: hero.zr_sample[1], command: hero.zr_sample[2] };
  }
  const cap = hero.zr_cap?.[wholeOf(piece)];
  if (typeof cap === "number") out.skillCap = cap;
  return out;
}

/** Saved per-hero inputs. Missing fields mean the defaults noted here. */
export type HeroState = {
  level?: number; // 1
  piece?: number; // 0..25 star segments, 0
  recruit?: boolean; // not recruited yet: +summon medals
  awake?: boolean;
  tLevel?: number; // default max level
  tPiece?: number; // default 25
  skills?: Record<string, number>; // current level per slot, default 1
  tSkills?: Record<string, number>; // target per slot, default max
};
