"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { DataList, type Column } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { INVITE_ROLES, ROLE_EXPLANATION, ROLE_LABEL, sortMembers, type InviteRole, type TeamInvite, type TeamMember, type TeamPayload } from "@/lib/team";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export default function TeamPage() {
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource("team", (signal) => api<TeamPayload>("/admin/team", { signal }));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const markBusy = (id: string, on: boolean) => setBusy((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  async function changeRole(m: TeamMember, role: InviteRole) {
    markBusy(m.userId, true);
    try {
      await api(`/admin/team/${m.userId}`, { method: "PATCH", body: { role } });
      res.reload();
      show({ message: "Role updated", tone: "good" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      markBusy(m.userId, false);
    }
  }

  async function removeAccess(m: TeamMember) {
    const okToRemove = await ask({ title: `Remove access for ${m.name}?`, body: `${m.email} will no longer be able to sign in to the admin console.`, confirmLabel: "Remove access", tone: "danger" });
    if (!okToRemove) return;
    markBusy(m.userId, true);
    try {
      await api(`/admin/team/${m.userId}`, { method: "PATCH", body: { role: null } });
      res.reload();
      show({ message: `Removed ${m.name}`, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      markBusy(m.userId, false);
    }
  }

  async function revoke(invite: TeamInvite) {
    const okToRevoke = await ask({ title: `Revoke the invite to ${invite.email}?`, confirmLabel: "Revoke", tone: "danger" });
    if (!okToRevoke) return;
    markBusy(invite.id, true);
    try {
      await api(`/admin/team/invites/${invite.id}`, { method: "DELETE" });
      res.reload();
      show({ message: `Revoked the invite to ${invite.email}`, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      markBusy(invite.id, false);
    }
  }

  const memberColumns: Column<TeamMember>[] = [
    { key: "name", label: "Name", render: (m) => (
      <div>
        <div className="font-semibold text-oh-charcoal">{m.name}</div>
        <div className="text-sm text-oh-stone/70">{m.email}</div>
      </div>
    ) },
    { key: "role", label: "Role", render: (m) => (m.locked ? (
      <Badge tone="info">Owner (allowlist)</Badge>
    ) : (
      <Select aria-label={`Role for ${m.name}`} value={m.role} disabled={busy.has(m.userId)}
        onChange={(e) => changeRole(m, e.target.value as InviteRole)} className="max-w-40">
        {INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </Select>
    )) },
    { key: "actions", label: "", align: "right", render: (m) => (m.locked ? null : (
      <Button size="sm" variant="danger" disabled={busy.has(m.userId)} onClick={() => removeAccess(m)}>Remove access</Button>
    )) },
  ];

  const inviteColumns: Column<TeamInvite>[] = [
    { key: "email", label: "Email", render: (i) => i.email },
    { key: "role", label: "Role", render: (i) => <Badge tone="pending">{ROLE_LABEL[i.role]}</Badge> },
    { key: "sent", label: "Sent", render: (i) => shortDate(i.createdAt) },
    { key: "actions", label: "", align: "right", render: (i) => (
      <Button size="sm" variant="danger" disabled={busy.has(i.id)} onClick={() => revoke(i)}>Revoke</Button>
    ) },
  ];

  const members = res.data ? sortMembers(res.data.members) : null;
  const invites = res.data?.invites ?? [];

  return (
    <>
      <PageHeader title="Team" subtitle="Owners, managers and station accounts."
        actions={<Button variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>Invite</Button>} />
      <div className="space-y-6">
        {res.error && !res.data ? (
          <ErrorCard message="Couldn't load the team." onRetry={res.reload} />
        ) : !members ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">Members</h2>
              <DataList rows={members} rowKey={(m) => m.userId} columns={memberColumns}
                empty={<EmptyState icon="users" title="No members yet" />}
                renderCard={(m) => (
                  <div className="space-y-2.5 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-oh-charcoal">{m.name}</div>
                        <div className="truncate text-sm text-oh-stone/70">{m.email}</div>
                      </div>
                      {m.locked && <Badge tone="info">Owner (allowlist)</Badge>}
                    </div>
                    {!m.locked && (
                      <div className="flex items-center gap-2">
                        <Select aria-label={`Role for ${m.name}`} value={m.role} disabled={busy.has(m.userId)}
                          onChange={(e) => changeRole(m, e.target.value as InviteRole)} className="flex-1">
                          {INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </Select>
                        <Button size="sm" variant="danger" disabled={busy.has(m.userId)} onClick={() => removeAccess(m)}>Remove</Button>
                      </div>
                    )}
                  </div>
                )} />
            </section>

            {invites.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-oh-stone/70">Pending invites</h2>
                <DataList rows={invites} rowKey={(i) => i.id} columns={inviteColumns}
                  empty={<EmptyState icon="mail" title="No pending invites" />}
                  renderCard={(i) => (
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-oh-charcoal">{i.email}</div>
                        <div className="text-sm text-oh-stone/70">{ROLE_LABEL[i.role]} &middot; Sent {shortDate(i.createdAt)}</div>
                      </div>
                      <Button size="sm" variant="danger" disabled={busy.has(i.id)} onClick={() => revoke(i)}>Revoke</Button>
                    </div>
                  )} />
              </section>
            )}

            <p className="text-sm text-oh-stone/60">Role changes take effect within 5 minutes.</p>
          </>
        )}
      </div>
      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={() => res.reload()} />
    </>
  );
}

function InviteSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { show } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("manager");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("manager");
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }
    setSaving(true);
    try {
      const result = await api<{ kind: "invited" | "updated" }>("/admin/team/invite", { method: "POST", body: { email: email.trim(), role } });
      onDone();
      onClose();
      show({ message: result.kind === "invited" ? "Invite sent" : "Role updated", tone: "good" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Invite"
      footer={<Button variant="primary" className="w-full" loading={saving} onClick={submit}>Send invite</Button>}>
      <div className="space-y-5">
        <Field label="Email" error={error ?? undefined}>
          <TextInput type="email" inputMode="email" autoComplete="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="name@example.com" />
        </Field>
        <fieldset className="space-y-3">
          <legend className="mb-1.5 block text-sm font-semibold text-oh-charcoal">Role</legend>
          {INVITE_ROLES.map((r) => (
            <label key={r} className="flex cursor-pointer items-start gap-3 rounded-xl border border-oh-stone/20 p-3">
              <input type="radio" name="role" className="mt-1 h-4 w-4 accent-oh-ember-deep" checked={role === r} onChange={() => setRole(r)} />
              <span>
                <span className="block text-[15px] font-semibold text-oh-charcoal">{ROLE_LABEL[r]}</span>
                <span className="block text-sm text-oh-stone/70">{ROLE_EXPLANATION[r]}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </Sheet>
  );
}
