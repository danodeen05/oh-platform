/**
 * Task D8 (carried from D7): the desktop language menu logged a hydration
 * mismatch in dev. Its trigger's `aria-controls` came from React's `useId`,
 * which encodes the component's position in the tree, so any server/client
 * drift anywhere above the shell (providers, Clerk, a dev-only wrapper)
 * changed the id between the server HTML and the first client render. The
 * id is now a fixed string (there is one compact menu per page, in the top
 * bar), so it can't depend on where the menu sits.
 */
import { NextIntlClientProvider } from "next-intl";
import { useId, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { LocaleSwitch, LOCALE_MENU_ID } from "../shell/LocaleSwitch";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="America/Denver">
      {children}
    </NextIntlClientProvider>
  );
}

/** Extra id-consuming wrappers shift every useId below them. */
function Drift({ depth, children }: { depth: number; children: ReactNode }) {
  const id = useId();
  if (depth <= 0) return <div data-drift={id}>{children}</div>;
  return (
    <section data-drift={id}>
      <span />
      <Drift depth={depth - 1}>{children}</Drift>
    </section>
  );
}

function controlsOf(html: string): string | null {
  return /aria-controls="([^"]+)"/.exec(html)?.[1] ?? null;
}

describe("LocaleSwitch (compact)", () => {
  it("renders the same aria-controls wherever it sits in the tree", () => {
    const plain = renderToString(
      <Providers>
        <LocaleSwitch variant="compact" />
      </Providers>,
    );
    const drifted = renderToString(
      <Providers>
        <Drift depth={3}>
          <LocaleSwitch variant="compact" />
        </Drift>
      </Providers>,
    );
    expect(controlsOf(plain)).toBe(LOCALE_MENU_ID);
    expect(controlsOf(drifted)).toBe(LOCALE_MENU_ID);
  });

  it("has no React-generated id in its markup", () => {
    const html = renderToString(
      <Providers>
        <LocaleSwitch variant="compact" />
      </Providers>,
    );
    // React's useId output looks like «r0» / :r0: / _R_..._
    expect(html).not.toMatch(/«r|:r[0-9a-z]+:|_R_/);
  });
});
