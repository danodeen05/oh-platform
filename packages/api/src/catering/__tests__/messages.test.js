import { test } from "node:test";
import assert from "node:assert/strict";
import { composeGuestMessage, formatEventWhen, inviteUrl, statusUrl, MESSAGE_KINDS } from "../messages.js";

const event = { slug: "oh-business-planning", eventName: "Oh! Business Planning", clientCompany: "Oh! Business Planning", hostName: "Dano and Kristy", eventDate: new Date("2026-10-05T00:00:00.000Z"), eventAddress: "379 W 3175 N, Lehi, UT 84043" };
const rsvp = { name: "Kristy", rememberToken: "tok123" };
const web = "https://www.ohbeef.com";

test("when is in Denver time", () => {
  assert.equal(formatEventWhen(event.eventDate), "Sunday, October 4 at 6:00 PM");
});

test("urls", () => {
  assert.equal(inviteUrl(web, "oh-business-planning", "tok123"), "https://www.ohbeef.com/en/e/oh-business-planning?rsvp=tok123");
  assert.equal(statusUrl(web, "oh-business-planning", "CAT-1"), "https://www.ohbeef.com/en/e/oh-business-planning/status?qrCode=CAT-1");
});

test("invite names the guest, the host, the time and the link; no emoji or em dashes; under 320 chars", () => {
  const body = composeGuestMessage({ kind: "invite", event, rsvp, webBaseUrl: web, order: null });
  assert.match(body, /Kristy/); assert.match(body, /Dano and Kristy/); assert.match(body, /Sunday, October 4 at 6:00 PM/);
  assert.match(body, /\/en\/e\/oh-business-planning\?rsvp=tok123/);
  assert.doesNotMatch(body, /[—\u{1F300}-\u{1FAFF}]/u);
  assert.ok(body.length <= 320, String(body.length));
});

test("reminder links the order page when there is no order and the status page when there is", () => {
  assert.match(composeGuestMessage({ kind: "reminder", event, rsvp, webBaseUrl: web, order: null }), /\?rsvp=tok123/);
  assert.match(composeGuestMessage({ kind: "reminder", event, rsvp, webBaseUrl: web, order: { orderQrCode: "CAT-9" } }), /status\?qrCode=CAT-9/);
});

test("status needs an order", () => {
  assert.equal(composeGuestMessage({ kind: "status", event, rsvp, webBaseUrl: web, order: null }), null);
  assert.match(composeGuestMessage({ kind: "status", event, rsvp, webBaseUrl: web, order: { orderQrCode: "CAT-9" } }), /CAT-9/);
});

test("kinds", () => assert.deepEqual(MESSAGE_KINDS, ["invite", "reminder", "status"]));
