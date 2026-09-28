/**
 * Task G3: the release-2 prod smoke checks, as data plus a tiny runner.
 * Every check is a read, except the Chappy guest question (one model call,
 * no money). Nothing here charges a card or writes an order.
 *
 * The CLI is packages/api/scripts/cutover-smoke.mjs. Checks print a name and
 * a short detail only (status codes, counts): never a token or body dump.
 */

export const EXPECTED_ACTIVE_PODS = { "city-creek": 75, "university-place": 70 };
const TENANT_HEADERS = { "x-tenant-slug": "oh" };

async function status(fetchImpl, url, init = {}) {
  const res = await fetchImpl(url, { redirect: "manual", ...init });
  return res;
}

function expectStatus(name, url, want, init) {
  return {
    name,
    async run(fetchImpl) {
      const res = await status(fetchImpl, url, init);
      return { ok: res.status === want, detail: `${res.status}` };
    },
  };
}

/** Reads an SSE body to the end and returns the event names seen, in order. */
export async function sseEvents(res) {
  const text = await res.text();
  return [...text.matchAll(/^event: (\S+)$/gm)].map((m) => m[1]);
}

/**
 * @param {{ api: string, web: string, chappy?: boolean, locales?: string[] }} opts
 */
export function buildChecks({ api, web, chappy = true, locales = ["en", "zh-TW"] }) {
  const A = api.replace(/\/+$/, "");
  const W = web.replace(/\/+$/, "");
  const checks = [
    {
      name: "api /health",
      async run(f) {
        const res = await status(f, `${A}/health`);
        const body = res.status === 200 ? await res.json() : null;
        return { ok: res.status === 200 && body?.ok === true, detail: `${res.status}` };
      },
    },
    {
      name: "api /membership/program (tiers 10+2 / 25+5)",
      async run(f) {
        const res = await status(f, `${A}/membership/program`);
        if (res.status !== 200) return { ok: false, detail: `${res.status}` };
        const body = await res.json();
        const need = (key) => (Array.isArray(body?.tiers) ? body.tiers.find((t) => t.key === key)?.need : null);
        const a = need("CHOPSTICK");
        const b = need("NOODLE_MASTER");
        const ok = a?.orders === 10 && a?.referrals === 2 && b?.orders === 25 && b?.referrals === 5 && !("goodwill" in (body || {}));
        return { ok, detail: ok ? "200, 10+2 / 25+5, no goodwill caps exposed" : "200, unexpected program" };
      },
    },
    {
      name: "api seats: city-creek 75 and university-place 70 active pods",
      async run(f) {
        const res = await status(f, `${A}/locations`, { headers: TENANT_HEADERS });
        if (res.status !== 200) return { ok: false, detail: `/locations ${res.status}` };
        const locations = await res.json();
        const parts = [];
        let ok = true;
        for (const [slug, want] of Object.entries(EXPECTED_ACTIVE_PODS)) {
          const loc = (Array.isArray(locations) ? locations : []).find((l) => l.slug === slug);
          if (!loc) {
            ok = false;
            parts.push(`${slug}: no open location with this slug`);
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          const seatsRes = await status(f, `${A}/locations/${encodeURIComponent(loc.id)}/seats`, { headers: TENANT_HEADERS });
          // eslint-disable-next-line no-await-in-loop
          const body = seatsRes.status === 200 ? await seatsRes.json() : null;
          const n = Array.isArray(body?.seats) ? body.seats.length : -1;
          if (n !== want) ok = false;
          parts.push(`${slug}: ${n}/${want}`);
        }
        return { ok, detail: parts.join(", ") };
      },
    },
    {
      name: "api plan demo order status (DEMO-PLAN)",
      async run(f) {
        const res = await status(f, `${A}/orders/status?orderQrCode=DEMO-PLAN`, { headers: TENANT_HEADERS });
        return { ok: res.status === 200, detail: `${res.status}` };
      },
    },
  ];

  for (const locale of locales) {
    checks.push(expectStatus(`web /${locale} home`, `${W}/${locale}`, 200));
    checks.push(expectStatus(`web /${locale}/rewards`, `${W}/${locale}/rewards`, 200));
    checks.push(expectStatus(`web /${locale}/menu`, `${W}/${locale}/menu`, 200));
  }
  checks.push(expectStatus("web /zh-TW/privacy", `${W}/zh-TW/privacy`, 200));
  checks.push(expectStatus("web plan demo embed (/en/order/status?orderQrCode=DEMO-PLAN&embed=1&demoSync=parent)", `${W}/en/order/status?orderQrCode=DEMO-PLAN&embed=1&demoSync=parent`, 200));
  checks.push(expectStatus("web /en/member signed out (200, sign-in prompt)", `${W}/en/member`, 200));
  checks.push({
    name: "web /en/loyalty is a 308 to /en/rewards",
    async run(f) {
      const res = await status(f, `${W}/en/loyalty`);
      const loc = res.headers.get("location") || "";
      return { ok: res.status === 308 && /\/en\/rewards$/.test(loc.split("?")[0]), detail: `${res.status} -> ${loc.replace(W, "")}` };
    },
  });
  checks.push(expectStatus("web /en/tenants is gone (404)", `${W}/en/tenants`, 404));
  checks.push({
    name: "web Stripe webhook has its secret (bad signature is 400, not 500)",
    async run(f) {
      const res = await status(f, `${W}/api/webhooks/stripe`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=invalid" }, body: "{}" });
      return { ok: res.status === 400, detail: `${res.status}${res.status === 500 ? " (STRIPE_WEBHOOK_SECRET missing?)" : ""}` };
    },
  });
  checks.push({
    name: "api Chappy SMS webhook refuses an unsigned request (403)",
    async run(f) {
      const res = await status(f, `${A}/chappy/sms`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "From=%2B10000000000&Body=smoke" });
      return { ok: res.status === 403, detail: `${res.status}` };
    },
  });

  if (chappy) {
    checks.push({
      name: "chappy guest token + one guest question",
      async run(f) {
        const tokRes = await status(f, `${A}/chappy/guest-token`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        if (tokRes.status !== 200) return { ok: false, detail: `guest-token ${tokRes.status}` };
        const { token } = await tokRes.json();
        if (typeof token !== "string" || !token) return { ok: false, detail: "guest-token: no token" };
        const chatRes = await status(f, `${A}/chappy/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-chappy-guest": token },
          body: JSON.stringify({ message: "What time do you open on Saturday?", locale: "en", channel: "web" }),
        });
        if (chatRes.status !== 200) return { ok: false, detail: `chat ${chatRes.status}` };
        const events = await sseEvents(chatRes);
        const ok = events.includes("text") && events.includes("done") && !events.includes("error");
        return { ok, detail: `chat 200, events: ${[...new Set(events)].join(",")}` };
      },
    });
  }
  return checks;
}

/** Runs every check (never stops early); returns { passed, failed, results }. */
export async function runChecks(checks, fetchImpl = fetch, log = console.log) {
  const results = [];
  for (const check of checks) {
    let result;
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential on purpose: gentle on prod, readable output
      result = await check.run(fetchImpl);
    } catch (err) {
      result = { ok: false, detail: `threw: ${err?.message ?? err}` };
    }
    results.push({ name: check.name, ...result });
    log(`${result.ok ? "PASS" : "FAIL"}  ${check.name}  (${result.detail})`);
  }
  const failed = results.filter((r) => !r.ok).length;
  return { passed: results.length - failed, failed, results };
}
