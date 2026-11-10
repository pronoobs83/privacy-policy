// Mirrors the local store to /api/sync while signed in. Polls instead of WebSockets
// because Hostinger's managed Node.js hosting does not accept inbound WebSockets.
import {
  META_PID, clearDirty, dropPristineLocal, emit, ensureProfile, getDirty, getMeta, markAllDirty, readUnit, syncHooks, writeUnit,
  type DirtyMap,
} from "./store";

const STATE = "zrp:sync";
const POLL_MS = 20_000;
const PUSH_DELAY_MS = 800;

export type SyncStatus = { state: "off" | "syncing" | "ok" | "error"; lastSync: number | null };
let status: SyncStatus = { state: "off", lastSync: null };
const statusListeners = new Set<() => void>();
export const getSyncStatus = () => status;
export function subscribeSync(fn: () => void) {
  statusListeners.add(fn);
  return () => void statusListeners.delete(fn);
}
function setStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s };
  statusListeners.forEach((fn) => fn());
}

type ServerUnit = { profileId: string; unitKey: string; data: unknown; version: number; at: number };
const readState = (): { userId: string | null; since: number } => {
  try {
    return JSON.parse(localStorage.getItem(STATE) || "") ?? { userId: null, since: 0 };
  } catch {
    return { userId: null, since: 0 };
  }
};
const saveState = (s: { userId: string | null; since: number }) => localStorage.setItem(STATE, JSON.stringify(s));

function apply(units: ServerUnit[]) {
  const dirty = getDirty();
  for (const u of units) {
    const localAt = dirty[`${u.profileId}\t${u.unitKey}`];
    if (u.profileId !== META_PID && localAt && localAt > u.at) continue; // our newer edit will be pushed
    writeUnit(u.profileId, u.unitKey, u.data, { at: u.at, fromServer: true });
  }
  emit();
}

export function startSync(userId: string) {
  let stopped = false;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;

  const st = readState();
  if (st.userId !== userId) {
    // First sign-in on this device (or a different account): upload what we have, then merge.
    saveState({ userId, since: 0 });
    if (!dropPristineLocal()) markAllDirty();
  }

  async function pull() {
    const { since } = readState();
    const res = await fetch(`/api/sync?since=${since}`, { credentials: "same-origin" });
    if (res.status === 401) throw new Error("signed out");
    if (!res.ok) throw new Error(`pull ${res.status}`);
    const body: { units: ServerUnit[]; serverMax: number } = await res.json();
    apply(body.units);
    saveState({ userId, since: Math.max(since, body.serverMax) });
  }

  async function push() {
    const dirty: DirtyMap = { ...getDirty() };
    const keys = Object.keys(dirty);
    if (!keys.length) return;
    const units = keys.slice(0, 400).map((k) => {
      const [profileId, unitKey] = k.split("\t");
      const data = profileId === META_PID ? getMeta().data : readUnit(profileId, unitKey)?.data ?? null;
      return { profileId, unitKey, data, at: dirty[k] };
    });
    const res = await fetch("/api/sync", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ units }),
    });
    if (!res.ok) throw new Error(`push ${res.status}`);
    const body: { rejected: ServerUnit[] } = await res.json();
    clearDirty(Object.fromEntries(units.map((u) => [`${u.profileId}\t${u.unitKey}`, u.at])));
    if (body.rejected.length) apply(body.rejected);
  }

  async function run() {
    if (busy || stopped) return;
    busy = true;
    setStatus({ state: "syncing" });
    try {
      await pull();
      await push();
      await pull(); // pick up versions we just wrote plus anything that raced in
      if (!getMeta().data.profiles.length) ensureProfile(); // brand-new account with nothing on the server
      setStatus({ state: "ok", lastSync: Date.now() });
    } catch {
      setStatus({ state: "error" });
    } finally {
      busy = false;
    }
  }

  syncHooks.onLocalChange = () => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(run, PUSH_DELAY_MS);
  };
  const onWake = () => document.visibilityState === "visible" && run();
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("online", run);
  const poll = setInterval(() => document.visibilityState === "visible" && run(), POLL_MS);
  run();

  return () => {
    stopped = true;
    clearTimeout(pushTimer);
    clearInterval(poll);
    syncHooks.onLocalChange = undefined;
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("online", run);
    setStatus({ state: "off" });
  };
}

/** Forget sync bookkeeping on sign-out; local data stays on the device. */
export function resetSyncState() {
  localStorage.removeItem(STATE);
}
