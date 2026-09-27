"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import type { ShoppingListItem } from "@/lib/catering";
import { useResource } from "@/lib/use-resource";

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong.");

export default function ShoppingTab({ eventId }: { eventId: string }) {
  const { show } = useToast();
  const res = useResource(`catering-shopping:${eventId}`, async (signal) => {
    const data = await api<{ shoppingList: ShoppingListItem[] }>(`/admin/catering/events/${eventId}/shopping-list`, { signal });
    return Array.isArray(data?.shoppingList) ? data.shoppingList : [];
  });
  const [generating, setGenerating] = useState(false);
  const items = res.data ?? [];

  async function generate() {
    setGenerating(true);
    try {
      await api(`/admin/catering/events/${eventId}/shopping-list`, { method: "POST" });
      res.reload();
    } catch (e) {
      show({ message: `Couldn't generate the shopping list. ${errorText(e)}`, tone: "alert" });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={generate} loading={generating}>Generate shopping list</Button>
        {items.length > 0 && <span className="text-sm text-oh-stone/70">{items.length} ingredient{items.length !== 1 ? "s" : ""}</span>}
      </div>

      {res.error && !res.data ? (
        <ErrorCard message="Couldn't load the shopping list." onRetry={res.reload} />
      ) : !res.data ? (
        <SkeletonList rows={4} />
      ) : items.length === 0 ? (
        <EmptyState icon="bag" title="No shopping list yet" body="Generate one based on current orders." />
      ) : (
        <Card title="Shopping list" padded={false}>
          {items.map((item, i) => (
            <div key={i} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-[15px] text-oh-charcoal">{item.ingredient}</span>
              <span className="tabular-nums text-oh-stone/70">{item.quantity} {item.unit}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
