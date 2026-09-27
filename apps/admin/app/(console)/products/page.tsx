"use client";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Field, MoneyInput, NumberInput, Select, TextArea, TextInput, Toggle, dollarsToCents } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { runOptimistic } from "@/lib/optimistic";
import {
  CATEGORIES, emptyProductForm, filterProducts, formFromProduct, productBody, stockLabel, validateProduct,
  type ProductFilter, type ProductForm, type ShopProduct,
} from "@/lib/products";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");
const categoryLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, " ");

function ProductSheet({ product, onClose, onSaved, onDeleted }: {
  product: ShopProduct | null; onClose: () => void; onSaved: (p: ShopProduct, created: boolean) => void; onDeleted: (id: string, softDeleted: boolean) => void;
}) {
  const ask = useConfirm();
  const { show } = useToast();
  const [form, setForm] = useState<ProductForm>(() => formFromProduct(product));
  const [errors, setErrors] = useState<Partial<Record<keyof ProductForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function save() {
    const errs = validateProduct(form);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    try {
      const body = productBody(form);
      const saved = product
        ? await api<ShopProduct>(`/admin/shop/products/${product.id}`, { method: "PATCH", body })
        : await api<ShopProduct>("/admin/shop/products", { method: "POST", body: { ...body, isAvailable: true } });
      onSaved(saved, !product);
    } catch (e) {
      show({ message: `Couldn't save. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!product) return;
    const ok = await ask({ title: `Delete ${product.name}?`, body: "Orders that used it keep their history.", confirmLabel: "Delete", tone: "danger" });
    if (!ok) return;
    setDeleting(true);
    try {
      // Products with order history are soft-deleted (marked unavailable) instead of
      // removed outright, so the row needs to stay - just flipped - not disappear.
      const data = await api<{ message: string }>(`/admin/shop/products/${product.id}`, { method: "DELETE" });
      onDeleted(product.id, data.message.toLowerCase().includes("unavailable"));
      show({ message: data.message, tone: "info" });
    } catch (e) {
      show({ message: errorText(e), tone: "alert" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={product ? "Edit product" : "New product"}
      footer={
        <div className="flex gap-2">
          {product && <Button variant="danger" icon="trash" onClick={remove} loading={deleting} disabled={saving}>Delete</Button>}
          <Button variant="primary" className="flex-1" onClick={save} loading={saving} disabled={deleting}>{product ? "Save changes" : "Add product"}</Button>
        </div>
      }>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Slug" error={errors.slug}>
            <TextInput value={form.slug} onChange={(e) => set("slug", e.target.value)} disabled={Boolean(product)}
              aria-invalid={Boolean(errors.slug)} placeholder="home-kit" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </Field>
          <Field label="SKU" hint="Optional">
            <TextInput value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="HOME-KIT-001" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
          </Field>
        </div>
        <Field label="Name" error={errors.name}>
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(errors.name)} placeholder="Oh! Home Kit" autoCapitalize="words" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Name (Traditional)" hint="Optional"><TextInput value={form.nameZhTW} onChange={(e) => set("nameZhTW", e.target.value)} /></Field>
          <Field label="Name (Simplified)" hint="Optional"><TextInput value={form.nameZhCN} onChange={(e) => set("nameZhCN", e.target.value)} /></Field>
          <Field label="Name (Spanish)" hint="Optional"><TextInput value={form.nameEs} onChange={(e) => set("nameEs", e.target.value)} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price" error={errors.price}>
            <MoneyInput cents={dollarsToCents(form.price)} onCents={() => {}} onInput={(e) => set("price", e.currentTarget.value)} aria-invalid={Boolean(errors.price)} placeholder="0.00" />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Image URL" hint="Optional">
          <TextInput value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." autoCapitalize="none" autoCorrect="off" />
        </Field>
        {form.imageUrl.trim() && (
          <img src={form.imageUrl} alt="" className="h-24 w-24 rounded-xl border border-oh-stone/15 object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock" hint="Empty means unlimited" error={errors.stockCount}>
            <NumberInput value={form.stockCount} onChange={(e) => set("stockCount", e.target.value)} aria-invalid={Boolean(errors.stockCount)} placeholder="Unlimited" />
          </Field>
          <Field label="Low-stock threshold" hint="Optional" error={errors.lowStockThreshold}>
            <NumberInput value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} aria-invalid={Boolean(errors.lowStockThreshold)} />
          </Field>
        </div>

        <Field label="Description" hint="Optional">
          <TextArea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}

function ProductRow({ product, busy, onToggle, onOpen }: { product: ShopProduct; busy: boolean; onToggle: (p: ShopProduct, next: boolean) => void; onOpen: (p: ShopProduct) => void }) {
  const off = !product.isAvailable;
  return (
    <div className="flex items-center gap-3 pr-3">
      <button type="button" onClick={() => onOpen(product)} aria-label={`Edit ${product.name}`}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left transition-colors hover:bg-oh-linen/60 active:bg-oh-linen focus-visible:-outline-offset-2!">
        {product.imageUrl
          ? <img src={product.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
          : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-oh-linen text-oh-stone/50"><Icon name="bag" size={18} /></span>}
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] font-semibold ${off ? "text-oh-stone/60" : "text-oh-charcoal"}`}>{product.name}</span>
          <span className="mt-0.5 block truncate text-sm text-oh-stone/60">{product.slug}{product.sku ? ` · ${product.sku}` : ""}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-oh-stone/70">
            <Badge tone="neutral">{categoryLabel(product.category)}</Badge>
            <span className="font-semibold tabular-nums text-oh-stone">{money(product.priceCents)}</span>
            <span className="tabular-nums">Stock: {stockLabel(product.stockCount)}</span>
            {off && <Badge tone="alert">Unavailable</Badge>}
          </span>
        </span>
      </button>
      <Toggle checked={product.isAvailable} disabled={busy} hideLabel label={`Available: ${product.name}`} onChange={(next) => onToggle(product, next)} />
    </div>
  );
}

export default function ProductsPage() {
  const { show } = useToast();
  const res = useResource("shop-products", (signal) => api<ShopProduct[]>("/admin/shop/products", { signal }));
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  if (res.data && products === null) setProducts(res.data);

  const [filter, setFilter] = useState<ProductFilter>("ALL");
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [sheet, setSheet] = useState<{ product: ShopProduct | null } | null>(null);

  const shown = useMemo(() => (products ? filterProducts(products, filter) : []), [products, filter]);

  const markBusy = (id: string, on: boolean) => setBusy((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const setAvailable = (id: string, v: boolean) => setProducts((list) => list && list.map((p) => (p.id === id ? { ...p, isAvailable: v } : p)));

  const flip = useCallback(async function flip(product: ShopProduct, next: boolean, isUndo = false) {
    markBusy(product.id, true);
    const ok = await runOptimistic({
      apply: () => setAvailable(product.id, next),
      revert: () => setAvailable(product.id, !next),
      commit: () => api(`/admin/shop/products/${product.id}`, { method: "PATCH", body: { isAvailable: next } }),
    });
    markBusy(product.id, false);
    if (!ok) { show({ message: `Couldn't update ${product.name}. Try again.`, tone: "alert" }); return; }
    show({
      message: next ? `${product.name} is available` : `${product.name} is unavailable`,
      tone: next ? "good" : "info",
      action: isUndo ? undefined : { label: "Undo", onClick: () => { flip(product, !next, true); } },
      durationMs: isUndo ? undefined : 5000,
    });
  }, [show]);

  return (
    <>
      <PageHeader title="Shop products" actions={<Button variant="primary" icon="plus" onClick={() => setSheet({ product: null })} disabled={!products}>New product</Button>} />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips<ProductFilter> label="Category" value={filter} onChange={setFilter}
            options={[{ value: "ALL", label: "All", count: products?.length }, ...CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c), count: products?.filter((p) => p.category === c).length }))]} />
          {products && <span className="shrink-0 text-sm tabular-nums text-oh-stone/60">{shown.length} {shown.length === 1 ? "product" : "products"}</span>}
        </div>

        {res.error && !products ? (
          <ErrorCard message="Couldn't load products." onRetry={res.reload} />
        ) : !products ? (
          <SkeletonList rows={6} />
        ) : products.length === 0 ? (
          <EmptyState icon="bag" title="No products yet" body="Add the first item to start selling." action={<Button variant="primary" icon="plus" onClick={() => setSheet({ product: null })}>New product</Button>} />
        ) : shown.length === 0 ? (
          <EmptyState icon="search" title="No products in this category" body="Try a different category." />
        ) : (
          <Card padded={false}>
            {shown.map((p) => <ProductRow key={p.id} product={p} busy={busy.has(p.id)} onToggle={flip} onOpen={(product) => setSheet({ product })} />)}
          </Card>
        )}
      </div>

      {sheet && (
        <ProductSheet key={sheet.product?.id ?? "new"} product={sheet.product}
          onClose={() => setSheet(null)}
          onSaved={(saved, created) => {
            setProducts((list) => list && (created ? [saved, ...list] : list.map((p) => (p.id === saved.id ? saved : p))));
            setSheet(null);
            show({ message: created ? `${saved.name} added` : `${saved.name} saved`, tone: "good" });
          }}
          onDeleted={(id, softDeleted) => {
            setProducts((list) => list && (softDeleted
              ? list.map((p) => (p.id === id ? { ...p, isAvailable: false } : p))
              : list.filter((p) => p.id !== id)));
            setSheet(null);
          }} />
      )}
    </>
  );
}
