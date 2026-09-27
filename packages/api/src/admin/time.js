const TZ = "America/Denver";

function zonedParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** Offset (ms) of Denver from UTC at the given instant: local wall time minus UTC. */
function offsetAt(date) {
  const p = zonedParts(date);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of local midnight on the Denver calendar day containing `now`. */
export function startOfDenverDay(now = new Date()) {
  const p = zonedParts(now);
  const guess = new Date(Date.UTC(p.y, p.m - 1, p.d) - offsetAt(now));
  // The offset at midnight can differ from now's on DST days; correct once.
  return new Date(Date.UTC(p.y, p.m - 1, p.d) - offsetAt(guess));
}
