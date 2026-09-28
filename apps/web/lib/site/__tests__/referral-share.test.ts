import { describe, expect, it, vi } from "vitest";
import { copyText, referralLink, shareOrCopy } from "../referral";

const DATA = { title: "Oh!", text: "Five dollars for your first bowl", url: "https://www.ohbeef.com/order?ref=abc" };

describe("referralLink (Task D9)", () => {
  it("is locale-free and encodes the code", () => {
    expect(referralLink("https://www.ohbeef.com/", "cm a&b")).toBe("https://www.ohbeef.com/order?ref=cm%20a%26b");
  });
});

describe("shareOrCopy (Task D9)", () => {
  it("uses the share sheet when there is one", async () => {
    const share = vi.fn(async () => undefined);
    const writeText = vi.fn(async () => undefined);
    expect(await shareOrCopy({ share, clipboard: { writeText } }, DATA)).toBe("shared");
    expect(share).toHaveBeenCalledWith(DATA);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("closing the share sheet is cancelled, with no copy", async () => {
    const abort = Object.assign(new Error("closed"), { name: "AbortError" });
    const writeText = vi.fn(async () => undefined);
    expect(await shareOrCopy({ share: async () => Promise.reject(abort), clipboard: { writeText } }, DATA)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to copying when share fails or can't share this data", async () => {
    const writeText = vi.fn(async () => undefined);
    expect(await shareOrCopy({ share: async () => Promise.reject(new Error("NotAllowed")), clipboard: { writeText } }, DATA)).toBe("copied");
    expect(await shareOrCopy({ share: async () => undefined, canShare: () => false, clipboard: { writeText } }, DATA)).toBe("copied");
    expect(writeText).toHaveBeenLastCalledWith(DATA.url);
  });

  it("copies on a desktop browser with no share sheet", async () => {
    const writeText = vi.fn(async () => undefined);
    expect(await shareOrCopy({ clipboard: { writeText } }, DATA)).toBe("copied");
  });

  it("is failed when neither works", async () => {
    expect(await shareOrCopy({}, DATA)).toBe("failed");
    expect(await copyText({ clipboard: { writeText: async () => Promise.reject(new Error("denied")) } }, "x")).toBe("failed");
    expect(await shareOrCopy(null, DATA)).toBe("failed");
  });
});
