import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Icon, type IconName } from "@/components/ui/icons";
import type { AttentionRow } from "@/lib/today";

const ICON: Record<string, IconName> = {
  podCalls: "seat", shop: "bag", catering: "calendar", planQuestions: "key", countersigner: "edit",
};
const ICON_TONE: Record<AttentionRow["tone"], string> = {
  alert: "bg-oh-ember/10 text-oh-ember-deep",
  pending: "bg-oh-gold/15 text-oh-clay",
  info: "bg-oh-linen text-oh-stone",
};

export function AttentionList({ rows }: { rows: AttentionRow[] }) {
  return (
    <Card title="Needs attention" padded={false}>
      {rows.length === 0 ? (
        <EmptyState icon="check" title="All clear" body="Nothing needs you right now." />
      ) : rows.map((r) => (
        <ListRow key={r.key} href={r.href} title={r.label}
          leading={
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${ICON_TONE[r.tone]}`}>
              <Icon name={ICON[r.key] ?? "alert"} size={18} />
            </span>
          }
          trailing={<Badge tone={r.tone}>{r.count}</Badge>} />
      ))}
    </Card>
  );
}
