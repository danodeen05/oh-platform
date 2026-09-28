/**
 * Task G3 fix round 1: an old pod sticker shows a translated "out of date"
 * notice with the kiosk hint and a choose-your-pod link, in every locale.
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { RetiredPodNotice } from "../pod/RetiredPodNotice";
import en from "../../../messages/en.json";
import zhTW from "../../../messages/zh-TW.json";
import zhCN from "../../../messages/zh-CN.json";
import es from "../../../messages/es.json";

const LOCALES = { en, "zh-TW": zhTW, "zh-CN": zhCN, es } as const;

function render(locale: keyof typeof LOCALES, props: Parameters<typeof RetiredPodNotice>[0] = {}) {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={LOCALES[locale]} timeZone="America/Denver">
      <RetiredPodNotice {...props} />
    </NextIntlClientProvider>,
  );
}

describe("RetiredPodNotice", () => {
  it("renders the translated title, kiosk hint and a choose-your-pod link in all four locales", () => {
    for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
      const m = LOCALES[locale].podCode;
      const html = render(locale, { locationName: "City Creek" });
      expect(html).toContain(m.title);
      expect(html).toContain(m.kiosk);
      expect(html).toContain(m.choose);
      expect(html).toContain(`href="/${locale}/order"`);
      expect(html).toContain("City Creek");
    }
  });

  it("offers the order status only when an order code is known", () => {
    expect(render("en")).not.toContain(en.podCode.status);
    expect(render("en", { orderQrCode: "ORD-1" })).toContain("/en/order/status?orderQrCode=ORD-1");
  });

  it("the podCode keys match across locales and carry no em dash", () => {
    const keys = Object.keys(en.podCode).sort();
    for (const messages of Object.values(LOCALES)) {
      expect(Object.keys(messages.podCode).sort()).toEqual(keys);
      expect(JSON.stringify(messages.podCode)).not.toContain("—");
    }
  });
});
