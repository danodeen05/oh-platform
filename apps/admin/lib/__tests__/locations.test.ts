import { describe, expect, test } from "vitest";
import {
  emptyLocationForm, formFromLocation, locationAddressLine, locationCreateBody, locationPatchBody, tenantBody,
  topSuggestions, validateLocationForm, validateTenantForm, type LocationRow, type Tenant, type ValidateAddressResponse,
} from "../locations";

const TENANTS: Tenant[] = [{ id: "t1", slug: "oh", brandName: "Oh! Beef Noodle Soup" }];

const LOCATION: LocationRow = {
  id: "l1", name: "SoHo", address: "123 Main St", city: "Salt Lake City", state: "UT", zipCode: "84101",
  phone: "8015551234", isActive: true, tenantId: "t1", lat: 40.75, lng: -111.9,
};

describe("emptyLocationForm / formFromLocation", () => {
  test("empty form defaults to the first tenant", () => {
    expect(emptyLocationForm(TENANTS).tenantId).toBe("t1");
  });
  test("editing seeds every field, with null fields as empty strings", () => {
    const f = formFromLocation({ ...LOCATION, state: null, zipCode: null, phone: null }, TENANTS);
    expect(f).toMatchObject({ name: "SoHo", address: "123 Main St", city: "Salt Lake City", state: "", zipCode: "", phone: "" });
  });
});

describe("validateLocationForm", () => {
  test("requires name, address and city", () => {
    const errors = validateLocationForm(emptyLocationForm(TENANTS));
    expect(errors.name).toBeTruthy();
    expect(errors.address).toBeTruthy();
    expect(errors.city).toBeTruthy();
  });
  test("passes with the required fields filled", () => {
    const f = { ...emptyLocationForm(TENANTS), name: "SoHo", address: "123 Main St", city: "SLC" };
    expect(validateLocationForm(f)).toEqual({});
  });
});

describe("locationCreateBody", () => {
  test("defaults missing lat/lng to 0", () => {
    const f = { ...emptyLocationForm(TENANTS), name: "SoHo", address: "123 Main St", city: "SLC" };
    expect(locationCreateBody(f)).toMatchObject({ lat: 0, lng: 0 });
  });
  test("keeps found coordinates", () => {
    const f = { ...emptyLocationForm(TENANTS), name: "SoHo", address: "123 Main St", city: "SLC", lat: 40.7, lng: -111.9 };
    expect(locationCreateBody(f)).toMatchObject({ lat: 40.7, lng: -111.9 });
  });
});

describe("locationPatchBody", () => {
  test("sends empty optional fields as null, not omitted or blank", () => {
    const f = formFromLocation(LOCATION, TENANTS);
    f.state = ""; f.zipCode = ""; f.phone = "";
    const body = locationPatchBody(f);
    expect(body.state).toBeNull();
    expect(body.zipCode).toBeNull();
    expect(body.phone).toBeNull();
  });
});

describe("topSuggestions", () => {
  test("caps at 3", () => {
    const res: ValidateAddressResponse = {
      valid: true, message: "ok",
      suggestions: Array.from({ length: 5 }, (_, i) => ({ displayName: `${i}`, address: "", city: "", state: "", zipCode: "", lat: 0, lng: 0 })),
    };
    expect(topSuggestions(res)).toHaveLength(3);
  });
  test("empty when there is no response", () => {
    expect(topSuggestions(null)).toEqual([]);
  });
});

describe("validateTenantForm / tenantBody", () => {
  test("requires slug and brand name", () => {
    const errors = validateTenantForm({ slug: "", brandName: "" });
    expect(errors.slug).toBeTruthy();
    expect(errors.brandName).toBeTruthy();
  });
  test("trims the body", () => {
    expect(tenantBody({ slug: " oh ", brandName: " Oh! " })).toEqual({ slug: "oh", brandName: "Oh!" });
  });
});

describe("locationAddressLine", () => {
  test("joins address, city and state", () => {
    expect(locationAddressLine(LOCATION)).toBe("123 Main St, Salt Lake City, UT");
  });
  test("drops a missing state", () => {
    expect(locationAddressLine({ ...LOCATION, state: null })).toBe("123 Main St, Salt Lake City");
  });
  test("skips the redundant suffix when the address already spells out the city", () => {
    const l = { ...LOCATION, address: "50 S Main St, Salt Lake City, UT 84101" };
    expect(locationAddressLine(l)).toBe("50 S Main St, Salt Lake City, UT 84101");
  });
});
