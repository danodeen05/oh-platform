"use client";
import { useCallback, useState } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Confirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Field, MoneyInput, TextInput, Toggle, dollarsToCents } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { runOptimistic } from "@/lib/optimistic";
import { slugifyDesignId, validateCustomRange, validateDenomination, type CustomRange, type Denomination, type Design } from "@/lib/gift-cards";
import { useResource } from "@/lib/use-resource";

const BACK = { href: "/gift-cards", label: "Gift cards" };
const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

type Config = { denominations: Denomination[]; customRange?: CustomRange; designs: Design[] };

function AddDesignSheet({ order, onClose, onSaved }: { order: number; onClose: () => void; onSaved: (d: Design) => void }) {
  const { show } = useToast();
  const [designId, setDesignId] = useState("");
  const [designName, setDesignName] = useState("");
  const [gradient, setGradient] = useState("");
  const [errors, setErrors] = useState<{ designId?: string; designName?: string; gradient?: string }>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const errs = {
      designId: designId.trim() ? undefined : "Give the design an id.",
      designName: designName.trim() ? undefined : "Give the design a name.",
      gradient: gradient.trim() ? undefined : "Enter a CSS gradient.",
    };
    setErrors(errs);
    if (errs.designId || errs.designName || errs.gradient) return;
    setSaving(true);
    try {
      const saved = await api<Design>("/admin/gift-card-config/designs", { method: "POST", body: { designId: slugifyDesignId(designId), designName: designName.trim(), gradient: gradient.trim(), displayOrder: order } });
      onSaved(saved);
    } catch (e) {
      show({ message: `Couldn't add the design. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Add design" size="auto" footer={<Button variant="primary" className="w-full" onClick={save} loading={saving}>Add design</Button>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <Field label="Id" hint="Lowercase, spaces become dashes" error={errors.designId}>
          <TextInput value={designId} onChange={(e) => setDesignId(e.target.value)} placeholder="festive-winter" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={Boolean(errors.designId)} />
        </Field>
        <Field label="Name" error={errors.designName}>
          <TextInput value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder="Festive Winter" aria-invalid={Boolean(errors.designName)} />
        </Field>
        <Field label="CSS gradient" error={errors.gradient}>
          <TextInput value={gradient} onChange={(e) => setGradient(e.target.value)} placeholder="linear-gradient(135deg, #C7A878 0%, #8B7355 100%)" autoCapitalize="none" autoCorrect="off" aria-invalid={Boolean(errors.gradient)} />
        </Field>
        {gradient.trim() && <div className="h-20 rounded-xl" style={{ background: gradient }} />} {/* style-ok: live gradient preview */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}

export default function GiftCardConfigPage() {
  const { show } = useToast();
  const ask = useConfirm();
  const res = useResource("gift-card-config", (signal) => api<Config>("/admin/gift-card-config", { signal }));
  const [config, setConfig] = useState<Config | null>(null);
  if (res.data && config === null) setConfig(res.data);

  const [newAmount, setNewAmount] = useState("");
  const [amountError, setAmountError] = useState<string | undefined>();
  const [denomInputKey, setDenomInputKey] = useState(0);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [rangeErrors, setRangeErrors] = useState<{ min?: string; max?: string }>({});
  const [rangeSeeded, setRangeSeeded] = useState(false);
  const [addingDesign, setAddingDesign] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(() => new Set());

  if (config?.customRange && !rangeSeeded) {
    setMinAmount((config.customRange.minAmountCents / 100).toFixed(2));
    setMaxAmount((config.customRange.maxAmountCents / 100).toFixed(2));
    setRangeSeeded(true);
  }

  async function addDenomination() {
    const err = validateDenomination(newAmount);
    setAmountError(err);
    if (err) return;
    try {
      const created = await api<Denomination>("/admin/gift-card-config/denominations", { method: "POST", body: { amountCents: dollarsToCents(newAmount), displayOrder: config?.denominations.length ?? 0 } });
      setConfig((c) => (c ? { ...c, denominations: [...c.denominations, created] } : c));
      setNewAmount("");
      setDenomInputKey((k) => k + 1); // remount the MoneyInput so its own text state clears too
      show({ message: `${money(created.amountCents)} added.`, tone: "good" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  async function removeDenomination(d: Denomination) {
    const ok = await ask({ title: `Remove ${money(d.amountCents)}?`, confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    try {
      await api(`/admin/gift-card-config/denominations/${d.id}`, { method: "DELETE" });
      setConfig((c) => (c ? { ...c, denominations: c.denominations.filter((x) => x.id !== d.id) } : c));
      show({ message: "Denomination removed.", tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  async function saveRange() {
    const errs = validateCustomRange(minAmount, maxAmount);
    setRangeErrors(errs);
    if (errs.min || errs.max) return;
    try {
      const saved = await api<CustomRange>("/admin/gift-card-config/custom-range", { method: "PATCH", body: { minAmountCents: dollarsToCents(minAmount), maxAmountCents: dollarsToCents(maxAmount) } });
      setConfig((c) => (c ? { ...c, customRange: saved } : c));
      show({ message: "Custom range updated.", tone: "good" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  const markBusy = (id: string, on: boolean) => setBusy((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const setDesignActive = (id: string, v: boolean) => setConfig((c) => c && { ...c, designs: c.designs.map((x) => (x.id === id ? { ...x, isActive: v } : x)) });

  const toggleDesign = useCallback(async function toggleDesign(d: Design, next: boolean, isUndo = false) {
    markBusy(d.id, true);
    const ok = await runOptimistic({
      apply: () => setDesignActive(d.id, next),
      revert: () => setDesignActive(d.id, !next),
      commit: () => api(`/admin/gift-card-config/designs/${d.id}`, { method: "PATCH", body: { isActive: next } }),
    });
    markBusy(d.id, false);
    if (!ok) { show({ message: `Couldn't update ${d.designName}. Try again.`, tone: "alert" }); return; }
    show({
      message: next ? `${d.designName} is active` : `${d.designName} is inactive`,
      tone: next ? "good" : "info",
      action: isUndo ? undefined : { label: "Undo", onClick: () => { toggleDesign(d, !next, true); } },
      durationMs: isUndo ? undefined : 5000,
    });
  }, [show]);

  async function removeDesign(d: Design) {
    const ok = await ask({ title: `Delete ${d.designName}?`, confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    try {
      await api(`/admin/gift-card-config/designs/${d.id}`, { method: "DELETE" });
      setConfig((c) => (c ? { ...c, designs: c.designs.filter((x) => x.id !== d.id) } : c));
      show({ message: `${d.designName} deleted.`, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    }
  }

  if (!config) {
    return (
      <>
        <PageHeader title="Gift card setup" back={BACK} />
        {res.error ? <ErrorCard message="Couldn't load gift card setup." onRetry={res.reload} /> : <SkeletonList rows={4} />}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Gift card setup" back={BACK} subtitle="Denominations and designs shown on the purchase page." />
      <div className="space-y-4 lg:space-y-6">
        <Card title="Preset denominations">
          <div className="flex flex-wrap gap-2">
            {config.denominations.length === 0 && <p className="text-sm text-oh-stone/60">No denominations yet.</p>}
            {config.denominations.map((d) => (
              <span key={d.id} className="inline-flex items-center gap-0.5 rounded-full bg-oh-linen pl-4">
                <span className="text-[15px] font-semibold text-oh-charcoal">{money(d.amountCents)}</span>
                <IconButton icon="close" label={`Remove ${money(d.amountCents)}`} onClick={() => removeDenomination(d)} className="text-oh-stone/70 hover:text-oh-ember-deep" />
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Field label="Add a denomination" error={amountError} className="w-40">
              <MoneyInput key={denomInputKey} cents={null} onCents={() => {}} onInput={(e) => { setNewAmount(e.currentTarget.value); setAmountError(undefined); }} placeholder="0.00" aria-invalid={Boolean(amountError)} />
            </Field>
            <Button onClick={addDenomination}>Add</Button>
          </div>

          <div className="mt-6 border-t border-oh-stone/15 pt-5">
            <p className="mb-3 text-[15px] font-semibold text-oh-charcoal">Custom amount range</p>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Minimum" error={rangeErrors.min} className="w-32">
                <MoneyInput cents={dollarsToCents(minAmount)} onCents={() => {}} onInput={(e) => { setMinAmount(e.currentTarget.value); setRangeErrors((r) => ({ ...r, min: undefined })); }} placeholder="10.00" aria-invalid={Boolean(rangeErrors.min)} />
              </Field>
              <Field label="Maximum" error={rangeErrors.max} className="w-32">
                <MoneyInput cents={dollarsToCents(maxAmount)} onCents={() => {}} onInput={(e) => { setMaxAmount(e.currentTarget.value); setRangeErrors((r) => ({ ...r, max: undefined })); }} placeholder="500.00" aria-invalid={Boolean(rangeErrors.max)} />
              </Field>
              <Button onClick={saveRange}>Update range</Button>
            </div>
          </div>
        </Card>

        <Card title="Designs" action={<Button variant="primary" icon="plus" size="sm" onClick={() => setAddingDesign(true)}>Add design</Button>}>
          {config.designs.length === 0 ? (
            <EmptyState icon="gift" title="No designs yet" body="Add the first one guests can choose from." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {config.designs.map((d) => (
                <div key={d.id} className={`overflow-hidden rounded-xl border border-oh-stone/15 ${d.isActive ? "" : "opacity-50"}`}>
                  <div className="flex h-20 items-center justify-center text-[17px] font-semibold text-oh-cream" style={{ background: d.gradient }}>Gift card</div> {/* style-ok: design gradient preview */}
                  <div className="space-y-2 p-3">
                    <p className="font-semibold text-oh-charcoal">{d.designName}</p>
                    <p className="font-mono text-xs text-oh-stone/60">{d.designId}</p>
                    <div className="flex items-center justify-between pt-1">
                      <Toggle checked={d.isActive} disabled={busy.has(d.id)} label="Active" onChange={(next) => toggleDesign(d, next)} />
                      <Button size="sm" variant="danger" onClick={() => removeDesign(d)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {addingDesign && (
        <AddDesignSheet order={config.designs.length} onClose={() => setAddingDesign(false)}
          onSaved={(d) => { setConfig((c) => (c ? { ...c, designs: [...c.designs, d] } : c)); setAddingDesign(false); show({ message: `${d.designName} added.`, tone: "good" }); }} />
      )}
    </>
  );
}
