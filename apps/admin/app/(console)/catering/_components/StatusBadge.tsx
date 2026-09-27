import { Badge } from "@/components/ui/Badge";
import { statusLabel, statusTone, type CateringEventStatus } from "@/lib/catering";

export default function StatusBadge({ status }: { status: CateringEventStatus }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}
