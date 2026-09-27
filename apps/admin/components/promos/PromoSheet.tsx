"use client";
import { useEffect, useRef, useState } from "react";
import type { Location } from "@/components/providers/LocationProvider";
import { Button } from "@/components/ui/Button";
import { dollarsToCents, Field, MoneyInput, NumberInput, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import {
  DISCOUNT_TYPES, SCOPES, TARGET_CATEGORIES, emptyPromoForm, formFromPromo, promoBody, validatePromo,
  type PromoCode, type PromoForm,
} from "@/lib/promo";

type Product = { id: string; name: string; slug: string };

type Props = {
  open: boolean; promo: PromoCode | null; locations: Location[];
  onClose: () => void; onSaved: (promo: PromoCode, created: boolean) => void;
};

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

const SECTIONS = [
  { id: "basics", label: "Basics" },
  { id: "limits", label: "Limits" },
  { id: "targeting", label: "Targeting" },
] as const;

const chipCls = (on: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors ${on
    ? "border-oh-charcoal bg-oh-charcoal text-oh-cream"
    : "border-oh-stone/20 bg-oh-cream text-oh-stone hover:border-oh-stone/40"}`;

const valueLabel = (t: string) => (t === "PERCENTAGE" ? "Percent off" : t === "FIXED_PER_BOWL" ? "Amount off per bowl" : "Amount off");

export function PromoSheet({ open, promo, locations, onClose, onSaved }: Props) {
  const { show } = useToast();
  const [form, setForm] = useState<PromoForm>(() => formFromPromo(promo));
  const [errors, setErrors] = useState<Partial<Record<keyof PromoForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctl = new AbortController();
    api<Product[]>("/admin/shop/products", { signal: ctl.signal }).then((p) => setProducts(Array.isArray(p) ? p : [])).catch(() => {});
    return () => ctl.abort();
  }, []);

  const set = <K extends keyof PromoForm>(k: K, v: PromoForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function setScope(scope: string) {
    // Per-bowl discounts only make sense for catering; leaving that scope resets the type.
    const discountType = scope !== "CATERING" && form.discountType === "FIXED_PER_BOWL" ? "PERCENTAGE" : form.discountType;
    setForm((f) => ({ ...f, scope, discountType }));
  }

  function toggle(field: "targetCategories" | "targetProductIds" | "excludedProductIds" | "locationIds", value: string) {
    setForm((f) => ({ ...f, [field]: f[field].includes(value) ? f[field].filter((v) => v !== value) : [...f[field], value] }));
  }

  function jumpTo(id: string) {
    bodyRef.current?.querySelector(`#promo-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save() {
    const errs = validatePromo(form);
    setErrors(errs);
    if (Object.keys(errs).some((k) => errs[k as keyof PromoForm])) return;
    setSaving(true);
    try {
      const body = promoBody(form);
      const saved = promo
        ? await api<PromoCode>(`/admin/promo-codes/${promo.id}`, { method: "PATCH", body })
        : await api<PromoCode>("/promo-codes", { method: "POST", body });
      onSaved(saved, !promo);
    } catch (e) {
      show({ message: `Couldn't save. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  const types = DISCOUNT_TYPES.filter((t) => t.value !== "FIXED_PER_BOWL" || form.scope === "CATERING");

  return (
    <Sheet open={open} onClose={onClose} title={promo ? "Edit promo" : "New promo"}
      footer={<Button variant="primary" className="w-full" onClick={save} loading={saving}>{promo ? "Save changes" : "Create promo"}</Button>}>
      <div className="-mx-4 -mt-5 mb-4 flex gap-2 overflow-x-auto border-b border-oh-stone/15 bg-oh-paper px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => <button key={s.id} type="button" className={chipCls(false)} onClick={() => jumpTo(s.id)}>{s.label}</button>)}
      </div>
      <div ref={bodyRef} className="space-y-8">
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          <section id="promo-basics" className="scroll-mt-2 space-y-5">
            <h3 className="font-display text-[1.25rem] leading-tight text-oh-charcoal">Basics</h3>
            <Field label="Code" error={errors.code}>
              <TextInput value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} disabled={Boolean(promo)}
                aria-invalid={Boolean(errors.code)} placeholder="FALL15" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
            </Field>
            <Field label="Scope">
              <Select value={form.scope} onChange={(e) => setScope(e.target.value)}>
                {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" error={errors.discountType}>
                <Select value={form.discountType} onChange={(e) => set("discountType", e.target.value)} aria-invalid={Boolean(errors.discountType)}>
                  {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label={valueLabel(form.discountType)} error={errors.discountValue}>
                {form.discountType === "FREE_SHIPPING" ? (
                  <p className="flex min-h-11 items-center text-sm text-oh-stone/60">No value needed</p>
                ) : form.discountType === "PERCENTAGE" ? (
                  <NumberInput value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} aria-invalid={Boolean(errors.discountValue)} placeholder="15" />
                ) : (
                  <MoneyInput cents={dollarsToCents(form.discountValue)} onCents={() => {}} onInput={(e) => set("discountValue", e.currentTarget.value)}
                    aria-invalid={Boolean(errors.discountValue)} placeholder="0.00" />
                )}
              </Field>
            </div>
            <Field label="Description" hint="Internal, not shown to guests">
              <TextInput value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Fall promo for email list" />
            </Field>
          </section>

          <section id="promo-limits" className="scroll-mt-2 space-y-5 border-t border-oh-stone/15 pt-6">
            <h3 className="font-display text-[1.25rem] leading-tight text-oh-charcoal">Limits</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total uses" hint="Unlimited if empty" error={errors.totalUsageLimit}>
                <NumberInput value={form.totalUsageLimit} onChange={(e) => set("totalUsageLimit", e.target.value)} aria-invalid={Boolean(errors.totalUsageLimit)} />
              </Field>
              <Field label="Per user" error={errors.perUserLimit}>
                <NumberInput value={form.perUserLimit} onChange={(e) => set("perUserLimit", e.target.value)} aria-invalid={Boolean(errors.perUserLimit)} />
              </Field>
              <Field label="Minimum order" hint="Optional">
                <MoneyInput cents={dollarsToCents(form.minimumOrderCents)} onCents={() => {}} onInput={(e) => set("minimumOrderCents", e.currentTarget.value)} placeholder="0.00" />
              </Field>
              <Field label="Max discount" hint="Cap for percentage off">
                <MoneyInput cents={dollarsToCents(form.maxDiscountCents)} onCents={() => {}} onInput={(e) => set("maxDiscountCents", e.currentTarget.value)} placeholder="0.00" />
              </Field>
            </div>
            <Field label="Expires" hint="Never if empty">
              <input type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)}
                className="block min-h-11 w-full rounded-xl border border-oh-stone/25 bg-oh-paper px-3 text-[16px] text-oh-charcoal focus:border-oh-gold focus:outline-none focus:ring-3 focus:ring-oh-gold/30" />
            </Field>
          </section>

          <section id="promo-targeting" className="scroll-mt-2 space-y-5 border-t border-oh-stone/15 pt-6">
            <h3 className="font-display text-[1.25rem] leading-tight text-oh-charcoal">Targeting</h3>
            <div>
              <p className="mb-2 text-sm font-semibold text-oh-charcoal">Categories</p>
              <p className="mb-2 text-sm text-oh-stone/70">Leave empty to apply to every category.</p>
              <div className="flex flex-wrap gap-2">
                {TARGET_CATEGORIES.map((c) => (
                  <button key={c} type="button" aria-pressed={form.targetCategories.includes(c)} className={chipCls(form.targetCategories.includes(c))} onClick={() => toggle("targetCategories", c)}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-oh-charcoal">Include products only</p>
              <p className="mb-2 text-sm text-oh-stone/70">Leave empty to apply to every product.</p>
              <ProductChecklist products={products} selected={form.targetProductIds} onToggle={(id) => toggle("targetProductIds", id)} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-oh-charcoal">Exclude products</p>
              <ProductChecklist products={products} selected={form.excludedProductIds} onToggle={(id) => toggle("excludedProductIds", id)} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-oh-charcoal">Locations</p>
              <p className="mb-2 text-sm text-oh-stone/70">Leave empty to apply everywhere.</p>
              <div className="flex flex-wrap gap-2">
                {locations.length === 0
                  ? <p className="text-sm text-oh-stone/60">No locations available.</p>
                  : locations.map((l) => (
                    <button key={l.id} type="button" aria-pressed={form.locationIds.includes(l.id)} className={chipCls(form.locationIds.includes(l.id))} onClick={() => toggle("locationIds", l.id)}>{l.name}</button>
                  ))}
              </div>
            </div>
          </section>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </div>
    </Sheet>
  );
}

function ProductChecklist({ products, selected, onToggle }: { products: Product[]; selected: string[]; onToggle: (id: string) => void }) {
  if (products.length === 0) return <p className="text-sm text-oh-stone/60">No products available.</p>;
  return (
    <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-oh-stone/20 p-1.5">
      {products.map((p) => (
        <label key={p.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[15px] text-oh-charcoal hover:bg-oh-linen">
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} className="h-4 w-4 accent-oh-ember-deep" />
          {p.name}
        </label>
      ))}
    </div>
  );
}
