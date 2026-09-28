/**
 * `/agents` stays in place (not a customer route) but its pages still use
 * bare button/input/a/h1-h6/p tags styled by the retired global element
 * rules (Task C1 fix round 1). Mirrors the kiosk and CNY layouts.
 */
export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return <div className="legacy-ui">{children}</div>;
}
