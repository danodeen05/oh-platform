"use client";

/**
 * The NDA signing flow: details, then a texted code, then read and sign.
 * Every step saves on the server, so a reload (or coming back tomorrow)
 * resumes where the signer left off and nothing is ever asked twice.
 * The document on the right fills in live from the same builder the PDF uses.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { buildNdaDocument, type NdaRecipient } from "@/lib/plan/nda/document";
import { ATTORNEY_NOTE, CONSENT_ELECTRONIC, CONSENT_TERMS } from "@/lib/plan/nda/content";
import type { NdaState, NdaStep } from "@/lib/plan/nda/types";
import { startingIdentity } from "@/lib/plan/nda/prefill";
import { NdaDocument } from "./NdaDocument";
import { SignaturePad, type SignatureValue } from "./SignaturePad";

interface Props {
  locale: string;
  initial: NdaState;
  signatureFontFamily: string;
}

interface Form {
  legalName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  onBehalf: boolean;
  company: string;
  title: string;
}

const FIELD_ERRORS: Record<string, string> = {
  legalName: "Please enter your full legal name.",
  email: "That email doesn't look right.",
  phone: "Please enter a mobile number we can text, like (801) 555-0123, or +44 for outside the US.",
  "address.line1": "Street address, please.",
  "address.city": "City, please.",
  "address.region": "State or province, please.",
  "address.postalCode": "ZIP or postal code, please.",
};

function formFrom(d: NdaRecipient | null): Form {
  return {
    legalName: d?.legalName ?? "",
    email: d?.email ?? "",
    phone: d?.phone ?? "",
    line1: d?.address.line1 ?? "",
    line2: d?.address.line2 ?? "",
    city: d?.address.city ?? "",
    region: d?.address.region ?? "",
    postalCode: d?.address.postalCode ?? "",
    country: d?.address.country ?? "United States",
    onBehalf: Boolean(d?.company),
    company: d?.company ?? "",
    title: d?.title ?? "",
  };
}

function recipientFrom(f: Form): NdaRecipient {
  return {
    legalName: f.legalName.trim(),
    email: f.email.trim(),
    phone: f.phone.trim(),
    address: { line1: f.line1.trim(), line2: f.line2.trim(), city: f.city.trim(), region: f.region.trim(), postalCode: f.postalCode.trim(), country: f.country.trim() || "United States" },
    company: f.onBehalf ? f.company.trim() : "",
    title: f.onBehalf ? f.title.trim() : "",
  };
}

async function post<T>(url: string, body: unknown): Promise<{ status: number; data: T | null }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

const inputClass =
  "w-full rounded-lg border border-oh-stone bg-oh-charcoal px-3 py-2.5 text-base text-oh-cream placeholder:text-oh-ash/70 focus:border-oh-ember focus:bg-oh-charcoal focus:text-oh-cream focus:outline-none";
const labelClass = "mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-oh-mute";
const primaryButton =
  "inline-flex w-full items-center justify-center rounded-lg bg-oh-ember-deep px-5 py-3 text-[0.95rem] font-semibold tracking-wide text-oh-cream transition-colors hover:bg-oh-ember focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-gold disabled:cursor-not-allowed disabled:opacity-50";
const linkButton = "bg-transparent p-0 text-[0.85rem] text-oh-gold underline decoration-oh-gold/40 underline-offset-4 hover:text-oh-cream";

const STEPS: { key: Exclude<NdaStep, "done">; label: string }[] = [
  { key: "details", label: "Your details" },
  { key: "verify", label: "Verify your mobile" },
  { key: "sign", label: "Read and sign" },
];

export function NdaFlow({ locale, initial, signatureFontFamily }: Props) {
  const [state, setState] = useState<NdaState>(initial);
  const [step, setStep] = useState<NdaStep>(initial.step);
  // Prefilled from the invitation when they haven't saved details yet; all editable.
  const [form, setForm] = useState<Form>(() => ({ ...formFrom(initial.details), ...startingIdentity(initial) }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(Boolean(initial.otpSentAt));
  const [resendIn, setResendIn] = useState(() => {
    const sent = initial.otpSentAt ? Date.parse(initial.otpSentAt) : 0;
    return sent ? Math.max(0, 60 - Math.floor((Date.now() - sent) / 1000)) : 0;
  });
  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [consentE, setConsentE] = useState(false);
  const [consentT, setConsentT] = useState(false);
  const [redirectIn, setRedirectIn] = useState(4);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = k === "onBehalf" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
  };

  // The document fills in as they type (details step) or from what was saved.
  const liveRecipient = step === "details" ? recipientFrom(form) : state.details;
  const doc = buildNdaDocument({ recipient: liveRecipient && liveRecipient.legalName ? liveRecipient : null, effectiveDate: new Date() });

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step !== "done") return;
    if (redirectIn <= 0) {
      window.location.assign(`/${locale}/plan`);
      return;
    }
    const t = setTimeout(() => setRedirectIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [step, redirectIn, locale]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const onSignature = useCallback((v: SignatureValue | null) => setSignature(v), []);

  async function sendCode(): Promise<void> {
    setBusy(true);
    setMessage(null);
    const r = await post<{ ok?: boolean; verified?: boolean; error?: string; retryIn?: number }>("/api/plan/nda/code", {});
    setBusy(false);
    if (r.status === 200) {
      if (r.data?.verified) {
        setStep("sign");
        return;
      }
      setCodeSent(true);
      setResendIn(60);
      setMessage(null);
      return;
    }
    if (r.data?.error === "cooldown") {
      setCodeSent(true);
      setResendIn(r.data.retryIn ?? 60);
    } else if (r.data?.error === "too_many_codes") setMessage("That is plenty of codes for one day. Reply to your invitation and Dano will sort it out.");
    else if (r.data?.error === "sms_failed") setMessage("We couldn't text that number. Check it and try again.");
    else setMessage("We couldn't send a code just now. Please try again.");
  }

  async function submitDetails(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setFieldErrors({});
    const r = await post<NdaState & { error?: string; errors?: Record<string, string> }>("/api/plan/nda/details", recipientFrom(form));
    setBusy(false);
    if (r.status === 200 && r.data) {
      const next = r.data;
      const phoneChanged = next.details?.phone !== state.details?.phone;
      setState(next);
      setForm(formFrom(next.details));
      setStep(next.step);
      if (next.step === "verify" && (phoneChanged || !codeSent)) {
        setCode("");
        setCodeSent(false);
        await sendCode();
      }
      return;
    }
    if (r.data?.errors) {
      setFieldErrors(Object.fromEntries(Object.keys(r.data.errors).map((k) => [k, FIELD_ERRORS[k] ?? "Please check this field."])));
      setMessage("A few details need another look.");
    } else if (r.status === 409) window.location.assign(`/${locale}/plan`);
    else setMessage("We couldn't save that just now. Please try again.");
  }

  async function submitCode(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const r = await post<NdaState & { error?: string; remaining?: number }>("/api/plan/nda/verify", { code });
    setBusy(false);
    if (r.status === 200 && r.data) {
      setState(r.data);
      setStep(r.data.step);
      return;
    }
    if (r.data?.error === "wrong_code") setMessage(`That code doesn't match. ${r.data.remaining ?? 0} ${r.data.remaining === 1 ? "try" : "tries"} left.`);
    else if (r.data?.error === "expired") {
      setMessage("That code has expired. Send yourself a new one.");
      setCode("");
    } else setMessage("We couldn't check that code just now. Please try again.");
  }

  async function sign(): Promise<void> {
    if (!signature || !consentE || !consentT) return;
    setBusy(true);
    setMessage(null);
    const r = await post<{ ok?: boolean; error?: string }>("/api/plan/nda/sign", { signature, consent: { electronic: true, terms: true } });
    setBusy(false);
    if (r.status === 200 && r.data?.ok) {
      setStep("done");
      return;
    }
    if (r.status === 409 && r.data?.error === "not_pending") {
      window.location.assign(`/${locale}/plan`);
      return;
    }
    if (r.data?.error === "no_countersigner") setMessage("This agreement isn't ready for signatures yet. Please try again a little later.");
    else setMessage("Something went wrong while signing, and nothing was saved. Please try again.");
  }

  const current = step === "done" ? 3 : STEPS.findIndex((s) => s.key === step);
  const ready = Boolean(signature && consentE && consentT);

  const field = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, errorKey: string = k) => (
    <div>
      <label htmlFor={`nda-${k}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`nda-${k}`}
        value={form[k] as string}
        onChange={set(k)}
        aria-invalid={Boolean(fieldErrors[errorKey])}
        aria-describedby={fieldErrors[errorKey] ? `nda-${k}-err` : undefined}
        className={`${inputClass} ${fieldErrors[errorKey] ? "border-oh-ember-light" : ""}`}
        {...props}
      />
      {fieldErrors[errorKey] ? (
        <p id={`nda-${k}-err`} className="m-0 mt-1 text-[0.8rem] text-oh-ember-light">
          {fieldErrors[errorKey]}
        </p>
      ) : null}
    </div>
  );

  const panel = (
    <div className="rounded-2xl border border-oh-stone bg-oh-ink/80 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] sm:p-6">
      {step === "details" ? (
        <form onSubmit={submitDetails} noValidate className="flex flex-col gap-4">
          <div>
            <h2 className="m-0 font-display text-[1.6rem] font-normal leading-tight text-oh-cream">Your details</h2>
            <p className="m-0 mt-1 text-[0.88rem] leading-relaxed text-oh-mute">For the agreement and your signed copy. We ask once, and only once.</p>
          </div>
          {field("legalName", "Full legal name", { autoComplete: "name", required: true })}
          {field("email", "Email", { type: "email", autoComplete: "email", inputMode: "email", required: true })}
          {field("phone", "Mobile number", { type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "(801) 555-0123", required: true })}
          {field("line1", "Street address", { autoComplete: "address-line1", required: true }, "address.line1")}
          {field("line2", "Apt, suite (optional)", { autoComplete: "address-line2" }, "address.line2")}
          <div className="grid grid-cols-2 gap-3">
            {field("city", "City", { autoComplete: "address-level2", required: true }, "address.city")}
            {field("region", "State", { autoComplete: "address-level1", required: true }, "address.region")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("postalCode", "ZIP code", { autoComplete: "postal-code", required: true }, "address.postalCode")}
            {field("country", "Country", { autoComplete: "country-name" }, "address.country")}
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-oh-stone/70 bg-transparent p-3 text-[0.88rem] text-oh-cream">
            <input type="checkbox" checked={form.onBehalf} onChange={set("onBehalf")} className="mt-1 h-4 w-4 accent-[#C1502E]" />
            <span>I am signing on behalf of a company or organization</span>
          </label>
          {form.onBehalf ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {field("company", "Company", { autoComplete: "organization" })}
              {field("title", "Your title", { autoComplete: "organization-title" })}
            </div>
          ) : null}
          {message ? <p role="alert" className="m-0 text-[0.85rem] text-oh-ember-light">{message}</p> : null}
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? "Saving" : "Continue"}
          </button>
          <p className="m-0 text-[0.75rem] leading-relaxed text-oh-ash">
            Your details are encrypted and used only for this agreement. We text a one-time code to confirm your mobile.
          </p>
        </form>
      ) : null}

      {step === "verify" ? (
        <form onSubmit={submitCode} noValidate className="flex flex-col gap-4">
          <div>
            <h2 className="m-0 font-display text-[1.6rem] font-normal leading-tight text-oh-cream">Verify your mobile</h2>
            <p className="m-0 mt-1 text-[0.88rem] leading-relaxed text-oh-mute">
              {codeSent ? `We texted a 6-digit code to ${state.phoneMasked ?? "your phone"}. It expires in 10 minutes.` : `We'll text a 6-digit code to ${state.phoneMasked ?? "your phone"}.`}
            </p>
          </div>
          {codeSent ? (
            <div>
              <label htmlFor="nda-otp" className={labelClass}>
                Code
              </label>
              <input
                id="nda-otp"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                className={`${inputClass} text-center font-mono text-[1.6rem] tracking-[0.5em]`}
              />
            </div>
          ) : null}
          {message ? <p role="alert" className="m-0 text-[0.85rem] text-oh-ember-light">{message}</p> : null}
          {codeSent ? (
            <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>
              {busy ? "Checking" : "Verify"}
            </button>
          ) : (
            <button type="button" onClick={() => void sendCode()} disabled={busy} className={primaryButton}>
              {busy ? "Sending" : "Text me a code"}
            </button>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {codeSent ? (
              <button type="button" onClick={() => void sendCode()} disabled={busy || resendIn > 0} className={`${linkButton} disabled:no-underline disabled:opacity-60`}>
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Send a new code"}
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => { setMessage(null); setStep("details"); }} className={linkButton}>
              Wrong number? Edit details
            </button>
          </div>
        </form>
      ) : null}

      {step === "sign" ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="m-0 font-display text-[1.6rem] font-normal leading-tight text-oh-cream">Read and sign</h2>
            <p className="m-0 mt-1 text-[0.88rem] leading-relaxed text-oh-mute">{ATTORNEY_NOTE}</p>
          </div>
          <div className="rounded-xl bg-oh-paper p-4 text-oh-charcoal">
            <SignaturePad legalName={state.details?.legalName ?? ""} fontFamily={signatureFontFamily} onChange={onSignature} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-[0.86rem] leading-relaxed text-oh-cream">
            <input type="checkbox" checked={consentE} onChange={(e) => setConsentE(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#C1502E]" />
            <span>{CONSENT_ELECTRONIC}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-[0.86rem] leading-relaxed text-oh-cream">
            <input type="checkbox" checked={consentT} onChange={(e) => setConsentT(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#C1502E]" />
            <span>{CONSENT_TERMS}</span>
          </label>
          {message ? <p role="alert" className="m-0 text-[0.85rem] text-oh-ember-light">{message}</p> : null}
          <button type="button" onClick={() => void sign()} disabled={busy || !ready} className={primaryButton}>
            {busy ? "Signing" : "Sign the agreement"}
          </button>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setStep("details")} className={linkButton}>
              Edit my details
            </button>
            <button type="button" onClick={() => window.print()} className={linkButton}>
              Print
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (step === "done") {
    return (
      <section aria-live="polite" className="mx-auto max-w-xl px-4 py-16 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/plan/chappy-192.webp" alt="Chappy Chopstix" width={112} height={112} className="mx-auto mb-6 block h-28 w-28 rounded-full bg-oh-ink object-cover ring-2 ring-oh-gold/60" />
        <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-oh-gold">Fully executed</p>
        <h1 className="m-0 mt-3 font-display text-[clamp(2.2rem,6vw,3rem)] font-normal leading-[1.1] text-oh-cream">Signed, sealed, slightly stamped.</h1>
        <p className="m-0 mx-auto mt-4 max-w-md text-[1rem] leading-relaxed text-oh-mute">
          Thanks{state.details?.legalName ? `, ${state.details.legalName.split(" ")[0]}` : ""}. Your fully executed copy is on its way to your inbox, and a text is headed to your phone. Now the good stuff.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a href={`/${locale}/plan`} className="inline-flex items-center justify-center rounded-lg bg-oh-ember-deep px-6 py-3 text-[0.95rem] font-semibold text-oh-cream no-underline hover:bg-oh-ember">
            Open the business plan
          </a>
          <a href="/api/plan/nda/pdf" className="inline-flex items-center justify-center rounded-lg border border-oh-stone bg-transparent px-6 py-3 text-[0.95rem] text-oh-cream no-underline hover:border-oh-mute">
            Download my copy
          </a>
        </div>
        <p className="m-0 mt-6 text-[0.8rem] text-oh-ash">{redirectIn > 0 ? `Taking you to the Summary in ${redirectIn}...` : "Opening the plan..."}</p>
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-10 print:hidden md:px-8 md:pt-14">
        <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-oh-gold">Before the good stuff</p>
        <h1 className="m-0 mt-3 max-w-3xl font-display text-[clamp(2.1rem,5.5vw,3.4rem)] font-normal leading-[1.08] text-oh-cream">
          One agreement, then the whole plan.
        </h1>
        <div className="mt-6 flex max-w-2xl items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/plan/chappy-96.webp" alt="Chappy Chopstix" width={52} height={52} className="h-13 w-13 shrink-0 rounded-full bg-oh-ink object-cover ring-1 ring-oh-gold/50" style={{ width: 52, height: 52 }} />
          <div className="rounded-2xl rounded-tl-sm border border-oh-stone bg-oh-ink px-4 py-3">
            <p className="m-0 text-[0.9rem] leading-relaxed text-oh-cream sm:text-[0.98rem]">
              Chappy Chopstix here. Before I show you the recipes, the numbers and the floor plan, the lawyers would like a signature. Three quick steps, and I will never ask you for any of this again.
            </p>
          </div>
        </div>
      </section>

      <ol aria-label="Steps" className="m-0 mx-auto mb-8 flex max-w-6xl list-none flex-wrap gap-2 p-0 px-4 print:hidden md:px-8">
        {STEPS.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={s.key} aria-current={now ? "step" : undefined} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.8rem] ${now ? "border-oh-ember bg-oh-ember/15 text-oh-cream" : done ? "border-oh-olive-light/50 text-oh-olive-light" : "border-oh-stone text-oh-ash"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.7rem] font-semibold ${now ? "bg-oh-ember text-oh-cream" : done ? "bg-oh-olive text-oh-cream" : "bg-oh-stone text-oh-mute"}`}>
                {done ? "✓" : i + 1}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 md:px-8 lg:grid-cols-[minmax(0,370px)_minmax(0,1fr)] lg:gap-10">
        <aside className={`print:hidden lg:sticky lg:top-6 lg:order-none lg:self-start ${step === "sign" ? "order-2" : "order-1"}`}>{panel}</aside>
        <div className={`min-w-0 lg:order-none ${step === "sign" ? "order-1" : "order-2"}`}>
          <NdaDocument doc={doc} countersigner={state.countersigner} recipientSignature={step === "sign" ? signature?.image ?? null : null} />
        </div>
      </div>
    </>
  );
}
