// Local-first state: everything lives in localStorage first; the sync engine mirrors it to the server.
import { useCallback, useSyncExternalStore } from "react";

export type Profile = { id: string; name: string; server?: string; createdAt: number };
type Meta = { profiles: Profile[]; deleted: string[] };
type Stored<T = unknown> = { data: T; at: number };

const META = "zrp:meta";
const ACTIVE = "zrp:active";
const DIRTY = "zrp:dirty";
const unitKey = (pid: string, tool: string) => `zrp:u:${pid}:${tool}`;
export const META_PID = "_meta";
export const META_KEY = "profiles";

const listeners = new Set<() => void>();
const snapshots = new Map<string, { raw: string | null; value: unknown }>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key?.startsWith("zrp:") && emit();
  window.addEventListener("storage", onStorage); // other tabs
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}
export function emit() {
  listeners.forEach((fn) => fn());
}

function readRaw<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.value as T; // stable identity for useSyncExternalStore
  let value: unknown = fallback;
  try {
    if (raw != null) value = JSON.parse(raw);
  } catch {}
  snapshots.set(key, { raw, value });
  return value as T;
}
function writeRaw(key: string, value: unknown) {
  if (value === undefined) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---- dirty tracking (units waiting to be pushed) -------------------------

export type DirtyMap = Record<string, number>; // "pid\tkey" -> edit time
export const getDirty = () => readRaw<DirtyMap>(DIRTY, {});
function markDirty(pid: string, key: string, at: number) {
  writeRaw(DIRTY, { ...getDirty(), [`${pid}\t${key}`]: at });
  syncHooks.onLocalChange?.();
}
export function clearDirty(pushed: DirtyMap) {
  const d = { ...getDirty() };
  for (const [k, at] of Object.entries(pushed)) if (d[k] === at) delete d[k];
  writeRaw(DIRTY, d);
}
export const syncHooks: { onLocalChange?: () => void } = {};

// ---- meta (profile list) -------------------------------------------------

const EMPTY_META: Meta = { profiles: [], deleted: [] };
export function getMeta(): Stored<Meta> {
  return readRaw<Stored<Meta>>(META, { data: EMPTY_META, at: 0 });
}
function setMeta(data: Meta, at = Date.now(), fromServer = false) {
  writeRaw(META, { data, at });
  if (!fromServer) markDirty(META_PID, META_KEY, at);
  emit();
}
/** Union profiles from two devices; deletions win so a removed profile stays removed everywhere. */
export function mergeMeta(a: Meta, b: Meta): Meta {
  const deleted = [...new Set([...(a.deleted ?? []), ...(b.deleted ?? [])])];
  const byId = new Map<string, Profile>();
  for (const p of [...(b.profiles ?? []), ...(a.profiles ?? [])]) byId.set(p.id, p); // a wins on conflicts
  return { profiles: [...byId.values()].filter((p) => !deleted.includes(p.id)), deleted };
}

function ensureProfile(): Profile {
  const meta = getMeta().data;
  if (meta.profiles.length) return meta.profiles.find((p) => p.id === getActiveId()) ?? meta.profiles[0];
  const p: Profile = { id: newId(), name: "Main account", createdAt: Date.now() };
  setMeta({ ...meta, profiles: [p] });
  localStorage.setItem(ACTIVE, p.id);
  return p;
}
const getActiveId = () => (typeof localStorage === "undefined" ? null : localStorage.getItem(ACTIVE));

// ---- units ---------------------------------------------------------------

export function readUnit<T>(pid: string, tool: string): Stored<T> | null {
  return readRaw<Stored<T> | null>(unitKey(pid, tool), null);
}
export function writeUnit(pid: string, tool: string, data: unknown, opts: { at?: number; fromServer?: boolean } = {}) {
  const at = opts.at ?? Date.now();
  if (pid === META_PID) {
    // Server copy of the profile list is merged, never blindly replaced.
    const local = getMeta();
    const merged = mergeMeta(local.data, (data as Meta) ?? EMPTY_META);
    setMeta(merged, Math.max(at, local.at), true);
    if (JSON.stringify(merged) !== JSON.stringify(data)) markDirty(META_PID, META_KEY, Date.now());
    return;
  }
  writeRaw(unitKey(pid, tool), data == null ? undefined : { data, at });
  if (!opts.fromServer) markDirty(pid, tool, at);
  emit();
}
/** Everything stored locally, used to seed the server on first sign-in. */
export function allLocalUnits(): { pid: string; tool: string; at: number }[] {
  const out: { pid: string; tool: string; at: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const m = k?.match(/^zrp:u:([^:]+):(.+)$/);
    if (m) out.push({ pid: m[1], tool: m[2], at: readUnit(m[1], m[2])?.at ?? Date.now() });
  }
  return out;
}
export function markAllDirty() {
  const d: DirtyMap = { ...getDirty(), [`${META_PID}\t${META_KEY}`]: getMeta().at || Date.now() };
  for (const u of allLocalUnits()) d[`${u.pid}\t${u.tool}`] = u.at;
  writeRaw(DIRTY, d);
}

/**
 * A device with no saved plans only has the auto-created placeholder profile. Drop it on first
 * sign-in so the device adopts the account's profiles instead of adding an empty "Main account".
 */
export function dropPristineLocal(): boolean {
  if (allLocalUnits().length) return false;
  writeRaw(META, undefined);
  writeRaw(DIRTY, undefined);
  localStorage.removeItem(ACTIVE);
  emit();
  return true;
}
export { ensureProfile };

// ---- React hooks ---------------------------------------------------------

export function useProfiles() {
  const meta = useSyncExternalStore(subscribe, () => getMeta().data, () => EMPTY_META);
  const activeId = useSyncExternalStore(subscribe, getActiveId, () => null);
  const active = meta.profiles.find((p) => p.id === activeId) ?? meta.profiles[0] ?? null;

  const select = useCallback((id: string) => {
    localStorage.setItem(ACTIVE, id);
    emit();
  }, []);
  const create = useCallback((name: string, server?: string) => {
    const p: Profile = { id: newId(), name: name.trim() || "New account", server, createdAt: Date.now() };
    const m = getMeta().data;
    setMeta({ ...m, profiles: [...m.profiles, p] });
    select(p.id);
    return p;
  }, [select]);
  const update = useCallback((id: string, patch: Partial<Pick<Profile, "name" | "server">>) => {
    const m = getMeta().data;
    setMeta({ ...m, profiles: m.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }, []);
  const remove = useCallback((id: string) => {
    const m = getMeta().data;
    for (const u of allLocalUnits()) if (u.pid === id) writeUnit(id, u.tool, null);
    setMeta({ profiles: m.profiles.filter((p) => p.id !== id), deleted: [...(m.deleted ?? []), id] });
    if (getActiveId() === id) localStorage.removeItem(ACTIVE);
    ensureProfile();
    emit();
  }, []);
  return { profiles: meta.profiles, active, select, create, update, remove, ensure: ensureProfile };
}

/**
 * Per-profile, per-tool state saved to localStorage and synced when signed in.
 * `tool` must be a stable id like "buildings" or "heroes"; values must be JSON-serialisable.
 * During SSR and the first client render this returns `initial`.
 */
export function useToolState<T>(tool: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const { active } = useProfiles();
  const pid = active?.id ?? null;
  const stored = useSyncExternalStore(
    subscribe,
    () => (pid ? readUnit<T>(pid, tool) : null),
    () => null,
  );
  const value = stored ? stored.data : initial;
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const id = pid ?? ensureProfile().id;
      const prev = readUnit<T>(id, tool)?.data ?? initial;
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeUnit(id, tool, v);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pid, tool],
  );
  return [value, set];
}
