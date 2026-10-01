// Guest texts in Chappy's voice. Deterministic templates (no model), one SMS segment-ish (<= 320 chars).
// Rules: no emoji, no em dashes, welcoming. Links go to the web app's /en/e/{slug} routes.
export const MESSAGE_KINDS = ["invite", "reminder", "status"];

const whenFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
export function formatEventWhen(eventDate) {
  // "Sunday, October 4 at 6:00 PM"
  const parts = Object.fromEntries(whenFmt.formatToParts(new Date(eventDate)).map((p) => [p.type, p.value]));
  return `${parts.weekday}, ${parts.month} ${parts.day} at ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}
export const inviteUrl = (web, slug, token) => `${web}/en/e/${slug}?rsvp=${encodeURIComponent(token)}`;
export const statusUrl = (web, slug, qr) => `${web}/en/e/${slug}/status?qrCode=${encodeURIComponent(qr)}`;

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

export function composeGuestMessage({ kind, event, rsvp, webBaseUrl, order }) {
  const name = firstName(rsvp.name);
  const title = event.eventName || event.clientCompany;
  const host = event.hostName || "your host";
  const when = formatEventWhen(event.eventDate);
  const invite = inviteUrl(webBaseUrl, event.slug, rsvp.rememberToken);
  const status = order?.orderQrCode ? statusUrl(webBaseUrl, event.slug, order.orderQrCode) : null;
  switch (kind) {
    case "invite":
      return `${name}, Chappy here from Oh! Beef Noodle Soup. ${host} saved you a bowl at ${title}, ${when}. Pick your bowl now so it is ready when you are: ${invite}`;
    case "reminder":
      return status
        ? `${name}, today is the day. ${title}, ${when}. When you arrive, tap I'm here and your bowl starts: ${status}`
        : `${name}, today is the day. ${title}, ${when}. You have not picked a bowl yet. Thirty seconds, I timed it: ${invite}`;
    case "status":
      return status ? `${name}, your bowl is reserved for ${title}. Follow it here and tap I'm here when you arrive: ${status}` : null;
    default:
      throw new Error(`unknown message kind ${kind}`);
  }
}
