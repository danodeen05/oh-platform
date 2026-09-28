/** Task D11 fix round 1: CNY zodiac insights in the reader's language. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { zodiacFallbacks, zodiacInsightsPrompt, zodiacName } from "../zodiac-insights.js";

const EMOJI = /\p{Extended_Pictographic}/u;
const guests = { compatibleGuests: [{ name: "Mei", zodiac: "Tiger" }], avoidGuests: [{ name: "Ana", zodiac: "Rat" }] };
/** Latin words left once the guests' own names (data) are removed. */
const english = (text) => text.replace(/\bMei\b|\bAna\b/g, "").match(/[A-Za-z]{2,}/g) ?? [];

for (const locale of ["zh-TW", "zh-CN"]) {
  test(`${locale} fallbacks have no English, with and without party matches`, () => {
    for (const g of [guests, { compatibleGuests: [], avoidGuests: [] }]) {
      const f = zodiacFallbacks({ locale, zodiac: "Horse", ...g });
      for (const [k, v] of Object.entries(f)) {
        assert.deepEqual(english(v), [], `${locale} ${k}: ${v}`);
        assert.doesNotMatch(v, EMOJI);
        assert.doesNotMatch(v, /—/);
      }
    }
  });
}

test("es fallbacks are Spanish and name the animal in Spanish", () => {
  const f = zodiacFallbacks({ locale: "es", zodiac: "Horse", ...guests });
  assert.match(f.horseYearAdvice, /Caballo/);
  assert.match(f.hangOutWith, /Tigre/);
  assert.doesNotMatch(Object.values(f).join(" "), /\bSeek out\b|\bWatch out\b|\bshould\b/);
});

test("en fallbacks are unchanged in meaning; an unknown locale is English", () => {
  assert.match(zodiacFallbacks({ locale: "en", zodiac: "Horse", ...guests }).horseYearAdvice, /Horses should embrace/);
  assert.equal(zodiacFallbacks({ locale: "fr", zodiac: "Horse", ...guests }).horseYearAdvice, zodiacFallbacks({ locale: "en", zodiac: "Horse", ...guests }).horseYearAdvice);
  assert.equal(zodiacName("Dragon", "zh-TW"), "龍");
  assert.equal(zodiacName("Dragon", "zh-CN"), "龙");
});

test("the prompt names the reader's language and asks for no emoji", () => {
  const args = { firstName: "Mei", zodiac: "Horse", birthday: "1990-01-01", compatibility: { best: ["Tiger"], avoid: ["Rat"] }, ...guests };
  assert.match(zodiacInsightsPrompt({ ...args, locale: "zh-TW" }), /Write every value in Traditional Chinese \(Taiwan\)/);
  assert.match(zodiacInsightsPrompt({ ...args, locale: "zh-CN" }), /Write every value in Simplified Chinese/);
  assert.match(zodiacInsightsPrompt({ ...args, locale: "es" }), /Write every value in Spanish/);
  assert.match(zodiacInsightsPrompt({ ...args, locale: "en" }), /Write every value in English\. Do not use emoji/);
  assert.doesNotMatch(zodiacInsightsPrompt({ ...args, locale: "en" }), /zodiacEmoji/);
});
