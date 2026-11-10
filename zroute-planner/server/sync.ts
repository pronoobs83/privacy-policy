import express, { type Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";
import { db, dbType } from "./db";

type Unit = { profileId: string; unitKey: string; data: unknown; at: number };
const MAX_UNITS = 500;
const MAX_UNIT_BYTES = 512 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_RE = /^[A-Za-z0-9_:./-]{1,190}$/;

async function userId(req: Request) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user.id ?? null;
}

const row = (r: { profile_id: string; unit_key: string; data: string | null; version: number | string; updated_at: number | string }) => ({
  profileId: r.profile_id,
  unitKey: r.unit_key,
  data: r.data == null ? null : JSON.parse(r.data),
  version: Number(r.version),
  at: Number(r.updated_at),
});

export const syncRouter = express.Router();
syncRouter.use(express.json({ limit: "4mb" }));

/** Pull every unit changed after `since` (a per-user version cursor). Deleted units come back with data: null. */
syncRouter.get("/", async (req, res) => {
  const uid = await userId(req);
  if (!uid) return void res.status(401).json({ error: "unauthorized" });
  const since = Number(req.query.since) || 0;
  const rows = await db
    .selectFrom("sync_unit")
    .select(["profile_id", "unit_key", "data", "version", "updated_at"])
    .where("user_id", "=", uid)
    .where("version", ">", since)
    .orderBy("version")
    .execute();
  const counter = await db.selectFrom("sync_counter").select("v").where("user_id", "=", uid).executeTakeFirst();
  res.json({ units: rows.map(row), serverMax: Number(counter?.v ?? 0) });
});

/**
 * Push units. Conflict rule is last-write-wins per unit on the client edit time (`at`);
 * when the server copy is newer it is returned in `rejected` so the client adopts it.
 */
syncRouter.post("/", async (req, res) => {
  const uid = await userId(req);
  if (!uid) return void res.status(401).json({ error: "unauthorized" });
  const units: Unit[] = Array.isArray(req.body?.units) ? req.body.units : [];
  if (units.length > MAX_UNITS) return void res.status(413).json({ error: "too many units" });
  for (const u of units) {
    if (!ID_RE.test(u?.profileId) || !KEY_RE.test(u?.unitKey) || typeof u.at !== "number")
      return void res.status(400).json({ error: "invalid unit" });
  }

  const result = await db.transaction().execute(async (trx) => {
    const ins = trx.insertInto("sync_counter").values({ user_id: uid, v: 0 });
    await (dbType === "mysql" ? ins.ignore() : ins.orIgnore()).execute();
    // Row lock on MySQL serializes concurrent pushes from the same user.
    let q = trx.selectFrom("sync_counter").select("v").where("user_id", "=", uid);
    if (dbType === "mysql") q = q.forUpdate();
    let v = Number((await q.executeTakeFirstOrThrow()).v);

    const versions: Record<string, number> = {};
    const rejected: ReturnType<typeof row>[] = [];
    for (const u of units) {
      const existing = await trx
        .selectFrom("sync_unit")
        .select(["profile_id", "unit_key", "data", "version", "updated_at"])
        .where("user_id", "=", uid)
        .where("profile_id", "=", u.profileId)
        .where("unit_key", "=", u.unitKey)
        .executeTakeFirst();
      if (existing && Number(existing.updated_at) > u.at) {
        rejected.push(row(existing));
        continue;
      }
      const data = u.data == null ? null : JSON.stringify(u.data);
      if (data && data.length > MAX_UNIT_BYTES) throw Object.assign(new Error("unit too large"), { status: 413 });
      v += 1;
      const values = { user_id: uid, profile_id: u.profileId, unit_key: u.unitKey, data, version: v, updated_at: u.at };
      const insert = trx.insertInto("sync_unit").values(values);
      const set = { data, version: v, updated_at: u.at };
      await (dbType === "mysql"
        ? insert.onDuplicateKeyUpdate(set)
        : insert.onConflict((oc) => oc.columns(["user_id", "profile_id", "unit_key"]).doUpdateSet(set))
      ).execute();
      versions[`${u.profileId}\t${u.unitKey}`] = v;
    }
    await trx.updateTable("sync_counter").set({ v }).where("user_id", "=", uid).execute();
    return { versions, rejected, serverMax: v };
  }).catch((e) => {
    if (e?.status === 413) return null;
    throw e;
  });
  if (!result) return void res.status(413).json({ error: "unit too large" });
  res.json(result);
});
