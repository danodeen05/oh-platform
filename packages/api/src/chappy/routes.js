/**
 * Chappy routes (Task B1; moved out of index.js).
 *
 *   POST /chappy/guest-token       Public, rate limited. A signed guest token for web chat.
 *   POST /chappy/chat              text/event-stream. Body {message (<=1500 chars), locale, channel:"web"}.
 *   GET  /chappy/history           The caller's active web conversation, for display.
 *   POST /chappy/reset             Start over (a trusted service may reset any {identifier, channel}).
 *   POST /chappy/sms               Twilio webhook (X-Twilio-Signature verified, else 403), same agent, TwiML reply.
 *
 * Identity for chat/history/reset comes from ONE preHandler
 * (requireChappyIdentity): a verified member session, or a signed guest token
 * in the x-chappy-guest header. Raw guestId/sessionId/userId values are never
 * identity; an unidentified request is 401 before any handler runs.
 *
 * The SSE response is sent through Fastify (not reply.raw.writeHead), so the
 * app's CORS allowlist applies and there is never an
 * Access-Control-Allow-Origin: * header.
 *
 * Every handler uses deps.prisma, which index.js sets to basePrisma (never the
 * demo-wrapped client). checkLimits is the hook Task B3 fills in: it may
 * return {status, code} to refuse a turn before any model call.
 *
 * Payments (Task B2): Chappy never confirms a payment. Its checkout tool
 * returns a pay card (web) or a payment-page link (SMS), and the customer's
 * tap pays through POST /orders/:id/confirm-payment (orders/routes.js). The
 * old POST /chappy/confirm-payment is gone.
 */
import { Readable } from "node:stream";
import { resolveChappyWebIdentity } from "../auth/customer.js";
import {
  runTurn,
  loadOrCreateConversation,
  resetConversation,
  handleSpecialKeywords,
  isCustomerTurn,
  MESSAGE_MAX_CHARS,
  CHAPPY_LOCALES,
} from "./agent.js";
import { fallbackText } from "./prompts.js";
import { checkTwilioSignature } from "./twilio-signature.js";
import { formatForSMS } from "./formatters/rcs.js";
import { formatForWeb } from "./formatters/web.js";

export const GUEST_TOKEN_RATE_LIMIT = Object.freeze({ max: 10, timeWindow: "1 hour" });
export const CHAPPY_UNIDENTIFIED = Object.freeze({ error: "Sign in, or start a guest chat session, to talk to Chappy" });

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const twiml = (messages) => `<?xml version="1.0" encoding="UTF-8"?><Response>${messages.map((m) => `<Message>${escapeXml(m)}</Message>`).join("")}</Response>`;

/** What the history view shows: the customer's words and Chappy's text, nothing internal. */
function displayMessages(messages) {
  const out = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    let content = "";
    if (m.role === "user") {
      if (!isCustomerTurn(m)) continue;
      content =
        typeof m.content === "string"
          ? m.content
          : m.content
              .filter((b) => b.type === "text" && !b.text.startsWith("<context>"))
              .map((b) => b.text)
              .join("\n");
    } else if (m.role === "assistant") {
      content = typeof m.content === "string" ? m.content : (m.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    }
    if (content) out.push({ role: m.role, content, timestamp: m.timestamp || null });
  }
  return out;
}

/** Turn runTurn events into SSE frames. The done frame also carries the legacy widget's quick actions. */
async function* toSse(events) {
  yield ": chappy\n\n";
  try {
    for await (const event of events) {
      const { type, ...data } = event;
      if (type === "done") {
        const web = formatForWeb(data.text || "", []);
        data.actions = web.actions;
        data.cards = web.cards;
      }
      yield `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    }
  } catch (err) {
    console.error("[Chappy] stream failed:", err?.message);
    yield `event: error\ndata: ${JSON.stringify({ code: "INTERNAL" })}\n\n`;
  }
}

export async function registerChappyRoutes(app, deps) {
  const {
    prisma,
    customerAuth,
    client,
    tools,
    checkLimits = async () => null,
    now = () => new Date(),
    stripe = null,
    sendSMS = null,
    sendGraphMail = null,
    env = process.env,
  } = deps;

  // What the tools need beyond prisma. Support notifications honor SUPPORT_NOTIFY (env).
  const toolDeps = {
    stripe,
    notify: { env, sendSMS, sendGraphMail },
    webBaseUrl: String(env.WEB_BASE_URL || "https://www.ohbeef.com").replace(/\/+$/, ""),
  };

  /** The one identity check for every web Chappy route: sets req.chappyIdentity or answers 401. */
  async function requireChappyIdentity(req, reply) {
    const identity = resolveChappyWebIdentity({
      who: await customerAuth.resolve(req),
      guestToken: req.headers["x-chappy-guest"],
      verifyGuestToken: customerAuth.verifyGuestToken,
    });
    if (!identity) return reply.code(401).send(CHAPPY_UNIDENTIFIED);
    req.chappyIdentity = identity;
  }

  async function limited(reply, args) {
    const limit = await checkLimits(args);
    if (!limit) return false;
    reply.code(limit.status || 429).send({ error: limit.code || "CHAPPY_LIMIT", ...(limit.body || {}) });
    return true;
  }

  app.post("/chappy/guest-token", { config: { rateLimit: GUEST_TOKEN_RATE_LIMIT } }, async (req, reply) => {
    try {
      return { token: customerAuth.issueGuestToken() };
    } catch {
      return reply.code(503).send({ error: "GUEST_TOKENS_DISABLED" });
    }
  });

  app.post("/chappy/chat", { preHandler: requireChappyIdentity }, async (req, reply) => {
    const body = req.body || {};
    if (typeof body.message !== "string" || !body.message.trim()) return reply.code(400).send({ error: "MESSAGE_REQUIRED" });
    if (body.message.length > MESSAGE_MAX_CHARS) return reply.code(413).send({ error: "MESSAGE_TOO_LONG", max: MESSAGE_MAX_CHARS });
    if (body.channel !== undefined && body.channel !== "web") return reply.code(400).send({ error: "UNSUPPORTED_CHANNEL" });
    const locale = CHAPPY_LOCALES.includes(body.locale) ? body.locale : "en";
    const identity = req.chappyIdentity;
    const message = body.message.trim();

    if (await limited(reply, { identity, channel: "web", message, req })) return reply;
    if (!client) return reply.code(503).send({ error: "CHAPPY_UNAVAILABLE" });

    const at = now();
    const conversation = await loadOrCreateConversation(prisma, identity.identifier, "web", at);
    const abort = new AbortController();
    reply.raw.on("close", () => {
      if (!reply.raw.writableFinished) abort.abort();
    });
    const events = runTurn({ client, prisma, identity, channel: "web", locale, message, conversation, tools, toolDeps, now: at, signal: abort.signal });
    return reply
      .code(200)
      .header("content-type", "text/event-stream; charset=utf-8")
      .header("cache-control", "no-cache, no-transform")
      .header("x-accel-buffering", "no")
      .send(Readable.from(toSse(events)));
  });

  app.get("/chappy/history", { preHandler: requireChappyIdentity }, async (req) => {
    const conversation = await prisma.chappyConversation.findFirst({
      where: { identifier: req.chappyIdentity.identifier, channel: "web", isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!conversation) return { messages: [], isNew: true };
    return { messages: displayMessages(conversation.messages), isNew: false };
  });

  app.post(
    "/chappy/reset",
    {
      preHandler: async (req, reply) => {
        if (customerAuth.isServiceCall(req)) return;
        return requireChappyIdentity(req, reply);
      },
    },
    async (req, reply) => {
      const body = req.body || {};
      if (!req.chappyIdentity) {
        // Trusted service: may reset any conversation, e.g. an SMS one keyed by phone number.
        if (typeof body.identifier !== "string" || !body.identifier || typeof body.channel !== "string") {
          return reply.code(400).send({ error: "identifier and channel required" });
        }
        await resetConversation(prisma, body.identifier, body.channel);
      } else {
        await resetConversation(prisma, req.chappyIdentity.identifier, "web");
      }
      return { success: true, message: "Conversation reset. Ready for a fresh start!" };
    },
  );

  // Twilio SMS webhook: same agent, plain text, TwiML reply. The Twilio
  // signature is checked first; nothing else runs for an unsigned request.
  app.post("/chappy/sms", async (req, reply) => {
    const signature = checkTwilioSignature(req, env);
    if (!signature.ok) {
      console.warn(`[Chappy SMS] rejected: ${signature.reason}`);
      return reply.code(403).send({ error: "INVALID_SIGNATURE" });
    }
    const { From, Body } = req.body || {};
    if (!From || !Body) return reply.code(400).send({ error: "Missing required fields" });
    const phone = String(From).replace(/\D/g, "");
    reply.type("text/xml");
    try {
      const keyword = handleSpecialKeywords(Body);
      if (keyword.handled) {
        if (keyword.action === "UNSUBSCRIBE") {
          await prisma.user.updateMany({ where: { phone: { contains: phone } }, data: { smsOptIn: false } });
        } else if (keyword.action === "RESUBSCRIBE") {
          await prisma.user.updateMany({ where: { phone: { contains: phone } }, data: { smsOptIn: true, smsOptInDate: now() } });
        }
        return twiml([keyword.response]);
      }
      if (String(Body).length > MESSAGE_MAX_CHARS) return twiml([fallbackText("tooLong", "en")]);
      if (!client) return twiml([fallbackText("error", "en")]);

      const user = await prisma.user.findFirst({ where: { phone: { contains: phone } } });
      const identity = { kind: "sms", phone, userId: user?.id || null };
      const limit = await checkLimits({ identity, channel: "sms", message: Body, req });
      if (limit) return twiml([limit.message || fallbackText("error", "en")]);

      const at = now();
      const conversation = await loadOrCreateConversation(prisma, phone, "sms", at);
      let text = "";
      let error = null;
      for await (const event of runTurn({ client, prisma, identity, channel: "sms", locale: "en", message: Body, conversation, tools, toolDeps, now: at })) {
        if (event.type === "done") text = event.text;
        else if (event.type === "error") error = event.code;
      }
      if (error) text = fallbackText(error === "REFUSAL" ? "refusal" : "error", "en");
      const { messages } = formatForSMS(text || fallbackText("empty", "en"));
      console.log(`[Chappy SMS] ${phone}: ${messages.length} message(s)`);
      return twiml(messages);
    } catch (err) {
      console.error("[Chappy SMS Error]", err);
      return twiml([fallbackText("error", "en")]);
    }
  });
}
