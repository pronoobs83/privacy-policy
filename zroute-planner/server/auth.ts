import { betterAuth } from "better-auth";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { getMigrations } from "better-auth/db/migration";
import { dialect, dbType, migrateAppTables, deleteUserData } from "./db";

const discord =
  process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
    ? { discord: { clientId: process.env.DISCORD_CLIENT_ID, clientSecret: process.env.DISCORD_CLIENT_SECRET } }
    : undefined;

export const authOptions = {
  appName: "Z Route Planner",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: { dialect, type: dbType },
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders: discord,
  user: { deleteUser: { enabled: true, afterDelete: async (user) => deleteUserData(user.id) } },
  // Device pairing: a signed-in device mints a short code; verifying it signs the other device in.
  plugins: [oneTimeToken({ expiresIn: 10 })],
  // Hostinger serves Node apps behind its CDN/proxy, which forwards the client IP (used for rate limiting).
  advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] } },
} satisfies Parameters<typeof betterAuth>[0];

export const auth = betterAuth(authOptions);
export const hasDiscord = !!discord;

let migrated: Promise<void> | undefined;
/** Create/upgrade Better Auth tables and app tables once per process. */
export function migrate() {
  migrated ??= (async () => {
    const { runMigrations } = await getMigrations(authOptions);
    await runMigrations();
    await migrateAppTables();
  })();
  return migrated;
}
