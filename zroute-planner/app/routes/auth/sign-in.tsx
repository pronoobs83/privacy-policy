import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui";

export const meta = () => [{ title: "Sign in – Z Route Planner" }];

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-center font-display text-2xl font-bold">{title}</h1>
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-6">{children}</div>
    </div>
  );
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input {...rest} className="rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-accent" />
    </label>
  );
}

export function DiscordButton({ redirectTo }: { redirectTo: string }) {
  const [err, setErr] = useState("");
  return (
    <>
      <Button variant="ghost" className="w-full" onClick={async () => {
        const r = await authClient.signIn.social({ provider: "discord", callbackURL: redirectTo });
        if (r.error) setErr(r.error.message || "Discord sign-in is not set up on this server.");
      }}>Continue with Discord</Button>
      {err && <p className="text-sm text-danger">{err}</p>}
    </>
  );
}

/** Full reload after auth so the server-rendered session (and sync) start cleanly. */
export const goAfterAuth = (to: string) => window.location.assign(to);

export default function SignIn() {
  const [params] = useSearchParams();
  const redirectTo = params.get("redirectTo") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message || "Sign in failed");
      setBusy(false);
    } else goAfterAuth(redirectTo);
  }

  return (
    <AuthShell title="Sign in">
      <DiscordButton redirectTo={redirectTo} />
      <div className="text-center text-xs text-muted">or</div>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="text-center text-sm text-muted">
        No account? <Link className="text-accent" to={`/auth/sign-up?redirectTo=${encodeURIComponent(redirectTo)}`}>Create one</Link>
      </p>
      <p className="text-center text-xs text-muted">Have a pairing code from another device? <Link className="text-accent" to="/pair">Pair this device</Link></p>
    </AuthShell>
  );
}
