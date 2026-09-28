/**
 * One-off scrub (Task E2 fix round 1): Stripe client secrets out of stored
 * Chappy conversations, and pre-cutover conversations retired.
 *
 * Why: before E2, a pay card's `clientSecret` went into the tool result the
 * model saw and the row saved, and main's retired agent stored
 * `create_apple_pay_order`'s raw `clientSecret` the same way (prod has been
 * Stripe LIVE since 2026-06-03). The API now scrubs history on every load
 * and save (packages/api/src/chappy/secrets.js); this cleans what is at rest.
 *
 * What it does, per ChappyConversation row:
 *  - `messages`: every tool result, text and tool input scrubbed with the
 *    API's own `scrubMessages` (client-secret keys dropped, card payloads
 *    reduced to `{type}`, "pi_..._secret_..." strings redacted).
 *  - `cart`: the same rule (a cart never holds one today; checked anyway).
 *  - Deactivates (isActive=false) every active conversation last updated
 *    before the cutover. Their tool_use blocks also name the retired agent's
 *    tools; the customer's next message starts a fresh conversation.
 *
 * Idempotent: a second run finds nothing to scrub and nothing to deactivate.
 * Prints COUNTS ONLY, never a message, an identifier or a secret.
 *
 * Usage (from packages/db):
 *   pnpm exec tsx scripts/scrub-chappy-secrets.ts --dry-run
 *   pnpm exec tsx scripts/scrub-chappy-secrets.ts [--cutover=2026-10-01T00:00:00Z]
 * The cutover defaults to now. Refuses a non-local DATABASE_URL unless
 * ALLOW_NON_LOCAL_SCRUB=1 (the controller sets it for prod at G3).
 */
import { PrismaClient } from "@prisma/client";
import { hasSecrets, scrubMessages, scrubSecrets } from "../../api/src/chappy/secrets.js";

export interface ScrubCounts {
  scanned: number;
  messagesScrubbed: number;
  cartsScrubbed: number;
  deactivated: number;
}

type Row = { id: string; messages: unknown; cart: unknown; isActive: boolean; updatedAt: Date };

/** The changes for one row (pure; the test drives it). */
export function planRow(row: Row, cutover: Date): { data: Record<string, unknown> | null; messages: boolean; cart: boolean; deactivate: boolean } {
  const scrubbed = scrubMessages(row.messages);
  const cartDirty = row.cart !== null && row.cart !== undefined && hasSecrets(row.cart);
  const deactivate = row.isActive && row.updatedAt.getTime() < cutover.getTime();
  const data: Record<string, unknown> = {};
  if (scrubbed.changed) data.messages = scrubbed.messages;
  if (cartDirty) data.cart = scrubSecrets(row.cart);
  if (deactivate) data.isActive = false;
  return { data: Object.keys(data).length ? data : null, messages: scrubbed.changed, cart: cartDirty, deactivate };
}

export async function scrub(prisma: PrismaClient, { cutover, dryRun }: { cutover: Date; dryRun: boolean }): Promise<ScrubCounts> {
  const counts: ScrubCounts = { scanned: 0, messagesScrubbed: 0, cartsScrubbed: 0, deactivated: 0 };
  let cursor: string | undefined;
  for (;;) {
    const rows = (await prisma.chappyConversation.findMany({
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, messages: true, cart: true, isActive: true, updatedAt: true },
    })) as Row[];
    if (!rows.length) break;
    for (const row of rows) {
      counts.scanned++;
      const plan = planRow(row, cutover);
      if (plan.messages) counts.messagesScrubbed++;
      if (plan.cart) counts.cartsScrubbed++;
      if (plan.deactivate) counts.deactivated++;
      // updatedAt is left as it was: the scrub is not activity.
      if (plan.data && !dryRun) await prisma.chappyConversation.update({ where: { id: row.id }, data: { ...plan.data, updatedAt: row.updatedAt } });
    }
    cursor = rows[rows.length - 1].id;
  }
  return counts;
}

function isLocal(url: string | undefined): boolean {
  return !!url && /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const arg = process.argv.find((a) => a.startsWith("--cutover="));
  const cutover = arg ? new Date(arg.slice("--cutover=".length)) : new Date();
  if (Number.isNaN(cutover.getTime())) throw new Error("--cutover must be an ISO date");
  if (!isLocal(process.env.DATABASE_URL) && process.env.ALLOW_NON_LOCAL_SCRUB !== "1") {
    throw new Error("DATABASE_URL is not local; set ALLOW_NON_LOCAL_SCRUB=1 to scrub a remote database on purpose.");
  }
  const prisma = new PrismaClient();
  try {
    const counts = await scrub(prisma, { cutover, dryRun });
    console.log(`${dryRun ? "[dry run] " : ""}chappy scrub, cutover ${cutover.toISOString()}: ${JSON.stringify(counts)}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    console.error(`chappy scrub failed: ${err?.message}`);
    process.exit(1);
  });
}
