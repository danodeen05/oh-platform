"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function CreateLocationForm({
  tenantOptions,
}: {
  tenantOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [tenantId, setTenantId] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${BASE}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name, city, tenantId }).toString(),
    });
    setName("");
    setCity("");
    setTenantId("");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => start(() => onSubmit(e))}
      style={{ display: "grid", gap: 8, maxWidth: 420 }}
    >
      <input
        name="name"
        placeholder="Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        name="city"
        placeholder="City (optional)"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <select
        name="tenantId"
        required
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
      >
        <option value="" disabled>
          Select tenant…
        </option>
        {tenantOptions.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending}>
        Create Location
      </button>
    </form>
  );
}
