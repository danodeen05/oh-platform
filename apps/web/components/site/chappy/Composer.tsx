"use client";

/**
 * The composer (Task E1): a growing textarea and a send button. The text is
 * 16px so iOS never zooms on focus; Enter sends (Shift+Enter is a new line,
 * and Enter while an IME is composing Chinese is left to the IME). The
 * message cap matches the API's (1500 characters).
 */
import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "@/components/site/icons/Icon";
import { CHAPPY_MESSAGE_MAX } from "./stream";

export interface ComposerHandle {
  focus: () => void;
}

interface ComposerProps {
  onSend: (text: string) => void;
  busy: boolean;
  /** Text to place in the box (openChappy(prefill)); `prefillKey` changes on every open so the same text can be placed twice. */
  prefill?: string;
  prefillKey?: number;
}

const MAX_HEIGHT = 132; // about five lines

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer({ onSend, busy, prefill, prefillKey }, ref) {
  const t = useTranslations("chappyWeb");
  const [value, setValue] = useState("");
  const box = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => ({ focus: () => box.current?.focus() }), []);

  useEffect(() => {
    if (prefill) setValue(prefill.slice(0, CHAPPY_MESSAGE_MAX));
  }, [prefill, prefillKey]);

  // Grow with the text, up to MAX_HEIGHT, then scroll inside.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const canSend = !busy && value.trim().length > 0;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    onSend(value);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    submit();
  }

  return (
    <form
      data-chappy-composer
      onSubmit={submit}
      className="shrink-0 border-0 border-t border-solid border-oh-stone/70 bg-oh-ink px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3"
    >
      <div className="flex items-end gap-2 rounded-3xl border border-solid border-oh-stone bg-oh-charcoal py-1 pl-4 pr-1 focus-within:border-oh-ash">
        <label htmlFor="chappy-input" className="sr-only">
          {t("inputLabel")}
        </label>
        <textarea
          ref={box}
          id="chappy-input"
          rows={1}
          value={value}
          maxLength={CHAPPY_MESSAGE_MAX}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder")}
          enterKeyHint="send"
          autoComplete="off"
          className="my-1.5 max-h-[132px] min-h-7 flex-1 resize-none appearance-none border-0 bg-transparent p-0 font-[inherit] text-base leading-7 text-oh-cream outline-none placeholder:text-oh-mute"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex h-11 w-11 shrink-0 cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-oh-ember-deep p-0 text-oh-cream transition-colors hover:bg-oh-ember disabled:cursor-default disabled:bg-oh-stone disabled:text-oh-mute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oh-cream"
        >
          <Icon name="arrow" size={22} title={t("send")} />
        </button>
      </div>
    </form>
  );
});
