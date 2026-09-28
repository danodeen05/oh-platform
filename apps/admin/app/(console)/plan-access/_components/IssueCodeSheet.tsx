"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, NumberInput, Select, TextInput, Toggle } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import {
  AUDIENCES, EMPTY_RECIPIENT, SCENARIOS, SECTION_KEYS, inviteMissing, joinFields, scenarioForAudience, validateMaxSessions, validateRecipientEmail,
  type Audience, type CodeRow, type Recipient, type Scenario,
} from "@/lib/plan-access";
import { fetchCountersigner } from "@/lib/plan-nda";
import { sendInvite } from "./InvitePanel";
import { RecipientFields } from "./RecipientFields";

type Props = { open: boolean; onClose: () => void; onCreated: (code: CodeRow) => void };
const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export function IssueCodeSheet({ open, onClose, onCreated }: Props) {
  const { show } = useToast();
  const [label, setLabel] = useState("");
  const [audience, setAudience] = useState<Audience>("INVESTOR");
  const [scenario, setScenario] = useState<Scenario>("BASE");
  const [allSections, setAllSections] = useState(true);
  const [sections, setSections] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxSessions, setMaxSessions] = useState("");
  const [ndaRequired, setNdaRequired] = useState(true);
  const [hasCountersigner, setHasCountersigner] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [maxSessionsError, setMaxSessionsError] = useState<string | undefined>(undefined);
  const [recipient, setRecipient] = useState<Recipient>(EMPTY_RECIPIENT);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [emailNow, setEmailNow] = useState(false);
  const missing = inviteMissing(recipient);

  useEffect(() => {
    fetchCountersigner().then((c) => setHasCountersigner(Boolean(c))).catch(() => setHasCountersigner(null));
  }, []);

  function toggleSection(key: string) {
    setSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save() {
    if (!label.trim()) return;
    const maxSessionsErr = validateMaxSessions(maxSessions);
    setMaxSessionsError(maxSessionsErr);
    const emailErr = validateRecipientEmail(recipient.email);
    setEmailError(emailErr);
    if (maxSessionsErr || emailErr) return;
    const sendNow = emailNow && missing.length === 0;
    setSaving(true);
    try {
      const data = await api<{ code: CodeRow }>("/admin/plan/codes", {
        method: "POST",
        body: {
          label: label.trim(), audience, defaultScenario: scenario,
          allowedSections: allSections ? [] : sections,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          maxSessions: maxSessions.trim() ? Number(maxSessions.trim()) : null,
          ndaRequired,
          recipientFirstName: recipient.firstName.trim(),
          recipientLastName: recipient.lastName.trim(),
          recipientEmail: recipient.email.trim(),
        },
      });
      if (sendNow) await sendInvite(data.code.id, show);
      onCreated({ ...data.code, status: "ACTIVE", sessionCount: 0, questionCount: 0, totalSeconds: 0, ndaStatus: data.code.ndaRequired ? "PENDING" : "NOT_REQUIRED", ndaSignedAt: null });
    } catch (e) {
      show({ message: `Couldn't issue the code. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Issue code"
      footer={<Button variant="primary" className="w-full" onClick={save} loading={saving} disabled={saving || !label.trim()}>{emailNow && missing.length === 0 ? "Issue and email" : "Issue code"}</Button>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="Label" hint="Who gets this code">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Jim R., America First CU" autoFocus />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Audience">
            <Select value={audience} onChange={(e) => { const a = e.target.value as Audience; setAudience(a); setScenario((s) => scenarioForAudience(a, s)); }}>
              {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </Field>
          <Field label="Default scenario">
            <Select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
              {SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-oh-charcoal">Sections</p>
          <Toggle checked={allSections} onChange={setAllSections} label="All sections" />
          {!allSections && (
            <div className="mt-3 grid grid-cols-2 gap-1">
              {SECTION_KEYS.map((key) => (
                <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-[15px] text-oh-charcoal hover:bg-oh-linen">
                  <input type="checkbox" checked={sections.includes(key)} onChange={() => toggleSection(key)} className="h-4 w-4 accent-oh-ember-deep" />
                  {key}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Expires" hint="Optional">
            <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="block min-h-11 w-full rounded-xl border border-oh-stone/25 bg-oh-paper px-3 text-[16px] text-oh-charcoal focus:border-oh-gold focus:outline-none focus:ring-3 focus:ring-oh-gold/30" />
          </Field>
          <Field label="Max sessions" hint={maxSessionsError ? undefined : "Unlimited if empty"} error={maxSessionsError}>
            <NumberInput value={maxSessions}
              onChange={(e) => { setMaxSessions(e.target.value); if (maxSessionsError) setMaxSessionsError(undefined); }}
              min={1} placeholder="unlimited" aria-invalid={Boolean(maxSessionsError)} />
          </Field>
        </div>

        <div className="rounded-xl border border-oh-stone/15 bg-oh-linen/50 p-3">
          <Toggle checked={ndaRequired} onChange={setNdaRequired} label="Require NDA" />
          <p className="mt-1.5 pl-[64px] text-sm text-oh-stone/70">The recipient signs the confidential disclosure agreement, and verifies their mobile, before seeing any of the plan.</p>
          {ndaRequired && hasCountersigner === false && (
            <p className="mt-2 pl-[64px] text-sm font-medium text-oh-clay">Heads up: adopt your NDA countersignature on this page first, or the recipient will not be able to sign.</p>
          )}
        </div>

        <div className="rounded-xl border border-oh-stone/15 p-3">
          <p className="text-sm font-semibold text-oh-charcoal">Recipient <span className="font-normal text-oh-stone/70">(optional)</span></p>
          <p className="mb-3 mt-1 text-sm text-oh-stone/70">Needed to email the link. Also prefills their NDA, and Chappy greets them by first name.</p>
          <RecipientFields value={recipient} emailError={emailError}
            onChange={(r) => { setRecipient(r); if (emailError) setEmailError(validateRecipientEmail(r.email)); if (inviteMissing(r).length) setEmailNow(false); }} />
          <div className="mt-3">
            <Toggle checked={emailNow && missing.length === 0} onChange={setEmailNow} disabled={missing.length > 0} label="Email them the link now" />
            <p className="mt-1.5 pl-[64px] text-sm text-oh-stone/70">
              {missing.length > 0 ? `Add their ${joinFields(missing)} to email it.` : "Chappy sends the invitation from service@ as soon as the code is issued. You can also send it later from the code's page."}
            </p>
          </div>
        </div>

        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
