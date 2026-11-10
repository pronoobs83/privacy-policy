import { useEffect, useState } from "react";
import { Link } from "react-router";
import { authClient } from "~/lib/auth-client";
import { useProfiles } from "~/lib/store";
import { resetSyncState } from "~/lib/sync";
import { Button, Card, PageHeader } from "~/components/ui";
import { useUser } from "~/root";

export const meta = () => [{ title: "Account – Z Route Planner" }];

function Profiles() {
  const { profiles, active, select, create, update, remove } = useProfiles();
  const [name, setName] = useState("");
  const [server, setServer] = useState("");
  return (
    <Card title="Game accounts" className="scroll-mt-24" >
      <p id="profiles" className="mb-3 text-sm text-muted">Each game account (main, farm, other server) keeps its own plans.</p>
      <ul className="mb-4 divide-y divide-line">
        {profiles.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
            <input aria-label="Account name" defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && update(p.id, { name: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-2 py-1.5 text-sm" />
            <input aria-label="Server" placeholder="Server #" defaultValue={p.server ?? ""} onBlur={(e) => update(p.id, { server: e.target.value || undefined })}
              className="w-24 rounded-lg border border-line bg-bg px-2 py-1.5 text-sm" />
            {active?.id === p.id ? <span className="px-2 text-xs text-success">Active</span> : <Button variant="ghost" onClick={() => select(p.id)}>Use</Button>}
            <Button variant="ghost" disabled={profiles.length < 2} onClick={() => confirm(`Delete "${p.name}" and all its plans?`) && remove(p.id)}>Delete</Button>
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); create(name, server || undefined); setName(""); setServer(""); }}>
        <input required placeholder="New account name" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
        <input placeholder="Server #" value={server} onChange={(e) => setServer(e.target.value)} className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
        <Button type="submit">Add</Button>
      </form>
    </Card>
  );
}

function PairDevice() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  async function generate() {
    setError("");
    const r = await authClient.oneTimeToken.generate();
    if (r.error || !r.data?.token) return setError(r.error?.message || "Could not create a code");
    setCode(r.data.token);
    // Rendered locally so the sign-in token is never sent to a third-party QR service.
    const QR = await import("qrcode");
    setQr(await QR.toDataURL(`${location.origin}/pair?code=${r.data.token}`, { width: 180, margin: 1 }));
  }
  return (
    <Card title="Pair another device">
      <p className="mb-3 text-sm text-muted">Sign in on your phone without typing a password: scan the QR code or open <code>/pair</code> and enter the code. Valid for 10 minutes, one use.</p>
      {code ? (
        <div className="flex flex-wrap items-center gap-4">
          {qr && <img src={qr} alt="Pairing QR code" className="size-[180px] rounded-lg bg-white" />}
          <div>
            <div className="break-all font-mono text-lg text-accent">{code}</div>
            <Button variant="ghost" className="mt-2" onClick={generate}>New code</Button>
          </div>
        </div>
      ) : <Button onClick={generate}>Create pairing code</Button>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}

function Sessions() {
  const [sessions, setSessions] = useState<{ id: string; userAgent?: string | null; createdAt: Date }[]>([]);
  useEffect(() => void authClient.listSessions().then((r) => setSessions((r.data as typeof sessions) ?? [])), []);
  return (
    <Card title="Signed-in devices" actions={<Button variant="ghost" onClick={async () => { await authClient.revokeOtherSessions(); location.reload(); }}>Sign out others</Button>}>
      <ul className="space-y-1 text-sm text-muted">
        {sessions.map((s) => <li key={s.id} className="truncate">{new Date(s.createdAt).toLocaleString()} · {s.userAgent || "Unknown device"}</li>)}
      </ul>
    </Card>
  );
}

export default function Account() {
  const user = useUser();
  async function signOut() {
    await authClient.signOut();
    resetSyncState();
    location.assign("/");
  }
  async function deleteAccount() {
    if (!confirm("Delete your login and all synced data? Plans saved on this device stay.")) return;
    const r = await authClient.deleteUser();
    if (r.error) return alert(r.error.message || "Could not delete account. Sign in again and retry.");
    resetSyncState();
    location.assign("/");
  }
  return (
    <>
      <PageHeader title="Account" subtitle={user ? `Signed in as ${user.email}` : "Not signed in – plans are saved on this device only."} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Profiles />
        {user ? (
          <>
            <PairDevice />
            <Sessions />
            <Card title="Sign out or delete">
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={signOut}>Sign out</Button>
                <Button variant="danger" onClick={deleteAccount}>Delete account</Button>
              </div>
            </Card>
          </>
        ) : (
          <Card title="Sync across devices">
            <p className="mb-3 text-sm text-muted">Create a free login to back up your plans and use them on any device.</p>
            <Link to="/auth/sign-up?redirectTo=/account" className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-[#1a0d08]">Create account</Link>
          </Card>
        )}
      </div>
    </>
  );
}
