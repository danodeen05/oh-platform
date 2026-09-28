/**
 * Task C4: dev-only lab for the site shell. Long placeholder content so the
 * top bar's scroll state, the dock, the More sheet and the bottom padding
 * (`--dock-h`) can be exercised by hand and by tests/e2e/site/shell.spec.ts.
 * Same production gate as the motion lab.
 *
 * The body copy is a dev-only placeholder (not customer copy), so it is not
 * in messages/*.json; the shell around it is fully translated.
 */
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Body, Display, Eyebrow, Title } from "@/components/site/Text";
import { Icon } from "@/components/site/icons/Icon";
import { TierMark } from "@/components/site/tiers/TierMark";

const SECTIONS = Array.from({ length: 8 }, (_, i) => i + 1);

export default async function ShellLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  const locale = await getLocale();

  return (
    <div data-testid="shell-lab" className="mx-auto max-w-3xl px-5 pb-16 pt-10 md:px-8 md:pt-20">
      <Eyebrow locale={locale} className="text-oh-ember-light">
        Shell lab (dev only)
      </Eyebrow>
      <Display locale={locale} className="mt-3 text-oh-cream">
        The shell around every rebuilt page.
      </Display>
      <Body locale={locale} className="mt-4 max-w-prose text-oh-cream/75">
        Scroll to watch the top bar pick up its background. On a phone the dock sits at the bottom and this page pads
        itself by --dock-h, so the last line below stays readable above it.
      </Body>

      {/* The dock's brand marks and the redrawn seal icon, large, for review. */}
      <div data-testid="shell-lab-marks" className="mt-10 flex flex-wrap items-center gap-8 rounded-2xl bg-oh-ink p-6">
        <span className="text-oh-cream">
          <Icon name="seal" size={72} />
        </span>
        <span className="text-oh-ember-light">
          <Icon name="seal" size={24} />
        </span>
        <span className="text-oh-cream">
          <TierMark tier="chopstick" tone="current" size={72} />
        </span>
        <span className="text-oh-mute">
          <TierMark tier="chopstick" tone="current" size={24} />
        </span>
        <span className="text-oh-cream">
          <TierMark tier="chopstick" tone="current" size={24} />
        </span>
      </div>

      {SECTIONS.map((n) => (
        <section key={n} className="mt-14 border-t border-oh-stone/60 pt-10">
          <Title locale={locale} className="text-oh-cream">
            Section {n}
          </Title>
          <Body locale={locale} className="mt-3 text-oh-cream/70">
            Placeholder text to make the page long. The broth simmers, the noodles are pulled, the bowl is set down at a
            pod. Nothing here is real copy; it only gives the shell something to scroll over.
          </Body>
          <div className="mt-6 h-40 rounded-2xl bg-oh-ink" aria-hidden="true" />
        </section>
      ))}

      <p data-testid="shell-lab-end" className="mt-14 text-sm text-oh-mute">
        End of the lab page. This line should sit fully above the dock.
      </p>
    </div>
  );
}
