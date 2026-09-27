/**
 * Validation and display helpers for the details a plan NDA signer enters.
 * Pure functions; shared by the NDA routes and delivery.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clean = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * E.164 or null. Bare 10-digit (or 1 + 10-digit) numbers are treated as US;
 * anything else must start with "+" and a country code.
 */
export function toE164(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * @returns {{ ok: true, value: { legalName, email, phone, address: { line1, line2, city, region, postalCode, country }, company, title } }
 *          | { ok: false, errors: Record<string, string> }}
 */
export function validateDetails(body) {
  const b = body && typeof body === "object" ? body : {};
  const a = b.address && typeof b.address === "object" ? b.address : {};
  const errors = {};
  const legalName = clean(b.legalName, 120);
  const email = clean(b.email, 254).toLowerCase();
  const phone = toE164(typeof b.phone === "string" ? b.phone : "");
  const address = {
    line1: clean(a.line1, 160),
    line2: clean(a.line2, 160),
    city: clean(a.city, 80),
    region: clean(a.region, 80),
    postalCode: clean(a.postalCode, 20),
    country: clean(a.country, 80) || "United States",
  };
  if (legalName.length < 3) errors.legalName = "required";
  if (!EMAIL_RE.test(email)) errors.email = "invalid";
  if (!phone) errors.phone = "invalid";
  if (!address.line1) errors["address.line1"] = "required";
  if (!address.city) errors["address.city"] = "required";
  if (!address.region) errors["address.region"] = "required";
  if (!address.postalCode) errors["address.postalCode"] = "required";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { legalName, email, phone, address, company: clean(b.company, 120), title: clean(b.title, 80) } };
}

export function maskEmail(email) {
  const [user, domain] = String(email || "").split("@");
  if (!user || !domain) return "your inbox";
  return `${user[0]}•••@${domain}`;
}

export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return `•••-•••-${digits.slice(-4)}`;
}

export function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

/** "Oh-Beef-NDA-James-Robertson-2026-09-27.pdf" (date in America/Denver). */
export function ndaFilename(legalName, signedAt) {
  const name = String(legalName || "Signer").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "Signer";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(signedAt));
  return `Oh-Beef-NDA-${name}-${day}.pdf`;
}

/**
 * Decrypted signer details, or null when none were entered or they cannot be
 * decrypted (wrong key, corrupted row). Null sends the signer back to the
 * details step instead of failing the request.
 */
export function openDetails(pii, nda) {
  if (!nda?.legalNameEnc) return null;
  try {
    const address = JSON.parse(pii.open(nda.addressEnc) || "{}");
    return {
      legalName: pii.open(nda.legalNameEnc),
      email: pii.open(nda.emailEnc),
      phone: pii.open(nda.phoneEnc),
      address: address && typeof address === "object" ? address : {},
      company: pii.open(nda.companyEnc) || "",
      title: pii.open(nda.titleEnc) || "",
    };
  } catch {
    return null;
  }
}
