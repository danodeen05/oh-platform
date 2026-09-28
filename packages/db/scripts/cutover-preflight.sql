-- Task G3 cutover pre-flight: READ-ONLY counts for the release-2 runbook.
--
-- Runs inside BEGIN READ ONLY ... ROLLBACK, so Postgres itself refuses any
-- write. It only uses columns that exist BEFORE the release-2 migrations, so
-- it can run before and after them. It prints counts and the Location list
-- (ids, names, slugs: no customer data).
--
-- Run:  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f packages/db/scripts/cutover-preflight.sql
-- (strip any ?schema=... from the URL first; psql rejects it)

BEGIN READ ONLY;

\echo '== 1. Locations (seed and backfill must target the LIVE rows; closed duplicates are expected in prod)'
SELECT l.id, l.name, l.slug, l."isClosed", l."layoutKey", l."podCount",
       count(s.id) FILTER (WHERE s."retiredAt" IS NULL) AS active_seats,
       count(s.id) AS all_seats
FROM "Location" l
LEFT JOIN "Seat" s ON s."locationId" = l.id
GROUP BY l.id
ORDER BY l."isClosed", l.name;

\echo '== 2. Kiosk devices (an active device with no heartbeat for 24h may be keyless: it loses member-QR check-in)'
SELECT count(*) AS devices,
       count(*) FILTER (WHERE "isActive") AS active,
       count(*) FILTER (WHERE "isActive" AND "lastHeartbeat" IS NULL) AS active_never_heartbeat,
       count(*) FILTER (WHERE "isActive" AND "lastHeartbeat" < now() - interval '24 hours') AS active_stale_24h
FROM "KioskDevice";

\echo '== 3. Undisbursed PendingCredit (cutover-credit-lots pays these as REFERRAL lots)'
SELECT count(*) AS undisbursed,
       coalesce(sum("amountCents"), 0) AS undisbursed_cents,
       count(*) FILTER (WHERE "amountCents" <= 0) AS non_positive,
       count(DISTINCT "userId") AS users
FROM "PendingCredit"
WHERE "disbursedAt" IS NULL;

\echo '== 4. Credit ledger: legacy balances without a lot, and cached balance drift'
WITH lot_sum AS (
  SELECT "userId", sum("remainingCents") AS remaining FROM "CreditLot" GROUP BY "userId"
)
SELECT count(*) FILTER (WHERE u."creditsCents" > 0 AND ls."userId" IS NULL) AS legacy_users_without_lot,
       coalesce(sum(u."creditsCents") FILTER (WHERE u."creditsCents" > 0 AND ls."userId" IS NULL), 0) AS legacy_cents,
       count(*) FILTER (WHERE ls."userId" IS NOT NULL AND u."creditsCents" <> ls.remaining) AS drift_users
FROM "User" u
LEFT JOIN lot_sum ls ON ls."userId" = u.id;

\echo '== 5. MealGift rows without paidAt, created before release 1 (2026-09-27 22:20Z), by status'
SELECT status, count(*) AS gifts, coalesce(sum("amountCents"), 0) AS cents
FROM "MealGift"
WHERE "paidAt" IS NULL AND "createdAt" < '2026-09-27T22:20:00Z'
GROUP BY status
ORDER BY status;
\echo '   ...of which EXPIRED after release 1 (the new code did not refund these givers)'
SELECT count(*) AS expired_after_release1_unpaid
FROM "MealGift"
WHERE "paidAt" IS NULL AND "createdAt" < '2026-09-27T22:20:00Z' AND status = 'EXPIRED' AND "expiredAt" >= '2026-09-27T22:20:00Z';

\echo '== 6. Shop orders: unpaid with recorded savings (D10a: safe, settle skips legacy), and legacy SHOP- rows'
SELECT count(*) FILTER (WHERE "paymentStatus" = 'PENDING' AND ("creditsApplied" > 0 OR "giftCardApplied" > 0)) AS unpaid_with_savings,
       count(*) FILTER (WHERE "orderNumber" LIKE 'SHOP-%') AS legacy_shop_rows,
       count(*) FILTER (WHERE "orderNumber" LIKE 'SHOP-%' AND "paymentStatus" = 'PENDING') AS legacy_shop_unpaid
FROM "ShopOrder";

\echo '== 7. Chappy conversations holding a Stripe client secret (scrub-chappy-secrets cleans these)'
SELECT count(*) FILTER (WHERE messages::text ~ '(client_secret|clientSecret|_secret_)') AS with_secret,
       count(*) FILTER (WHERE "isActive") AS active,
       count(*) AS total
FROM "ChappyConversation";

\echo '== 8. Phones not yet E.164 (backfill-phone-e164)'
SELECT (SELECT count(*) FROM "User" WHERE phone IS NOT NULL AND phone !~ '^\+[1-9][0-9]{7,14}$') AS users_non_e164,
       (SELECT count(*) FROM "Guest" WHERE phone IS NOT NULL AND phone !~ '^\+[1-9][0-9]{7,14}$') AS guests_non_e164;

\echo '== 9. Badge/Challenge i18n and emoji (backfill-i18n; --clear-emoji only after the new web is live)'
SELECT (SELECT count(*) FROM "Badge") AS badges,
       (SELECT count(*) FROM "Badge" WHERE i18n IS NULL) AS badges_without_i18n,
       (SELECT count(*) FROM "Badge" WHERE coalesce("iconEmoji", '') <> '') AS badges_with_emoji,
       (SELECT count(*) FROM "Challenge") AS challenges,
       (SELECT count(*) FROM "Challenge" WHERE i18n IS NULL) AS challenges_without_i18n,
       (SELECT count(*) FROM "Challenge" WHERE "iconEmoji" <> '') AS challenges_with_emoji;

\echo '== 10. Release-2 migration columns already present (0 before cutover-migrate, 1 after)'
SELECT table_name || '.' || column_name AS column_, 1 AS present
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND (table_name, column_name) IN (('Seat', 'bestRank'), ('SupportCase', 'resolutionNote'), ('SupportCase', 'resolutionDetail'), ('ChappyConversation', 'cart'))
ORDER BY 1;

\echo '== 11. Live orders right now (deploy in a quiet window: ideally 0)'
SELECT count(*) AS in_flight
FROM "Order"
WHERE status IN ('PAID', 'QUEUED', 'PREPPING', 'READY', 'SERVING');

ROLLBACK;
