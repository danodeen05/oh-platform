import { expect, test, vi } from "vitest";
import { runOptimistic } from "../optimistic";

test("applies, commits, and keeps the change on success", async () => {
  const apply = vi.fn(), revert = vi.fn();
  expect(await runOptimistic({ apply, revert, commit: async () => {} })).toBe(true);
  expect(apply).toHaveBeenCalledOnce();
  expect(revert).not.toHaveBeenCalled();
});

test("reverts when the commit fails and reports false", async () => {
  const apply = vi.fn(), revert = vi.fn();
  expect(await runOptimistic({ apply, revert, commit: async () => { throw new Error("offline"); } })).toBe(false);
  expect(revert).toHaveBeenCalledOnce();
});

test("applies before the commit starts, so the switch moves on tap", async () => {
  const order: string[] = [];
  await runOptimistic({ apply: () => order.push("apply"), revert: () => order.push("revert"), commit: async () => { order.push("commit"); } });
  expect(order).toEqual(["apply", "commit"]);
});
