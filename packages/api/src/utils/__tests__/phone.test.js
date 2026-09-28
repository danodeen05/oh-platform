import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhoneE164 } from "../phone.js";

test("normalizePhoneE164: 10-digit US number gets +1", () => {
  assert.equal(normalizePhoneE164("(801) 555-1234"), "+18015551234");
  assert.equal(normalizePhoneE164("801-555-1234"), "+18015551234");
  assert.equal(normalizePhoneE164("8015551234"), "+18015551234");
});

test("normalizePhoneE164: 11-digit number starting with 1 keeps a single +1", () => {
  assert.equal(normalizePhoneE164("18015551234"), "+18015551234");
  assert.equal(normalizePhoneE164("1 (801) 555-1234"), "+18015551234");
});

test("normalizePhoneE164: already-plus input keeps its digits, any country", () => {
  assert.equal(normalizePhoneE164("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhoneE164("+18015551234"), "+18015551234");
});

test("normalizePhoneE164: invalid input returns null", () => {
  assert.equal(normalizePhoneE164("abc"), null);
  assert.equal(normalizePhoneE164(""), null);
  assert.equal(normalizePhoneE164(null), null);
  assert.equal(normalizePhoneE164(undefined), null);
  assert.equal(normalizePhoneE164("12345"), null); // too short, no country code
  assert.equal(normalizePhoneE164("+1"), null); // too short even with a +
  assert.equal(normalizePhoneE164("20155512345678"), null); // 14 bare digits: neither 10 nor 11
});

test("normalizePhoneE164 is idempotent on its own output", () => {
  const once = normalizePhoneE164("(801) 555-1234");
  assert.equal(normalizePhoneE164(once), once);
});
