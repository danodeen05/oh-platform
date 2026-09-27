import { test } from "node:test";
import assert from "node:assert/strict";
import { parseModelJson } from "../model-json.js";

const obj = { roast: "Alex ordered wide noodles.", highlights: ["a", "b"] };

test("parses bare JSON", () => {
  assert.deepEqual(parseModelJson(JSON.stringify(obj)), obj);
});

test("strips a ```json fence", () => {
  const raw = "```json\n" + JSON.stringify(obj, null, 2) + "\n```";
  assert.deepEqual(parseModelJson(raw), obj);
});

test("strips a bare ``` fence and surrounding prose", () => {
  const raw = "Here you go:\n```\n" + JSON.stringify(obj) + "\n```\nEnjoy!";
  assert.deepEqual(parseModelJson(raw), obj);
});

test("pulls the object out of unfenced prose", () => {
  const raw = "Sure! " + JSON.stringify(obj) + " Hope that helps.";
  assert.deepEqual(parseModelJson(raw), obj);
});

test("throws on non-JSON text", () => {
  assert.throws(() => parseModelJson("just a plain roast, no JSON"));
  assert.throws(() => parseModelJson(""));
  assert.throws(() => parseModelJson(undefined));
});
