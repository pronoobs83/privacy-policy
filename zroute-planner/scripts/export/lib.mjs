// Shared helpers for pulling data and images from zrouteguide.com into this app.
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ORIGIN = "https://zrouteguide.com";
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const CACHE = path.join(ROOT, ".cache/raw");
export const DATA_OUT = path.join(ROOT, "app/data");
export const IMG_OUT = path.join(ROOT, "public/img");
const UA = "zroute-planner-export/1.0 (+https://zrouteguide.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with on-disk cache so re-runs don't hit the site again. Pass fresh: true to bypass. */
export async function get(url, { fresh = false, binary = false } = {}) {
  const key = url.replace(/^https?:\/\//, "").replace(/token=[^&]*&?/, "").replace(/[?&=]/g, "_").replace(/[^a-zA-Z0-9._/-]/g, "_");
  const file = path.join(CACHE, key.endsWith("/") ? key + "index.html" : key);
  if (!fresh) {
    try {
      const buf = await fs.readFile(file);
      return binary ? buf : buf.toString("utf8");
    } catch {}
  }
  const isApi = url.includes("/wp-json/");
  for (let attempt = 1; ; attempt++) {
    // The site's REST API rate-limits bursts (429 without Retry-After), so space API calls out.
    if (isApi) await apiGate();
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, buf);
      return binary ? buf : buf.toString("utf8");
    }
    if (res.status === 404 || attempt >= 8) throw new Error(`${res.status} ${url}`);
    const wait = res.status === 429 ? Math.min(30_000 * attempt, 180_000) : 1000 * attempt;
    if (res.status === 429) console.warn(`429, waiting ${wait / 1000}s: ${url.replace(/token=[^&]+&?/, "")}`);
    await sleep(wait);
  }
}

let nextApiAt = 0;
async function apiGate() {
  const now = Date.now();
  const at = Math.max(now, nextApiAt);
  nextApiAt = at + 1500;
  await sleep(at - now);
}

export async function getJson(url, opts) {
  return JSON.parse(await get(url, opts));
}

/** Run `items` through `fn` with bounded concurrency (be gentle with shared hosting). */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await fn(items[n], n);
      }
    }),
  );
  return out;
}

/** Evaluate a `window.X = {...}` data file (first-party content) and return the window globals it set. */
export function evalWindowFile(src) {
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { timeout: 5000 });
  return sandbox.window;
}

/** Read `var name = {...};` emitted by wp_localize_script. */
export function pageVar(html, name) {
  const m = html.match(new RegExp(`var ${name} = (\\{.*?\\});\\s*\\n`, "s"));
  return m ? JSON.parse(m[1]) : null;
}

/** Read `<script type="application/json" id="...">` blocks. */
export function pageJson(html, id) {
  const m = html.match(new RegExp(`<script[^>]*id="${id}"[^>]*>(.*?)</script>`, "s"));
  return m ? JSON.parse(m[1]) : null;
}

export async function writeData(name, value) {
  await fs.mkdir(DATA_OUT, { recursive: true });
  const file = path.join(DATA_OUT, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(value));
  return file;
}

// ---- images -------------------------------------------------------------

const images = new Map(); // remote url -> local public path

/** Map a zrouteguide.com wp-content URL to its local /img/... path and queue it for download. */
export function img(url) {
  if (!url) return url;
  const abs = url.startsWith("http") ? url : ORIGIN + (url.startsWith("/") ? "" : "/") + url;
  const u = new URL(abs);
  if (u.hostname !== "zrouteguide.com" || !u.pathname.startsWith("/wp-content/")) return url;
  const local = "/img/" + u.pathname.slice("/wp-content/".length);
  images.set(u.origin + u.pathname, local);
  return local;
}

/** Replace every zrouteguide.com image URL inside a JSON-able value with its local path. */
export function localizeImages(value) {
  const re = /https?:\/\/zrouteguide\.com\/wp-content\/[^"'\s)]+?\.(?:webp|png|jpe?g|avif|svg|gif)/g;
  const json = JSON.stringify(value).replace(/https?:\\\/\\\/zrouteguide\.com\\\//g, ORIGIN + "/").replace(re, (m) => img(m));
  // Remaining wp-content URLs are asset directory bases (e.g. ".../uploads/zr-res/").
  return JSON.parse(json.replace(/https?:\/\/zrouteguide\.com\/wp-content\/([^"]*\/)"/g, '/img/$1"'));
}

/** Queue every `zr_*` icon stem found in `value` against `base` (tries .webp then .png). */
export function stems(value, base, exts = [".webp", ".png"]) {
  const found = new Set();
  JSON.stringify(value).replace(/"(zr_[a-z0-9_]+)"/g, (_, s) => found.add(s));
  return [...found].map((s) => ({ base, stem: s, exts }));
}

export async function downloadImages(candidates = []) {
  // Probe stem candidates (icon names without extension) for whichever extension exists.
  await pool(candidates, 6, async ({ base, stem, exts }) => {
    for (const ext of exts) {
      try {
        await get(base + stem + ext, { binary: true });
        img(base + stem + ext);
        return;
      } catch {}
    }
  });
  const list = [...images.entries()];
  let failed = 0;
  await pool(list, 6, async ([remote, local]) => {
    const dest = path.join(ROOT, "public", local);
    try {
      await fs.access(dest);
      return;
    } catch {}
    try {
      const buf = await get(remote, { binary: true });
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, buf);
    } catch (e) {
      failed++;
      console.warn("image failed:", remote, e.message);
    }
  });
  return { total: list.length, failed };
}
