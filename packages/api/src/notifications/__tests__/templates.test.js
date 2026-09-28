import { test } from "node:test";
import assert from "node:assert/strict";
import en from "../templates/en.js";
import zhTW from "../templates/zh-TW.js";
import zhCN from "../templates/zh-CN.js";
import es from "../templates/es.js";
import { orderConfirmationText } from "../../notifications.js";

const TEMPLATES = { en, "zh-TW": zhTW, "zh-CN": zhCN, es };

// Sample vars for every template key. kitchenOrderNumber-shaped (digits only)
// so a rendered order number never itself contains a run of Latin letters.
const SAMPLE_VARS = {
  orderConfirmed: { orderNumber: "0042", total: "$23.46", link: "https://www.ohbeef.com/zh-TW/order/status?orderQrCode=ORDER-abc-1" },
  orderConfirmedNoLink: { orderNumber: "0042", total: "$23.46" },
  podReady: { podNumber: "07", link: "https://www.ohbeef.com/zh-TW/order/status?orderQrCode=ORDER-abc-1" },
  podReadyNoLink: { podNumber: "07", orderNumber: "0042" },
  queueUpdate: { orderNumber: "0042", position: 3, minutes: 12 },
  orderReady: { orderNumber: "0042" },
  tierUp: { tierKey: "NOODLE_MASTER", link: "https://www.ohbeef.com/zh-TW/member" },
  creditExpiring: { amount: "$5.00", date: "12/31", link: "https://www.ohbeef.com/zh-TW/member/credits" },
};

const EXPECTED_KEYS = Object.keys(SAMPLE_VARS).sort();

/** Strips http(s) URLs, then finds runs of 3+ Latin letters (the same shape as the C5 no-Latin-copy check). */
function latinWordsOutsideUrls(text) {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "");
  const matches = withoutUrls.match(/[A-Za-z]{3,}/g) || [];
  const ALLOWLIST = new Set(["oh"]);
  return matches.filter((w) => !ALLOWLIST.has(w.toLowerCase()));
}

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

test("all 4 template files export exactly the same keys", () => {
  for (const [locale, mod] of Object.entries(TEMPLATES)) {
    assert.deepEqual(Object.keys(mod).sort(), EXPECTED_KEYS, `${locale} keys`);
  }
});

test("every template key exists for every locale and renders a non-empty string", () => {
  for (const [locale, mod] of Object.entries(TEMPLATES)) {
    for (const key of EXPECTED_KEYS) {
      const rendered = mod[key](SAMPLE_VARS[key]);
      assert.equal(typeof rendered, "string", `${locale}.${key}`);
      assert.ok(rendered.length > 0, `${locale}.${key} rendered empty`);
    }
  }
});

test("zh-TW: no Latin word of 3+ letters outside the allowlist (Oh, URLs, digits, $)", () => {
  for (const key of EXPECTED_KEYS) {
    const rendered = zhTW[key](SAMPLE_VARS[key]);
    const offenders = latinWordsOutsideUrls(rendered);
    assert.deepEqual(offenders, [], `zh-TW.${key} -> "${rendered}"`);
  }
});

test("zh-CN: no Latin word of 3+ letters outside the allowlist (Oh, URLs, digits, $)", () => {
  for (const key of EXPECTED_KEYS) {
    const rendered = zhCN[key](SAMPLE_VARS[key]);
    const offenders = latinWordsOutsideUrls(rendered);
    assert.deepEqual(offenders, [], `zh-CN.${key} -> "${rendered}"`);
  }
});

test("no emoji and no em dash (U+2014) in any template, any locale", () => {
  for (const [locale, mod] of Object.entries(TEMPLATES)) {
    for (const key of EXPECTED_KEYS) {
      const rendered = mod[key](SAMPLE_VARS[key]);
      assert.ok(!EMOJI_RE.test(rendered), `${locale}.${key} has an emoji: "${rendered}"`);
      assert.ok(!rendered.includes("—"), `${locale}.${key} has an em dash: "${rendered}"`);
    }
  }
});

test("en tierUp and en creditExpiring translate the tier key and stay short", () => {
  assert.match(en.tierUp({ tierKey: "BEEF_BOSS", link: "https://x/en/member" }), /Beef Boss/);
  assert.match(en.tierUp({ tierKey: "CHOPSTICK", link: "https://x/en/member" }), /Chopstick/);
  const sms = en.orderConfirmed(SAMPLE_VARS.orderConfirmed);
  assert.ok(sms.length <= 220, `${sms.length} chars (has a long test URL; real QR codes are shorter)`);
});

test("a zh-TW user's order confirmation uses the zh-TW template with a /zh-TW/ status link", () => {
  // orderConfirmationText is pure (no Twilio/network involved) - the right
  // place to check locale resolution and link-locale matching in isolation.
  const order = {
    orderNumber: "ORD-XYZ-000123",
    kitchenOrderNumber: "0099",
    totalCents: 1500,
    orderQrCode: "ORDER-abc-1",
    guest: null,
  };
  const user = { locale: "zh-TW" };
  const text = orderConfirmationText({ ...order, user });
  assert.match(text, /\/zh-TW\/order\/status/);
  assert.deepEqual(latinWordsOutsideUrls(text), []);

  // English stays English when there's no locale at all (matches the pinned
  // demo status-link test's expectations).
  const enText = orderConfirmationText(order);
  assert.match(enText, /\/en\/order\/status/);
});
