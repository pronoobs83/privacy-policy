import { useEffect, useState, useSyncExternalStore } from "react";
import {
  isRouteErrorResponse, Link, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, useRouteLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import { sessionContext, type SessionUser } from "./context";
import { useProfiles } from "./lib/store";
import { getSyncStatus, startSync, subscribeSync } from "./lib/sync";
import { TOOLS } from "./lib/tools";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Space+Grotesk:wght@500..700&display=swap" },
];

export async function loader({ context }: Route.LoaderArgs) {
  return { user: context.get(sessionContext) };
}

export function useUser(): SessionUser {
  return (useRouteLoaderData("root") as { user: SessionUser } | undefined)?.user ?? null;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#071015" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function SyncBadge() {
  const s = useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus);
  const label = { off: "", syncing: "Syncing…", ok: "Synced", error: "Offline – will retry" }[s.state];
  if (!label) return null;
  const dot = { syncing: "bg-warning", ok: "bg-success", error: "bg-danger", off: "" }[s.state];
  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex" role="status">
      <span className={`size-2 rounded-full ${dot}`} />{label}
    </span>
  );
}

function ProfileSwitcher() {
  const { profiles, active, select, ensure } = useProfiles();
  useEffect(() => void ensure(), [ensure]);
  if (!active) return null;
  return (
    <select
      aria-label="Game account"
      value={active.id}
      onChange={(e) => (e.target.value === "__manage" ? (location.href = "/account#profiles") : select(e.target.value))}
      className="min-w-0 max-w-36 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
    >
      {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}{p.server ? ` · S${p.server}` : ""}</option>)}
      <option value="__manage">Manage accounts…</option>
    </select>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const user = loaderData.user;
  const [menu, setMenu] = useState(false);
  useEffect(() => (user ? startSync(user.id) : undefined), [user?.id]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button className="rounded-lg border border-line p-2 lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>☰</button>
          <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold" aria-label="Z Route Planner home">
            <img src="/img/themes/zroute-theme/assets/zr-logo.webp" alt="" className="size-8" />
            <span className="hidden whitespace-nowrap sm:inline">Z Route <span className="text-primary">Planner</span></span>
          </Link>
          <div className="flex-1" />
          <SyncBadge />
          <ProfileSwitcher />
          {user ? (
            <Link to="/account" className="max-w-28 truncate rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">{user.name || "Account"}</Link>
          ) : (
            <Link to="/auth/sign-in" className="shrink-0 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-[#1a0d08]">Sign in</Link>
          )}
        </div>
        <nav className={`${menu ? "block" : "hidden"} border-t border-line lg:block`}>
          <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 lg:flex-row lg:overflow-x-auto">
            {TOOLS.map((t) => (
              <li key={t.to}>
                <NavLink to={t.to} onClick={() => setMenu(false)}
                  className={({ isActive }) => `block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${isActive ? "bg-surface-2 text-primary-ink" : "text-muted hover:text-ink"}`}>
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Fan-made planner for Z Route: Redemption · Data from <a className="text-accent" href="https://zrouteguide.com">zrouteguide.com</a>
      </footer>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }
  return (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="font-display text-2xl font-bold">{message}</h1>
      <p className="text-muted">{details}</p>
      <Link to="/" className="mt-4 inline-block text-accent">Back home</Link>
      {stack && <pre className="mt-4 w-full overflow-x-auto p-4 text-xs"><code>{stack}</code></pre>}
    </main>
  );
}
