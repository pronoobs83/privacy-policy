// Pulls every Z Route dataset and image from zrouteguide.com into app/data and public/img.
// Usage: node scripts/export/run.mjs [--fresh]   (--fresh re-downloads instead of using .cache)
import {
  ORIGIN, get, getJson, pool, evalWindowFile, pageVar, pageJson, writeData,
  img, localizeImages, stems, downloadImages,
} from "./lib.mjs";

const fresh = process.argv.includes("--fresh");
const page = (p) => get(`${ORIGIN}/${p}/`, { fresh });
const asset = (p) => get(`${ORIGIN}/wp-content/${p}`, { fresh });
const THEME = `${ORIGIN}/wp-content/themes/zroute/assets/`;
const THEME2 = `${ORIGIN}/wp-content/themes/zroute-theme/assets/`;
const RES_ICONS = ["zr_food.png", "zr_wood.png", "zr_stone.png"].map((f) => img(THEME + f));
const pending = []; // icon stems to probe

// The site's REST API is gated by a rotating token printed into tool pages, so always read it fresh.
const myPage = await get(`${ORIGIN}/my-z-route/`, { fresh: true });
const token = pageVar(myPage, "zrMy")?.token;
if (!token) throw new Error("Could not find zroute/v1 token on /my-z-route/");
const api = (route, q = {}) =>
  getJson(`${ORIGIN}/wp-json/zroute/v1/${route}?${new URLSearchParams({ token, ...q })}`, { fresh });

async function buildings() {
  const catalog = await api("buildings");
  const list = await pool(catalog, 4, async (b) => {
    const r = await api("building-upgrade", { id: b.zr_id, from: 1, to: b.zr_max });
    return {
      id: b.zr_id, name: b.zr_name, image: img(b.zr_image), max: b.zr_max, powerMax: b.zr_power_max,
      // steps[i] = cost to go from level (step.level - 1) to step.level
      steps: r.zr_steps.map((s) => ({
        level: s.zr_level, timeSec: s.zr_time_sec, power: s.zr_power,
        costs: s.zr_costs.map((c) => ({ label: c.zr_label, count: c.zr_count })),
        requires: (s.zr_requires || []).map((q) => ({ name: q.zr_name, level: q.zr_level })),
        rewards: s.zr_rewards || [],
      })),
    };
  });
  return writeData("buildings", localizeImages({ buildings: list }));
}

async function research() {
  const { zr_categories, zr_nodes } = await api("researches");
  const levels = await pool(zr_nodes, 4, (n) => api("research-levels", { id: n.zr_id }));
  const byId = Object.fromEntries(levels.map((l) => [l.zr_id, l.zr_rows]));
  const categories = zr_categories.map((c) => ({
    id: c.zr_id, name: c.zr_name, slug: c.zr_slug, icon: c.zr_icon, gates: c.zr_gates,
  }));
  const nodes = zr_nodes.map((n) => ({
    id: n.zr_id, category: n.zr_type, name: n.zr_name, slug: n.zr_slug, max: n.zr_max,
    row: n.zr_row, col: n.zr_col, icon: n.zr_icon, desc: n.zr_desc,
    prereqs: (n.zr_tech || []).map((t) => ({ id: t.zr_id, level: t.zr_level })),
    buildings: (n.zr_buildings || []).map((b) => ({ name: b.zr_name, level: b.zr_level })),
    levels: (byId[n.zr_id] || []).map((r) => ({
      level: r.zr_level, power: r.zr_power, timeSec: r.zr_time_sec,
      costs: (r.zr_costs || []).map((c) => ({ label: c.zr_label, count: c.zr_count })),
      buffs: (r.zr_buffs || []).map((b) => ({ n: b.zr_n, label: b.zr_label, value: b.zr_value })),
      needs: {
        tech: (r.zr_needs?.zr_tech || []).map((t) => ({ id: t.zr_id, name: t.zr_name, level: t.zr_level })),
        buildings: (r.zr_needs?.zr_buildings || []).map((b) => ({ name: b.zr_name, level: b.zr_level })),
      },
    })),
  }));
  return writeData("research", localizeImages({ categories, nodes }));
}

async function heroes() {
  const w = evalWindowFile(await asset("themes/zroute/assets/zr_heroes_data.js"));
  // Hero ids/slugs/images come from the per-hero calculator pages.
  const listHtml = await page("tools/hero-calculator");
  const slugs = [...new Set([...listHtml.matchAll(/tools\/hero-calculator\/([a-z0-9-]+)\//g)].map((m) => m[1]))].filter((s) => s !== "feed");
  const pages = await pool(slugs, 3, async (slug) => {
    const html = await page(`tools/hero-calculator/${slug}`);
    const name = html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1].replace(/<[^>]+>/g, "").trim();
    const images = [...html.matchAll(/(?:src|srcset)="(https:\/\/zrouteguide\.com\/wp-content\/[^"\s]+\.(?:webp|png))/g)].map((m) => img(m[1]));
    return { slug, id: pageVar(html, "zrHero")?.id, title: name, images: [...new Set(images)] };
  });
  return writeData("heroes", localizeImages({ data: w.zrHeroData, variants: w.zrHeroVariants, heroes: pages }));
}

async function windowData(file, global, tool, configVar, out) {
  const w = evalWindowFile(await asset(file));
  const html = await page(`tools/${tool}`);
  const config = pageVar(html, configVar);
  if (config?.img) pending.push(...stems(w[global], config.img));
  return writeData(out, localizeImages({ config, data: w[global] }));
}

async function inlineTool(tool, id, out) {
  const html = await page(`tools/${tool}`);
  const data = pageJson(html, id);
  // Inline datasets carry bare filenames in "img"; find the directory they are served from.
  const used = [...html.matchAll(/src="(https:\/\/zrouteguide\.com\/wp-content\/[^"?]+\.(?:webp|png))/g)].map((m) => m[1]);
  const imgBase = used.find((u) => /\/zr_(atech|deco|vip)/.test(u))?.replace(/[^/]+$/, "") ?? null;
  for (const u of used) img(u);
  // Inline datasets name images by bare filename relative to data.base / data.pbase.
  for (const base of [imgBase, data.base, data.pbase].filter(Boolean)) {
    JSON.stringify(data).replace(/"([\w.-]+\.(?:webp|png))"/g, (_, f) => img(base + f));
  }
  const localBase = imgBase && "/img/" + new URL(imgBase).pathname.slice("/wp-content/".length);
  return writeData(out, localizeImages({ imgBase: localBase, data }));
}

async function survivors() {
  const html = await page("tools/survivor-calculator");
  const list = [...html.matchAll(/<a class="zr-scard" href="[^"]*\/survivor-calculator\/([^/"]+)\/" data-name="[^"]*" data-quality="([^"]*)" data-job="([^"]*)">.*?<img class="zr-scard__img" src="([^"?]+)[^"]*".*?<span class="zr-scard__name[^"]*">(.*?)<\/span>/gs)]
    .map(([, slug, quality, job, src, name]) => ({ slug, name, quality, job, image: img(src.replace(/-240\.webp$/, "-320.webp")) }));
  return writeData("survivors", { survivors: list });
}

const steps = {
  buildings, research, heroes, survivors,
  equipment: () => windowData("themes/zroute-theme/assets/zr_equipment_data.js", "ZREQ", "equipment-calculator", "zrEQ", "equipment"),
  exclusive: () => windowData("themes/zroute-theme/assets/zr_exclusive_data.js", "ZRXW", "exclusive-weapon-calculator", "zrXW", "exclusive"),
  skyfighter: () => windowData("themes/zroute/assets/zr_skyfighter_data.js", "ZRSF", "skyfighter-calculator", "zrSF", "skyfighter"),
  allianceTech: () => inlineTool("alliance-tech-calculator", "zr-at-data", "alliance-tech"),
  decorations: () => inlineTool("decoration-calculator", "zr-dc-data", "decorations"),
  vip: () => inlineTool("vip-calculator", "zr-vipc-data", "vip"),
};

const only = process.argv.filter((a) => !a.startsWith("--")).slice(2);
for (const [name, fn] of Object.entries(steps)) {
  if (only.length && !only.includes(name)) continue;
  const t = Date.now();
  const file = await fn();
  console.log(`${name.padEnd(13)} -> ${file} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
// Images referenced only from calculator code (not data): extra-images*.txt, one zrouteguide.com URL per line.
const fsp = await import("node:fs/promises");
const here = new URL(".", import.meta.url);
let extra = "";
for (const f of (await fsp.readdir(here)).filter((f) => /^extra-images.*\.txt$/.test(f))) {
  extra += "\n" + (await fsp.readFile(new URL(f, here), "utf8"));
}
for (const line of extra.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))) img(line);

const { total, failed } = await downloadImages(pending);
console.log(`images: ${total} referenced, ${failed} failed, resource icons: ${RES_ICONS.join(", ")}`);
