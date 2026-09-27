"use client";
import { use, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { denverDateTime, money } from "@/lib/format";
import {
  canMarkShipped, customerEmail, fulfillmentPatchBody, customerName, fulfillmentLabel, fulfillmentTone, isShipped, paymentLabel, paymentTone,
  typeLabel, CARRIERS, FULFILLMENT_STATUSES, type FulfillmentFields, type ShopOrderDetail,
} from "@/lib/shop-orders";
import { useResource } from "@/lib/use-resource";

const BACK = { href: "/shop-orders", label: "Shop orders" };
const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-[15px] ${strong ? "font-semibold text-oh-charcoal" : muted ? "text-oh-stone/70" : "text-oh-stone"}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

type FulfillmentForm = FulfillmentFields;

function FulfillmentSheet({ order, presetShipped, onClose, onSaved }: { order: ShopOrderDetail; presetShipped: boolean; onClose: () => void; onSaved: (marked: boolean) => void }) {
  const { show } = useToast();
  const [form, setForm] = useState<FulfillmentForm>(() => ({
    fulfillmentStatus: presetShipped ? "SHIPPED" : order.fulfillmentStatus, trackingCarrier: order.trackingCarrier ?? "",
    trackingNumber: order.trackingNumber ?? "", trackingUrl: order.trackingUrl ?? "", adminNotes: order.adminNotes ?? "",
  }));
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FulfillmentForm>(k: K, v: FulfillmentForm[K]) => { setForm((f) => ({ ...f, [k]: v })); if (k === "trackingNumber") setError(undefined); };

  async function save() {
    if (form.fulfillmentStatus === "SHIPPED" && !form.trackingNumber.trim()) {
      setError("Add a tracking number before marking this shipped.");
      return;
    }
    setSaving(true);
    try {
      const wasUnshipped = !isShipped(order.fulfillmentStatus);
      // The PATCH response only includes items/user/guest, not giftCard/promoCode - the
      // parent reloads the full record instead of trusting this, so those cards don't vanish.
      await api(`/admin/shop/orders/${order.id}`, {
        method: "PATCH",
        body: fulfillmentPatchBody(order.fulfillmentStatus, form),
      });
      onSaved(wasUnshipped && form.fulfillmentStatus === "SHIPPED");
    } catch (e) {
      show({ message: `Couldn't save. ${errorText(e)}`, tone: "alert" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Fulfillment"
      footer={<Button variant="primary" className="w-full" onClick={save} loading={saving}>Save</Button>}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={form.fulfillmentStatus} onChange={(e) => set("fulfillmentStatus", e.target.value)}>
              {FULFILLMENT_STATUSES.map((s) => <option key={s} value={s}>{fulfillmentLabel(s)}</option>)}
            </Select>
          </Field>
          <Field label="Carrier">
            <Select value={form.trackingCarrier} onChange={(e) => set("trackingCarrier", e.target.value)}>
              <option value="">Choose a carrier</option>
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Tracking number" error={error}>
          <TextInput value={form.trackingNumber} onChange={(e) => set("trackingNumber", e.target.value)} aria-invalid={Boolean(error)}
            placeholder="1Z999..." autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
        </Field>
        <Field label="Tracking URL" hint="Optional">
          <TextInput type="url" value={form.trackingUrl} onChange={(e) => set("trackingUrl", e.target.value)} placeholder="https://..." autoCapitalize="none" autoCorrect="off" />
        </Field>
        <Field label="Admin notes" hint="Internal, not shown to the customer">
          <TextArea rows={3} value={form.adminNotes} onChange={(e) => set("adminNotes", e.target.value)} placeholder="Internal notes" />
        </Field>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}

export default function ShopOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { show } = useToast();
  const res = useResource(`shop-order:${id}`, (signal) => api<ShopOrderDetail>(`/admin/shop/orders/${encodeURIComponent(id)}`, { signal }));
  const order = res.data;
  const [sheetMode, setSheetMode] = useState<"edit" | "shipped" | null>(null);

  if (!order) {
    return (
      <>
        <PageHeader title="Order" back={BACK} />
        {res.error
          ? <ErrorCard message={res.error === "Order not found" ? "This order doesn't exist." : "Couldn't load this order."} onRetry={res.error === "Order not found" ? undefined : res.reload} />
          : <div className="space-y-4"><Skeleton className="h-32 rounded-card" /><SkeletonList rows={3} /></div>}
      </>
    );
  }

  const subtotal = order.items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const card = order.stripePaymentId ? "Card on file" : "No card on file";

  return (
    <>
      <PageHeader title={`Order #${order.orderNumber}`} back={BACK}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={fulfillmentTone(order.fulfillmentStatus)}>{fulfillmentLabel(order.fulfillmentStatus)}</Badge><span>{denverDateTime(order.createdAt)}</span></span>}
        actions={canMarkShipped(order) && (
          <Button variant="primary" onClick={() => setSheetMode("shipped")}>Mark as shipped</Button>
        )} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="space-y-4 lg:space-y-6">
          <Card title="Items">
            <ul className="space-y-3">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="text-[15px] text-oh-charcoal"><span className="tabular-nums text-oh-stone/70">{i.quantity} ×</span> {i.product.name}</span>
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-oh-stone">{money(i.priceCents * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t border-oh-stone/15 pt-3">
              <Line label="Subtotal" value={money(subtotal)} muted />
              {!!order.promoDiscountCents && <Line label={`Discount${order.promoCode ? ` (${order.promoCode.code})` : ""}`} value={`−${money(order.promoDiscountCents)}`} muted />}
              <Line label="Shipping" value={money(order.shippingCents)} muted />
              <Line label="Tax" value={money(order.taxCents)} muted />
              <div className="pt-1.5"><Line label="Total" value={money(order.totalCents)} strong /></div>
            </div>
          </Card>

          <Card title="Fulfillment" action={<Button variant="ghost" size="sm" icon="edit" onClick={() => setSheetMode("edit")}>Edit</Button>}>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm text-oh-stone/70">Status</span><Badge tone={fulfillmentTone(order.fulfillmentStatus)}>{fulfillmentLabel(order.fulfillmentStatus)}</Badge></div>
              <div className="flex items-center justify-between"><span className="text-sm text-oh-stone/70">Type</span><span className="text-[15px] text-oh-charcoal">{typeLabel(order.fulfillmentType)}</span></div>
              {order.trackingNumber ? (
                <div className="mt-3 rounded-xl border border-oh-stone/15 bg-oh-linen/50 p-3">
                  {order.trackingCarrier && <p className="text-[15px] font-semibold text-oh-charcoal">{order.trackingCarrier}</p>}
                  <p className="font-mono text-sm text-oh-stone">{order.trackingNumber}</p>
                  {order.trackingUrl && (
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-oh-ember-deep hover:underline">
                      Track package <Icon name="external" size={14} />
                    </a>
                  )}
                </div>
              ) : (
                <p className="pt-1 text-sm text-oh-stone/60">No tracking number yet.</p>
              )}
              {order.adminNotes && <p className="mt-2 whitespace-pre-wrap text-sm text-oh-stone/70">{order.adminNotes}</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <Card title="Customer">
            <p className="text-[17px] font-semibold text-oh-charcoal">{customerName(order)}</p>
            {customerEmail(order) && <p className="mt-0.5 text-sm text-oh-stone/70">{customerEmail(order)}</p>}
          </Card>

          <Card title={order.fulfillmentType === "SHIPPING" ? "Shipping address" : "In-store pickup"}>
            {order.fulfillmentType === "SHIPPING" ? (
              <div className="text-[15px] text-oh-stone">
                {order.shippingAddress1 && <p>{order.shippingAddress1}</p>}
                {order.shippingAddress2 && <p>{order.shippingAddress2}</p>}
                {(order.shippingCity || order.shippingState || order.shippingZip) && (
                  <p>{[order.shippingCity, order.shippingState, order.shippingZip].filter(Boolean).join(", ")}</p>
                )}
                {order.shippingCountry && <p>{order.shippingCountry}</p>}
                {!order.shippingAddress1 && <p className="text-oh-stone/60">No address on file.</p>}
              </div>
            ) : (
              <p className="text-[15px] text-oh-stone">The customer will pick this order up at the store.</p>
            )}
          </Card>

          <Card title="Payment">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={paymentTone(order.paymentStatus)}>{paymentLabel(order.paymentStatus)}</Badge>
              <span className="text-[15px] text-oh-stone">{card}</span>
            </div>
            {order.stripePaymentId && <p className="mt-2 break-all font-mono text-xs text-oh-stone/60">{order.stripePaymentId}</p>}
            {order.giftCard && (
              <a href={`/gift-cards/${order.giftCard.id}`} className="mt-2 block rounded-lg bg-oh-linen px-3 py-2 text-sm font-semibold text-oh-charcoal hover:bg-oh-linen/70">
                Gift card {order.giftCard.code}
              </a>
            )}
          </Card>
        </div>
      </div>

      {sheetMode && (
        <FulfillmentSheet key={sheetMode} order={order} presetShipped={sheetMode === "shipped"} onClose={() => setSheetMode(null)}
          onSaved={(marked) => {
            res.reload();
            setSheetMode(null);
            show({ message: marked ? "Order marked as shipped." : "Fulfillment updated.", tone: "good" });
          }} />
      )}
    </>
  );
}
