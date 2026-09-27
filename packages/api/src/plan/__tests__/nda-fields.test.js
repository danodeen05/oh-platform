/** Run with: node --test packages/api/src/plan/__tests__/ */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createPii, piiKeyFromEnv } from "../pii.js";
import { toE164, validateDetails, maskEmail, maskPhone, firstName } from "../nda-fields.js";

const KEY = crypto.randomBytes(32);

describe("pii.js", () => {
  test("seal/open round-trips text and never stores plaintext", () => {
    const pii = createPii(KEY);
    const sealed = pii.seal("Jim Robertson");
    assert.match(sealed, /^v1:/);
    assert.ok(!sealed.includes("Jim"));
    assert.equal(pii.open(sealed), "Jim Robertson");
    assert.notEqual(pii.seal("x"), pii.seal("x"), "random IV per seal");
  });
  test("null passes through", () => {
    const pii = createPii(KEY);
    assert.equal(pii.seal(null), null);
    assert.equal(pii.open(null), null);
  });
  test("tampering is detected", () => {
    const pii = createPii(KEY);
    const sealed = pii.seal("secret");
    const raw = Buffer.from(sealed.slice(3), "base64");
    raw[raw.length - 1] ^= 1;
    assert.throws(() => pii.open(`v1:${raw.toString("base64")}`));
  });
  test("a different key cannot open", () => {
    const sealed = createPii(KEY).seal("secret");
    assert.throws(() => createPii(crypto.randomBytes(32)).open(sealed));
  });
  test("bytes round-trip", () => {
    const pii = createPii(KEY);
    const pdf = Buffer.from("%PDF-1.7 hello");
    const blob = pii.sealBytes(pdf);
    assert.ok(Buffer.isBuffer(blob));
    assert.deepEqual(pii.openBytes(blob), pdf);
  });
  test("hmac is keyed and stable", () => {
    const a = createPii(KEY);
    assert.equal(a.hmac("n1:123456"), a.hmac("n1:123456"));
    assert.notEqual(a.hmac("n1:123456"), createPii(crypto.randomBytes(32)).hmac("n1:123456"));
  });
  test("piiKeyFromEnv validates length", () => {
    assert.equal(piiKeyFromEnv({}), null);
    assert.equal(piiKeyFromEnv({ PLAN_PII_KEY: KEY.toString("base64") }).length, 32);
    assert.equal(piiKeyFromEnv({ PLAN_PII_KEY: "short" }), null);
  });
});

describe("nda-fields.js", () => {
  test("toE164 normalizes US and international numbers", () => {
    assert.equal(toE164("(801) 555-1234"), "+18015551234");
    assert.equal(toE164("801.555.1234"), "+18015551234");
    assert.equal(toE164("1 801 555 1234"), "+18015551234");
    assert.equal(toE164("+44 20 7946 0958"), "+442079460958");
    assert.equal(toE164("555-1234"), null);
    assert.equal(toE164("hello"), null);
    assert.equal(toE164("+1234"), null);
    assert.equal(toE164(42), null);
  });
  const good = {
    legalName: "  James   Robertson ",
    email: "Jim@Firm.com ",
    phone: "(801) 555-1234",
    address: { line1: "1 Main St", line2: "", city: "Lehi", region: "UT", postalCode: "84043", country: "" },
    company: "America First CU",
    title: "VP",
  };
  test("validateDetails cleans a good submission", () => {
    const r = validateDetails(good);
    assert.equal(r.ok, true);
    assert.equal(r.value.legalName, "James Robertson");
    assert.equal(r.value.email, "jim@firm.com");
    assert.equal(r.value.phone, "+18015551234");
    assert.equal(r.value.address.country, "United States");
    assert.equal(r.value.address.line2, "");
    assert.equal(r.value.company, "America First CU");
  });
  test("validateDetails reports each bad field", () => {
    const r = validateDetails({ legalName: "J", email: "nope", phone: "12", address: { line1: "", city: "", region: "", postalCode: "" } });
    assert.equal(r.ok, false);
    for (const f of ["legalName", "email", "phone", "address.line1", "address.city", "address.region", "address.postalCode"]) {
      assert.ok(r.errors[f], f);
    }
  });
  test("validateDetails tolerates missing optional fields and junk types", () => {
    const r = validateDetails({ ...good, company: 7, title: undefined, address: { ...good.address, line2: null } });
    assert.equal(r.ok, true);
    assert.equal(r.value.company, "");
    assert.equal(r.value.title, "");
    assert.equal(validateDetails(null).ok, false);
  });
  test("masks and first name", () => {
    assert.equal(maskEmail("jim@firm.com"), "j•••@firm.com");
    assert.equal(maskPhone("+18015551234"), "•••-•••-1234");
    assert.equal(firstName("James Robertson"), "James");
    assert.equal(firstName(""), "there");
  });
});
