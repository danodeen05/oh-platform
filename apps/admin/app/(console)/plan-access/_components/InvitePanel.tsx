"use client";

/**
 * Who a plan code is for, and Chappy's invitation email with their link.
 * The recipient is optional; sending needs first name, last name and email
 * (the API refuses otherwise). Re-sending is allowed.
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import {
  EMPTY_RECIPIENT, inviteMissing, inviteSummary, joinFields, sameRecipient, validateRecipientEmail,
  type CodeDetail, type Recipient,
} from "@/lib/plan-access";
import { RecipientFields } from "./RecipientFields";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

type InviteResponse = { ok: true; mode: "live" | "log"; code: Pick<CodeDetail, "recipient" | "invite"> };

/** Sends the invitation and toasts the outcome. Shared with the issue flow. */
export async function sendInvite(codeId: string, show: ReturnType<typeof useToast>["show"]): Promise<boolean> {
  try {
    const r = await api<InviteResponse>(`/admin/plan/codes/${codeId}/invite`, { method: "POST", body: {} });
    show(r.mode === "log"
      ? { message: "Logged, not emailed: this server has SUPPORT_NOTIFY=log.", tone: "info" }
      : { message: `Invitation sent to ${r.code.invite.sentTo ?? "the recipient"}.`, tone: "good" });
    return true;
  } catch (e) {
    show({ message: `Couldn't send the invitation. ${errorText(e)}`, tone: "alert" });
    return false;
  }
}

export function InvitePanel({ code, onChanged }: { code: CodeDetail; onChanged: () => void }) {
  const { show } = useToast();
  const ask = useConfirm();
  const saved = code.recipient ?? EMPTY_RECIPIENT;
  const [form, setForm] = useState<Recipient>(saved);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "send" | null>(null);

  // Pick up the saved values after a reload, unless they're mid-edit.
  const savedKey = `${saved.firstName}|${saved.lastName}|${saved.email}`;
  useEffect(() => { setForm(saved); }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !sameRecipient(form, saved);
  const missing = inviteMissing(form);
  const active = code.status === "ACTIVE";
  const sent = Boolean(code.invite.sentAt);

  function change(next: Recipient) {
    setForm(next);
    setProblem(null);
    if (emailError) setEmailError(validateRecipientEmail(next.email));
  }

  async function save(): Promise<boolean> {
    const err = validateRecipientEmail(form.email);
    setEmailError(err);
    if (err) return false;
    try {
      await api(`/admin/plan/codes/${code.id}/recipient`, { method: "PATCH", body: form });
      return true;
    } catch (e) {
      show({ message: `Couldn't save the recipient. ${errorText(e)}`, tone: "alert" });
      return false;
    }
  }

  async function onSave() {
    setBusy("save");
    const ok = await save();
    setBusy(null);
    if (ok) {
      show({ message: "Recipient saved.", tone: "good" });
      onChanged();
    }
  }

  async function onSend() {
    if (missing.length) {
      setProblem(`Add their ${joinFields(missing)} to send the link by email.`);
      return;
    }
    const err = validateRecipientEmail(form.email);
    setEmailError(err);
    if (err) return;
    const name = `${form.firstName.trim()} ${form.lastName.trim()}`;
    const ok = await ask({
      title: sent ? `Send the link to ${name} again?` : `Email the plan link to ${name}?`,
      body: `Chappy's invitation goes to ${form.email.trim().toLowerCase()} from service@ohbeefnoodlesoup.com.${code.ndaRequired ? " It mentions the quick NDA they sign first." : ""}`,
      confirmLabel: sent ? "Send again" : "Send",
      tone: "primary",
    });
    if (!ok) return;
    setBusy("send");
    if (dirty && !(await save())) {
      setBusy(null);
      return;
    }
    await sendInvite(code.id, show);
    setBusy(null);
    onChanged();
  }

  return (
    <Card
      title={<span className="flex flex-wrap items-center gap-2">Invitation <Badge tone={sent ? "good" : "neutral"}>{sent ? "Emailed" : "Not emailed"}</Badge></span>}>
      <p className="mb-4 text-sm text-oh-stone/70">
        Who this code is for. Optional, but first name, last name and email are needed to email the link. Their name and email also prefill the NDA, and Chappy greets them by first name.
      </p>
      <RecipientFields value={form} onChange={change} emailError={emailError} disabled={busy !== null} />

      <div className="mt-4 space-y-1.5 text-sm">
        <p className="text-oh-stone">{inviteSummary(code.invite)}</p>
        <p className="break-all text-oh-stone/60">The email links to <span className="font-mono text-oh-charcoal">{code.invite.url}</span></p>
        {!active && <p className="font-medium text-oh-clay">This code is {code.status.toLowerCase()}, so its link no longer works.</p>}
        {problem && <p role="alert" className="font-medium text-oh-ember-deep">{problem}</p>}
        {!problem && active && missing.length > 0 && (
          <p className="text-oh-clay">Needed to send: {joinFields(missing)}.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" icon="mail" onClick={onSend} loading={busy === "send"} disabled={busy !== null || !active}>
          {sent ? "Send again" : "Send link by email"}
        </Button>
        {dirty && <Button onClick={onSave} loading={busy === "save"} disabled={busy !== null}>Save recipient</Button>}
      </div>
    </Card>
  );
}
