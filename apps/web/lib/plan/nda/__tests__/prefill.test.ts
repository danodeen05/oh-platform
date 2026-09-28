import { describe, expect, test } from "vitest";
import { startingIdentity } from "../prefill";

const SAVED = {
  legalName: "Patricia Lee",
  email: "p.lee@lease.com",
  phone: "+18015550000",
  address: { line1: "9 Elm", city: "Provo", region: "UT", postalCode: "84601" },
};

describe("NDA form prefill", () => {
  test("uses the invitation's name and email before they save details", () => {
    expect(startingIdentity({ details: null, prefill: { legalName: "Pat Lee", email: "pat@lease.com" } })).toEqual({ legalName: "Pat Lee", email: "pat@lease.com" });
  });
  test("their saved details always win over the invitation", () => {
    expect(startingIdentity({ details: SAVED, prefill: { legalName: "Pat Lee", email: "pat@lease.com" } })).toEqual({ legalName: "Patricia Lee", email: "p.lee@lease.com" });
  });
  test("blank when there is nothing to prefill", () => {
    expect(startingIdentity({ details: null })).toEqual({ legalName: "", email: "" });
    expect(startingIdentity({ details: null, prefill: null })).toEqual({ legalName: "", email: "" });
  });
});
