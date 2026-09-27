import { describe, expect, test } from "vitest";
import { accessState } from "../access";

describe("accessState", () => {
  test("inactive or failed status is none", () => {
    expect(accessState(false, null)).toBe("none");
    expect(accessState(true, { active: false, nda: "pending" })).toBe("none");
    expect(accessState(true, null)).toBe("none");
  });
  test("pending NDA routes to the NDA page", () => {
    expect(accessState(true, { active: true, nda: "pending" })).toBe("nda");
  });
  test("signed, not required, or an older API without the field are ok", () => {
    expect(accessState(true, { active: true, nda: "signed" })).toBe("ok");
    expect(accessState(true, { active: true, nda: "none" })).toBe("ok");
    expect(accessState(true, { active: true })).toBe("ok");
  });
});
