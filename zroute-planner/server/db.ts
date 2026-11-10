import { Kysely, MysqlDialect, SqliteDialect, sql, type Dialect } from "kysely";

export type DbType = "mysql" | "sqlite";

export interface SyncUnitTable {
  user_id: string;
  profile_id: string;
  unit_key: string;
  data: string | null; // JSON; null when deleted
  version: number;
  updated_at: number; // client edit time (ms)
}
export interface SyncCounterTable {
  user_id: string;
  v: number;
}
export interface AppDb {
  sync_unit: SyncUnitTable;
  sync_counter: SyncCounterTable;
}

/**
 * DATABASE_URL=mysql://user:pass@host:3306/db  -> MySQL (Hostinger)
 * unset                                      -> SQLite file (local dev), path from SQLITE_PATH
 */
async function createDialect(): Promise<{ dialect: Dialect; type: DbType }> {
  const url = process.env.DATABASE_URL;
  if (url?.startsWith("mysql")) {
    const { createPool } = await import("mysql2");
    return { type: "mysql", dialect: new MysqlDialect({ pool: createPool({ uri: url, connectionLimit: 5, timezone: "Z" }) }) };
  }
  const { default: Database } = await import("better-sqlite3");
  const db = new Database(process.env.SQLITE_PATH || "./local.sqlite");
  db.pragma("journal_mode = WAL");
  return { type: "sqlite", dialect: new SqliteDialect({ database: db }) };
}

export const { dialect, type: dbType } = await createDialect();
export const db = new Kysely<AppDb>({ dialect });

/** Remove all synced data for a user (their browser copies stay). */
export async function deleteUserData(uid: string) {
  await db.deleteFrom("sync_unit").where("user_id", "=", uid).execute();
  await db.deleteFrom("sync_counter").where("user_id", "=", uid).execute();
}

export async function migrateAppTables() {
  const text = dbType === "mysql" ? sql`LONGTEXT` : sql`TEXT`;
  const id = dbType === "mysql" ? sql`VARCHAR(64)` : sql`TEXT`;
  const key = dbType === "mysql" ? sql`VARCHAR(191)` : sql`TEXT`;
  await db.schema
    .createTable("sync_unit")
    .ifNotExists()
    .addColumn("user_id", id, (c) => c.notNull())
    .addColumn("profile_id", id, (c) => c.notNull())
    .addColumn("unit_key", key, (c) => c.notNull())
    .addColumn("data", text)
    .addColumn("version", "bigint", (c) => c.notNull())
    .addColumn("updated_at", "bigint", (c) => c.notNull())
    .addPrimaryKeyConstraint("sync_unit_pk", ["user_id", "profile_id", "unit_key"])
    .execute();
  await db.schema
    .createIndex("sync_unit_user_version")
    .ifNotExists()
    .on("sync_unit")
    .columns(["user_id", "version"])
    .execute()
    .catch(() => {}); // MySQL has no CREATE INDEX IF NOT EXISTS; ignore "already exists"
  await db.schema
    .createTable("sync_counter")
    .ifNotExists()
    .addColumn("user_id", id, (c) => c.primaryKey())
    .addColumn("v", "bigint", (c) => c.notNull())
    .execute();
}
