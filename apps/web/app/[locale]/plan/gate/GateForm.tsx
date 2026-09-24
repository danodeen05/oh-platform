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

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="plan-code" style={{ display: "block", textAlign: "left", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9A9188", marginBottom: 8 }}>
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
        disabled={status === "submitting"}
        style={{
          width: "100%",
          padding: "14px 16px",
          fontSize: "1.1rem",
          letterSpacing: "0.12em",
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          background: "#2A2724",
          color: "#F2EDE4",
          border: `1px solid ${error ? "#C1502E" : "#3A3632"}`,
          borderRadius: 8,
          outline: "none",
        }}
      />
      {error && (
        <p id="plan-code-error" role="alert" style={{ color: "#E07A5A", fontSize: "0.85rem", marginTop: 10, textAlign: "left" }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "submitting" || !code.trim()}
        style={{
          width: "100%",
          marginTop: 16,
          padding: "14px 16px",
          fontSize: "1rem",
          fontWeight: 600,
          background: "#C1502E",
          color: "#F2EDE4",
          border: "none",
          borderRadius: 8,
          cursor: status === "submitting" ? "wait" : "pointer",
          opacity: status === "submitting" || !code.trim() ? 0.6 : 1,
        }}
      >
        {status === "submitting" ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
