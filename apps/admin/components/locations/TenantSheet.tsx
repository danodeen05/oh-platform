"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { formFromTenant, tenantBody, validateTenantForm, type Tenant, type TenantForm } from "@/lib/locations";

type Props = { open: boolean; tenant: Tenant | null; onClose: () => void; onSaved: (tenant: Tenant, created: boolean) => void };

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export function TenantSheet({ open, tenant, onClose, onSaved }: Props) {
  const { show } = useToast();
  const [form, setForm] = useState<TenantForm>(() => formFromTenant(tenant));
  const [errors, setErrors] = useState<Partial<Record<keyof TenantForm, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TenantForm>(k: K, v: TenantForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function save() {
    const errs = validateTenantForm(form);
    setErrors(errs);
    if (Object.keys(errs).some((k) => errs[k as keyof TenantForm])) return;
    setSaving(true);
    try {
      const body = tenantBody(form);
      const saved = tenant
        ? await api<Tenant>(`/tenants/${tenant.id}`, { method: "PATCH", body })
        : await api<Tenant>("/tenants", { method: "POST", body });
      onSaved(saved, !tenant);
    } catch (e) {
      show({ message: `Couldn't save. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={tenant ? "Edit brand" : "New brand"} size="auto"
      footer={<Button variant="primary" className="w-full" onClick={save} loading={saving}>{tenant ? "Save changes" : "Create brand"}</Button>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="Brand name" error={errors.brandName}>
          <TextInput value={form.brandName} onChange={(e) => set("brandName", e.target.value)} aria-invalid={Boolean(errors.brandName)} placeholder="Oh! Beef Noodle Soup" />
        </Field>
        <Field label="Slug" hint="Used in internal tenant lookups" error={errors.slug}>
          <TextInput value={form.slug} onChange={(e) => set("slug", e.target.value)} aria-invalid={Boolean(errors.slug)} placeholder="oh" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </Field>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
