"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface Labels {
  codeLabel: string;
  codePlaceholder: string;
  submit: string;
  submitting: string;
  errorInvalid: string;
  errorRateLimited: string;
  errorNetwork: string;
}

interface Props {
  nextPath: string;
  initialCode: string;
  labels: Labels;
}

type Status = "idle" | "submitting" | "invalid" | "rate_limited" | "network";

export function GateForm({ nextPath, initialCode, labels }: Props) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState<Status>("idle");
  const autoSubmitted = useRef(false);

  async function submit(value: string): Promise<void> {
    const trimmed = value.trim();
    if (!trimmed) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/plan/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      if (res.ok) {
        router.replace(nextPath);
        router.refresh();
        return;
      }
      setStatus(res.status === 429 ? "rate_limited" : "invalid");
    } catch {
      setStatus("network");
    }
  }

  // A "?c=CODE" invitation link submits itself so the recipient gets one clean click.
  useEffect(() => {
    if (initialCode && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  function onSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void submit(code);
  }

  const error =
    status === "invalid" ? labels.errorInvalid
    : status === "rate_limited" ? labels.errorRateLimited
    : status === "network" ? labels.errorNetwork
    : null;

  const busy = status === "submitting";
  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="plan-code" className="mb-2 block text-left text-[0.8rem] uppercase tracking-[0.08em] text-oh-mute">
        {labels.codeLabel}
      </label>
      <input
        id="plan-code"
        name="code"
        value={code}
        onChange={(e) => { setCode(e.target.value.toUpperCase()); if (status !== "submitting") setStatus("idle"); }}
        placeholder={labels.codePlaceholder}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "plan-code-error" : undefined}
        disabled={busy}
        className={[
          "w-full rounded-lg border bg-oh-ink px-4 py-3.5 text-center text-[1.1rem] tracking-[0.12em] tabular-nums text-oh-cream placeholder:text-oh-ash focus:border-oh-ember focus:outline-none",
          error ? "border-oh-ember" : "border-oh-stone",
        ].join(" ")}
      />
      {error && (
        <p id="plan-code-error" role="alert" className="m-0 mt-2.5 text-left text-[0.85rem] text-oh-ember-light">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !code.trim()}
        className={[
          "mt-4 w-full rounded-lg border-0 bg-oh-ember px-4 py-3.5 text-[1rem] font-semibold text-oh-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-oh-cream",
          busy ? "cursor-wait" : "cursor-pointer",
          busy || !code.trim() ? "opacity-60" : "hover:bg-oh-clay",
        ].join(" ")}
      >
        {busy ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
