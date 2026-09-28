/**
 * Task B2 fix round 1: SMS caller identity is an EXACT E.164 match of the
 * Twilio From number against User.phone, with smsOptIn true.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toE164, smsMemberFor, usersWithPhone } from "../phone.js";

describe("toE164", () => {
  test("normalizes common US formats and keeps international numbers", () => {
    for (const raw of ["+18015550100", "18015550100", "8015550100", "(801) 555-0100", "801-555-0100", "801.555.0100", "+1 (801) 555-0100", "001 801 555 0100"]) {
      assert.equal(toE164(raw), "+18015550100", raw);
    }
    assert.equal(toE164("+44 20 7946 0958"), "+442079460958");
  });

  test("rejects partial, empty and malformed numbers", () => {
    for (const raw of ["5550100", "555-0100", "", "   ", null, undefined, "abc", "+0123456789", "0801555010", "12345678901234567"]) {
      assert.equal(toE164(raw), null, String(raw));
    }
  });
});

function db(users) {
  return {
    user: {
      findMany: async ({ where }) => users.filter((u) => (u.phone || "").endsWith(where.phone.endsWith)),
    },
  };
}

describe("smsMemberFor", () => {
  test("an exact normalized match with smsOptIn is the member, whatever format the phone was stored in", async () => {
    const prisma = db([{ id: "u1", phone: "(801) 555-0100", smsOptIn: true }]);
    assert.equal((await smsMemberFor(prisma, "+18015550100"))?.id, "u1");
  });

  test("a partial / contains match is not a member", async () => {
    // The stored number merely ends in (or contains) the texter's digits, or vice versa.
    const prisma = db([
      { id: "longer", phone: "+1 385 801 555 0100", smsOptIn: true },
      { id: "other", phone: "+14358015550100", smsOptIn: true },
    ]);
    assert.equal(await smsMemberFor(prisma, "+18015550100"), null);
    assert.equal(await smsMemberFor(db([{ id: "u1", phone: "8015550100", smsOptIn: true }]), "5550100"), null, "short From");
  });

  test("a member who has not opted in to SMS is treated as a guest", async () => {
    const prisma = db([{ id: "u1", phone: "8015550100", smsOptIn: false }]);
    assert.equal(await smsMemberFor(prisma, "+18015550100"), null);
    assert.deepEqual((await usersWithPhone(prisma, "+18015550100")).map((u) => u.id), ["u1"], "STOP/START still find them");
  });

  test("two accounts with the same normalized number are ambiguous: no member", async () => {
    const prisma = db([
      { id: "a", phone: "8015550100", smsOptIn: true },
      { id: "b", phone: "+1 801 555 0100", smsOptIn: true },
    ]);
    assert.equal(await smsMemberFor(prisma, "+18015550100"), null);
  });
});
