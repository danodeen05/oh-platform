"use client";

/**
 * In-restaurant shelf tags (Task D10, /store/scan). The camera starts only
 * on a tap (the permission prompt then has a reason), and reads QR codes
 * with the browser's own BarcodeDetector where there is one. Typing the code
 * always works. A tag's code opens /store/item/:code.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "@/components/site/icons/Icon";
import { Reveal } from "@/components/site/motion/Reveal";
import { Body, Display, Eyebrow } from "@/components/site/Text";
import { usePublishOrderBack } from "@/lib/site/order-back";
import { FIELD, LABEL, PRIMARY, SECONDARY } from "./ui";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/** A scanned value: a full tag URL (…/store/item/CODE) or the bare code. */
export function tagCode(raw: string): string {
  const s = raw.trim();
  const m = s.match(/\/store\/item\/([^/?#]+)/);
  return decodeURIComponent(m ? m[1] : s).toUpperCase();
}

export function ScanView() {
  const t = useTranslations("store.scan");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState<"off" | "on" | "denied" | "none" | "unsupported">("off");
  usePublishOrderBack(`/${locale}/store`, t("back"));

  const go = (value: string) => {
    const c = tagCode(value);
    if (c) router.push(`/${locale}/store/item/${encodeURIComponent(c)}`);
  };

  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCamera((c) => (c === "on" ? "off" : c));
  };

  useEffect(() => () => stream.current?.getTracks().forEach((track) => track.stop()), []);

  async function start() {
    const Ctor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setCamera("unsupported");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch (err) {
      setCamera(err instanceof Error && err.name === "NotAllowedError" ? "denied" : "none");
      return;
    }
    setCamera("on");
    const el = video.current;
    if (!el) return;
    el.srcObject = stream.current;
    await el.play().catch(() => undefined);
    const detector = new Ctor({ formats: ["qr_code"] });
    const tick = async () => {
      if (!stream.current) return;
      const found = await detector.detect(el).catch(() => []);
      if (found[0]?.rawValue) {
        stop();
        go(found[0].rawValue);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const note = camera === "denied" ? t("denied") : camera === "none" ? t("noCamera") : camera === "unsupported" ? t("unsupported") : null;

  return (
    <div data-store-scan className="mx-auto max-w-xl px-4 pb-16 pt-6 md:pt-12">
      <Reveal from="fade">
        <Eyebrow locale={locale} className="text-oh-ember-light">
          {t("eyebrow")}
        </Eyebrow>
        <Display locale={locale} className="m-0 mt-2 text-[clamp(2rem,8vw,3rem)] text-oh-cream">
          {t("title")}
        </Display>
        <Body locale={locale} className="m-0 mt-3 text-oh-cream/85">
          {t("lede")}
        </Body>
      </Reveal>

      <div className="relative mt-7 aspect-square w-full overflow-hidden rounded-3xl border border-oh-stone/70 bg-oh-ink">
        <video ref={video} playsInline muted aria-hidden="true" className={`h-full w-full object-cover ${camera === "on" ? "block" : "hidden"}`} />
        {camera === "on" ? (
          <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-oh-cream/80 shadow-[0_0_0_999px_rgba(28,27,25,0.45)]" />
            <p role="status" className="absolute inset-x-0 bottom-4 m-0 text-center text-[15px] text-oh-cream">
              {t("scanning")}
            </p>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-oh-ember-deep/25 text-oh-ember-light">
              <Icon name="store" size={30} />
            </span>
            {note ? (
              <p role="alert" className="m-0 max-w-xs text-[15px] text-oh-cream/85">
                {note}
              </p>
            ) : null}
            <button type="button" onClick={start} className={PRIMARY} data-scan-start>
              {t("start")}
            </button>
          </div>
        )}
      </div>
      {camera === "on" ? (
        <button type="button" onClick={stop} className={`${SECONDARY} mt-4 w-full`}>
          {t("stop")}
        </button>
      ) : null}

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          go(code);
        }}
      >
        <label htmlFor={`${id}-code`} className={LABEL}>
          {t("codeLabel")}
        </label>
        <div className="flex gap-2">
          <input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64} className={`${FIELD} min-w-0 flex-1 font-mono`} data-field="tag" />
          <button type="submit" disabled={!code.trim()} className={`${PRIMARY} shrink-0 rounded-xl`}>
            {t("find")}
          </button>
        </div>
      </form>
    </div>
  );
}
