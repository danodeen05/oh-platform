/**
 * Task G3 cutover: `MealGift.paidAt` for gifts created before Task A6.
 *
 * Since A6 (prod release 1, 2026-09-27) a meal gift is a usable tender, and
 * is refunded to its giver on expiry, only when `paidAt` is set. Gifts
 * created before that have no `paidAt` and no `stripePaymentIntentId`: the
 * old flow confirmed a PaymentIntent in the browser (metadata
 * `{type:"meal_gift", giverId, locationId, creditsApplied}`), THEN created
 * the gift, then debited any credit part via `/users/:id/deduct-credits`
 * (a CREDIT_APPLIED CreditEvent with `metadata.mealGiftId`).
 *
 * For each in-scope gift (paidAt null, created before `--before`, default
 * the release 1 cutover), this script proves funding before writing:
 *  - credit part: the giver's CREDIT_APPLIED event whose metadata names the gift;
 *  - card part (the rest): exactly ONE Stripe PaymentIntent found by search
 *    on the old metadata with status `succeeded`, amount equal to the card
 *    part, USD, the gift's giver and location, created between 60 minutes
 *    before and 5 minutes after the gift, no refund on its charge, and not
 *    already bound to another gift. Two or more matches is "ambiguous" and
 *    nothing is written.
 *  - A gift paid entirely by credit has no PaymentIntent. It is counted as
 *    `creditFunded` and only written with `--accept-credit-funded`.
 * The write is a conditional `updateMany({ id, paidAt: null })` that sets
 * `paidAt` (the PaymentIntent's created time, or the gift's createdAt for a
 * credit-only gift) and `stripePaymentIntentId`, so a re-run is a no-op and
 * one PaymentIntent can never back two gifts (the column is unique).
 *
 * It never grants credit. Gifts that EXPIRED after `--before` while unpaid
 * in the new code were not refunded to their giver; they are counted as
 * `expiredAfterBeforeUnrefunded` for a human decision (see the runbook).
 *
 * Stripe calls are reads only (search, retrieve). The key's mode must match
 * the database: live for a remote DB, test for a local one.
 * Prints counts only.
 *
 * Usage (from packages/db, STRIPE_SECRET_KEY and DATABASE_URL in the env):
 *   pnpm exec tsx scripts/backfill-mealgift-paidat.ts --dry-run
 *   pnpm exec tsx scripts/backfill-mealgift-paidat.ts [--before=ISO] [--accept-credit-funded]
 * Refuses a non-local DATABASE_URL unless ALLOW_NON_LOCAL=1.
 */
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { isEntryPoint, requireSafeTarget, targetBanner } from "./lib/db-guard.ts";

/** Prod release 1 (Task A6 live), 2026-09-27 ~22:20Z. */
export const RELEASE_1 = new Date("2026-09-27T22:20:00Z");
const WINDOW_BEFORE_MS = 60 * 60 * 1000;
const WINDOW_AFTER_MS = 5 * 60 * 1000;

export interface StripeLike {
  paymentIntents: {
    search(args: { query: string; limit?: number; page?: string }): Promise<{ data: any[]; has_more?: boolean; next_page?: string | null }>;
    retrieve(id: string, opts?: any): Promise<any>;
  };
}

export interface MealGiftCounts {
  scanned: number;
  stripeVerified: number;
  creditFunded: number;
  ambiguous: number;
  unverified: number;
  applied: number;
  expiredAfterBeforeUnrefunded: number;
}

export function assertStripeMode(key: string | undefined, localDb: boolean): void {
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  const live = /^(sk|rk)_live_/.test(key);
  if (!localDb && !live) throw new Error("A remote database needs the live Stripe key (sk_live_/rk_live_); refusing a test key.");
  if (localDb && live) throw new Error("A local database needs a test Stripe key; refusing a live key.");
}

async function creditDebitCents(prisma: any, gift: any): Promise<number> {
  const events = await prisma.creditEvent.findMany({ where: { userId: gift.giverId, type: "CREDIT_APPLIED" } });
  return events
    .filter((e: any) => e.metadata && typeof e.metadata === "object" && e.metadata.mealGiftId === gift.id)
    .reduce((sum: number, e: any) => sum + Math.abs(e.amountCents || 0), 0);
}

async function searchIntents(stripe: StripeLike, giverId: string): Promise<any[]> {
  if (!/^[A-Za-z0-9_-]+$/.test(giverId)) return [];
  const query = `metadata['giverId']:'${giverId}' AND metadata['type']:'meal_gift'`;
  const out: any[] = [];
  let page: string | undefined;
  for (let i = 0; i < 10; i++) {
    // eslint-disable-next-line no-await-in-loop
    const res = await stripe.paymentIntents.search({ query, limit: 100, ...(page ? { page } : {}) });
    out.push(...res.data);
    if (!res.has_more || !res.next_page) break;
    page = res.next_page;
  }
  return out;
}

export async function backfillMealGiftPaidAt(
  prisma: any,
  stripe: StripeLike,
  { dryRun, before = RELEASE_1, acceptCreditFunded = false }: { dryRun: boolean; before?: Date; acceptCreditFunded?: boolean },
): Promise<MealGiftCounts> {
  const counts: MealGiftCounts = { scanned: 0, stripeVerified: 0, creditFunded: 0, ambiguous: 0, unverified: 0, applied: 0, expiredAfterBeforeUnrefunded: 0 };
  const gifts = await prisma.mealGift.findMany({ where: { paidAt: null, createdAt: { lt: before } }, orderBy: { createdAt: "asc" } });
  const searchCache = new Map<string, any[]>();
  const claimedThisRun = new Set<string>();

  for (const gift of gifts) {
    counts.scanned++;
    // eslint-disable-next-line no-await-in-loop
    const creditCents = await creditDebitCents(prisma, gift);
    const cardCents = gift.amountCents - creditCents;
    let paidAt: Date | null = null;
    let piId: string | null = null;

    if (cardCents < 0) {
      counts.unverified++;
      continue;
    }
    if (cardCents === 0) {
      counts.creditFunded++;
      if (!acceptCreditFunded) continue;
      paidAt = gift.createdAt;
    } else {
      if (!searchCache.has(gift.giverId)) {
        // eslint-disable-next-line no-await-in-loop
        searchCache.set(gift.giverId, await searchIntents(stripe, gift.giverId));
      }
      const created = gift.createdAt.getTime();
      const shortlist = searchCache.get(gift.giverId)!.filter(
        (p) =>
          p.status === "succeeded" &&
          p.amount === cardCents &&
          p.currency === "usd" &&
          p.metadata?.type === "meal_gift" &&
          p.metadata?.giverId === gift.giverId &&
          p.metadata?.locationId === gift.locationId &&
          p.created * 1000 >= created - WINDOW_BEFORE_MS &&
          p.created * 1000 <= created + WINDOW_AFTER_MS &&
          !claimedThisRun.has(p.id),
      );
      const candidates: any[] = [];
      for (const p of shortlist) {
        // eslint-disable-next-line no-await-in-loop
        const bound = await prisma.mealGift.findFirst({ where: { stripePaymentIntentId: p.id, id: { not: gift.id } } });
        if (bound) continue;
        // eslint-disable-next-line no-await-in-loop
        const full = await stripe.paymentIntents.retrieve(p.id, { expand: ["latest_charge"] });
        const charge = full.latest_charge;
        if (full.status !== "succeeded" || !charge || typeof charge !== "object" || charge.amount_refunded !== 0) continue;
        candidates.push(full);
      }
      if (candidates.length > 1) {
        counts.ambiguous++;
        continue;
      }
      if (candidates.length === 0) {
        counts.unverified++;
        continue;
      }
      counts.stripeVerified++;
      piId = candidates[0].id;
      paidAt = new Date(candidates[0].created * 1000);
      claimedThisRun.add(piId!);
    }

    if (gift.status === "EXPIRED" && gift.expiredAt && gift.expiredAt >= before) counts.expiredAfterBeforeUnrefunded++;

    if (dryRun) {
      counts.applied++;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const res = await prisma.mealGift.updateMany({ where: { id: gift.id, paidAt: null }, data: { paidAt, stripePaymentIntentId: piId } });
    counts.applied += res.count;
  }
  return counts;
}

function parseBefore(argv: string[]): Date {
  const arg = argv.find((a) => a.startsWith("--before="));
  if (!arg) return RELEASE_1;
  const d = new Date(arg.slice("--before=".length));
  if (Number.isNaN(d.getTime())) throw new Error("--before must be an ISO date");
  return d;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const acceptCreditFunded = process.argv.includes("--accept-credit-funded");
  const before = parseBefore(process.argv);
  const target = requireSafeTarget("backfill-mealgift-paidat");
  console.log(`${targetBanner("backfill-mealgift-paidat", target, dryRun)} before ${before.toISOString()}${acceptCreditFunded ? " --accept-credit-funded" : ""}`);
  assertStripeMode(process.env.STRIPE_SECRET_KEY, target.local);
  // stripe is a dependency of @oh/api, not @oh/db; resolve it from there.
  const Stripe = createRequire(new URL("../../api/package.json", import.meta.url))("stripe");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const prisma = new PrismaClient();
  try {
    const counts = await backfillMealGiftPaidAt(prisma, stripe, { dryRun, before, acceptCreditFunded });
    console.log(`[backfill-mealgift-paidat]${dryRun ? " [dry run]" : ""} ${JSON.stringify(counts)}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((err) => {
    console.error(`[backfill-mealgift-paidat] failed: ${err?.message ?? err}`);
    process.exit(1);
  });
}
