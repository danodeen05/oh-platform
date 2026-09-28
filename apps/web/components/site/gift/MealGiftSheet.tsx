"use client";

/**
 * A meal paid forward, offered to the guest at checkout (Task D9; was
 * components/MealGiftModal.tsx). Two choices:
 *
 *  - Take it: the caller applies the gift to the order (the savings step's
 *    `mealGiftId`); the server spends it from the quote at PAID.
 *  - Pass it on: POST /meal-gifts/:id/pay-forward. Signed-in callers only,
 *    and the recipient is the verified caller (Task D5 fix round 2), so the
 *    request carries the member's token and never a body recipientId.
 *    Nothing moves money; the gift stays for the next guest.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
// Task G2b: framer-motion loads on first open.
import { LazySheet as Sheet } from "@/components/site/motion/LazySheet";
import { Icon } from "@/components/site/icons/Icon";
import { Spinner } from "@/components/site/order/StepSheet";
import { SITE_API_URL, useSiteApi } from "@/lib/site/api";

export type SheetMealGift = {
  id: string;
  amountCents: number;
  messageFromGiver?: string | null;
  payForwardCount?: number;
  giver?: { name?: string | null } | null;
};

const SHEET = "[&_.oh-sheet-panel]:bg-oh-ink [&_.oh-sheet-panel]:text-oh-cream [&_.oh-sheet-grabber]:bg-oh-stone [&_.oh-sheet-panel]:max-w-xl [&_.oh-sheet-panel]:px-4";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";
const PRIMARY = `inline-flex min-h-14 w-full cursor-pointer font-[inherit] items-center justify-center gap-2 rounded-full border-0 bg-oh-ember-deep px-6 text-base font-semibold text-oh-cream disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;
const SECONDARY = `inline-flex min-h-12 w-full cursor-pointer font-[inherit] items-center justify-center gap-2 rounded-full border border-oh-stone bg-transparent px-5 text-base font-semibold text-oh-cream disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;
const MESSAGE_MAX = 200;

export function MealGiftSheet({
  open,
  gift,
  signedIn,
  amount,
  onTake,
  onPassed,
  onClose,
}: {
  open: boolean;
  gift: SheetMealGift;
  signedIn: boolean;
  /** The gift's amount, formatted by the caller in the page's locale. */
  amount: string;
  onTake: () => void;
  onPassed: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("mealGiftSheet");
  const api = useSiteApi();
  const [mode, setMode] = useState<"view" | "pass">("view");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const giver = gift.giver?.name?.trim() || null;

  async function pass() {
    if (!signedIn) {
      setStatus(t("signIn"));
      return;
    }
    setBusy(true);
    setStatus(null);
    const res = await api(`${SITE_API_URL}/meal-gifts/${encodeURIComponent(gift.id)}/pay-forward`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tenant-slug": "oh" },
      body: JSON.stringify({ messageFromRecipient: note.trim() || null }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      onPassed();
      return;
    }
    setStatus(res?.status === 401 ? t("signIn") : t("passFailed"));
  }

  return (
    <Sheet open={open} onClose={onClose} label={t("label")} snapPoints={[0.8]} className={SHEET}>
      <div data-meal-gift-sheet className="flex flex-col gap-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-2">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-oh-ember-deep text-oh-cream">
            <Icon name="gift" size={26} />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 className="m-0 font-display text-2xl font-normal leading-tight text-oh-cream">{mode === "pass" ? t("passTitle") : t("title")}</h2>
            <span className="text-[15px] text-oh-mute">{giver ? t("from", { name: giver }) : t("fromStranger")}</span>
          </div>
          <span className="ml-auto shrink-0 font-display text-3xl text-oh-gold">{amount}</span>
        </div>

        {gift.messageFromGiver ? (
          <blockquote className="m-0 border-l-2 border-oh-gold pl-4 text-base italic text-oh-cream/90 [overflow-wrap:anywhere]">{gift.messageFromGiver}</blockquote>
        ) : null}
        {gift.payForwardCount ? <p className="m-0 text-sm text-oh-gold">{t("chain", { count: gift.payForwardCount })}</p> : null}

        {mode === "view" ? (
          <>
            <p className="m-0 text-[15px] leading-relaxed text-oh-mute">{t("body")}</p>
            <button type="button" data-meal-gift-take onClick={onTake} className={PRIMARY}>
              {t("take")}
            </button>
            <button type="button" data-meal-gift-pass onClick={() => setMode("pass")} className={SECONDARY}>
              {t("pass")}
            </button>
          </>
        ) : (
          <>
            <p className="m-0 text-[15px] leading-relaxed text-oh-mute">{t("passBody")}</p>
            <label htmlFor="meal-gift-note" className="text-xs font-semibold uppercase tracking-[0.16em] text-oh-cream/85">
              {t("note")}
            </label>
            <textarea
              id="meal-gift-note"
              value={note}
              maxLength={MESSAGE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              rows={3}
              className="w-full resize-y rounded-2xl border border-oh-stone bg-oh-charcoal px-4 py-3 font-[inherit] text-base text-oh-cream placeholder:text-oh-ash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
            />
            <span className="-mt-3 self-end text-sm text-oh-mute">{t("counter", { count: note.length, max: MESSAGE_MAX })}</span>
            <button type="button" data-meal-gift-pass-confirm onClick={pass} disabled={busy} className={PRIMARY}>
              {busy ? <Spinner /> : null}
              {busy ? t("processing") : t("confirmPass")}
            </button>
            <button type="button" onClick={() => setMode("view")} disabled={busy} className={SECONDARY}>
              {t("back")}
            </button>
          </>
        )}
        <p role="status" aria-live="polite" className="m-0 min-h-5 text-[15px] text-oh-cream">
          {status}
        </p>
      </div>
    </Sheet>
  );
}
