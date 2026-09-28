import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Icon } from "../ui/icons";
import { denverDateTime } from "../../lib/format";
import type { AdminRole } from "../../lib/access";
import { canFullRefund, type CaseOrder, type RefundState } from "../../lib/support";

/** resolvedBy is a Clerk user id, "service" or "admin": never show the raw id. */
export function staffName(resolvedBy: string): string {
  if (resolvedBy === "service") return "the system";
  return "a staff member";
}

/**
 * The Resolve card on a support case. Pure: the page owns the sheets and the
 * requests. A card refund in progress blocks credit (always) and decline
 * (until its lease is stale); only the owner's retry may touch the case then.
 */
export function ResolveActions({ role, order, hasMember, busy, refund, onCredit, onRefund, onDecline }: {
  role: AdminRole;
  order: Pick<CaseOrder, "hasPaymentIntent"> | null;
  hasMember: boolean;
  busy: boolean;
  refund: RefundState;
  onCredit: () => void;
  onRefund: () => void;
  onDecline: () => void;
}) {
  const showRefund = canFullRefund(role, order);
  const pending = refund.pending;
  const declineBlocked = pending && !refund.stale;
  return (
    <Card title="Resolve">
      {pending && (
        <div role="status" data-testid="refund-pending" className="mb-3 flex gap-2.5 rounded-xl border border-oh-gold/50 bg-oh-gold/15 p-3 text-[15px] leading-snug text-oh-charcoal">
          <Icon name="clock" size={18} className="mt-0.5 shrink-0 text-oh-clay" />
          <span>
            <span className="block font-semibold">{refund.stale ? "Card refund stalled" : "Card refund in progress"}</span>
            <span className="block text-sm text-oh-stone/80">
              {[refund.startedBy ? `Started by ${staffName(refund.startedBy)}` : "Started", refund.startedAt ? denverDateTime(refund.startedAt) : null].filter(Boolean).join(", ")}.
              {" "}{refund.stale
                ? (showRefund ? "Retry the refund, or close the case if it was handled elsewhere." : "The owner can retry it. You can close the case if it was handled elsewhere.")
                : "Store credit and decline wait until it finishes."}
            </span>
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button variant="primary" icon="money" onClick={onCredit} disabled={busy || !hasMember || pending} data-testid="give-credit">Give store credit</Button>
        {!hasMember && <p className="text-sm text-oh-stone/70">No member account, so store credit can&apos;t be given. Reach them at the contact below.</p>}
        {showRefund && (
          <Button variant="danger" icon="undo" onClick={onRefund} disabled={busy} data-testid="refund-full">{pending ? "Retry full refund" : "Refund full order"}</Button>
        )}
        <Button onClick={onDecline} disabled={busy || declineBlocked} data-testid="decline">Decline or close</Button>
      </div>
    </Card>
  );
}
