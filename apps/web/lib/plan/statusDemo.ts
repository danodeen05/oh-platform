/**
 * The real guest order status page, running the synthetic demo order
 * (packages/api/src/demo/status-demo.js): nothing it does reaches a kitchen.
 * `embed=1` drops the site chrome; `demoSync=parent` makes the page follow
 * { type: "oh-status-demo", stage } messages from the page embedding it.
 */
export const STATUS_DEMO_CODE = "DEMO-PLAN";

export function statusDemoSrc(locale: string, opts: { embed?: boolean; sync?: boolean; stage?: string } = {}): string {
  const q = new URLSearchParams({ orderQrCode: STATUS_DEMO_CODE });
  if (opts.embed !== false) q.set("embed", "1");
  if (opts.sync) q.set("demoSync", "parent");
  if (opts.stage) q.set("demoStage", opts.stage);
  return `/${locale}/order/status?${q.toString()}`;
}
