"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { kioskSetupUrl, type KioskDevice } from "@/lib/kiosk";

type LocationOption = { id: string; name: string };
type Props = { open: boolean; locations: LocationOption[]; onClose: () => void; onRegistered: () => void };

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export function RegisterDeviceSheet({ open, locations, onClose, onRegistered }: Props) {
  const { show } = useToast();
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [errors, setErrors] = useState<{ deviceId?: string; name?: string; locationId?: string }>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<{ apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function register() {
    const errs: typeof errors = {};
    if (!deviceId.trim()) errs.deviceId = "Enter a device ID.";
    if (!name.trim()) errs.name = "Enter a display name.";
    if (!locationId) errs.locationId = "Choose a location.";
    setErrors(errs);
    if (errs.deviceId || errs.name || errs.locationId) return;
    setSaving(true);
    setServerError(null);
    try {
      const data = await api<KioskDevice & { apiKey: string }>("/kiosk-devices", { method: "POST", body: { deviceId: deviceId.trim(), name: name.trim(), locationId } });
      setResult({ apiKey: data.apiKey });
      onRegistered();
    } catch (e) {
      setServerError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  function copy() {
    const url = kioskSetupUrl(result!.apiKey);
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); show({ message: "Setup URL copied", tone: "good" }); }).catch(() => show({ message: "Couldn't copy. Select and copy the URL instead.", tone: "alert" }));
  }

  return (
    <Sheet open={open} onClose={onClose} title="Register device"
      footer={result
        ? <Button variant="primary" className="w-full" onClick={onClose}>Done</Button>
        : <Button variant="primary" className="w-full" onClick={register} loading={saving}>Register device</Button>}>
      {result ? (
        <div className="space-y-4">
          <p className="text-[15px] text-oh-stone">Device registered. Open this setup URL on the kiosk to finish.</p>
          <code className="block break-all rounded-xl border border-oh-stone/20 bg-oh-linen/60 p-3 font-mono text-sm text-oh-charcoal">{kioskSetupUrl(result.apiKey)}</code>
          <Button variant="secondary" icon="copy" onClick={copy}>{copied ? "Copied" : "Copy setup URL"}</Button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); register(); }} noValidate>
          <Field label="Device ID" error={errors.deviceId}>
            <TextInput value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="elo-location-01" aria-invalid={Boolean(errors.deviceId)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </Field>
          <Field label="Display name" error={errors.name}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Front counter kiosk" aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Location" error={errors.locationId}>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-invalid={Boolean(errors.locationId)}>
              <option value="">Select location...</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          {serverError && <p role="alert" className="text-sm font-medium text-oh-ember-deep">{serverError}</p>}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      )}
    </Sheet>
  );
}
