import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui";
import { AuthShell, Field } from "./auth/sign-in";

export const meta = () => [{ title: "Pair device – Z Route Planner" }];

export default function Pair() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const auto = useRef(false);

  async function verify(token: string) {
    setState("busy");
    const r = await authClient.oneTimeToken.verify({ token: token.trim() });
    if (r.error) {
      setError(r.error.message || "Invalid or expired code");
      setState("error");
      return;
    }
    setState("ok");
    setTimeout(() => location.assign("/"), 800);
  }
  useEffect(() => {
    if (!auto.current && params.get("code")) {
      auto.current = true;
      verify(params.get("code")!);
    }
  }, [params]);

  return (
    <AuthShell title="Pair this device">
      {state === "ok" ? <p className="text-center text-success">Device paired! Redirecting…</p> : (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); verify(code); }}>
          <p className="text-sm text-muted">On a signed-in device open Account → Pair another device, then enter the code here.</p>
          <Field label="Pairing code" required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" />
          {state === "error" && <p className="text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" disabled={state === "busy"} className="w-full">{state === "busy" ? "Pairing…" : "Pair"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
