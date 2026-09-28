/** Task D10a (parked from F1a): POST /challenges has no emoji default and accepts iconKey. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { challengeCreateData } from "../challenge-input.js";

const BASE = { slug: "s", name: "N", description: "D", requirements: { type: "orders", target: 3 } };

test("no emoji default: iconEmoji is empty when not given", () => {
  const data = challengeCreateData(BASE);
  assert.equal(data.iconEmoji, "");
  assert.equal(data.iconKey, null);
  assert.ok(!/\p{Extended_Pictographic}/u.test(JSON.stringify(data)));
});

test("iconKey is accepted", () => {
  assert.equal(challengeCreateData({ ...BASE, iconKey: "bowl" }).iconKey, "bowl");
});

test("missing required fields -> null (400 in the route)", () => {
  assert.equal(challengeCreateData({ slug: "s" }), null);
  assert.equal(challengeCreateData(undefined), null);
});
