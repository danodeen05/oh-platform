import { describe, expect, test } from "vitest";
import { addressLine } from "../plan-nda";

describe("addressLine", () => {
  test("joins the pieces", () => {
    expect(addressLine({ line1: "123 Main St", city: "Salt Lake City", region: "UT", postalCode: "84101" }))
      .toBe("123 Main St, Salt Lake City, UT 84101");
  });
  test("includes line2 and a non-US country", () => {
    expect(addressLine({ line1: "1 Foo", line2: "Suite 2", city: "Toronto", region: "ON", postalCode: "M5V", country: "Canada" }))
      .toBe("1 Foo, Suite 2, Toronto, ON M5V, Canada");
  });
  test("empty for undefined", () => expect(addressLine(undefined)).toBe(""));
});
