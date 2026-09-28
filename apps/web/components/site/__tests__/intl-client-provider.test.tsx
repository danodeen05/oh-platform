/**
 * Task C5 fix round 1: client components get the same missing-key handling
 * as the server (components/site/IntlClientProvider.tsx).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { withPlanFallback } from "@/i18n/plan-fallback";
import zhCN from "@/messages/zh-CN.json";
import { IntlClientProvider } from "../IntlClientProvider";
import type { I18nEnv } from "@/lib/site/i18n-errors";

type Messages = Record<string, unknown>;

function Label({ ns, k }: { ns: string; k: string }) {
  const t = useTranslations(ns);
  return <span data-label>{t(k)}</span>;
}

function render(env: I18nEnv, messages: Messages, ns: string, k: string, locale = "zh-CN") {
  return renderToString(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/Denver" now={new Date("2026-09-28T12:00:00Z")}>
      <IntlClientProvider env={env}>
        <Label ns={ns} k={k} />
      </IntlClientProvider>
    </NextIntlClientProvider>,
  );
}

const MSGS: Messages = { site: { nav: { menu: "菜单" } } };

describe("IntlClientProvider", () => {
  it("production: a missing key renders as an empty string, never the key path", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = render("production", MSGS, "site.nav", "doesNotExist");
    expect(html).toContain("<span data-label=\"true\"></span>");
    expect(html).not.toContain("site.nav.doesNotExist");
    expect(spy).toHaveBeenCalledWith("[i18n] MISSING_MESSAGE: site.nav.doesNotExist");
    spy.mockRestore();
  });

  it("production: existing keys still render", () => {
    expect(render("production", MSGS, "site.nav", "menu")).toContain("菜单");
  });

  it("development: shows the key path so the gap is visible", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(render("development", MSGS, "site.nav", "doesNotExist")).toContain("site.nav.doesNotExist");
    spy.mockRestore();
  });

  it("test: a missing key throws", () => {
    expect(() => render("test", MSGS, "site.nav", "doesNotExist")).toThrow(/MISSING_MESSAGE/);
  });

  it("never blanks plan text that exists through withPlanFallback (zh-CN plan.meta falls back to English)", () => {
    const zh = zhCN as Messages;
    expect((zh.plan as Messages).meta).toBeUndefined(); // the premise: zh-CN has no plan.meta of its own
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = render("production", withPlanFallback(zh), "plan.meta", "title");
    expect(html).toContain("Oh! Beef Noodle Soup Business Plan");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("wraps every NextIntlClientProvider branch in app/[locale]/layout.tsx, including the plan's", () => {
    const src = readFileSync(path.resolve(__dirname, "../../../app/[locale]/layout.tsx"), "utf8");
    const providers = src.match(/<NextIntlClientProvider messages=\{messages\}>\s*<IntlClientProvider>/g) ?? [];
    const all = src.match(/<NextIntlClientProvider\b/g) ?? [];
    expect(all.length).toBe(4);
    expect(providers.length).toBe(all.length);
    expect(src).toMatch(/if \(isPlanRoute\) \{\s*return \(\s*<NextIntlClientProvider messages=\{messages\}>\s*<IntlClientProvider>/);
  });
});
