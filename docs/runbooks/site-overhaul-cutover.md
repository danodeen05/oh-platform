# Site overhaul, release 2: production cutover runbook

Owner: the controller session. Written by Task G3 (2026-09-28), revised in G3 fix round 1.
Every script here was rehearsed against the local `oh_overhaul` clone only; nothing in this
file has been run against production yet.

**Rules for the whole run**

- Run every step in order. Never skip a dry run. At the first surprise, stop and follow that
  step's **Abort** line.
- **Every database or env mutation is a script** that validates, supports `--dry-run`,
  prints counts, and exits non-zero before writing when something is wrong. Nothing in this
  file asks you to paste a mutating SQL statement.
- **Every shell block is one subshell with `set -euo pipefail`**: a failed check ends the
  block, and nothing after it in that block runs. Paste one block at a time and read its output
  before the next.
- Never print a secret. Values stay in variables or go through stdin; the scripts print host,
  database and counts only.
- Every DB script refuses a non-local `DATABASE_URL` unless `ALLOW_NON_LOCAL=1` is set **on
  that one command**. Never `export ALLOW_NON_LOCAL=1`.
- Prod has **no `_prisma_migrations` table**. Never run `prisma migrate` or `prisma db push`
  against prod.
- All commands run from the release checkout **root**. DB scripts run as
  `pnpm --filter @oh/db exec tsx scripts/<name>.ts` and API scripts as
  `pnpm --filter @oh/api exec node scripts/<name>.mjs`, so there is no `cd`.
- Keep every artifact in `$CUT` (below), never `/tmp`.

**Already in prod from release 1 (2026-09-27, f7c6cd2):** migration
`20260928000000_site_overhaul`, legacy balances as LEGACY lots (1 user),
`CHAPPY_GUEST_SECRET` on Railway, and the privacy hotfix (649ab65).

---

## 0. Preconditions (stop if any is false)

1. `site-overhaul` has every lane merged (D1 to D11, E1, E2, F1, F2) plus `origin/main`
   (at least 649ab65). G1 and G2 passed on that exact commit, and `pnpm --filter @oh/api test`
   and `pnpm --filter @oh/db test` are green on it.
2. The release commit is merged to `main` locally but **not pushed**. Pushing is step 7.
3. Local production builds pass on the release commit (prod-deploy-gotchas):
   ```bash
   ( set -euo pipefail
     pnpm install --frozen-lockfile
     pnpm --filter @oh/web build
     pnpm --filter @oh/admin build
     readlink -f apps/web/node_modules/next; readlink -f apps/admin/node_modules/next )
   ```
   Each app must resolve one `next`, the one beside `@clerk/nextjs`.
4. `prisma` is a **dependency** of `@oh/db` (else Railway fails with `spawn prisma EACCES`):
   ```bash
   node -e 'const p=require("./packages/db/package.json"); if(!p.dependencies.prisma||(p.devDependencies||{}).prisma){console.error("STOP: prisma must be in dependencies");process.exit(1)} console.log("ok: prisma", p.dependencies.prisma)'
   ```
   `@oh/db` now depends on `@oh/floor-plan`. Railway builds with RAILPACK (whole workspace),
   so that is fine. The repo Dockerfile path also installs cleanly (simulated in G3), because
   nothing the API loads imports floor-plan.
5. `pnpm --filter @oh/db exec prisma generate` has run on the release checkout.
6. Tools: `psql` 16+, `jq`, `railway` CLI 4.x (`export PATH="$HOME/.railway/bin:$PATH"`),
   and `VERCEL_TOKEN` exported from `.env`. The Railway CLI is linked to project oh-beef
   (production).

## 1. Session setup

Replace `<main checkout>` with the checkout that holds `.env.prod-bak`.

```bash
export CUT="$HOME/oh-cutover-release2"; mkdir -p "$CUT"
export PROD_DATABASE_URL="$(grep -E '^DATABASE_URL=' <main checkout>/.env.prod-bak | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//')"
export PROD_PSQL_URL="${PROD_DATABASE_URL%%\?*}"
export TEAM=team_lcuKROVnRGMXAYN6Q3x44DKh
export WEB_PROJECT=prj_ekz7Au2qhyHm4F6KnFTRGfukYeD0
export ADMIN_PROJECT="$(curl -s "https://api.vercel.com/v9/projects/admin?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.id // empty')"
export PATH="$HOME/.railway/bin:$PATH"
( set -euo pipefail
  case "$PROD_DATABASE_URL" in postgres*://*) echo "ok: prod DB url loaded (not printed)";; *) echo "STOP: no prod DB url"; exit 1;; esac
  case "$ADMIN_PROJECT" in prj_*) echo "ok: admin project $ADMIN_PROJECT";; *) echo "STOP: admin project id not resolved"; exit 1;; esac
  test -n "${VERCEL_TOKEN:-}" || { echo "STOP: VERCEL_TOKEN unset"; exit 1; }
  railway status )
```

## 2. Pre-flight (read only) and rollback anchors

### 2a. Pre-flight counts

`packages/db/scripts/cutover-preflight.sql` runs inside `BEGIN READ ONLY ... ROLLBACK`
(Postgres refuses any write) and only uses columns that exist before release 2.

```bash
psql "$PROD_PSQL_URL" -X -v ON_ERROR_STOP=1 -f packages/db/scripts/cutover-preflight.sql | tee "$CUT/preflight-before.txt"
```

| # | Section | What to check |
|---|---------|---------------|
| 1 | Locations | 2 live rows (City Creek, University Place, `isClosed = f`) plus closed duplicates of both. Note the **live** ids. If a live id is not `cmip6jbz700022nnnxxpmm5hf` (City Creek) / `cmip6jbza00042nnnf4nc0dvh` (University Place), pass `--location-id` in step 8. A closed row holding a slug is handled by `--release-closed-slugs` in step 8. |
| 2 | Kiosk devices | Release 1 found 0. An active device with no heartbeat may be keyless and lose member-QR check-in (step 12b). |
| 3 | Undisbursed PendingCredit | Paid as REFERRAL lots in 6a. `non_positive` rows are never paid: list them for the owner. |
| 4 | Legacy users without a lot / drift | Expect `legacy_users_without_lot = 0`. `drift_users > 0`: list for the owner; nothing fixes it automatically. |
| 5 | MealGift without paidAt | Handled by 6b (backfill, and the return of every funded gift that expired or lapsed unredeemed, including EXPIRED rows from before release 1). 0 means the first pass has nothing to do; 6b still runs its second pass. |
| 6 | Shop orders | `unpaid_with_savings` rows are safe (D10a). Record only. |
| 7 | Chappy secrets | Cleaned in 11a. |
| 8 | Phones not E.164 | Fixed in 11b. |
| 9 | Badge/Challenge i18n and emoji | Step 9 and step 14. |
| 10 | Release-2 columns | Expect 0 rows before step 5. |
| 11 | Live orders | Must be 0 before step 5. |

### 2b. Rollback anchors

```bash
( set -euo pipefail
  for P in "$WEB_PROJECT" "$ADMIN_PROJECT"; do
    curl -sf "https://api.vercel.com/v6/deployments?projectId=$P&teamId=$TEAM&target=production&state=READY&limit=1" \
      -H "Authorization: Bearer $VERCEL_TOKEN" | jq -er --arg p "$P" '.deployments[0] | "vercel \($p) \(.uid) \(.meta.githubCommitSha)"'
    curl -sf "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" \
      | jq -r --arg p "$P" '"ignore-step \($p) \(.commandForIgnoringBuildStep // "<none>")"'
  done
  git rev-parse origin/main | sed 's/^/origin-main-before /' ) | tee "$CUT/rollback-anchors.txt"
```
Add the ACTIVE Railway `@oh/api` deployment id to that file by hand (dashboard > @oh/api >
Deployments, or the Railway MCP `list-deployments` tool): it is the API rollback target.

## 3. Window and deadlines

- **Start after 21:00 Denver**, when both stores are closed. (A morning run must finish by
  10:30; do not start one after 07:00.)
- **Hard deadline 10:00 Denver.** If step 13 (smoke) has not passed by then, run the **Full
  abort** in step 16 so release 1 is whole by 10:30.
- Re-run pre-flight section 11 right before step 5: live orders must be 0.
- Old pod stickers are fine to open with: after step 8, scanning an old sticker says (in the
  guest's language) that the pod code is out of date and offers the kiosk or choosing a pod.
  New stickers are mailed to the owner in step 12.

## 4. Environment variables, Stripe webhook, cron (before the deploy)

All writes go through `packages/api/scripts/cutover-env.mjs`. It validates (non-empty, no
whitespace, and the known format: `whsec_...`, live Stripe key, 32+ char keys,
`https://host` with no trailing slash, `live|log|off`, 32-hex Twilio token, JSON object for
`CHAPPY_LIMITS_JSON`) and **exits non-zero before writing** otherwise. Railway writes pass the
value on stdin with `--skip-deploys` and read it back; Vercel writes are encrypted, production.
Values never appear in argv or output.

### 4a. What is set now (names only)

```bash
railway variable list --service "@oh/api" --json | jq -r 'keys[]' | sort > "$CUT/railway-vars.txt"
( for v in NODE_ENV WALLET_AUTH_SECRET TWILIO_AUTH_TOKEN API_PUBLIC_URL SUPPORT_NOTIFY RATE_LIMIT_MAX RATE_LIMIT_WINDOW ADMIN_API_KEY STRIPE_SECRET_KEY CHAPPY_GUEST_SECRET CHAPPY_LIMITS_JSON CHAPPY_MODEL \
           ADMIN_PHONE_NUMBER TWILIO_ACCOUNT_SID TWILIO_PHONE_NUMBER ANTHROPIC_API_KEY CRON_SECRET WEB_APP_URL PLAN_VISIT_SUMMARIES \
           CHAPPY_SMS_SKIP_SIGNATURE MS_TENANT_ID MS_CLIENT_ID MS_CLIENT_SECRET MS_SENDER_EMAIL OWNER_EMAIL PLAN_NOTIFY_EMAIL; do
    grep -qx "$v" "$CUT/railway-vars.txt" && echo "set      $v" || echo "MISSING  $v"; done )
```
(If `railway variable list --json` is not a flat `{KEY: value}` object on your CLI version,
stop: `cutover-env.mjs --from-railway` and the webhook script depend on that shape.)

**`NODE_ENV` must be `production`** (final review M3). It is not secret, so print it:
```bash
railway variable list --service "@oh/api" --json | jq -r '"NODE_ENV=" + (.NODE_ENV // "MISSING")'
```
- `NODE_ENV=production`: go on.
- Anything else, or `MISSING` (Nixpacks usually sets it in the image, but nothing in the repo
  guarantees it): first confirm `CRON_SECRET` and `WALLET_AUTH_SECRET` are `set` in the list above
  (production refuses to run without them), then pin it in 4b:
  `printf %s production | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=NODE_ENV --dry-run`,
  then the same without `--dry-run` (the validator accepts only `production`). Without it the
  admin guard's dev bypass, the dev CORS origins and the Twilio signature skip are all live.

### 4b. Railway `@oh/api`

Each write: dry run first (validates only), then the same command without `--dry-run`.

| Variable | Value | Why |
|----------|-------|-----|
| `API_PUBLIC_URL` | `https://api.ohbeef.com` | Twilio signs the exact URL it called. In the Twilio console, the Oh! number's Messaging webhook must be `https://api.ohbeef.com/chappy/sms`; fix the webhook if it is anything else. |
| `TWILIO_AUTH_TOKEN` | Twilio **account** auth token | Without it every inbound text gets 403. |
| `SUPPORT_NOTIFY` | `live` | Support cases and escalations text/email the owner. |
| `ADMIN_API_KEY` | keep if set; if MISSING use `--generate` | Server-to-server key; the web uses the same value (4c). G3b: the web's server-side calls also send it as `x-oh-server-key`, which skips the global per-IP limit (Vercel's egress IPs are shared), so it must be identical on both. |
| `CHAPPY_LIMITS_JSON`, `CHAPPY_MODEL` | only if the owner wants non-defaults | Defaults: 20 msgs/10 min, 200/day, 300k output tokens/day, 300 guest chats/IP/day; model `claude-opus-5`. |
| `CHAPPY_SMS_SKIP_SIGNATURE` | must be MISSING | (Ignored in production anyway.) |
| `PLAN_VISIT_SUMMARIES` | leave as prod has it | |
| `RATE_LIMIT_MAX` | `1500` (recommended; code default 600) | G3b: global limit per client IP per window. In-store guests share the store's public IP. Worst case at one store is about 450/min from 75 status pages polling every 10 s, plus kiosks (seats every 5 s), the kitchen and cleaning displays (about 55/min), menus and Chappy. 1500 leaves headroom and still stops a single abusive client. |
| `RATE_LIMIT_WINDOW` | leave unset (1 minute) | Milliseconds or a duration like `1 minute`. |

```bash
( set -euo pipefail
  printf %s "https://api.ohbeef.com" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=API_PUBLIC_URL --dry-run
  printf %s "live" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=SUPPORT_NOTIFY --dry-run
  printf %s "1500" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=RATE_LIMIT_MAX --dry-run )
( set -euo pipefail
  printf %s "https://api.ohbeef.com" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=API_PUBLIC_URL
  printf %s "live" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=SUPPORT_NOTIFY
  printf %s "1500" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=RATE_LIMIT_MAX )
# Twilio account auth token: paste at the prompt (not echoed), validated before any write.
( set -euo pipefail
  read -rs -p "Twilio account auth token: " V; echo
  printf %s "$V" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=TWILIO_AUTH_TOKEN --dry-run
  printf %s "$V" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=TWILIO_AUTH_TOKEN )
# Only if 4a said ADMIN_API_KEY is MISSING:
#   pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=railway --key=ADMIN_API_KEY --generate
```
**Abort:** a failed write leaves the variable as it was. Nothing else to undo.

### 4c. Vercel `webapp`: `ADMIN_API_KEY` and the Stripe webhook secret

```bash
( set -euo pipefail
  pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=vercel-web --key=ADMIN_API_KEY --from-railway=ADMIN_API_KEY --dry-run
  pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=vercel-web --key=ADMIN_API_KEY --from-railway=ADMIN_API_KEY )
```

`STRIPE_WEBHOOK_SECRET` is missing on Vercel today. `cutover-stripe-webhook.mjs` reads the live
key from Railway (it must be `sk_live_`/`rk_live_`), looks for the endpoint
`https://www.ohbeef.com/api/webhooks/stripe`, and when it creates one it writes the new `whsec_`
secret straight to Vercel (validated, never shown). Stripe reveals a secret only at creation, so
an existing endpoint whose secret nobody has is **replaced** with `--recreate`: new endpoint,
secret written to Vercel, and only then the old endpoint deleted (if the Vercel write fails, the
new endpoint is deleted again and the old one stays).

```bash
pnpm --filter @oh/api exec node scripts/cutover-stripe-webhook.mjs --dry-run
```
- `would-create`: run it without `--dry-run`.
- `exists we_...`: Vercel has no secret for it, so run `... --recreate --dry-run` (expect
  `would-recreate`), then `... --recreate`.
- Dashboard alternative (only if the owner wants to keep the endpoint id): Stripe dashboard >
  Developers > Webhooks > the endpoint > Roll secret, then capture it without echo:
  ```bash
  ( set -euo pipefail
    read -rs -p "whsec_ secret: " V; echo
    printf %s "$V" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=vercel-web --key=STRIPE_WEBHOOK_SECRET --dry-run
    printf %s "$V" | pnpm --filter @oh/api exec node scripts/cutover-env.mjs --target=vercel-web --key=STRIPE_WEBHOOK_SECRET )
  ```
Both variables take effect on the web build in step 10.

### 4d. The wallet cron (expiry, expiry warnings, quarterly perk, membership sweep, meal-gift returns)

Check for a Railway service that runs `packages/api/src/cron/wallet-cron.js` (dashboard, or
the Railway MCP `list-services` tool). If none, add one:

- New service from the same repo, name `wallet-cron`, same builder as `@oh/api`.
- **Cron schedule** `10 10 * * *` (UTC; 03:10 MST / 04:10 MDT).
- **Start command:** `sh -c 'cd packages/api && node src/cron/wallet-cron.js run expire-credits && node src/cron/wallet-cron.js run quarterly-perk && node src/cron/wallet-cron.js run membership-sweep && node src/cron/wallet-cron.js run expire-meal-gifts'`.
  `expire-meal-gifts` (final review I2) returns every funded meal gift not taken by 9pm to its
  giver as MEAL_GIFT store credit, with the claim and the credit in one transaction, so it is
  idempotent and returns each gift exactly once (also against `POST /meal-gifts/expire` and the
  6b backfill). Gifts lapse at 9pm Denver and are returned at the 03:10 run.
  If the service already exists, update its start command to this one.
  `run` exits non-zero when a job fails (fix round 1), so a failed run shows as failed in Railway.
- **Variables:** reference ALL of `@oh/api`'s variables rather than picking some (expiry
  warnings refresh wallet passes, which need `WALLET_AUTH_SECRET` and the APNS variables, and
  texts need the Twilio ones). In the Railway dashboard: `wallet-cron` > Variables >
  "Add a variable reference" for each `@oh/api` variable, or move them to Shared Variables and
  share them with both services. `NODE_ENV=production` and `CRON_SECRET` must be present (the
  module throws at import in production without `CRON_SECRET`).
- Do not use `wallet-cron.js service` mode: it checks the server clock (UTC on Railway) every
  minute with 5-minute windows, so each job can run up to 5 times per window.

Verify after its first run: the log shows `[CRON] expire-credits completed successfully` and
the other three (`quarterly-perk`, `membership-sweep`, `expire-meal-gifts`), and the run is green.

## 5. Migrations (additive only)

| Migration | SQL | Additive? |
|-----------|-----|-----------|
| `20260929000000_comb_seats` | `ALTER TABLE "Seat" ADD COLUMN "bestRank" INTEGER` | yes, nullable |
| `20260930000000_support_resolution` | `ALTER TABLE "SupportCase" ADD COLUMN "resolutionDetail" JSONB, ADD COLUMN "resolutionNote" TEXT` | yes, nullable |
| `20261001000000_chappy_cart` | `ALTER TABLE "ChappyConversation" ADD COLUMN "cart" JSONB` | yes, nullable |

`cutover-migrate.sh` probes each migration's columns (all present = skip, none = apply in one
transaction, partial = stop). It refuses a missing release-1 baseline, and it refuses any newer
migration folder it has no probe for.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" packages/db/scripts/cutover-migrate.sh --dry-run
```
Expect `target REMOTE ...`, then three `pending` lines and three `applies cleanly (rolled back)` lines. Then:
```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" packages/db/scripts/cutover-migrate.sh
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" packages/db/scripts/cutover-migrate.sh --dry-run   # 3x "already applied, skip", "nothing to apply"
```
**Abort:** a failed migration names itself and rolls back its own transaction. Earlier ones stay
applied, which is harmless because release 1 ignores the new columns. Stop the cutover there;
nothing else has changed.

## 6. Data scripts that do not need the new code

### 6a. Credit lots: `cutover-credit-lots.ts`

Runs `convertLegacyBalances` (expect 0), then pays every undisbursed `PendingCredit` as a
REFERRAL lot. Each payment is one transaction with a conditional claim, so no row is ever paid
twice. It also prints a read-only drift count.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/cutover-credit-lots.ts --dry-run
```
Check that `pendingPaid`/`pendingPaidCents` match pre-flight 3 (minus `non_positive`), and that
`legacyUsers` and `driftUsers` match pre-flight 4. Run it for real, then dry-run again: expect
`legacyUsers 0` and `pendingPaid 0`.
**Abort:** stopping here is safe. The lots are real member credit on the same ledger release 1
uses, so leave them.

### 6b. Meal gifts: `backfill-mealgift-paidat.ts` (always run: the second pass covers post-release-1 gifts)

For each pre-release-1 gift without `paidAt`, funding is proven first:
- The card part must match exactly one succeeded, unrefunded live PaymentIntent with the old
  metadata. That PaymentIntent must be for the gift's giver and location, for the right amount,
  created from 60 min before to 5 min after the gift, and not already bound to another gift.
- The credit part is the old `CREDIT_APPLIED` debit logged for that gift.
- A gift paid entirely by credit counts as funded.

Then:
- **Every funded gift that expired or lapsed unredeemed** is returned to its giver (fix round 2
  ruling). That covers every EXPIRED pre-release-1 gift, whenever it expired: the new expiry code
  skipped the refund because `paidAt` was null, and the OLD code's "refund" wrote a nonexistent
  `creditBalanceCents` field, so no giver was ever credited. It also covers gifts still PENDING
  past `expiresAt`. The full amount goes back as a MEAL_GIFT store-credit lot, the
  same return as `POST /meal-gifts/expire`, so a credit-funded gift returns the credit that
  funded it. A conditional claim (`paidAt IS NULL`) in the same transaction returns each gift
  exactly once, even if the expire endpoint runs at the same time.
- Other funded gifts (ACCEPTED) get `paidAt` and the PaymentIntent binding only.
- A second pass returns gifts that are already funded (`paidAt` set, created after release 1)
  but still PENDING past expiry, because nothing ran the expire endpoint. It uses the endpoint's
  own claim (`status PENDING -> EXPIRED`) in the same transaction as the credit, so the script and
  `POST /meal-gifts/expire` can never both return one.

Stripe calls are reads. The script refuses a test key against a remote DB.

```bash
( set -euo pipefail
  SK="$(railway variable list --service "@oh/api" --json | jq -r '.STRIPE_SECRET_KEY // empty')"
  case "$SK" in sk_live_*|rk_live_*) ;; *) echo "STOP: no live Stripe key"; exit 1;; esac
  ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" STRIPE_SECRET_KEY="$SK" pnpm --filter @oh/db exec tsx scripts/backfill-mealgift-paidat.ts --dry-run )
```
Read `returned`/`returnedCents` (store credit going back to givers; `lapsedFundedReturned` is
the second pass), `applied`, and `unverified`/`ambiguous`/`unverifiedExpired` (never written;
list them for the owner, since an expired gift whose payment can't be proven is not returned
automatically). Run the same block without `--dry-run`, then dry-run again: expect `returned 0`
and `applied 0`. Put `returned` and `returnedCents` in the owner notes.
**Abort:** leave what is written. Every write is a proven payment.

### 6c. Dietary safety: `fix-no-beef-vegan-flag.ts` (F1 SAFETY RULING, final review I3)

"Classic Beef Noodle Soup (no beef)" (`cmip6jbzc000a2nnnewnr00lb`) is made with beef-bone
broth but is flagged vegan in prod. The new menu's dietary marks and Chappy (its menu tool's
`dietary` field and dietary filter) both read `MenuItem.isVegan`/`isVegetarian` from that row,
so this must land before the web deploy (step 10). The script sets both flags to false on that
one row, matched by id AND name: it refuses (non-zero, nothing written) if the id is missing or
the name differs.
```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/fix-no-beef-vegan-flag.ts --dry-run
```
Expect `"action":"would-fix"` with `before` showing `isVegan: true` (or `already-correct`, then
skip). Run it without `--dry-run` (expect `fixed`), then dry-run again: expect `already-correct`.
Put "the no-beef soup is no longer marked vegan or vegetarian (beef-bone broth)" in the owner notes.
**Abort:** a refusal means the row changed since the review. Stop and ask the owner which row
it is now; do not deploy the web until the flag is right. Undo, only if the owner says so: the
owner re-flags it in admin.

## 7. Deploy the API (Railway) with Vercel held

A push to `main` makes Railway **and** Vercel build. Hold Vercel so the API goes first.

```bash
( set -euo pipefail
  for P in "$WEB_PROJECT" "$ADMIN_PROJECT"; do
    curl -sf -X PATCH "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" -d '{"commandForIgnoringBuildStep":"exit 0"}' | jq -er '"held \(.name): \(.commandForIgnoringBuildStep)"'
  done
  git push origin main )
```
Wait for the Railway `@oh/api` deployment to be SUCCESS, then prove the NEW code answers.
Release-1's Prisma client does not know `bestRank`, so its seat rows never carry it.
```bash
( set -euo pipefail
  curl -sf https://api.ohbeef.com/health | jq -e '.ok == true'
  LOC=$(curl -sf https://api.ohbeef.com/locations -H 'x-tenant-slug: oh' | jq -er '[.[] | select((.stats.totalSeats // 0) > 0)][0].id')
  curl -sf "https://api.ohbeef.com/locations/$LOC/seats" -H 'x-tenant-slug: oh' | jq -e 'type == "object" and (.seats | length > 0) and (.seats[0] | has("bestRank"))' )
```
**Abort (build fails, or the check fails):** the old API keeps or regains traffic. Redeploy the
anchored Railway deployment if the new one went live, release the Vercel hold (step 16c), and
stop. No seats have changed yet.

## 8. Seed the comb seats, then verify

`seed-comb-seats` resolves locations **by slug**, falling back to the known live id (or
`--location-id=<slug>=<id>` from pre-flight 1). It refuses closed rows. With
`--release-closed-slugs`, a closed duplicate holding a slug gives it up first (only closed rows
are touched). Every location resolves before anything is written.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/seed-comb-seats.ts --all --release-closed-slugs --dry-run
# add --location-id=city-creek=<live id> --location-id=university-place=<live id> only if pre-flight 1 showed other live ids
```
Check each line names the LIVE id, `via known-id` (or `override`), and `location fields to change [slug, layoutKey, podCount]` (plus `layoutMirror` for University Place). Expect: City Creek `created 75`, University Place `created 70`, `updated 0`, `retired` equal to the legacy active seats from pre-flight 1 (likely 12), and `duo links 10` at each. Then:
```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/seed-comb-seats.ts --all --release-closed-slugs | tee "$CUT/seed-comb-seats.txt"
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/seed-comb-seats.ts --all --dry-run   # via slug, unchanged, all zeros
```
The `retiredAt` in `$CUT/seed-comb-seats.txt` is the seat rollback key. The seed is not one
transaction; a crashed run is safe to re-run (it converges), or roll back with 16a.

Verify with the live API. Take one old sticker code from the legacy seats (`qrCode` of a
retired seat) and check that it answers `retired`, not an error:
```bash
( set -euo pipefail
  for S in city-creek university-place; do
    ID=$(curl -sf https://api.ohbeef.com/locations -H 'x-tenant-slug: oh' | jq -er --arg s "$S" '.[] | select(.slug==$s) | .id')
    curl -sf "https://api.ohbeef.com/locations/$ID/seats" -H 'x-tenant-slug: oh' | jq -er --arg s "$S" '"\($s) active pods: \(.seats|length)"'
  done
  OLD=$(psql "$PROD_PSQL_URL" -X -q -t -A -c "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY" \
        -c "SELECT \"qrCode\" FROM \"Seat\" s JOIN \"Location\" l ON l.id = s.\"locationId\" WHERE l.slug = 'city-creek' AND s.\"retiredAt\" IS NOT NULL LIMIT 1" | head -1)
  test -n "$OLD" || { echo "STOP: no retired seat found"; exit 1; }
  curl -sf "https://api.ohbeef.com/pods/info?qrCode=$OLD" -H 'x-tenant-slug: oh' | jq -e '.retired == true and .code == "POD_RETIRED"' )
```
Expect `city-creek active pods: 75`, `university-place active pods: 70`, `true`.
**Abort:** run 16a (seat rollback), then 16b (API rollback), then 16c (release Vercel).

## 9. Translations: `backfill-i18n.ts` (without `--clear-emoji`)

This updates `i18n`, `iconKey` and slider `labelsI18n` on existing rows. Locations are matched by
slug, so this step must run after step 8. It never creates rows and never overwrites English: a
row whose English differs from the seed prints `SKIP ... prod text differs` and is left untouched.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/backfill-i18n.ts --dry-run | tee "$CUT/i18n-dry.txt"
```
Review every SKIP. A SKIP is correct when the owner renamed that row in admin: the row stays
English-only in other locales until someone translates it by hand. List each SKIP in the owner
notes. Then run it for real, then dry-run again (expect `Would update: 0 ...`).
**Abort:** not an abort trigger. The API still serves English for untranslated rows.

## 10. Deploy the web and admin (Vercel)

Release the hold, then build `main` for production:
```bash
( set -euo pipefail
  for P in "$WEB_PROJECT" "$ADMIN_PROJECT"; do
    curl -sf -X PATCH "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" -d '{"commandForIgnoringBuildStep":null}' | jq -er '"released \(.name)"'
    PROJ=$(curl -sf "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN")
    jq -n --arg n "$(jq -r .name <<<"$PROJ")" --arg r "$(jq -r .link.repoId <<<"$PROJ")" \
      '{name:$n, project:$n, target:"production", gitSource:{type:"github", repoId:$r, ref:"main"}}' |
      curl -sf -X POST "https://api.vercel.com/v13/deployments?teamId=$TEAM&forceNew=1" -H "Authorization: Bearer $VERCEL_TOKEN" \
        -H "Content-Type: application/json" -d @- | jq -er '"\(.name) \(.id) \(.readyState)"'
  done )
```
(If `2b` recorded an ignore step other than `<none>`, PATCH that string back instead of `null`.
Dashboard fallback: Deployments > the skipped `main` deployment > Redeploy.)
Wait until both are READY and aliased to production.
**Abort (a build fails, or the web is broken):** 16d (promote the old web and admin if the new
one was promoted), then 16a (seat rollback), then 16b (API rollback).

## 11. Data scripts that need the new code

### 11a. `scrub-chappy-secrets.ts`

This scrubs Stripe client secrets out of stored Chappy messages and carts. It also deactivates
every conversation last updated before `--cutover` (default: now), so returning customers start
fresh on the new agent. `updatedAt` is kept.
```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/scrub-chappy-secrets.ts --dry-run
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/scrub-chappy-secrets.ts
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/scrub-chappy-secrets.ts --dry-run   # messagesScrubbed 0, cartsScrubbed 0
```

### 11b. `backfill-phone-e164.ts`

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/backfill-phone-e164.ts --dry-run
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/backfill-phone-e164.ts
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/backfill-phone-e164.ts --dry-run   # 0 would be updated
```
List `conflicts` and `unparseable` counts for the owner (manual review).
**Abort (either):** not an abort trigger. Both are correct for any version of the code.

## 12. Pods and kiosks

### 12a. New pod QR codes, mailed to the owner

`export-pod-qr.ts` is read only on the DB. It writes one SVG per live pod
(`https://www.ohbeef.com/pod?qr=<Seat.qrCode>`), a print sheet per location, and a
self-contained print sheet per location. With `--email`, it mails the two self-contained sheets
to the owner through the Microsoft Graph mailer, with a "replace the pod stickers" note. The
mailer credentials come only from the `MS_*` keys of `--mail-env-file` (the local `.env` of the
main checkout); nothing else in that file is read.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/export-pod-qr.ts --dry-run   # {"city-creek":75,"university-place":70}
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/export-pod-qr.ts \
  --out="$CUT/pod-qr" --email=dano@ohbeef.com --mail-env-file=<main checkout>/.env
```
Expect `mailed 2 print sheets to dano@ohbeef.com`. Scan one code per location with a phone: it
must open the pod page for that label. Stores can open with the old stickers (step 3).

### 12b. Kiosk keys

After release 2 (A10b) a kiosk authenticates with its `KioskDevice.apiKey` (stored on the tablet
as `oh_kiosk_api_key`), and a tablet without it loses member-QR check-in. Release 1 found 0
devices. If pre-flight 2 shows any, confirm with the owner that each tablet heartbeats
(`lastHeartbeat` is recent while it is on), and re-pair any that do not.

## 13. Smoke test (prod)

```bash
pnpm --filter @oh/api exec node scripts/cutover-smoke.mjs --api=https://api.ohbeef.com --web=https://www.ohbeef.com | tee "$CUT/smoke.txt"
```
Everything is read only except one Chappy guest question (one model call, no money) and two
refused webhook probes:
1. API `/health`.
2. `/membership/program` shows 10+2 and then 25+5, with no goodwill caps exposed.
3. `city-creek` has 75 active pods and `university-place` has 70.
4. `/orders/status?orderQrCode=DEMO-PLAN` returns 200.
5. `/en` and `/zh-TW`: home, `/rewards` and `/menu` return 200.
6. `/zh-TW/privacy` returns 200.
7. The plan demo embed returns 200.
8. Signed-out `/en/member` returns 200.
9. `/en/loyalty` redirects to `/en/rewards` with a 308.
10. `/en/tenants` returns 404.
11. The Stripe webhook with a bad signature returns **400**. A 500 means `STRIPE_WEBHOOK_SECRET` is missing.
12. `/chappy/sms` unsigned returns **403**.
13. The Chappy guest token works, and one guest question streams `text` and `done`.

Expect `18 passed, 0 failed` (exit 0). Then check by hand on a phone: the shell and dock render,
Chappy answers, the floor plan loads (plan code), the admin console and its Support tab open,
and an old sticker's `/pod?qr=` shows the out-of-date notice.
Also check once in the Railway logs that `req.ip` on API requests is the visitor's IP, not a
Vercel or Railway proxy address. The global per-IP limit (`RATE_LIMIT_MAX`, G3b) depends on
`trustProxy: 1` matching prod's hop count. Also check that no 429s show for Vercel IPs: the
web's server-side calls must carry `x-oh-server-key`, which needs the same `ADMIN_API_KEY` on
Railway and Vercel (4b, 4c). Report what you see to the owner.
**Abort trigger (final review M11):** if `req.ip` is a proxy address (the same few IPs for
every visitor), every client shares one rate-limit bucket and the site starts answering 429
under normal traffic. Treat that as a failed smoke: follow 16e, and fix `trustProxy` in
`packages/api/src/http-config.js` before the next attempt.

**Money paths are not charged in prod.** A $0 check only if a real unredeemed FREE_BOWL reward
already exists on the owner's own account (never create one for the test).

**Abort (a failed check that is not cosmetic):** run the Full abort (16e).

## 14. Clear the badge/challenge emoji (after smoke passed)

A real `--clear-emoji` requires `--emoji-backup=<new file>`. The script writes the backup first
and refuses to overwrite an existing file.
```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/backfill-i18n.ts --dry-run --clear-emoji
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/backfill-i18n.ts --clear-emoji --emoji-backup="$CUT/emoji-backup.json"
```
Rows on the SKIP list keep their emoji.

## 15. Tell the owner (last, once)

Only when steps 1 to 14 are done and verified. The script reads the Twilio variables and
`ADMIN_PHONE_NUMBER` from Railway into its own process (never printed), and honors
`SUPPORT_NOTIFY`.
```bash
pnpm --filter @oh/api exec node scripts/notify-owner-release.mjs --from-railway          # dry run: masked number + text
pnpm --filter @oh/api exec node scripts/notify-owner-release.mjs --from-railway --send   # once
```
Text: "Oh! site release is live in prod and ready for your review." Do not re-run `--send`.
Include in the owner notes:
- the SKIP list (9);
- the meal-gift `returned` count and `returnedCents`, plus the unverified counts (6b);
- the no-beef soup is no longer marked vegan or vegetarian: it uses beef-bone broth (6c);
- lapsed meal gifts now go back to givers as store credit every night at 03:10 (4d);
- the credit drift and non-positive PendingCredit counts (6a);
- the phone conflicts (11b);
- that the new pod stickers were mailed (12a);
- the `req.ip` observation (13).

## 16. Rollback and abort procedures

### 16a. Seat rollback: `seat-rollback-release1.ts`

This restores release 1's pod view in ONE transaction:
- The pre-comb seats are un-retired. With `--retired-at`, only those retired by the step-8 run.
- Comb pods no order or pod call references are deleted. `seed-comb-seats` recreates them with
  the same labels and QR codes.
- Comb pods with history are retired as `CLEANING`, so release 1, which lists every row, never
  offers them.
- The plan is printed before any write. The result is checked inside the transaction (0 active
  comb pods, the legacy pods active); a failed check rolls everything back.
- The script refuses while an unfinished order sits on a comb pod.

```bash
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/seat-rollback-release1.ts --dry-run --retired-at=<retiredAt from $CUT/seed-comb-seats.txt>
ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/seat-rollback-release1.ts --retired-at=<same>
```
Expect `legacyRevived 12` (or the legacy count), `combDeleted + combRetired = 75 / 70`, and
`combActiveAfter 0`. To go forward again later, run step 8.

### 16b. API rollback

Railway dashboard > `@oh/api` > Deployments > the anchored deployment > Rollback (or the Railway
MCP `redeploy` of that deployment). Railway rebuilds from `main` on the next push that touches
`packages/api/**` or `packages/db/**`, so revert `main` to `origin-main-before`
(`$CUT/rollback-anchors.txt`) with a revert commit before pushing anything else.

### 16c. Release the Vercel hold without deploying

```bash
( set -euo pipefail
  for P in "$WEB_PROJECT" "$ADMIN_PROJECT"; do
    curl -sf -X PATCH "https://api.vercel.com/v9/projects/$P?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" -d '{"commandForIgnoringBuildStep":null}' | jq -er '"released \(.name)"'
  done )
```
Production stays on the anchored deployments, since the skipped builds were never promoted.

### 16d. Web/admin rollback

```bash
( set -euo pipefail
  WEB_OLD=<web deployment uid from $CUT/rollback-anchors.txt>; ADMIN_OLD=<admin deployment uid>
  curl -sf -X POST "https://api.vercel.com/v10/projects/$WEB_PROJECT/promote/$WEB_OLD?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN"
  curl -sf -X POST "https://api.vercel.com/v10/projects/$ADMIN_PROJECT/promote/$ADMIN_OLD?teamId=$TEAM" -H "Authorization: Bearer $VERCEL_TOKEN"
  echo promoted )
```
Dashboard fallback: Deployments > the old one > Promote to Production (Instant Rollback).

### 16e. Full abort (any failure after step 8, or the 10:00 deadline)

In order: 16d (if the new web or admin was promoted), 16a, 16b, then 16c (if the Vercel hold
is still on). Then re-run pre-flight: section 1 must show the legacy seats active again.

### What is never rolled back, and why

- **Migrations:** nullable columns that release 1 ignores. Leave them; there is no drop script on purpose.
- **Credit lots (6a) and meal-gift returns (6b):** real member credit on the ledger release 1 uses.
- **paidAt, E.164 phones, the Chappy scrub, i18n:** correct for any version.
- **Env vars:** release 1 ignores the new ones.
- **Emoji (only after 14):** restore from the backup if the old web comes back. The restore only
  fills still-empty emoji, in one transaction, and prints counts first:
  ```bash
  ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/emoji-backup.ts --from="$CUT/emoji-backup.json" --dry-run
  ALLOW_NON_LOCAL=1 DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @oh/db exec tsx scripts/emoji-backup.ts --from="$CUT/emoji-backup.json"
  ```

---

## Appendix: script reference

Every DB script prints `target LOCAL|REMOTE host/db` first, refuses a non-local DB without
`ALLOW_NON_LOCAL=1`, and prints counts, not customer data.

| Script | Dry run | Idempotent because | Tests |
|--------|---------|--------------------|-------|
| `packages/db/scripts/cutover-preflight.sql` | always read only | n/a | run locally |
| `packages/db/scripts/cutover-migrate.sh` | `BEGIN; file; ROLLBACK` per pending migration | column probes; partial aborts | `cutover-migrate.test.ts` (scratch schema) |
| `packages/db/scripts/cutover-credit-lots.ts` | counts only | conditional `disbursedAt` claim in the grant transaction | `cutover-credit-lots.test.ts` |
| `packages/db/scripts/backfill-mealgift-paidat.ts` | Stripe reads only | conditional `paidAt IS NULL` claim; the return's credit grant commits with it | `backfill-mealgift-paidat.test.ts` |
| `packages/db/scripts/fix-no-beef-vegan-flag.ts` | reports would-fix / already-correct | conditional update on id + name; a re-run is already-correct | `fix-no-beef-vegan-flag.test.ts` |
| `packages/db/scripts/seed-comb-seats.ts --all` | counts creates/updates/retires/links | upsert by label; only changed rows written | `seed-comb-seats.test.ts` |
| `packages/db/scripts/seat-rollback-release1.ts` | plan only | a second run finds nothing to change | `seat-rollback-release1.test.ts` |
| `packages/db/scripts/backfill-i18n.ts` (+ `--clear-emoji --emoji-backup`) | logs planned updates | writes only differing values; backup never overwritten | `backfill-i18n.test.ts`, `emoji-backup.test.ts` |
| `packages/db/scripts/emoji-backup.ts --from` | plan only | fills only still-empty emoji | `emoji-backup.test.ts` |
| `packages/db/scripts/scrub-chappy-secrets.ts` | counts only | nothing left to scrub | `scrub-chappy-secrets.test.ts` |
| `packages/db/scripts/backfill-phone-e164.ts` | logs planned updates | E.164 rows skipped | `backfill-phone-e164.test.ts` |
| `packages/db/scripts/export-pod-qr.ts` | counts, no files, no mail | read only | `export-pod-qr.test.ts` |
| `packages/api/scripts/cutover-env.mjs` | validates only | upsert; Railway read-back | `src/cutover/__tests__/env-writes.test.js` |
| `packages/api/scripts/cutover-stripe-webhook.mjs` | reports exists / would-create | existing endpoint kept unless `--recreate` | `env-writes.test.js` |
| `packages/api/scripts/cutover-smoke.mjs` | always read only (+1 Chappy question) | n/a | `src/cutover/__tests__/cutover.test.js` |
| `packages/api/scripts/notify-owner-release.mjs` | default; `--send` sends | run once by hand | `cutover.test.js` |
