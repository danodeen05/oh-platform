import { Badge } from "@/components/ui/Badge";
import { statusLabel, statusTone } from "@/lib/orders";

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}
