"use client";

/**
 * Private events: the guest step. Name and mobile (for the reminder text),
 * an optional birthday (month, day, year; it picks the guest's zodiac) and
 * a note for the kitchen. Saves the RSVP, remembers the guest on this
 * browser, then goes on to the bowl.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEvent } from "@/components/site/events/EventProvider";
import { readRemembered, writeRemembered } from "@/components/site/events/remember";
import { StepSheet } from "@/components/site/order/StepSheet";
import { FIELD, LABEL } from "@/components/site/store/ui";
import { guestPayload, phoneDigits, splitDob, validateGuest, type GuestErrors } from "@/lib/site/event-guest";
import { eventPath, submitRsvp, type GuestRsvp } from "@/lib/site/events";

const HELP = "m-0 mt-1.5 text-sm text-oh-mute";
const ERROR = "m-0 mt-1.5 text-sm font-semibold text-oh-ember-light";

export function GuestStep({ guest, token }: { guest: GuestRsvp | null; token: string | null }) {
  const event = useEvent();
  const slug = event.slug;
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("events.guest");
  const tFlow = useTranslations("orderFlow.errors");

  const born = splitDob(guest?.dob);
  const [name, setName] = useState(guest?.name ?? "");
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [month, setMonth] = useState(born.month);
  const [day, setDay] = useState(born.day);
  const [year, setYear] = useState(born.year);
  const [notes, setNotes] = useState(guest?.notes ?? "");
  const [rsvpToken, setRsvpToken] = useState(token);
  // Which optional fields were prefilled with a value: only those are cleared ("") when left empty.
  const [prefilled, setPrefilled] = useState({ dob: Boolean(guest?.dob), notes: Boolean(guest?.notes) });
  const [errors, setErrors] = useState<GuestErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // No invite token: prefill from this browser's last visit.
  useEffect(() => {
    if (guest) return;
    const who = readRemembered(slug);
    if (!who) return;
    setName(who.name);
    setPhone(who.phone);
    const d = splitDob(who.dob);
    setMonth(d.month);
    setDay(d.day);
    setYear(d.year);
    if (d.year) setPrefilled((p) => ({ ...p, dob: true }));
    if (who.token) setRsvpToken(who.token);
  }, [guest, slug]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const found = validateGuest({ name, phone, month, day, year });
    setErrors(found);
    setAlert(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    const digits = phoneDigits(phone);
    const optional = guestPayload({ month, day, year, notes }, prefilled);
    const dob = optional.dob || null;
    const r = await submitRsvp(slug, { name: name.trim(), phone: digits, ...optional, ...(rsvpToken ? { rsvpToken } : {}) });
    if (r.ok) {
      // Merge: keep what this browser already knows (the reserved order's code, for the status link once orders close).
      const { dob: _oldDob, ...known } = readRemembered(slug) ?? { name: "", phone: "" };
      writeRemembered(slug, { ...known, name: name.trim(), phone: digits, token: r.data?.rememberToken, ...(dob ? { dob } : {}) });
      router.push(eventPath(locale, slug, "order"));
      return;
    }
    setBusy(false);
    if (r.status === 409) setAlert(t("phoneTaken"));
    else if (r.status === 0) setAlert(tFlow("NETWORK_ERROR"));
    else setAlert(tFlow("GENERIC"));
  }

  // Editing a field clears its error; the next submit checks again.
  const edit = (field: keyof GuestErrors, set: (v: string) => void, clean: (v: string) => string = (v) => v) => (e: { target: { value: string } }) => {
    set(clean(e.target.value));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };
  const digitsOnly = (v: string) => v.replace(/\D/g, "");

  return (
    <StepSheet
      step="bowl"
      progress={false}
      title={t("title")}
      lede={t("lede")}
      backHref={eventPath(locale, slug)}
      cta={{ label: t("continue"), form: "guest-form", type: "submit", busy, dataAttr: "data-guest-submit" }}
      alert={alert}
    >
      <form id="guest-form" noValidate onSubmit={submit} className="flex flex-col gap-6" data-guest-form>
        <div>
          <label htmlFor="guest-name" className={LABEL}>
            {t("name")}
          </label>
          <input
            id="guest-name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={edit("name", setName)}
            aria-invalid={errors.name ? "true" : undefined}
            aria-describedby={errors.name ? "guest-name-error" : undefined}
            maxLength={80}
            className={FIELD}
          />
          {errors.name ? (
            <p id="guest-name-error" className={ERROR}>
              {t(errors.name)}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="guest-phone" className={LABEL}>
            {t("phone")}
          </label>
          <input
            id="guest-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={edit("phone", setPhone)}
            aria-invalid={errors.phone ? "true" : undefined}
            aria-describedby={errors.phone ? "guest-phone-error guest-phone-help" : "guest-phone-help"}
            maxLength={20}
            className={FIELD}
          />
          {errors.phone ? (
            <p id="guest-phone-error" className={ERROR}>
              {t(errors.phone)}
            </p>
          ) : null}
          <p id="guest-phone-help" className={HELP}>
            {t("phoneHelp")}
          </p>
        </div>

        <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby={errors.birthday ? "guest-dob-error guest-dob-help" : "guest-dob-help"}>
          <legend className={`${LABEL} p-0`}>{t("birthday")}</legend>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-2.5">
            {(
              [
                ["month", month, setMonth, 2, "bday-month"],
                ["day", day, setDay, 2, "bday-day"],
                ["year", year, setYear, 4, "bday-year"],
              ] as const
            ).map(([part, value, set, max, auto]) => (
              <div key={part} className="min-w-0">
                <label htmlFor={`guest-dob-${part}`} className="mb-1.5 block text-xs text-oh-mute">
                  {t(part)}
                </label>
                <input
                  id={`guest-dob-${part}`}
                  name={`dob-${part}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={auto}
                  maxLength={max}
                  value={value}
                  onChange={edit("birthday", set, digitsOnly)}
                  aria-label={t(part)}
                  aria-invalid={errors.birthday ? "true" : undefined}
                  className={`${FIELD} text-center tabular-nums`}
                />
              </div>
            ))}
          </div>
          {errors.birthday ? (
            <p id="guest-dob-error" className={ERROR}>
              {t(errors.birthday)}
            </p>
          ) : null}
          <p id="guest-dob-help" className={HELP}>
            {t("birthdayHelp")}
          </p>
        </fieldset>

        <div>
          <label htmlFor="guest-notes" className={LABEL}>
            {t("notes")}
          </label>
          <textarea
            id="guest-notes"
            name="notes"
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-describedby="guest-notes-help"
            className={`${FIELD} min-h-24 resize-y py-3 font-[inherit] leading-relaxed`}
          />
          <p id="guest-notes-help" className={HELP}>
            {t("notesHelp")}
          </p>
        </div>
      </form>
    </StepSheet>
  );
}
