"use client";

/**
 * The member's referral link as a QR code (Task D9), for a friend standing
 * next to them. Loaded with next/dynamic only when opened, so the QR
 * library never weighs on the page's first load.
 */
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
// Task G2b: framer-motion loads on first open.
import { LazySheet as Sheet } from "@/components/site/motion/LazySheet";

const SHEET = "[&_.oh-sheet-panel]:bg-oh-ink [&_.oh-sheet-panel]:text-oh-cream [&_.oh-sheet-grabber]:bg-oh-stone [&_.oh-sheet-panel]:max-w-md [&_.oh-sheet-panel]:px-4";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream";

export default function ReferralQrSheet({ open, onClose, link, friend }: { open: boolean; onClose: () => void; link: string; friend: string }) {
  const t = useTranslations("referralPage");
  return (
    <Sheet open={open} onClose={onClose} label={t("qrTitle")} snapPoints={[0.86]} className={SHEET}>
      <div data-referral-qr-sheet className="flex flex-col items-center gap-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-2 text-center">
        <h2 className="m-0 font-display text-3xl font-normal text-oh-cream">{t("qrTitle")}</h2>
        <p className="m-0 max-w-xs text-[15px] text-oh-mute">{t("qrBody", { friend })}</p>
        <div className="relative rounded-3xl bg-oh-paper p-4">
          <QRCodeSVG value={link} size={232} level="H" bgColor="#FAF7F1" fgColor="#1C1B19" title={t("qrTitle")} />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-oh-paper">
            <Image src="/Oh_Logo_Mark_Web.png" alt="Oh!" width={48} height={48} className="h-12 w-12 object-contain" />
          </span>
        </div>
        <p className="m-0 w-full max-w-xs break-all rounded-2xl bg-oh-charcoal px-3 py-2 font-mono text-sm text-oh-cream/85">{link}</p>
        <button type="button" onClick={onClose} className={`inline-flex min-h-12 w-full max-w-xs cursor-pointer font-[inherit] items-center justify-center rounded-full border border-oh-stone bg-transparent px-5 text-base font-semibold text-oh-cream ${FOCUS}`}>
          {t("close")}
        </button>
      </div>
    </Sheet>
  );
}
