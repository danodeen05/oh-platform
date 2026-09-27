"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function CreateTenantForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [slug, setSlug] = useState("");
  const [brandName, setBrandName] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${BASE}/tenants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, brandName }),
    });
    setSlug("");
    setBrandName("");
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => start(() => onSubmit(e))}
      style={{ display: "grid", gap: 8, maxWidth: 420 }}
    >
      <input
        name="slug"
        placeholder="Slug (e.g., 'oh')"
        required
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
      />
      <input
        name="brandName"
        placeholder="Brand Name (e.g., 'Oh Beef Noodle Soup')"
        required
        value={brandName}
        onChange={(e) => setBrandName(e.target.value)}
      />
      <button type="submit" disabled={pending}>
        Create Tenant
      </button>
    </form>
  );
}
