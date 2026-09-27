/** Locations and brands (tenants). Types and pure form helpers for LocationSheet / TenantSheet. */

export type Tenant = { id: string; slug: string; brandName: string };

export type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  city: string;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  isActive: boolean;
  tenantId: string;
  lat: number;
  lng: number;
};

export type LocationForm = {
  name: string; address: string; city: string; state: string; zipCode: string; phone: string; tenantId: string;
  lat: number | null; lng: number | null;
};

export function emptyLocationForm(tenants: Tenant[]): LocationForm {
  return { name: "", address: "", city: "", state: "", zipCode: "", phone: "", tenantId: tenants[0]?.id ?? "", lat: null, lng: null };
}

export function formFromLocation(l: LocationRow | null, tenants: Tenant[]): LocationForm {
  if (!l) return emptyLocationForm(tenants);
  return {
    name: l.name, address: l.address ?? "", city: l.city, state: l.state ?? "", zipCode: l.zipCode ?? "",
    phone: l.phone ?? "", tenantId: l.tenantId, lat: l.lat || null, lng: l.lng || null,
  };
}

export function validateLocationForm(f: LocationForm): Partial<Record<keyof LocationForm, string>> {
  const errors: Partial<Record<keyof LocationForm, string>> = {};
  if (!f.name.trim()) errors.name = "Give the location a name.";
  if (!f.address.trim()) errors.address = "Enter an address.";
  if (!f.city.trim()) errors.city = "Enter a city.";
  if (!f.tenantId) errors.tenantId = "Choose a brand.";
  return errors;
}

export type LocationCreateBody = {
  name: string; address: string; city: string; state: string | null; zipCode: string | null; phone: string | null;
  tenantId: string; lat: number; lng: number;
};

/** Create sends lat||0 and lng||0 (the API defaults them the same way). */
export function locationCreateBody(f: LocationForm): LocationCreateBody {
  return {
    name: f.name.trim(), address: f.address.trim(), city: f.city.trim(),
    state: f.state.trim() || null, zipCode: f.zipCode.trim() || null, phone: f.phone.trim() || null,
    tenantId: f.tenantId, lat: f.lat || 0, lng: f.lng || 0,
  };
}

export type LocationPatchBody = {
  name: string; address: string | null; city: string; state: string | null; zipCode: string | null;
  phone: string | null; tenantId: string; lat?: number; lng?: number;
};

/** Edit sends PATCH with empty optional values as null (not omitted, and not empty strings). */
export function locationPatchBody(f: LocationForm): LocationPatchBody {
  const body: LocationPatchBody = {
    name: f.name.trim(), address: f.address.trim() || null, city: f.city.trim(),
    state: f.state.trim() || null, zipCode: f.zipCode.trim() || null, phone: f.phone.trim() || null,
    tenantId: f.tenantId,
  };
  if (f.lat != null) body.lat = f.lat;
  if (f.lng != null) body.lng = f.lng;
  return body;
}

export type AddressSuggestion = { displayName: string; address: string; city: string; state: string; zipCode: string; lat: number; lng: number };
export type ValidateAddressResponse = { valid: boolean; message: string; suggestions?: AddressSuggestion[] };

/** Up to 3 "Did you mean" suggestions shown under the address field. */
export function topSuggestions(res: ValidateAddressResponse | null, max = 3): AddressSuggestion[] {
  return (res?.suggestions ?? []).slice(0, max);
}

// --- Brands (tenants) ---

export type TenantForm = { slug: string; brandName: string };

export function emptyTenantForm(): TenantForm {
  return { slug: "", brandName: "" };
}

export function formFromTenant(t: Tenant | null): TenantForm {
  return t ? { slug: t.slug, brandName: t.brandName } : emptyTenantForm();
}

export function validateTenantForm(f: TenantForm): Partial<Record<keyof TenantForm, string>> {
  const errors: Partial<Record<keyof TenantForm, string>> = {};
  if (!f.slug.trim()) errors.slug = "Give the brand a slug.";
  if (!f.brandName.trim()) errors.brandName = "Give the brand a name.";
  return errors;
}

export function tenantBody(f: TenantForm): { slug: string; brandName: string } {
  return { slug: f.slug.trim(), brandName: f.brandName.trim() };
}

/**
 * "123 Main St, Salt Lake City, UT". Some seeded addresses already spell out
 * the city (from the old free-text create form) - skip the redundant suffix then.
 */
export function locationAddressLine(l: Pick<LocationRow, "address" | "city" | "state">): string {
  const address = l.address ?? "";
  const cityState = [l.city, l.state].filter(Boolean).join(", ");
  if (!cityState) return address;
  if (address.toLowerCase().includes(l.city.toLowerCase())) return address;
  return [address, cityState].filter(Boolean).join(", ");
}
