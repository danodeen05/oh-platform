"use client";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { money } from "../../lib/format";

export const REFUND_EXPLAINER = "This refunds the entire order to the card. Credits and gift card amounts used are restored as store credit.";

/**
 * What the refund confirm shows: the full order total and what happens.
 * There is deliberately no amount field: a card refund is always the whole
 * order (owner's rule). Kept separate from the Sheet so a test can render it.
 */
export function RefundDialogContent({ totalCents, orderNumber, error }: { totalCents: number | null; orderNumber: string | null; error?: string | null }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-oh-stone">
      <div className="rounded-xl border border-oh-stone/15 bg-oh-cream p-4">
        <p className="text-sm font-semibold text-oh-stone/70">{orderNumber ? `Order #${orderNumber}` : "Order"} total</p>
        <p className="mt-1 font-display text-[2rem] leading-none text-oh-charcoal tabular-nums" data-testid="refund-total">{money(totalCents)}</p>
      </div>
      <p>{REFUND_EXPLAINER}</p>
      {error && <p role="alert" className="font-medium text-oh-ember-deep">{error}</p>}
    </div>
  );
}

export function RefundDialog({ open, onClose, onConfirm, busy, totalCents, orderNumber, error, retry }: {
  open: boolean; onClose: () => void; onConfirm: () => void; busy: boolean;
  totalCents: number | null; orderNumber: string | null; error?: string | null; retry?: boolean;
}) {
  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title="Refund full order" size="auto"
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="flex-1" variant="primary" onClick={onConfirm} loading={busy} data-testid="refund-confirm">
            {retry ? "Retry refund" : `Refund ${money(totalCents)}`}
          </Button>
        </div>
      }>
      <RefundDialogContent totalCents={totalCents} orderNumber={orderNumber} error={error} />
    </Sheet>
  );
}
