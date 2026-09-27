"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import {
  formFromLocation, locationCreateBody, locationPatchBody, topSuggestions, validateLocationForm,
  type AddressSuggestion, type LocationForm, type LocationRow, type Tenant, type ValidateAddressResponse,
} from "@/lib/locations";

type Props = { open: boolean; location: LocationRow | null; tenants: Tenant[]; onClose: () => void; onSaved: (location: LocationRow, created: boolean) => void };

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export function LocationSheet({ open, location, tenants, onClose, onSaved }: Props) {
  const { show } = useToast();
  const [form, setForm] = useState<LocationForm>(() => formFromLocation(location, tenants));
  const [errors, setErrors] = useState<Partial<Record<keyof LocationForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidateAddressResponse | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const set = <K extends keyof LocationForm>(k: K, v: LocationForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  // Debounced address validation, matching the old create form's timing.
  useEffect(() => {
    if (!form.address.trim() || !form.city.trim()) { setValidation(null); setValidating(false); return; }
    setValidating(true);
    const t = setTimeout(async () => {
      try {
        const res = await api<ValidateAddressResponse>("/locations/validate-address", {
          method: "POST", body: { address: form.address, city: form.city, state: form.state, zipCode: form.zipCode, country: "US" },
        });
        setValidation(res);
      } catch {
        setValidation(null);
      } finally {
        setValidating(false);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.address, form.city, form.state, form.zipCode]);

  function applySuggestion(s: AddressSuggestion) {
    setForm((f) => ({ ...f, address: s.address, city: s.city, state: s.state, zipCode: s.zipCode, lat: s.lat, lng: s.lng }));
    setValidation(null);
  }

  async function findCoordinates() {
    if (!form.address.trim() || !form.city.trim()) return;
    setGeocoding(true);
    try {
      const res = await api<{ lat: number; lng: number }>("/locations/geocode", {
        method: "POST", body: { address: form.address, city: form.city, state: form.state, zipCode: form.zipCode, country: "US" },
      });
      set("lat", res.lat);
      set("lng", res.lng);
    } catch (e) {
      show({ message: `Couldn't find coordinates. ${errorText(e)}`, tone: "alert" });
    } finally {
      setGeocoding(false);
    }
  }

  async function save() {
    const errs = validateLocationForm(form);
    setErrors(errs);
    if (Object.keys(errs).some((k) => errs[k as keyof LocationForm])) return;
    setSaving(true);
    try {
      const saved = location
        ? await api<LocationRow>(`/locations/${location.id}`, { method: "PATCH", body: locationPatchBody(form) })
        : await api<LocationRow>("/locations", { method: "POST", body: locationCreateBody(form) });
      onSaved(saved, !location);
    } catch (e) {
      show({ message: `Couldn't save. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  const suggestions = topSuggestions(validation);

  return (
    <Sheet open={open} onClose={onClose} title={location ? "Edit location" : "New location"}
      footer={<Button variant="primary" className="w-full" onClick={save} loading={saving}>{location ? "Save changes" : "Create location"}</Button>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="Name" error={errors.name}>
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} placeholder="SoHo" />
        </Field>
        <Field label="Address" error={errors.address}>
          <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} aria-invalid={Boolean(errors.address)} placeholder="123 Main St" />
        </Field>
        <Field label="City" error={errors.city}>
          <TextInput value={form.city} onChange={(e) => set("city", e.target.value)} aria-invalid={Boolean(errors.city)} placeholder="Salt Lake City" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <TextInput value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="UT" />
          </Field>
          <Field label="Zip">
            <TextInput value={form.zipCode} onChange={(e) => set("zipCode", e.target.value)} placeholder="84101" />
          </Field>
        </div>

        {(validating || validation) && (
          <div className="flex items-start gap-2 rounded-xl border border-oh-stone/15 bg-oh-linen/50 p-3 text-sm">
            {validating ? (
              <span className="text-oh-stone/70">Checking address...</span>
            ) : validation?.valid ? (
              <span className="flex items-center gap-1.5 text-oh-olive"><Icon name="check" size={16} />{validation.message}</span>
            ) : (
              <span className="flex items-center gap-1.5 text-oh-clay"><Icon name="alert" size={16} />{validation?.message}</span>
            )}
          </div>
        )}
        {suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-oh-charcoal">Did you mean</p>
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <button key={i} type="button" onClick={() => applySuggestion(s)}
                  className="block min-h-11 w-full rounded-lg border border-oh-stone/20 bg-oh-paper px-3 py-2 text-left text-sm text-oh-charcoal transition-colors hover:border-oh-gold hover:bg-oh-linen">
                  {s.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Phone" hint="Optional">
          <TextInput type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(801) 555-1234" />
        </Field>
        <Field label="Brand" error={errors.tenantId}>
          <Select value={form.tenantId} onChange={(e) => set("tenantId", e.target.value)} aria-invalid={Boolean(errors.tenantId)}>
            <option value="" disabled>Select brand...</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.brandName}</option>)}
          </Select>
        </Field>

        <div className="flex items-center gap-3 border-t border-oh-stone/15 pt-5">
          <Button variant="secondary" onClick={findCoordinates} loading={geocoding} disabled={!form.address.trim() || !form.city.trim()}>Find coordinates</Button>
          {form.lat != null && form.lng != null && (
            <span className="text-sm tabular-nums text-oh-stone/70">Coordinates found: {form.lat.toFixed(6)}, {form.lng.toFixed(6)}</span>
          )}
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
