import { expect, test } from "vitest";
import { toastQueue } from "../ui/Toast";

test("keeps at most 3 toasts, newest last, and expires by id", () => {
  let q = toastQueue.push([], { id: 1, message: "a" });
  q = toastQueue.push(q, { id: 2, message: "b" });
  q = toastQueue.push(q, { id: 3, message: "c" });
  q = toastQueue.push(q, { id: 4, message: "d" });
  expect(q.map((t) => t.id)).toEqual([2, 3, 4]);
  expect(toastQueue.expire(q, 3).map((t) => t.id)).toEqual([2, 4]);
});
