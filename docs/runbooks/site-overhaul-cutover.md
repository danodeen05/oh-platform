# Site overhaul, release 2: production cutover runbook

Owner: the controller session. Written by Task G3 (2026-09-28). Every step here was
rehearsed against the local `oh_overhaul` clone only; nothing in this file has been run
against production yet.

**Rules for the whole run**

- Run every step in order. Do not skip a dry run. Stop at the first surprise and write
  down what you saw before doing anything else.
- Never print a secret. Every command below keeps URLs and keys in shell variables. The
  scripts print host/database and counts only.
- Every write script refuses a non-local `DATABASE_URL` unless `ALLOW_NON_LOCAL=1` is set
  on that one command. Never `export ALLOW_NON_LOCAL=1`.
- Prod has **no `_prisma_migrations` table**. Never run `prisma migrate` or `prisma db push`
  against prod. Migrations go through `cutover-migrate.sh` (psql, one transaction each).
- Customer ordering is Mon to Sat 11:00 to 21:00 America/Denver, closed Sunday (all prod
  `Location.operatingHours` are null, so the defaults apply). Do steps 5 to 9 while the
  stores are closed.

**Already in prod from release 1 (2026-09-27, f7c6cd2):** migration
`20260928000000_site_overhaul`, the credit cutover of legacy balances to LEGACY lots
(1 user), `CHAPPY_GUEST_SECRET` on Railway, and the privacy hotfix (649ab65).

---

## 0. Preconditions (stop if any is false)

1. `site-overhaul` has every lane merged (Lanes 2 and 3 through D1 to D11, E1, E2, F1, F2)
   and `origin/main` (at least 649ab65) merged in. G1 and G2 passed on that exact commit.
2. The release commit is merged to `main` locally but **not pushed yet**. Pushing is step 7.
3. Local production builds pass on the release commit (prod-deploy-gotchas):
   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @oh/web build
   pnpm --filter @oh/admin build
   readlink -f apps/web/node_modules/next; readlink -f apps/admin/node_modules/next   # one next copy each, beside @clerk/nextjs
   ```
4. `prisma` is a **dependency** (not a devDependency) of `@oh/db`, or the Railway build
   fails with `spawn prisma EACCES`:
   ```bash
   node -e 'const p=require("./packages/db/package.json"); if(!p.dependencies.prisma||(p.devDependencies||{}).prisma) {console.error("FIX packages/db/package.json: prisma must be in dependencies"); process.exit(1)} console.log("prisma is a dependency:", p.dependencies.prisma)'
   ```
   Note: `@oh/db` now depends on `@oh/floor-plan` (workspace). Railway builds with RAILPACK
   (whole workspace), so this is fine. The repo Dockerfile path also installs cleanly
   (G3 simulated it: the link dangles, and nothing the API loads imports floor-plan).
5. The release checkout has the new Prisma client: `pnpm --filter @oh/db exec prisma generate`.
6. Tools: `psql` (16+), `jq`, `railway` CLI (`export PATH="$HOME/.railway/bin:$PATH"`),
   `VERCEL_TOKEN` and `RAILWAY_TOKEN` from `.env`.

## 1. Session setup

Run from the release checkout root (the merged commit). Replace `<main checkout>` with the
path of the checkout that holds `.env.prod-bak`.

```bash
export PROD_DATABASE_URL="$(grep -E '^DATABASE_URL=' <main checkout>/.env.prod-bak | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//')"
export PROD_PSQL_URL="${PROD_DATABASE_URL%%\?*}"          # psql rejects ?schema=...
test -n "$PROD_DATABASE_URL" && echo "prod DB url loaded (not printed)"
export TEAM=team_lcuKROVnRGMXAYN6Q3x44DKh
export WEB_PROJECT=prj_ekz7Au2qhyHm4F6KnFTRGfukYeD0
export ADMIN_PROJECT=admin                                  # Vercel accepts the project name
export PATH="$HOME/.railway/bin:$PATH"
```

## 2. Pre-flight (read only) and rollback anchors

### 2a. Pre-flight counts

`packages/db/scripts/cutover-preflight.sql` runs inside `BEGIN READ ONLY ... ROLLBACK`
(Postgres refuses any write) and only uses columns that exist before release 2.

```bash
psql "$PROD_PSQL_URL" -X -v ON_ERROR_STOP=1 -f packages/db/scripts/cutover-preflight.sql | tee /tmp/preflight-before.txt
```

Write down each number. What to check:

| # | Section | What it means / what to do |
|---|---------|----------------------------|
| 1 | Locations | Expect 2 live rows (City Creek, University Place, `isClosed = f`) plus closed duplicates of both (`isClosed = t`). Note the **live** ids. If a live id is not `cmip6jbz700022nnnxxpmm5hf` (City Creek) / `cmip6jbza00042nnnf4nc0dvh` (University Place), you will pass `--location-id` in step 6a. If a **closed** row already holds `city-creek` or `university-place` as its slug, stop and move the slug by hand (6a explains). |
| 2 | Kiosk devices | Release 1 found 0. Any active device with no heartbeat for 24h may be keyless; after release 2 (A10b) a keyless kiosk loses member-QR check-in. Step 9b. |
| 3 | Undisbursed PendingCredit | Paid out as REFERRAL lots in 6c. `non_positive` rows are never paid; note them for the owner. |
| 4 | Legacy users without a lot / drift | Release 1 converted 1 user, so expect `legacy_users_without_lot = 0`. `drift_users > 0` means a cached balance disagrees with its lots: nothing fixes it automatically; list it for the owner. |
| 5 | MealGift without paidAt (before release 1) | If the total is 0, skip 6d. `expired_after_release1_unpaid > 0`: those givers were not refunded by the new code (owner decision, see 6d). |
| 6 | Shop orders | `unpaid_with_savings` rows are safe (D10a: settle skips legacy `SHOP-` rows). Record the numbers only. |
| 7 | Chappy with a client secret | Cleaned by 8a. |
| 8 | Phones not E.164 | Fixed by 8b. |
| 9 | Badge/Challenge i18n and emoji | `backfill-i18n` (6b) and `--clear-emoji` (step 11). |
| 10 | Release-2 columns present | Expect 0 rows before step 5. |
| 11 | Live orders | Must be 0 before step 5. If not, wait. |

### 2b. Rollback anchors (record before anything changes)

```bash
# Vercel: the current production deployments (the rollback targets)
curl -s "https://api.vercel.com/v6/deployments?projectId=$WEB_PROJECT&teamId=$TEAM&target=production&state=READY&limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.deployments[0] | "web   \(.uid) \(.url) \(.meta.githubCommitSha)"'
curl -s "https://api.vercel.com/v6/deployments?projectId=$ADMIN_PROJECT&teamId=$TEAM&target=production&state=READY&limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.deployments[0] | "admin \(.uid) \(.url) \(.meta.githubCommitSha)"'
# Railway: note the ACTIVE deployment of @oh/api (dashboard > @oh/api > Deployments, or the Railway MCP list-deployments tool)
railway status
```

Save the three ids in `/tmp/rollback-anchors.txt`. Also record the pre-release `origin/main`
SHA: `git rev-parse origin/main`.

## 3. The window

Pick a time when both stores are closed (before 11:00 or after 21:00 Denver, or Sunday).
Re-run pre-flight section 11 (live orders) right before step 5; it must be 0.

## 4. Environment variables, webhook, cron (before the deploy)

Never echo values. Setting a Railway variable redeploys the **current** build; that is
harmless (release-1 code ignores these), but use `--skip-deploys` when your CLI has it.

### 4a. Railway `@oh/api`

First see which already exist (names only):

```bash
railway variables --service "@oh/api" --kv | cut -d= -f1 | sort > /tmp/railway-vars.txt
for v in TWILIO_AUTH_TOKEN API_PUBLIC_URL SUPPORT_NOTIFY ADMIN_API_KEY CHAPPY_GUEST_SECRET CHAPPY_LIMITS_JSON CHAPPY_MODEL \
         ADMIN_PHONE_NUMBER TWILIO_ACCOUNT_SID TWILIO_PHONE_NUMBER ANTHROPIC_API_KEY CRON_SECRET WEB_APP_URL \
         PLAN_VISIT_SUMMARIES CHAPPY_SMS_SKIP_SIGNATURE MS_TENANT_ID MS_CLIENT_ID MS_CLIENT_SECRET MS_SENDER_EMAIL OWNER_EMAIL PLAN_NOTIFY_EMAIL; do
  grep -qx "$v" /tmp/railway-vars.txt && echo "set      $v" || echo "MISSING  $v"; done
```

Then set what is missing:

| Variable | Value | Why |
|----------|-------|-----|
| `TWILIO_AUTH_TOKEN` | the Twilio **account** auth token (Twilio console) | `POST /chappy/sms` verifies `X-Twilio-Signature`; without it every inbound text gets 403. API-key credentials cannot verify webhooks. |
| `API_PUBLIC_URL` | `https://api.ohbeef.com` | The signature is computed over the exact URL Twilio called. Open Twilio console > the Oh! number > Messaging webhook: it must be `https://api.ohbeef.com/chappy/sms`. If it is anything else, change the webhook to that URL (or set `API_PUBLIC_URL` to that URL's origin). |
| `SUPPORT_NOTIFY` | `live` | Support cases and Chappy escalations text/email the owner. (`live` is also the default when unset; set it explicitly.) |
| `ADMIN_API_KEY` | already set on Railway (the plan-code smoke uses it). If MISSING: `openssl rand -hex 32`. | Server-to-server key; the web's Stripe webhook uses the same value (4b). |
| `CHAPPY_LIMITS_JSON` | only if the owner wants non-default limits | Defaults: 20 msgs / 10 min, 200 / day, 300k output tokens / day, 300 guest chats per IP / day. |
| `CHAPPY_MODEL` | optional; default `claude-opus-5` | |
| `CHAPPY_SMS_SKIP_SIGNATURE` | must be **MISSING** | (It is ignored in production anyway.) |
| `PLAN_VISIT_SUMMARIES` | leave as prod has it | |
| `MS_*`, `OWNER_EMAIL` / `PLAN_NOTIFY_EMAIL` | set if the owner wants support emails from prod | Without `MS_*` the support email is skipped (SMS still goes). |

```bash
railway variables --service "@oh/api" --skip-deploys --set "API_PUBLIC_URL=https://api.ohbeef.com" --set "SUPPORT_NOTIFY=live"
read -rs TWILIO_AUTH_TOKEN_VALUE   # paste, Enter (not echoed)
railway variables --service "@oh/api" --skip-deploys --set "TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN_VALUE"; unset TWILIO_AUTH_TOKEN_VALUE
```
(If your CLI rejects `--skip-deploys`, drop it; the redeploy of the old build is harmless.)

### 4b. Vercel `webapp`

`STRIPE_WEBHOOK_SECRET` is missing today, so the Stripe webhook at
`https://www.ohbeef.com/api/webhooks/stripe` is inert. Release 2 needs it (and
`ADMIN_API_KEY`) to confirm shop and gift-card payments when the browser never returns.

1. Check for an existing live endpoint first (never create a duplicate):
   ```bash
   export STRIPE_LIVE_SECRET_KEY="$(railway variables --service "@oh/api" --kv | grep -E '^STRIPE_SECRET_KEY=' | cut -d= -f2-)"
   case "$STRIPE_LIVE_SECRET_KEY" in sk_live_*|rk_live_*) echo "live key loaded";; *) echo "STOP: not a live key";; esac
   curl -s https://api.stripe.com/v1/webhook_endpoints -u "$STRIPE_LIVE_SECRET_KEY:" | jq -r '.data[] | "\(.id) \(.url) \(.status) \(.enabled_events|join(","))"'
   ```
2. If none points at `https://www.ohbeef.com/api/webhooks/stripe`, create it and keep the
   secret in a variable (Stripe shows it only once):
   ```bash
   export WHSEC="$(curl -s https://api.stripe.com/v1/webhook_endpoints -u "$STRIPE_LIVE_SECRET_KEY:" \
     -d url=https://www.ohbeef.com/api/webhooks/stripe \
     -d "enabled_events[]=payment_intent.succeeded" -d "enabled_events[]=payment_intent.payment_failed" -d "enabled_events[]=payment_intent.canceled" | jq -r .secret)"
   case "$WHSEC" in whsec_*) echo "webhook secret captured";; *) echo "STOP: no secret";; esac
   ```
   If one exists but its secret is unknown, roll its secret in the Stripe dashboard and use the new one.
3. Add both variables to the webapp project, production target, as encrypted values:
   ```bash
   export ADMIN_API_KEY_VALUE="$(railway variables --service "@oh/api" --kv | grep -E '^ADMIN_API_KEY=' | cut -d= -f2-)"
   for kv in "STRIPE_WEBHOOK_SECRET:$WHSEC" "ADMIN_API_KEY:$ADMIN_API_KEY_VALUE"; do
     k="${kv%%:*}"; v="${kv#*:}"
     jq -n --arg k "$k" --arg v "$v" '{key:$k,value:$v,type:"encrypted",target:["production"]}' |
       curl -s -X POST "https://api.vercel.com/v10/projects/$WEB_PROJECT/env?teamId=$TEAM&upsert=true" \
         -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" -d @- | jq -r '.created.key // .key // .error.message'
   done
   unset WHSEC ADMIN_API_KEY_VALUE
   ```
   They take effect on the next build (step 7).

### 4c. The wallet cron (credit expiry, expiry warnings, quarterly perk, membership sweep)

Check whether a Railway service already runs `packages/api/src/cron/wallet-cron.js`
(dashboard, or the Railway MCP `list-services` tool). If none exists, add one:

- New service from the same GitHub repo, name `wallet-cron`, same builder as `@oh/api`.
- **Cron schedule** `10 10 * * *` (UTC; 03:10 MST / 04:10 MDT).
- **Start command** (each `run` exits when done, which a Railway cron needs):
  `sh -c 'cd packages/api && node src/cron/wallet-cron.js run expire-credits && node src/cron/wallet-cron.js run quarterly-perk && node src/cron/wallet-cron.js run membership-sweep'`
- **Variables:** `DATABASE_URL` (reference the Postgres-yOLk service), `NODE_ENV=production`,
  `CRON_SECRET` (same as `@oh/api`; the module throws at import in production without it),
  `SUPPORT_NOTIFY=live`, `WEB_APP_URL`, and the Twilio sending variables copied from `@oh/api`
  (`TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` or `TWILIO_AUTH_TOKEN`,
  `TWILIO_PHONE_NUMBER`) for the expiry-warning texts.
- Do not use `wallet-cron.js service` mode: it checks the server clock (UTC on Railway)
  every minute with 5-minute windows, so each job can run up to 5 times per window.
  The three jobs above are idempotent, but the `run` form is cleaner.

Verify after the first run with the service logs: `[CRON] expire-credits completed successfully`
and the other two.

## 5. Migrations (additive only)

Newer than the release-1 baseline, in order:

| Migration | SQL | Additive? |
|-----------|-----|-----------|
| `20260929000000_comb_seats` | `ALTER TABLE "Seat" ADD COLUMN "bestRank" INTEGER` | yes, nullable column |
| `20260930000000_support_resolution` | `ALTER TABLE "SupportCase" ADD COLUMN "resolutionDetail" JSONB, ADD COLUMN "resolutionNote" TEXT` | yes, nullable columns |
| `20261001000000_chappy_cart` | `ALTER TABLE "ChappyConversation" ADD COLUMN "cart" JSONB` | yes, nullable column |

Before running, confirm the folder list still matches (`ls packages/db/prisma/migrations`).
`cutover-migrate.sh` refuses to run if a newer folder has no probe, if the baseline is
missing, or if a migration is half applied.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" packages/db/scripts/cutover-migrate.sh --dry-run
```
Expect: `target REMOTE <host>/<db> (dry run, every migration rolled back)`, three lines
`...: pending`, three lines `...: applies cleanly (rolled back)`. Then:

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" packages/db/scripts/cutover-migrate.sh
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" packages/db/scripts/cutover-migrate.sh --dry-run   # expect 3x "already applied, skip" and "nothing to apply"
```

Each migration runs in one transaction with `ON_ERROR_STOP`; a failure leaves it unapplied.
Release-1 code ignores the new columns, so this is safe before the code deploy.

## 6. Data scripts (before the code deploy)

All from `packages/db`, each with a dry run first. They need the migrations from step 5
(the Prisma client reads every column). Paste each dry-run count into your notes.

```bash
cd packages/db
```

### 6a. Comb seats: `scripts/seed-comb-seats.ts --all`

Locations resolve **by slug** first; when no row has the slug yet (prod today) it uses
the known live id, or `--location-id=<slug>=<id>` from pre-flight section 1. A closed row
is refused. Every location resolves before anything is written.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/seed-comb-seats.ts --all --dry-run
# only if pre-flight showed different live ids:
#   ... --all --dry-run --location-id=city-creek=<live id> --location-id=university-place=<live id>
```

Check each line says the LIVE id from pre-flight, `via known-id` (or `override`), and
`location fields to change [slug, layoutKey, podCount]` (plus `layoutMirror` for
University Place). Expected counts: City Creek `created 75`, University Place `created 70`,
`updated 0`, `retired` = the number of legacy seats on each live row (pre-flight
`active_seats`, likely 12), `duo links 10` at each (5 duo pairs, both directions). If a closed duplicate already holds a slug, the script stops; fix it by hand:
`UPDATE "Location" SET slug = NULL WHERE id = '<closed id>' AND "isClosed";` (one row), then rerun the dry run.

Run it for real (same flags, no `--dry-run`). **Write down the printed `retiredAt`
timestamp**: it is the seat rollback key.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/seed-comb-seats.ts --all
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/seed-comb-seats.ts --all --dry-run   # expect via slug, unchanged, all zeros
```

### 6b. Translations: `scripts/backfill-i18n.ts` (without `--clear-emoji`)

Updates `i18n`/`iconKey`/slider `labelsI18n` on existing Badge, Challenge, Location (by
slug, so after 6a) and slider MenuItem rows. It never creates rows and never overwrites
English: a row whose English differs from the seed is printed as `SKIP ... prod text differs`
and left untouched.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/backfill-i18n.ts --dry-run
```

Review the SKIP list line by line. A SKIP is correct when the owner renamed that row in
admin (that row stays English-only in other locales until someone translates it by hand).
List every SKIP in the release notes for the owner. `No matching row` entries are fine.
Then run it for real and dry-run again (expect `Would update: 0 ...`).

### 6c. Credit lots: `scripts/cutover-credit-lots.ts`

1. `convertLegacyBalances` (a LEGACY lot for any positive balance with no lots; release 1 did this, expect 0).
2. Every undisbursed `PendingCredit` becomes a REFERRAL lot (90-day expiry), marked
   disbursed in the same transaction; a conditional claim means no row is ever paid twice.
3. Read-only drift check.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/cutover-credit-lots.ts --dry-run
```
Check `pendingPaid`/`pendingPaidCents` match pre-flight section 3 (undisbursed minus
non-positive), `legacyUsers` matches section 4, `driftUsers` matches section 4. Then run
for real, then dry-run again (expect `legacyUsers 0`, `pendingPaid 0`).

### 6d. MealGift `paidAt`: `scripts/backfill-mealgift-paidat.ts` (only if pre-flight 5 > 0)

Sets `paidAt` (and binds `stripePaymentIntentId`) on pre-release-1 gifts only when funding
is proven: exactly one succeeded, unrefunded live PaymentIntent with the old flow's
metadata (`type=meal_gift`, the giver, the location), the right amount (gift minus any
credit debit logged for that gift), created 60 min before to 5 min after the gift, not
bound to another gift. Two matches = `ambiguous`, nothing written. Stripe calls are
reads. It refuses a test key against a remote DB.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" STRIPE_SECRET_KEY="$STRIPE_LIVE_SECRET_KEY" pnpm exec tsx scripts/backfill-mealgift-paidat.ts --dry-run
```
Then for real. Gifts paid entirely with credit (`creditFunded`) need `--accept-credit-funded`
(ask the owner; they are real funding, just not Stripe). `expiredAfterBeforeUnrefunded > 0`:
those givers were not refunded when their gift expired under the new code. The script
never grants credit; tell the owner the count and let them decide (a manual ADMIN or
MEAL_GIFT credit through admin).

```bash
cd ../..
```

## 7. Deploy: Railway (API) first, then Vercel (web, admin)

A push to `main` makes Railway **and** Vercel build at once. Hold Vercel so the API is live
first.

1. Save and set the Vercel "ignored build step" to skip (exit 0 = skip):
   ```bash
   for P in $WEB_PROJECT $ADMIN_PROJECT; do
     curl -s "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" \
       | jq -r --arg p "$P" '"\($p) ignore-step was: \(.commandForIgnoringBuildStep // "<none>")"' | tee -a /tmp/rollback-anchors.txt
     curl -s -X PATCH "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" \
       -H "Content-Type: application/json" -d '{"commandForIgnoringBuildStep":"exit 0"}' | jq -r '.commandForIgnoringBuildStep'
   done
   ```
2. Push: `git push origin main`. Railway builds `@oh/api` (it watches `packages/api/**`
   and `packages/db/**`). Vercel records skipped (canceled) builds.
3. Wait for Railway: deployment status SUCCESS, then prove the NEW code answers
   (`bestRank` exists only in release 2):
   ```bash
   curl -s https://api.ohbeef.com/health
   CC=$(curl -s https://api.ohbeef.com/locations -H 'x-tenant-slug: oh' | jq -r '.[] | select(.slug=="city-creek") | .id')
   curl -s "https://api.ohbeef.com/locations/$CC/seats" -H 'x-tenant-slug: oh' | jq '{n: (.seats|length), hasBestRank: (.seats[0]|has("bestRank"))}'
   ```
   Expect `{"ok":true}`, then `n: 75, hasBestRank: true`. If the build fails, the old
   deploy keeps running: fix and push again; do not continue.
4. Release Vercel: restore each project's ignore step, then build `main` for production.
   The command below restores `null` (step 1 printed `<none>`); if step 1 printed a
   command, send that string instead of `null` for that project.
   ```bash
   for P in $WEB_PROJECT $ADMIN_PROJECT; do
     curl -s -X PATCH "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" \
       -H "Content-Type: application/json" -d '{"commandForIgnoringBuildStep":null}' | jq -r '.name'
     REPO_ID=$(curl -s "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.link.repoId')
     NAME=$(curl -s "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.name')
     jq -n --arg n "$NAME" --arg r "$REPO_ID" '{name:$n, project:$n, target:"production", gitSource:{type:"github", repoId:$r, ref:"main"}}' |
       curl -s -X POST "https://api.vercel.com/v13/deployments?teamId=$TEAM&forceNew=1" -H "Authorization: Bearer $VERCEL_TOKEN" \
         -H "Content-Type: application/json" -d @- | jq -r '"\(.name) \(.id) \(.readyState)"'
   done
   ```
   (Dashboard fallback: each project > Deployments > the skipped `main` deployment > Redeploy.)
5. Wait until both deployments are READY and aliased to production
   (`https://www.ohbeef.com`, admin). If the web build fails, prod keeps the old web.

## 8. Data scripts (after the new API is live)

These run after the deploy so nothing the old code writes in between is missed.

### 8a. `scripts/scrub-chappy-secrets.ts`

Scrubs Stripe client secrets out of stored Chappy messages/carts and deactivates every
conversation last updated before `--cutover` (default: now), so returning customers start
fresh on the new agent. Keeps `updatedAt`.

```bash
cd packages/db
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/scrub-chappy-secrets.ts --dry-run
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/scrub-chappy-secrets.ts
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/scrub-chappy-secrets.ts --dry-run   # expect messagesScrubbed 0, cartsScrubbed 0
```
(The second dry run's `deactivated` counts conversations started since the real run; that is fine.)

### 8b. `scripts/backfill-phone-e164.ts`

Normalizes `User.phone` and `Guest.phone` to E.164 with the API's own rule. Unparseable
numbers and User collisions are left unchanged and listed (row id and last 4 digits only).

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/backfill-phone-e164.ts --dry-run
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/backfill-phone-e164.ts
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/backfill-phone-e164.ts --dry-run   # expect 0 would be updated
cd ../..
```
Report any `conflicts` / `unparseable` counts to the owner (manual review).

## 9. Pods and kiosks

### 9a. Print the new pod QR codes

If the merged admin console has a pod QR print page, use it. Otherwise (true at G3) use
the read-only export: one SVG per live pod, QR = `https://www.ohbeef.com/pod?qr=<Seat.qrCode>`
(the guest pod page), plus an `index.html` print sheet per location.

```bash
cd packages/db
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/export-pod-qr.ts --dry-run          # expect {"city-creek":75,"university-place":70}
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/export-pod-qr.ts --out="$HOME/pod-qr-release2"
cd ../..
```
Scan one code per location with a phone: it must open the pod page for that label. Send
the two `index.html` sheets to the owner to print; the old 12 pod stickers are retired.

### 9b. Kiosk keys

After release 2 (A10b) a kiosk authenticates with its `KioskDevice.apiKey` (stored on the
tablet as `oh_kiosk_api_key`); a tablet without it loses member-QR check-in. Release 1
found 0 KioskDevice rows. If pre-flight section 2 shows devices, confirm with the owner
that each tablet was paired (it heartbeats: `lastHeartbeat` within the last few minutes
while it is on) and re-pair any that do not heartbeat.

## 10. Smoke test (prod)

```bash
node packages/api/scripts/cutover-smoke.mjs --api=https://api.ohbeef.com --web=https://www.ohbeef.com
```

Read-only except one Chappy guest question (one model call, no money). Checks:

1. API `/health` is `{ok:true}`.
2. API `/membership/program`: tiers need 10 orders + 2 referrals, then 25 + 5; goodwill caps are not exposed.
3. Seats: `city-creek` has 75 active pods and `university-place` has 70 (via `/locations` then `/locations/:id/seats`).
4. API `/orders/status?orderQrCode=DEMO-PLAN` is 200 (the plan demo contract).
5. Web `/en` and `/zh-TW`: home, `/rewards`, `/menu` are 200.
6. Web `/zh-TW/privacy` is 200 (the 649ab65 hotfix survived the merge).
7. Web plan demo embed `/en/order/status?orderQrCode=DEMO-PLAN&embed=1&demoSync=parent` is 200.
8. Web `/en/member` signed out is 200 (sign-in prompt, not a Clerk 404).
9. Web `/en/loyalty` is a 308 to `/en/rewards`.
10. Web `/en/tenants` is 404 (debug page removed in D11).
11. Chappy: `POST /chappy/guest-token`, then one guest question streams `text` and `done`, no `error`.

Expected: `16 passed, 0 failed` (exit code 0). Then by hand on a phone:
the header, dock and Chappy render; the 3D floor plan on `/en/plan/floor-plan` loads (plan code);
admin console loads and the Support tab opens.

**Money paths are not charged in prod.** Optional $0 check, only if a real unredeemed
FREE_BOWL reward already exists on the owner's own account (never create one for the test):
sign in as the owner, order one bowl with the reward applied (balance $0.00), confirm it goes
PAID with no PaymentIntent, then cancel it from admin.

At G3 on the unmerged Lane-1 branch the smoke ran 13/16 against the local worktree
servers; the 3 failures are exactly the precondition-0 items (privacy hotfix not merged,
D8 `/member`, D11 `/tenants`). All 16 must pass on the release commit.

## 11. Clear the badge/challenge emoji (after the new web is live and smoke passed)

The old web rendered `iconEmoji`; the new one renders in-house seals. Back up first, then clear:

```bash
psql "$PROD_PSQL_URL" -X -v ON_ERROR_STOP=1 -c '\copy (SELECT id, "iconEmoji" FROM "Badge") TO /tmp/badge-emoji-backup.csv CSV HEADER' \
                                             -c '\copy (SELECT id, "iconEmoji" FROM "Challenge") TO /tmp/challenge-emoji-backup.csv CSV HEADER'
cd packages/db
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/backfill-i18n.ts --dry-run --clear-emoji
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm exec tsx scripts/backfill-i18n.ts --clear-emoji
cd ../..
```
Rows on the SKIP list keep their emoji (never touched).

## 12. Tell the owner (last, once)

Only when steps 1 to 11 are done and verified. From `packages/api` (Railway injects the
prod Twilio variables and `ADMIN_PHONE_NUMBER`):

```bash
cd packages/api
railway run --service "@oh/api" node scripts/notify-owner-release.mjs          # dry run: prints the masked number and the text
railway run --service "@oh/api" node scripts/notify-owner-release.mjs --send   # sends once
cd ../..
```
If `railway run` is refused with the project token, pass only the needed variables from
Railway into a local run (values never reach the terminal):
```bash
env $(railway variables --service "@oh/api" --kv | grep -E '^(TWILIO_[A-Z_]+|ADMIN_PHONE_NUMBER|SUPPORT_NOTIFY)=' | xargs) node scripts/notify-owner-release.mjs
```
(add `--send` for the real text). Text: "Oh! site release is live in prod and ready for your review." It honors
`SUPPORT_NOTIFY` (`live` sends). Do not re-run `--send`.

## 13. Rollback

Decide fast; everything below is reversible without data loss.

**Code (first choice).**
- Vercel: promote the step-2b deployments back (web and admin):
  ```bash
  curl -s -X POST "https://api.vercel.com/v10/projects/$WEB_PROJECT/promote/<web deployment id>?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN"
  curl -s -X POST "https://api.vercel.com/v10/projects/$ADMIN_PROJECT/promote/<admin deployment id>?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN"
  ```
  (Dashboard: Deployments > the old one > Promote / Instant Rollback.)
- Railway: redeploy the step-2b deployment (dashboard > @oh/api > Deployments > that deployment >
  Rollback, or the Railway MCP `redeploy`). Note Railway rebuilds from `main` on the next push
  to `packages/api/**` or `packages/db/**`: revert on `main` before pushing anything else.

**Schema.** The three migrations only add nullable columns; release-1 code ignores them.
Leave them. (If ever required: `ALTER TABLE "Seat" DROP COLUMN "bestRank"; ALTER TABLE "SupportCase" DROP COLUMN "resolutionNote", DROP COLUMN "resolutionDetail"; ALTER TABLE "ChappyConversation" DROP COLUMN "cart";`)

**Seats.** Nothing is deleted; legacy seats were retired with the timestamp from 6a.
Release-1 code only claims seats with `retiredAt IS NULL`, but its pod list shows every row.
To put the legacy pods back and stop comb pods being claimed:
```sql
BEGIN;
UPDATE "Seat" SET "retiredAt" = NULL
 WHERE "locationId" IN ('<city creek live id>', '<university place live id>') AND "retiredAt" = '<retiredAt from 6a>';
UPDATE "Seat" SET "retiredAt" = now()
 WHERE "locationId" IN ('<city creek live id>', '<university place live id>') AND "retiredAt" IS NULL AND label ~ '^[A-C]-[0-9]{2}$';
SELECT "locationId", count(*) FILTER (WHERE "retiredAt" IS NULL) AS active FROM "Seat" WHERE "locationId" IN ('<cc>', '<up>') GROUP BY 1;
COMMIT;   -- only if the counts are the legacy numbers; otherwise ROLLBACK
```
To go forward again, re-run `seed-comb-seats --all` (it revives comb pods and re-retires the legacy ones).

**Credits.** REFERRAL/LEGACY lots from 6c are real member credit and release-1 code uses
the same ledger: leave them.

**Meal gifts, phones, Chappy scrub, i18n.** Leave them: `paidAt` is set only on proven
payments; E.164 phones and scrubbed secrets are correct for any version; `i18n` columns
are ignored by release-1 code. After step 11 only, restore emoji if the old web returns:
```bash
psql "$PROD_PSQL_URL" -X -v ON_ERROR_STOP=1 \
  -c 'CREATE TEMP TABLE b(id text, "iconEmoji" text)' -c '\copy b FROM /tmp/badge-emoji-backup.csv CSV HEADER' \
  -c 'UPDATE "Badge" x SET "iconEmoji" = b."iconEmoji" FROM b WHERE b.id = x.id' \
  -c 'CREATE TEMP TABLE c(id text, "iconEmoji" text)' -c '\copy c FROM /tmp/challenge-emoji-backup.csv CSV HEADER' \
  -c 'UPDATE "Challenge" x SET "iconEmoji" = c."iconEmoji" FROM c WHERE c.id = x.id'
```

**Env vars.** Leave them; release-1 code ignores the new ones.

---

## Appendix: script reference

All paths are from the repo root. Every DB script prints `target LOCAL|REMOTE host/db` first,
refuses a non-local DB without `ALLOW_NON_LOCAL=1`, and prints counts, not customer data.

| Script | Dry run | Idempotent because | Tests |
|--------|---------|--------------------|-------|
| `packages/db/scripts/cutover-preflight.sql` | always read only (`BEGIN READ ONLY`) | n/a | run locally |
| `packages/db/scripts/cutover-migrate.sh` | `BEGIN; migration; ROLLBACK` per pending migration | column probes: applied ones are skipped, partial ones abort | `__tests__/cutover-migrate.test.ts` (scratch schema in local DB) |
| `packages/db/scripts/seed-comb-seats.ts --all` | counts creates/updates/retires/links, no writes | upsert by `(locationId, label)`; only changed rows written | `__tests__/seed-comb-seats.test.ts` |
| `packages/db/scripts/backfill-i18n.ts` | logs planned updates | writes only when the value differs; never overwrites English | `__tests__/backfill-i18n.test.ts` |
| `packages/db/scripts/cutover-credit-lots.ts` | counts, no writes | legacy: skip users with lots; pending: conditional `disbursedAt` claim in the grant transaction | `__tests__/cutover-credit-lots.test.ts` |
| `packages/db/scripts/backfill-mealgift-paidat.ts` | Stripe reads only, no writes | conditional `paidAt IS NULL` update; unique PaymentIntent binding | `__tests__/backfill-mealgift-paidat.test.ts` |
| `packages/db/scripts/scrub-chappy-secrets.ts` | counts only | a scrubbed row has nothing left to scrub | `__tests__/scrub-chappy-secrets.test.ts` |
| `packages/db/scripts/backfill-phone-e164.ts` | logs planned updates | already-E.164 rows are skipped | `__tests__/backfill-phone-e164.test.ts` |
| `packages/db/scripts/export-pod-qr.ts` | counts, no files | read only; same files each run | `__tests__/export-pod-qr.test.ts` |
| `packages/api/scripts/cutover-smoke.mjs` | always read only (+1 Chappy question) | n/a | `packages/api/src/cutover/__tests__/cutover.test.js` |
| `packages/api/scripts/notify-owner-release.mjs` | default; `--send` to send | send once, by hand | same |
