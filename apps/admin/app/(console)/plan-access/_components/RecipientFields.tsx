"use client";

/** First name, last name and email of the person a plan code is for. Shared by the issue sheet and the code page. */

import { Field, TextInput } from "@/components/ui/Field";
import type { Recipient } from "@/lib/plan-access";

type Props = {
  value: Recipient;
  onChange: (next: Recipient) => void;
  emailError?: string;
  disabled?: boolean;
};

export function RecipientFields({ value, onChange, emailError, disabled }: Props) {
  const set = (k: keyof Recipient) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <TextInput value={value.firstName} onChange={set("firstName")} autoComplete="off" maxLength={60} disabled={disabled} />
        </Field>
        <Field label="Last name">
          <TextInput value={value.lastName} onChange={set("lastName")} autoComplete="off" maxLength={60} disabled={disabled} />
        </Field>
      </div>
      <Field label="Email" error={emailError}>
        <TextInput type="email" inputMode="email" value={value.email} onChange={set("email")} autoComplete="off" maxLength={254}
          disabled={disabled} placeholder="name@company.com" aria-invalid={Boolean(emailError)} />
      </Field>
    </div>
  );
}
