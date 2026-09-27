"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { Field, MoneyInput, NumberInput, Select, TextArea, TextInput, Toggle } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { CATEGORY_TYPES, formFromItem, parseCents, readMenuForm, SELECTION_MODES, type MenuForm, type MenuItem, type Tenant } from "@/lib/menu";

type Props = {
  open: boolean; item: MenuItem | null; tenants: Tenant[]; defaultTenantId: string;
  onClose: () => void; onSaved: (item: MenuItem, created: boolean) => void; onDeleted: (id: string) => void;
};

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

/** Create or edit one menu item. Save and Delete live in the footer. */
export function MenuItemSheet({ open, item, tenants, defaultTenantId, onClose, onSaved, onDeleted }: Props) {
  const ask = useConfirm();
  const { show } = useToast();
  const [form, setForm] = useState<MenuForm>(() => formFromItem(item, defaultTenantId));
  const [errors, setErrors] = useState<Partial<Record<keyof MenuForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = <K extends keyof MenuForm>(k: K, v: MenuForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function save() {
    const { errors: errs, body } = readMenuForm(form);
    setErrors(errs);
    if (!body) return;
    setSaving(true);
    try {
      const saved = item
        ? await api<MenuItem>(`/menu/${item.id}`, { method: "PATCH", body })
        : await api<MenuItem>("/menu", { method: "POST", body });
      onSaved(saved, !item);
    } catch (e) {
      show({ message: `Couldn't save. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    const ok = await ask({ title: `Delete ${item.name}?`, body: "Orders that used it keep their history.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    setDeleting(true);
    try {
      await api(`/menu/${item.id}`, { method: "DELETE" });
      onDeleted(item.id);
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      setDeleting(false);
    }
  }

  const modes = form.selectionMode === "INCLUDED" ? [...SELECTION_MODES, { value: "INCLUDED" as const, label: "Included" }] : SELECTION_MODES;

  return (
    <Sheet open={open} onClose={onClose} title={item ? "Edit item" : "New item"}
      footer={
        <div className="flex gap-2">
          {item && <Button variant="danger" icon="trash" onClick={remove} loading={deleting} disabled={saving}>Delete</Button>}
          <Button variant="primary" className="flex-1" onClick={save} loading={saving} disabled={deleting}>{item ? "Save changes" : "Add item"}</Button>
        </div>
      }>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="Name" error={errors.name}>
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)}
            placeholder="Classic Beef Noodle Soup" autoCapitalize="words" enterKeyHint="done" />
        </Field>
        <Field label="Description" hint="Optional">
          <TextArea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" hint="main01, slider01">
            <TextInput value={form.category} onChange={(e) => set("category", e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </Field>
          <Field label="Type">
            <Select value={form.categoryType} onChange={(e) => set("categoryType", e.target.value)}>
              <option value="">None</option>
              {CATEGORY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
            </Select>
          </Field>
          <Field label="Selection">
            <Select value={form.selectionMode} onChange={(e) => set("selectionMode", e.target.value as MenuForm["selectionMode"])}>
              {modes.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <Field label="Display order" error={errors.displayOrder}>
            <NumberInput value={form.displayOrder} onChange={(e) => set("displayOrder", e.target.value)} aria-invalid={Boolean(errors.displayOrder)} />
          </Field>
        </div>

        <fieldset className="mx-0 min-w-0 p-0">
          <legend className="mb-3 p-0 font-display text-[1.25rem] leading-tight text-oh-charcoal">Pricing</legend>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Base" error={errors.base}>
              <MoneyInput cents={parseCents(form.base)} onCents={() => {}} aria-invalid={Boolean(errors.base)}
                onInput={(e) => set("base", e.currentTarget.value)} placeholder="0.00" />
            </Field>
            <Field label="Extra" error={errors.extra}>
              <MoneyInput cents={parseCents(form.extra)} onCents={() => {}} aria-invalid={Boolean(errors.extra)}
                onInput={(e) => set("extra", e.currentTarget.value)} placeholder="0.00" />
            </Field>
            <Field label="Included" error={errors.included}>
              <NumberInput value={form.included} onChange={(e) => set("included", e.target.value)} aria-invalid={Boolean(errors.included)} />
            </Field>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-oh-stone/70">Example: Baby Bok Choy, base $0, extra $1.00, 1 included.</p>
        </fieldset>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-oh-stone/15 bg-oh-cream py-1 pl-4 pr-2">
          <span>
            <span className="block text-[15px] font-semibold text-oh-charcoal">Available</span>
            <span className="block text-sm text-oh-stone/70">{form.isAvailable ? "Guests can order it." : "Shows as sold out."}</span>
          </span>
          <Toggle checked={form.isAvailable} onChange={(v) => set("isAvailable", v)} label="Available" hideLabel />
        </div>

        <Field label="Tenant" hint="Brand" error={errors.tenantId}>
          <Select value={form.tenantId} onChange={(e) => set("tenantId", e.target.value)} aria-invalid={Boolean(errors.tenantId)}>
            <option value="" disabled>Choose a brand</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.brandName}</option>)}
          </Select>
        </Field>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
