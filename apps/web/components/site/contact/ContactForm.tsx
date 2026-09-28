"use client";

/**
 * Task D11: the contact form. It posts straight from the browser to
 * `POST /support/cases {type: "CONTACT", summary, contact, locale}` (A9),
 * so the API's own anti-spam applies to the visitor, not to a server hop:
 * its per-caller rate limit keys on the signed-in member or the visitor's
 * own address (a Next route in between would need to forward a per-client
 * key; there is none), and the hidden `website` field is its honeypot. A
 * signed-in member's Clerk token rides along, so the case lands on their
 * account. Staff see it in the admin Support queue as an OPEN case.
 *
 * The reference shown after sending is the tail of the case id, which is
 * how staff find it.
 */
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { SITE_API_URL, useSiteApi } from "@/lib/site/api";
import { localizedHref } from "@/lib/site/nav";

export const MESSAGE_MAX = 1800;
const TOPICS = ["general", "order", "feedback", "events", "press"] as const;
type Topic = (typeof TOPICS)[number];
type ErrorKey = "contactRequired" | "messageRequired" | "invalidEmail" | "invalidPhone" | "rateLimited" | "failed";

const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,255}\.[A-Za-z]{2,}$/;

/** What staff read: the topic in plain English (the queue is English), then the visitor's words. */
export function caseSummary(topic: Topic, message: string): string {
  const label: Record<Topic, string> = { general: "Question", order: "Order", feedback: "Feedback", events: "Groups and events", press: "Press" };
  return `[Contact: ${label[topic]}] ${message.trim()}`;
}

/** The short reference a visitor can quote back: the case id's last 8 characters. */
export function caseRef(caseId: string): string {
  return caseId.slice(-8).toUpperCase();
}

/** Client-side checks that mirror the API's, so most mistakes never make a round trip. */
export function validateContact(v: { email: string; phone: string; message: string }): ErrorKey | null {
  const email = v.email.trim();
  const phone = v.phone.trim();
  if (!v.message.trim()) return "messageRequired";
  if (!email && !phone) return "contactRequired";
  if (email && !EMAIL_RE.test(email)) return "invalidEmail";
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15 || /[^\d\s()+.-]/.test(phone)) return "invalidPhone";
  }
  return null;
}

const field =
  "block w-full min-h-12 rounded-xl border border-oh-stone bg-oh-charcoal px-4 text-base text-oh-cream placeholder:text-oh-ash transition-colors focus:border-oh-ember-light focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-ember-light/40";
const label = "mb-2 block text-sm font-semibold text-oh-cream/85";

export function ContactForm() {
  const t = useTranslations("contactPage");
  const locale = useLocale();
  const api = useSiteApi();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [ready, setReady] = useState(false);
  const [values, setValues] = useState({ name: "", email: "", phone: "", topic: "general" as Topic, message: "", website: "" });
  const [error, setError] = useState<ErrorKey | null>(null);
  const [sending, setSending] = useState(false);
  const [sentRef, setSentRef] = useState<string | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);

  // Hydrated: the e2e waits for this before typing.
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (sentRef) successRef.current?.focus();
  }, [sentRef]);

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const problem = validateContact(values);
    if (problem) {
      setError(problem);
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setError(null);
    setSending(true);
    try {
      const contact: Record<string, string> = {};
      if (values.name.trim()) contact.name = values.name.trim();
      if (values.email.trim()) contact.email = values.email.trim();
      if (values.phone.trim()) contact.phone = values.phone.trim();
      const res = await api(`${SITE_API_URL}/support/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": "oh" },
        body: JSON.stringify({
          type: "CONTACT",
          summary: caseSummary(values.topic, values.message),
          contact,
          locale,
          ...(values.website ? { website: values.website } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.caseId) {
        setSentRef(caseRef(String(body.caseId)));
        return;
      }
      const code = body?.code as string | undefined;
      setError(res.status === 429 ? "rateLimited" : code === "CONTACT_REQUIRED" ? "contactRequired" : code === "INVALID_CONTACT" ? (values.email.trim() ? "invalidEmail" : "invalidPhone") : "failed");
      requestAnimationFrame(() => errorRef.current?.focus());
    } catch {
      setError("failed");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setSending(false);
    }
  }

  if (sentRef) {
    return (
      <div ref={successRef} tabIndex={-1} data-contact-success role="status" className="rounded-[1.75rem] border border-oh-stone/70 bg-oh-ink p-6 outline-none md:p-8">
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-oh-olive/30 text-oh-olive-light">
          <Icon name="check" size={28} />
        </span>
        <h2 className="m-0 mt-5 text-2xl font-semibold text-oh-cream">{t("success.title")}</h2>
        <p className="m-0 mt-2 text-base text-oh-cream/80">{t("success.body")}</p>
        <div className="mt-6 rounded-2xl border border-dashed border-oh-stone bg-oh-charcoal px-5 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-oh-mute">{t("success.ref")}</p>
          <p className="m-0 mt-1 font-mono text-2xl tracking-[0.12em] text-oh-gold" data-case-ref>
            {sentRef}
          </p>
          <p className="m-0 mt-1 text-sm text-oh-mute">{t("success.refHint")}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSentRef(null);
            setValues((v) => ({ ...v, message: "", website: "" }));
          }}
          className="mt-6 inline-flex min-h-12 cursor-pointer appearance-none items-center justify-center rounded-full border border-oh-cream/35 bg-transparent px-6 font-[inherit] text-base font-semibold text-oh-cream transition-colors hover:border-oh-cream hover:bg-oh-cream/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
        >
          {t("success.another")}
        </button>
      </div>
    );
  }

  const ids = { name: `${uid}-name`, email: `${uid}-email`, phone: `${uid}-phone`, topic: `${uid}-topic`, message: `${uid}-message`, hint: `${uid}-hint`, mhint: `${uid}-mhint`, err: `${uid}-err`, hp: `${uid}-hp` };

  return (
    <form
      data-contact-form
      data-ready={ready ? "true" : "false"}
      noValidate
      onSubmit={onSubmit}
      aria-describedby={error ? ids.err : undefined}
      className="rounded-[1.75rem] border border-oh-stone/70 bg-oh-ink p-5 md:p-8"
    >
      <h2 className="m-0 text-2xl font-semibold text-oh-cream">{t("form.title")}</h2>

      <div className="mt-6 grid gap-5">
        <div>
          <label htmlFor={ids.name} className={label}>
            {t("form.name")} <span className="font-normal text-oh-mute">({t("form.optional")})</span>
          </label>
          <input id={ids.name} name="name" type="text" autoComplete="name" maxLength={100} value={values.name} onChange={set("name")} className={field} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={ids.email} className={label}>
              {t("form.email")}
            </label>
            <input id={ids.email} name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={values.email} onChange={set("email")} aria-describedby={ids.hint} className={field} />
          </div>
          <div className="min-w-0">
            <label htmlFor={ids.phone} className={label}>
              {t("form.phone")}
            </label>
            <input id={ids.phone} name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={32} value={values.phone} onChange={set("phone")} aria-describedby={ids.hint} className={field} />
          </div>
        </div>
        <p id={ids.hint} className="-mt-2 m-0 text-sm text-oh-mute">
          {t("form.reachHint")}
        </p>

        <div>
          <label htmlFor={ids.topic} className={label}>
            {t("form.topic")}
          </label>
          <div className="relative">
            <select id={ids.topic} name="topic" value={values.topic} onChange={set("topic")} className={`${field} cursor-pointer appearance-none pr-12`}>
              {TOPICS.map((k) => (
                <option key={k} value={k}>
                  {t(`form.topics.${k}`)}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-oh-mute" />
          </div>
        </div>

        <div>
          <label htmlFor={ids.message} className={label}>
            {t("form.message")}
          </label>
          <textarea
            id={ids.message}
            name="message"
            rows={6}
            maxLength={MESSAGE_MAX}
            value={values.message}
            onChange={set("message")}
            aria-describedby={ids.mhint}
            className={`${field} min-h-40 resize-y py-3 leading-relaxed`}
          />
          <p id={ids.mhint} className="m-0 mt-2 flex justify-between gap-3 text-sm text-oh-mute">
            <span>{t("form.messageHint", { max: MESSAGE_MAX })}</span>
            <span aria-hidden="true" className="tabular-nums">
              {values.message.length}/{MESSAGE_MAX}
            </span>
          </p>
        </div>

        {/* Honeypot: people never see or fill it; bots fill every field. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor={ids.hp}>{t("form.honeypot")}</label>
          <input id={ids.hp} name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
        </div>
      </div>

      {error ? (
        <p ref={errorRef} id={ids.err} tabIndex={-1} role="alert" data-contact-error className="m-0 mt-5 flex items-start gap-2 text-base text-oh-ember-light outline-none">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          <span>{t(`errors.${error}`)}</span>
        </p>
      ) : null}

      <button
        type="submit"
        data-contact-submit
        disabled={sending}
        aria-busy={sending || undefined}
        className="mt-6 inline-flex min-h-12 w-full cursor-pointer appearance-none items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-6 font-[inherit] text-base font-semibold text-oh-cream shadow-[0_10px_30px_-12px] shadow-oh-ember-deep transition-colors hover:bg-oh-ember focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        {sending ? t("form.sending") : t("form.submit")}
        {sending ? null : <Icon name="arrow" size={18} />}
      </button>
      <p className="m-0 mt-4 text-sm text-oh-mute">
        {t("form.privacy")}{" "}
        <Link href={localizedHref(locale, "/privacy")} className="text-oh-cream/85 underline decoration-oh-cream/30 underline-offset-4 hover:decoration-oh-cream">
          {t("form.privacyLink")}
        </Link>
      </p>
    </form>
  );
}
