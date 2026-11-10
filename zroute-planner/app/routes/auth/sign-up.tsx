import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui";
import { AuthShell, DiscordButton, Field, goAfterAuth } from "./sign-in";

export const meta = () => [{ title: "Create account – Z Route Planner" }];

export default function SignUp() {
  const [params] = useSearchParams();
  const redirectTo = params.get("redirectTo") || "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.signUp.email({ name, email, password });
    if (error) {
      setError(error.message || "Sign up failed");
      setBusy(false);
    } else goAfterAuth(redirectTo);
  }

  return (
    <AuthShell title="Create account">
      <p className="text-sm text-muted">Your current plans on this device are uploaded to the new account automatically.</p>
      <DiscordButton redirectTo={redirectTo} />
      <div className="text-center text-xs text-muted">or</div>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
        <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password (8+ characters)" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="text-center text-sm text-muted">
        Already have one? <Link className="text-accent" to={`/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`}>Sign in</Link>
      </p>
    </AuthShell>
  );
}
