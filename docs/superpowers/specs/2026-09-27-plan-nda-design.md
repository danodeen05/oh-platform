# Plan NDA Signing Gate: Spec + Implementation Plan

> For agentic workers: executed natively (superpowers:executing-plans) with TDD per task and a final fresh-reviewer pass (superpowers:requesting-code-review). Owner approved execution with full authority on 2026-09-27 ("fully test in dev (passing all gates) before committing and pushing to prod; then test prod; use my phone number; email me a Chappy-voiced report").

On exit from plan mode, this file is copied to `docs/superpowers/specs/2026-09-27-plan-nda-design.md` (Part 1) and `docs/superpowers/plans/2026-09-27-plan-nda.md` (Part 2).

---

# Part 1: Spec (approved in brainstorming, sections 1-4)

## Context
The owner sends each prospective investor, partner or landlord a personal plan code. They want the recipient to sign a styled, in-app NDA (not DocuSign) before seeing any part of the business plan, with the fully executed PDF stored, emailed by Chappy from service@, confirmed by text, and then land on the Summary page.

## Decisions (owner)
- Per-code `ndaRequired`, admin modal checkbox default ON. Existing codes default OFF (migration default false).
- One-way (unilateral) NDA. Company: Oh! Beef Noodle Soup, LLC, Utah entity #14642519-0160, 379 W 3175 N, Lehi, UT 84043.
- Auto-countersign: owner adopts name, title and signature once in admin; applied at signing, so the PDF is fully executed instantly.
- Mobile verified by 6-digit SMS code before signing.
- On signing: signer gets Chappy email (from service@ohbeefnoodlesoup.com, reply-to owner) with PDF attached plus a thank-you text; owner gets an email copy (PDF) and a text "X just signed the NDA".
- PDF approach A: one versioned NDA text in the web app, rendered online as HTML and server-side to PDF with @react-pdf/renderer; the API encrypts, stores, emails, texts.
- English-only NDA (one controlling language).
- Needs a Utah attorney's review before real use (stated in admin and report).

## Flow
1. `/plan?c=CODE` → gate → `/plan/auth` (unchanged except it returns nda state).
2. Enforcement: `/plan/sessions/:sid/status` returns `{active, nda: none|pending|signed, contactOnFile}`. Web `getPlanAccess()` maps to `ok|nda|none`; `getPlanSession()` returns claims only when `ok`, so every existing content consumer is blocked while pending. Gated and print layouts redirect `nda` to `/[locale]/plan/nda`. API content routes (heartbeat, questions, chat/*, event) return 403 `nda_required` while pending.
3. `/[locale]/plan/nda`: steps Details → Verify (SMS code, 10 min, 5 attempts, 60 s resend cooldown, 8 sends max) → Read and sign (consent + agree checkboxes, typed or drawn signature) → Done (download, auto-redirect to `/[locale]/plan` after ~3 s). Server-side draft, so nothing is asked twice; returning signed viewers skip to the plan.
4. Sign: web BFF fetches draft (decrypted details + countersigner), fixes `signedAt`, builds the document, hashes it (SHA-256 of canonical text), renders PDF (cover, key terms, clauses, signature page, certificate of completion), then one API call stores everything atomically (`updateMany where status DRAFT`), and deliveries run after (only the winner of the transition delivers).
5. "Never ask twice": questions route falls back to the NDA email for `contactEmail`; Chappy's prompt is told the email is on file.

## Data
- `PlanAccessCode.ndaRequired Boolean @default(false)`; relation `ndas PlanNda[]`.
- `PlanNda` (status DRAFT/SIGNED/VOIDED, version, encrypted PII: legal name, email, phone, address JSON, company, title, signer IP, signature image; OTP hash/expiry/attempts/sentAt/sendCount; phoneVerifiedAt, consentAt, signedAt, userAgent, documentSha256, pdfEnc Bytes, pdfSha256, countersigner name/title snapshot, emailedAt, textedAt, ownerNotifiedAt, deliveryError, voidedAt).
- `PlanNdaCountersigner` singleton (`id "default"`, name, title, signature PNG data URL).
- AES-256-GCM via `PLAN_PII_KEY` (32 bytes base64), API only. Missing key → NDA routes 503.
- Raw signer IP is stored (encrypted) for the audit trail; everything else keeps the hash-only rule.

## NDA content
Cover "Key Terms" ledger (Company, Recipient, Purpose, Effective date, Confidentiality 3 years after last access / trade secrets while secret, Non-solicit 12 months, Non-circumvention 18 months, Utah law, Utah County state courts or D. Utah) then ~22 plain-English clauses: definition (Oh!-specific categories, no figures or site names), exclusions, use limits (no screenshots/recording/scraping/code sharing/AI tools/reverse engineering/competing use), representatives, compelled disclosure, government-reporting carve-out + DTSA 1833(b) notice, term, return/destruction, no license, feedback, non-solicit, non-circumvention, no residuals, no obligation, no warranty/forward-looking, not a securities offer, remedies (injunction, fees, 48-hour breach notice), Utah law/venue, boilerplate, electronic signatures (ESIGN, Utah UETA 46-4). Signature page (two blocks) and a certificate page (document ID, version, hash, timeline in America/Denver and UTC, IP, user agent). No em dashes anywhere.

## Visual
Online: charcoal page, cream paper sheet, logo mark head and faint watermark, Instrument Serif headings, Raleway body, gold hairlines, ember margin numerals, key-terms ledger, step rail, prints cleanly via `print:` utilities. PDF: Letter, cream-paper cover with large mark and "Prepared for", small mark header and "Oh! Beef Noodle Soup, LLC · Confidential · Page X of Y" footer, certificate last.

## Copy (approved)
- Code text: "Oh! Beef Noodle Soup: {code} is your code to sign the NDA. It expires in 10 minutes."
- Signer email subject "Your signed NDA with Oh! Beef Noodle Soup", Chappy body as approved.
- Signer text: "Oh! Beef Noodle Soup: Thanks for signing, {first}, and for your interest in Oh!. We received your NDA, and your fully executed copy is in your inbox at {masked}. Enjoy the plan. Chappy" ("is on its way to" when the email failed).
- Owner text: "Chappy: {label} just signed the NDA as {legalName}. PDF's in your inbox. {adminUrl}"; owner email "NDA signed: {legalName} ({label})".

---

