/**
 * `/agents` stays in place (not a customer route) but its pages still use
 * bare button/input/a/h1-h6/p tags styled by the retired global element
 * rules (Task C1 fix round 1). Mirrors the kiosk and CNY layouts.
 *
 * Task C4: it keeps the legacy chrome it used to inherit from the shared
 * [locale] layout.
 */
import { LegacyChrome } from "@/components/legacy/LegacyChrome";

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <LegacyChrome>
      <div className="legacy-ui">{children}</div>
    </LegacyChrome>
  );
}
