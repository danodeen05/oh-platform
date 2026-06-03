/**
 * Catering AI helpers
 *
 * Uses Anthropic claude-sonnet-4-6 for:
 *  - Website enrichment (logo, colors, company summary)
 *  - Shopping list generation
 *  - Survey summarization
 *  - Booking detail one-liners for owner SMS
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const MODEL = "claude-sonnet-4-6";

// House style: no em/en dashes in guest-facing copy. Models occasionally ignore
// the prompt rule (especially at high temperature), so enforce it deterministically.
function stripEmDashes(text) {
  if (!text) return text;
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/\s+,/g, ",");
}

// Shared cacheable system prompt for catering context
const CATERING_SYSTEM = {
  type: "text",
  text: "You are a helpful assistant for Oh! Beef Noodle Soup, a restaurant that hosts co-branded catering events. You help with event enrichment, shopping lists, and guest experience summaries. Always respond with valid JSON when instructed.",
  cache_control: { type: "ephemeral" },
};

/**
 * Fetch a URL server-side and extract HTML text + meta tags.
 * Returns { html, text, metaTags, error } — never throws.
 */
async function fetchWebsite(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "OhBeef-CateringBot/1.0" },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!resp.ok) return { html: "", text: "", metaTags: {}, error: `HTTP ${resp.status}` };
    const html = await resp.text();

    // Extract meta tags
    const metaTags = {};
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const appleTouch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
    const favicon = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);

    if (ogImage) metaTags.ogImage = ogImage[1];
    if (appleTouch) metaTags.appleTouch = appleTouch[1];
    if (favicon) metaTags.favicon = favicon[1];
    if (ogTitle) metaTags.ogTitle = ogTitle[1];
    if (ogDesc) metaTags.ogDesc = ogDesc[1];
    if (themeColor) metaTags.themeColor = themeColor[1];

    // Schema.org / JSON-LD logo — usually the real brand logo
    // Handles both "logo":"url" and "logo":{ ... "url":"..." }
    const jsonLdLogo =
      html.match(/"logo"\s*:\s*"([^"]+)"/i) ||
      html.match(/"logo"\s*:\s*\{[^}]*?"url"\s*:\s*"([^"]+)"/i);
    if (jsonLdLogo) metaTags.jsonLdLogo = jsonLdLogo[1].replace(/\\\//g, "/");

    // First <img> whose src/alt/class/id mentions "logo" (skip data URIs/sprites)
    const imgTags = html.match(/<img\b[^>]*>/gi) || [];
    for (const tag of imgTags) {
      if (!/logo/i.test(tag)) continue;
      const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
      if (!srcMatch) continue;
      const src = srcMatch[1];
      if (/^data:/i.test(src) || /sprite|placeholder/i.test(src)) continue;
      metaTags.imgLogo = src;
      break;
    }

    // Highest-resolution icon link (parse all rel*=icon links, pick biggest sizes)
    const iconLinks = html.match(/<link\b[^>]*rel=["'][^"']*icon[^"']*["'][^>]*>/gi) || [];
    let bestIcon = null;
    let bestIconSize = 0;
    for (const tag of iconLinks) {
      const href = tag.match(/\bhref=["']([^"']+)["']/i);
      if (!href) continue;
      const sizes = tag.match(/\bsizes=["'](\d+)x\d+["']/i);
      const size = sizes ? parseInt(sizes[1], 10) : 0;
      if (size >= bestIconSize) { bestIconSize = size; bestIcon = href[1]; }
    }
    if (bestIcon) metaTags.iconHiRes = bestIcon;

    // Resolve relative URLs
    const base = new URL(url);
    for (const key of ["ogImage", "appleTouch", "favicon", "jsonLdLogo", "imgLogo", "iconHiRes"]) {
      if (metaTags[key] && !metaTags[key].startsWith("http")) {
        try { metaTags[key] = new URL(metaTags[key], base).href; } catch {}
      }
    }

    // Extract visible text (strip tags, collapse whitespace)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000); // Cap context

    return { html, text, metaTags, error: null };
  } catch (err) {
    return { html: "", text: "", metaTags: {}, error: err.message };
  }
}

// Bare registrable host for a URL, e.g. "https://www.acme.com/x" -> "acme.com"
function getDomain(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

// Verify a candidate URL actually resolves to a real image (not a 404/HTML/1x1).
// Returns true/false — never throws.
async function verifyImage(candidateUrl) {
  if (!candidateUrl || /^data:/i.test(candidateUrl)) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(candidateUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "OhBeef-CateringBot/1.0" },
      redirect: "follow",
    });
    clearTimeout(timeout);
    // Don't download the whole body — we only needed the headers.
    try { await resp.body?.cancel?.(); } catch {}
    if (!resp.ok) return false;
    const ct = resp.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return false;
    const len = Number(resp.headers.get("content-length") || 0);
    if (len && len < 200) return false; // skip 1x1 trackers / empty pixels
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the cleanest available company logo for a website.
 *
 * Strategy (first candidate that resolves to a real image wins):
 *   1. Clearbit Logo API — a clean, transparent brand PNG keyed off the domain.
 *      This is the "pull a clean png" path and works for most real companies.
 *   2. Schema.org / JSON-LD <logo> — the site's declared brand mark.
 *   3. <img> tagged as a logo (src/alt/class contains "logo").
 *   4. apple-touch-icon, then the highest-res favicon/icon link.
 *   5. og:image LAST — it's usually a hero/social photo, which is exactly the
 *      "strange image" problem we want to avoid leading with.
 *   6. Google's favicon service as a final, always-clean fallback.
 */
async function findBestLogo(url, metaTags) {
  const domain = getDomain(url);
  const ordered = [
    domain && `https://logo.clearbit.com/${domain}`,
    metaTags.jsonLdLogo,
    metaTags.imgLogo,
    metaTags.appleTouch,
    metaTags.iconHiRes,
    metaTags.favicon,
    metaTags.ogImage,
    domain && `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ].filter(Boolean);

  // De-dupe while preserving order
  const seen = new Set();
  const candidates = ordered.filter((c) => !seen.has(c) && seen.add(c));

  for (const candidate of candidates) {
    if (await verifyImage(candidate)) return candidate;
  }
  return null;
}

/**
 * Enrich an event from its company website.
 * Returns { logoUrl, brandColors, suggestedEventName, companyDescription, fetchError }
 */
export async function enrichFromWebsite(url) {
  const result = {
    logoUrl: null,
    brandColors: [],
    suggestedEventName: null,
    companyDescription: null,
    fetchError: null,
  };

  const { text, metaTags, error } = await fetchWebsite(url);
  if (error) result.fetchError = error;

  // Logo is chosen by verified-candidate ranking (Clearbit-first), NOT by the
  // model — this is what stops "strange" hero/social images from being picked.
  result.logoUrl = await findBestLogo(url, metaTags);

  // Without the model we can still return the logo; the rest is best-effort.
  if (!anthropic || !text) return result;

  try {
    const promptText = `You are analyzing a company website to help create a co-branded catering event with Oh! Beef Noodle Soup.

Website URL: ${url}
Extracted visible text (first 3000 chars):
${text || "(no text extracted)"}

Theme color from meta tag: ${metaTags.themeColor || "none"}

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "brandColors": ["<hex1>", "<hex2>"],
  "suggestedEventName": "<fun event name in the style 'Oh! × CompanyName' or 'CompanyName × Oh!'>",
  "companyDescription": "<1-2 sentence description of the company in a warm, celebratory tone>"
}

Rules:
- Extract 1-2 dominant brand colors as hex codes from the theme color or infer from the text context
- If you can't determine a color, omit it from the array (keep the array short and accurate)
- Keep companyDescription positive and suitable for a shared event landing page
`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: [CATERING_SYSTEM],
      messages: [{ role: "user", content: promptText }],
    });

    const raw = response.content[0]?.text?.trim() || "{}";
    // Strip possible markdown code block wrapper
    const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    result.brandColors = Array.isArray(parsed.brandColors) ? parsed.brandColors.slice(0, 5) : [];
    result.suggestedEventName = parsed.suggestedEventName || null;
    result.companyDescription = stripEmDashes(parsed.companyDescription) || null;
  } catch (err) {
    console.error("[catering/ai] enrichFromWebsite error:", err.message);
    // logoUrl already set above; just return what we have.
  }

  return result;
}

// Rotating "angles" so two guests with the SAME zodiac still get different riffs.
const ZODIAC_ANGLES = [
  "a quirky personality trait people born in this sign are famous for",
  "which Oh! Beef Noodle Soup bowl, broth, or topping secretly matches this sign's vibe",
  "a famous person or legendary figure born under this zodiac sign",
  "which zodiac sign they get along with best (fun, since they're at a group event)",
  "a tiny, playful good-luck fortune for today",
  "a one-line myth or legend tied to this zodiac animal",
  "this sign's secret 'superpower'",
  "a flavor or food this sign would instantly fall for",
  "a lucky number or color for this sign and a cheeky reason why",
];

/**
 * Generate a short, personalized "Chappy Chopstix" greeting for an attendee as
 * they build their bowl. Uses the guest's first name and (if they shared a
 * birthdate) their Chinese zodiac. High temperature + a random angle + a nonce
 * keep every attendee's message unique, even within the same zodiac sign.
 *
 * @param {{ name: string, zodiac?: string|null, dob?: string|null, eventName?: string|null }}
 * @returns {Promise<string|null>} the greeting text, or null if unavailable
 */
export async function chappyAttendeeGreeting({ name, zodiac, dob, eventName }) {
  if (!anthropic || !name) return null;

  const firstName = String(name).trim().split(/\s+/)[0] || String(name).trim();
  const angle = ZODIAC_ANGLES[Math.floor(Math.random() * ZODIAC_ANGLES.length)];
  const nonce = Math.random().toString(36).slice(2, 8);

  const task = zodiac
    ? `Greet ${firstName} by name, reveal with delight that they are a ${zodiac} (Chinese zodiac), then share ${angle}.`
    : `Give ${firstName} a warm, playful welcome and a cheeky nudge to build their perfect noodle bowl.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 160,
      temperature: 1,
      system: [
        {
          type: "text",
          text: "You are Chappy Chopstix, the playful chopsticks mascot of Oh! Beef Noodle Soup. You delight guests with short, warm, witty one-liners as they order at a catering event.",
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Write Chappy's greeting for a guest building their noodle bowl${eventName ? ` at "${eventName}"` : ""}.
${task}

Rules:
- 1 to 2 short sentences, about 30 words max total.
- Sound like Chappy: fun, warm, a little cheeky. At most ONE tasteful emoji.
- Be specific and surprising, never generic. Vary your wording each time. (variation key: ${nonce})
- Output ONLY the greeting text. No quotes, no preamble, no self-correction.`,
        },
      ],
    });
    return stripEmDashes(response.content[0]?.text?.trim()) || null;
  } catch (err) {
    console.error("[catering/ai] chappyAttendeeGreeting error:", err.message);
    return null;
  }
}

/**
 * Generate a shopping list for a catering event.
 * @param {{ attendeeCount: number, orderItems: Array<{name: string, quantity: number}>, event: object }}
 * @returns {Array<{ ingredient: string, quantity: number, unit: string }>}
 */
export async function generateShoppingList({ attendeeCount, orderItems, event }) {
  if (!anthropic) return [];

  try {
    const itemSummary = orderItems
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(", ");

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [CATERING_SYSTEM],
      messages: [
        {
          role: "user",
          content: `Generate a shopping list for an Oh! Beef Noodle Soup catering event.

Event details:
- Client: ${event.clientCompany || "Unknown"}
- Expected attendees: ${attendeeCount}
- Order breakdown (from RSVPs so far): ${itemSummary || "none yet"}

Return ONLY valid JSON (no markdown) as an array:
[
  { "ingredient": "beef brisket", "quantity": 15, "unit": "lbs" },
  ...
]

Include: proteins, noodles, broth ingredients, vegetables, condiments, and disposables. Base quantities on the order breakdown if available, otherwise estimate for ${attendeeCount} people. Be practical and precise.`,
        },
      ],
    });

    const raw = response.content[0]?.text?.trim() || "[]";
    const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("[catering/ai] generateShoppingList error:", err.message);
    return [];
  }
}

// Recursively find the first string value under a key matching `key`.
function deepFindString(obj, key) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === key && typeof obj[k] === "string") return obj[k];
  }
  for (const k of Object.keys(obj)) {
    const r = deepFindString(obj[k], key);
    if (r) return r;
  }
  return null;
}

// Models sometimes wrap prose in ```json fences or a JSON object despite being
// asked for plain text. Strip fences and, if the payload is JSON, pull out the
// summary text so the UI never shows raw JSON.
function extractSummaryText(raw) {
  if (!raw) return "";
  let t = raw.trim();
  const fence = t.match(/```(?:json|markdown)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const obj = JSON.parse(t);
      return deepFindString(obj, "summary") || t;
    } catch {
      // not valid JSON — fall through and return the cleaned text
    }
  }
  return t;
}

/**
 * Summarize survey responses into an aggregate object.
 * @param {Array<{ overallScore: number, areaScores: object, comment: string | null }>} responses
 * @returns {{ overallScore: number, areaAverages: object, summary: string }}
 */
export async function summarizeSurvey(responses) {
  if (!responses || responses.length === 0) {
    return { overallScore: 0, areaAverages: {}, summary: "No responses yet." };
  }

  // Compute averages locally first (used as fallback too)
  const overallScore =
    responses.reduce((s, r) => s + (r.overallScore || 0), 0) / responses.length;

  const areaSums = {};
  const areaCounts = {};
  for (const r of responses) {
    const scores = r.areaScores || {};
    for (const [k, v] of Object.entries(scores)) {
      areaSums[k] = (areaSums[k] || 0) + (Number(v) || 0);
      areaCounts[k] = (areaCounts[k] || 0) + 1;
    }
  }
  const areaAverages = {};
  for (const k of Object.keys(areaSums)) {
    areaAverages[k] = Math.round((areaSums[k] / areaCounts[k]) * 10) / 10;
  }

  if (!anthropic) return { overallScore: Math.round(overallScore * 10) / 10, areaAverages, summary: "" };

  try {
    const comments = responses
      .filter((r) => r.comment)
      .map((r) => `- "${r.comment}"`)
      .join("\n")
      .slice(0, 2000);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: [CATERING_SYSTEM],
      messages: [
        {
          role: "user",
          content: `Summarize catering event survey feedback for an internal report.

Number of responses: ${responses.length}
Overall average score: ${overallScore.toFixed(1)} / 5
Area averages: ${JSON.stringify(areaAverages)}

Guest comments:
${comments || "(no comments)"}

Write 2-3 sentences summarizing the highlights and any areas for improvement. Be concise and constructive.

IMPORTANT: Respond with ONLY the summary as plain prose. Do NOT use JSON, markdown, code fences, headings, or any formatting — output just the sentences.`,
        },
      ],
    });

    const raw = response.content[0]?.text?.trim() || "";
    const summary = extractSummaryText(raw);
    return { overallScore: Math.round(overallScore * 10) / 10, areaAverages, summary };
  } catch (err) {
    console.error("[catering/ai] summarizeSurvey error:", err.message);
    return { overallScore: Math.round(overallScore * 10) / 10, areaAverages, summary: "" };
  }
}

/**
 * Generate a one-line booking detail summary for the owner alert SMS.
 * @param {string} notes
 * @returns {string}
 */
export async function summarizeBookingDetail(notes) {
  if (!anthropic || !notes || !notes.trim()) return "";

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 100,
      system: [CATERING_SYSTEM],
      messages: [
        {
          role: "user",
          content: `Summarize this catering booking note in one short sentence (max 20 words) for an owner SMS alert:\n\n"${notes.slice(0, 500)}"`,
        },
      ],
    });
    return response.content[0]?.text?.trim() || "";
  } catch (err) {
    console.error("[catering/ai] summarizeBookingDetail error:", err.message);
    return "";
  }
}
