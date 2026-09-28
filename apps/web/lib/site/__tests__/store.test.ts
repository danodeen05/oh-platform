import { describe, expect, it } from "vitest";
import {
  formatGiftCode,
  giftAmountValid,
  giftCodeComplete,
  giftDesign,
  giftErrorCode,
  localizeProduct,
  maxQuantity,
  parseGiftDollars,
  productImage,
  productSizes,
  storeErrorCode,
} from "../store";

describe("store helpers (Task D10)", () => {
  it("matches product photos by slug: bowl-empty, chopsticks, files, and bowl-flatlay instead of the placeholder", () => {
    expect(productImage({ slug: "ceramic-noodle-bowl", imageUrl: "/store/CeramicBowl.png" })).toEqual({ kind: "site", key: "bowl-empty" });
    expect(productImage({ slug: "bamboo-chopsticks", imageUrl: "/store/ChopsticksSet.png" })).toEqual({ kind: "site", key: "chopsticks" });
    expect(productImage({ slug: "chili-oil", imageUrl: "/store/ChiliOil.png" })).toEqual({ kind: "file", src: "/store/SignatureChiliOil.png" });
    expect(productImage({ slug: "new-thing", imageUrl: "/store/placeholder.png" })).toEqual({ kind: "site", key: "bowl-flatlay" });
    expect(productImage({ slug: "new-thing", imageUrl: null })).toEqual({ kind: "site", key: "bowl-flatlay" });
  });

  it("localizes a product row, falling back to English", () => {
    const p = { name: "Chili Oil", nameZhCN: "辣油", description: "Hot", descriptionEs: "Picante" };
    expect(localizeProduct(p, "zh-CN")).toEqual({ name: "辣油", description: "Hot" });
    expect(localizeProduct(p, "es")).toEqual({ name: "Chili Oil", description: "Picante" });
  });

  it("reads sizes and caps quantity at the API limit or the stock", () => {
    expect(productSizes(JSON.stringify([{ size: "S", stock: 0 }, { size: "M", stock: 3 }]))).toEqual([
      { size: "S", soldOut: true },
      { size: "M", soldOut: false },
    ]);
    expect(productSizes("not json")).toEqual([]);
    expect(maxQuantity(null)).toBe(20);
    expect(maxQuantity(4)).toBe(4);
    expect(maxQuantity(0)).toBe(0);
  });

  it("maps refusals to translated codes", () => {
    expect(storeErrorCode("CREDIT_SHORT", 409)).toBe("CREDIT_SHORT");
    expect(storeErrorCode("SOMETHING_NEW", 500)).toBe("GENERIC");
    expect(storeErrorCode(null, 0)).toBe("NETWORK_ERROR");
    expect(storeErrorCode(null, 402)).toBe("PAYMENT_NOT_VERIFIED");
    expect(giftErrorCode("NOT_ALLOWED_FOR_GIFT_CARDS", 400)).toBe("NOT_ALLOWED_FOR_GIFT_CARDS");
  });

  it("validates gift amounts as whole dollars from $10 to $500", () => {
    expect(parseGiftDollars("35")).toBe(35);
    expect(parseGiftDollars("35.50")).toBeNull();
    expect(parseGiftDollars("$35")).toBeNull();
    expect(giftAmountValid(9)).toBe(false);
    expect(giftAmountValid(10)).toBe(true);
    expect(giftAmountValid(500)).toBe(true);
    expect(giftAmountValid(501)).toBe(false);
    expect(giftAmountValid(null)).toBe(false);
  });

  it("formats gift card codes and designs", () => {
    expect(formatGiftCode("abcd efgh-jkmn pqrs tuv")).toBe("ABCD-EFGH-JKMN-PQRS");
    expect(giftCodeComplete("ABCD-EFGH-JKMN-PQRS")).toBe(true);
    expect(giftCodeComplete("ABCD")).toBe(false);
    expect(giftDesign("gold")).toBe("gold");
    expect(giftDesign("rainbow")).toBe("classic");
  });
});
