/**
 * Catering AI helpers
 *
 * Uses Anthropic claude-sonnet-4-6-20260301 for:
 *  - Website enrichment (logo, colors, company summary)
 *  - Shopping list generation
 *  - Survey summarization
 *  - Booking detail one-liners for owner SMS
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const MODEL = "claude-sonnet-4-6-20260301";

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

    // Resolve relative URLs
    const base = new URL(url);
    for (const key of ["ogImage", "appleTouch", "favicon"]) {
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

  if (!anthropic) return result;

  const { text, metaTags, error } = await fetchWebsite(url);
  if (error) result.fetchError = error;

  // Pick the best candidate logo URL
  const logoCandidate =
    metaTags.ogImage ||
    metaTags.appleTouch ||
    metaTags.favicon ||
    null;

  if (!text && !logoCandidate) return result;

  try {
    const promptText = `You are analyzing a company website to help create a co-branded catering event with Oh! Beef Noodle Soup.

Website URL: ${url}
Extracted visible text (first 3000 chars):
${text || "(no text extracted)"}

Meta/OG image candidate: ${logoCandidate || "none"}
Theme color from meta tag: ${metaTags.themeColor || "none"}

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "logoUrl": "<best candidate logo URL, or null>",
  "brandColors": ["<hex1>", "<hex2>"],
  "suggestedEventName": "<fun event name in the style 'Oh! × CompanyName' or 'CompanyName × Oh!'>",
  "companyDescription": "<1-2 sentence description of the company in a warm, celebratory tone>"
}

Rules:
- Use the meta image/favicon candidate as logoUrl if it looks like a logo (not a random photo)
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

    result.logoUrl = parsed.logoUrl || logoCandidate || null;
    result.brandColors = Array.isArray(parsed.brandColors) ? parsed.brandColors.slice(0, 5) : [];
    result.suggestedEventName = parsed.suggestedEventName || null;
    result.companyDescription = parsed.companyDescription || null;
  } catch (err) {
    console.error("[catering/ai] enrichFromWebsite error:", err.message);
    // Return partial result with whatever we have
    result.logoUrl = logoCandidate || null;
  }

  return result;
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

Write 2-3 sentences summarizing the highlights and any areas for improvement. Be concise and constructive.`,
        },
      ],
    });

    const summary = response.content[0]?.text?.trim() || "";
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
