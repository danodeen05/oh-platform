/**
 * Operating Hours Utility Module
 *
 * Handles all logic related to restaurant operating hours, including:
 * - Checking if location is open
 * - Validating online ordering availability
 * - Filtering valid arrival times
 * - Getting next open time
 */

// Default operating hours - Mon-Sat 11am-9pm, Sunday closed
const DEFAULT_HOURS = {
  mon: { open: "11:00", close: "21:00" },
  tue: { open: "11:00", close: "21:00" },
  wed: { open: "11:00", close: "21:00" },
  thu: { open: "11:00", close: "21:00" },
  fri: { open: "11:00", close: "21:00" },
  sat: { open: "11:00", close: "21:00" },
  sun: null, // Closed
};

// Day of week mapping (0 = Sunday, 1 = Monday, etc.)
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Online ordering opens 1 hour before restaurant, closes 15 min before close
const ORDER_OPEN_OFFSET_MINUTES = -60; // Opens 1 hour early
const ORDER_CLOSE_OFFSET_MINUTES = -15; // Closes 15 min before restaurant

// Global bypass - set DISABLE_TIME_RESTRICTIONS=true to bypass all time checks
const GLOBAL_TIME_BYPASS = process.env.DISABLE_TIME_RESTRICTIONS === "true";

// Locations that bypass time restrictions (for testing)
// Can be set via environment variable as comma-separated slugs/names
const BYPASS_TIME_RESTRICTIONS = (process.env.BYPASS_TIME_RESTRICTIONS || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Check if a location should bypass time restrictions
 */
function shouldBypassTimeRestrictions(location) {
  // Global bypass for all locations
  if (GLOBAL_TIME_BYPASS) return true;

  if (!location) return false;
  const slug = (location.slug || "").toLowerCase();
  const name = (location.name || "").toLowerCase().replace(/\s+/g, "-");
  return BYPASS_TIME_RESTRICTIONS.includes(slug) || BYPASS_TIME_RESTRICTIONS.includes(name);
}

/**
 * Parse a time string like "11:00" or "21:00" into minutes from midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Format minutes from midnight back to HH:MM
 */
function formatMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Format minutes to 12-hour time like "11am" or "8:45pm"
 */
function formatMinutesToDisplay(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12;
  if (mins === 0) {
    return `${displayHours}${period}`;
  }
  return `${displayHours}:${mins.toString().padStart(2, "0")}${period}`;
}

/**
 * Get current time in the location's timezone
 */
function getLocationTime(timezone = "America/Denver", date = new Date()) {
  const options = {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  const currentMinutes = hour * 60 + minute;
  const dayIndex = date.getDay();

  return { weekday, dayIndex, currentMinutes, hour, minute };
}

/**
 * Get the operating hours for a specific day
 */
function getHoursForDay(location, dayKey) {
  const hours = location?.operatingHours || DEFAULT_HOURS;
  return hours[dayKey] || null;
}

/**
 * Check if the location is currently open
 */
export function isLocationOpen(location, date = new Date()) {
  if (location?.isClosed) return false;

  const { weekday, currentMinutes } = getLocationTime(location?.timezone, date);
  const dayHours = getHoursForDay(location, weekday);

  if (!dayHours) return false;

  const openMinutes = parseTimeToMinutes(dayHours.open);
  const closeMinutes = parseTimeToMinutes(dayHours.close);

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Check if the location can accept online orders
 * Online ordering opens 1 hour before restaurant and closes 15 min before close
 */
export function canAcceptOrders(location, date = new Date()) {
  if (location?.isClosed) return false;

  // Bypass time restrictions for testing locations
  if (shouldBypassTimeRestrictions(location)) {
    return true;
  }

  const { weekday, currentMinutes } = getLocationTime(location?.timezone, date);
  const dayHours = getHoursForDay(location, weekday);

  if (!dayHours) return false;

  const openMinutes = parseTimeToMinutes(dayHours.open);
  const closeMinutes = parseTimeToMinutes(dayHours.close);

  const orderOpenMinutes = openMinutes + ORDER_OPEN_OFFSET_MINUTES;
  const orderCloseMinutes = closeMinutes + ORDER_CLOSE_OFFSET_MINUTES;

  return currentMinutes >= orderOpenMinutes && currentMinutes < orderCloseMinutes;
}

/**
 * Get when the location next opens (for both restaurant and online ordering)
 */
export function getNextOpenTime(location, date = new Date()) {
  const { dayIndex, currentMinutes, weekday } = getLocationTime(location?.timezone, date);
  const hours = location?.operatingHours || DEFAULT_HOURS;

  // Check if open today but not yet
  const todayHours = getHoursForDay(location, weekday);
  if (todayHours) {
    const openMinutes = parseTimeToMinutes(todayHours.open);
    const orderOpenMinutes = openMinutes + ORDER_OPEN_OFFSET_MINUTES;

    if (currentMinutes < openMinutes) {
      return {
        restaurantOpens: formatMinutesToDisplay(openMinutes),
        orderingOpens: formatMinutesToDisplay(orderOpenMinutes),
        isToday: true,
        dayName: "today",
      };
    }
  }

  // Check next 7 days
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (dayIndex + i) % 7;
    const nextDayKey = DAY_KEYS[nextDayIndex];
    const nextDayHours = hours[nextDayKey];

    if (nextDayHours) {
      const openMinutes = parseTimeToMinutes(nextDayHours.open);
      const orderOpenMinutes = openMinutes + ORDER_OPEN_OFFSET_MINUTES;
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      return {
        restaurantOpens: formatMinutesToDisplay(openMinutes),
        orderingOpens: formatMinutesToDisplay(orderOpenMinutes),
        isToday: false,
        dayName: i === 1 ? "tomorrow" : dayNames[nextDayIndex],
      };
    }
  }

  return null; // Location appears to be permanently closed
}

/**
 * Get valid arrival time options based on current time and operating hours
 * Returns array of valid options like ["asap", "15", "30", "45", "60"]
 */
export function getValidArrivalTimes(location, date = new Date()) {
  // Bypass time restrictions for testing locations - return all options
  if (shouldBypassTimeRestrictions(location)) {
    return ["asap", "15", "30", "45", "60", "90"];
  }

  const { weekday, currentMinutes } = getLocationTime(location?.timezone, date);
  const dayHours = getHoursForDay(location, weekday);

  if (!dayHours || location?.isClosed) {
    return [];
  }

  const openMinutes = parseTimeToMinutes(dayHours.open);
  const closeMinutes = parseTimeToMinutes(dayHours.close);
  const orderCloseMinutes = closeMinutes + ORDER_CLOSE_OFFSET_MINUTES;

  // If before opening, no valid times
  if (currentMinutes < openMinutes + ORDER_OPEN_OFFSET_MINUTES) {
    return [];
  }

  // If after order cutoff, no valid times
  if (currentMinutes >= orderCloseMinutes) {
    return [];
  }

  const allOptions = [
    { key: "asap", offsetMinutes: 0 },
    { key: "15", offsetMinutes: 15 },
    { key: "30", offsetMinutes: 30 },
    { key: "45", offsetMinutes: 45 },
    { key: "60", offsetMinutes: 60 },
    { key: "90", offsetMinutes: 90 },
  ];

  const validOptions = [];

  for (const option of allOptions) {
    const arrivalMinutes = currentMinutes + option.offsetMinutes;

    // Arrival must be within opening hours and before close
    // If ordering before open, earliest arrival is at opening
    const effectiveArrival = Math.max(arrivalMinutes, openMinutes);

    if (effectiveArrival >= openMinutes && effectiveArrival < closeMinutes) {
      validOptions.push(option.key);
    }
  }

  return validOptions;
}

/**
 * Validate that a specific arrival time is within operating hours
 * Used when processing orders
 */
export function validateArrivalTime(location, arrivalMinutesFromNow, date = new Date()) {
  // Bypass time restrictions for testing locations
  if (shouldBypassTimeRestrictions(location)) {
    return { valid: true };
  }

  const { weekday, currentMinutes } = getLocationTime(location?.timezone, date);
  const dayHours = getHoursForDay(location, weekday);

  if (!dayHours || location?.isClosed) {
    return {
      valid: false,
      reason: "Location is closed",
    };
  }

  const openMinutes = parseTimeToMinutes(dayHours.open);
  const closeMinutes = parseTimeToMinutes(dayHours.close);
  const orderCloseMinutes = closeMinutes + ORDER_CLOSE_OFFSET_MINUTES;

  // Check if ordering is still open
  if (currentMinutes >= orderCloseMinutes) {
    return {
      valid: false,
      reason: "Online ordering has closed for today",
    };
  }

  const arrivalMinutes = currentMinutes + arrivalMinutesFromNow;

  // If ordering before restaurant opens, arrival must be at or after opening
  if (arrivalMinutes < openMinutes && arrivalMinutesFromNow > 0) {
    return {
      valid: false,
      reason: `Arrival time must be after ${formatMinutesToDisplay(openMinutes)}`,
    };
  }

  // Arrival must be before closing
  if (arrivalMinutes >= closeMinutes) {
    return {
      valid: false,
      reason: `Arrival time must be before ${formatMinutesToDisplay(closeMinutes)}`,
    };
  }

  return { valid: true };
}

/**
 * Get comprehensive location status for display
 */
export function getLocationStatus(location, date = new Date()) {
  const bypassActive = shouldBypassTimeRestrictions(location);
  const isOpen = isLocationOpen(location, date) || bypassActive;
  const canOrder = canAcceptOrders(location, date);
  const nextOpen = !canOrder ? getNextOpenTime(location, date) : null;
  const validTimes = canOrder ? getValidArrivalTimes(location, date) : [];

  const { weekday, currentMinutes } = getLocationTime(location?.timezone, date);
  const dayHours = getHoursForDay(location, weekday);

  let statusMessage = null;
  let preOrderMessage = null;

  // If bypass is active, don't show any closed messages
  if (bypassActive) {
    // No status message needed - ordering is available
  } else if (location?.isClosed) {
    statusMessage = "Temporarily Closed";
  } else if (!dayHours) {
    statusMessage = "Closed Today";
  } else if (!isOpen && canOrder) {
    const openMinutes = parseTimeToMinutes(dayHours.open);
    preOrderMessage = `Pre-ordering available! We open at ${formatMinutesToDisplay(openMinutes)}.`;
  } else if (!canOrder && nextOpen) {
    if (nextOpen.isToday) {
      statusMessage = `Online ordering opens at ${nextOpen.orderingOpens}`;
    } else {
      statusMessage = `Online ordering opens ${nextOpen.dayName} at ${nextOpen.orderingOpens}`;
    }
  }

  // Get close time for display
  let closesAt = null;
  let orderingClosesAt = null;
  if (dayHours) {
    const closeMinutes = parseTimeToMinutes(dayHours.close);
    closesAt = formatMinutesToDisplay(closeMinutes);
    orderingClosesAt = formatMinutesToDisplay(closeMinutes + ORDER_CLOSE_OFFSET_MINUTES);
  }
  // No invented close time under the testing bypass: customers see real hours
  // or none (Task D1 review). hoursBypassed tells the site to hide open/closed.

  return {
    isOpen,
    openNow: isLocationOpen(location, date),
    hoursBypassed: bypassActive,
    canOrder,
    validArrivalTimes: validTimes,
    preOrderMessage,
    statusMessage,
    closesAt,
    orderingClosesAt,
    nextOpen,
  };
}

const WEEK_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * A location's opening hours as a customer would ask about them (Task E1 fix
 * round 1, for Chappy's get_locations). Same source and semantics ordering
 * enforces: Location.operatingHours when set, else DEFAULT_HOURS
 * (getHoursForDay), a missing day is closed, and isClosed closes everything.
 * Computed in the location's timezone (America/Denver by default). Ignores
 * the DISABLE_TIME_RESTRICTIONS testing bypass: these are the real hours.
 *
 * Returns { timezone, hoursSource: "location"|"default", temporarilyClosed,
 *   openNow, today: {day, open, close} | {day, closed: true},
 *   week: [{day, open, close} | {day, closed: true}] x7, Monday first }.
 * open/close are "HH:MM" 24-hour local times; close is exclusive (21:00
 * means the doors close at 9 pm).
 */
export function weeklyHours(location, date = new Date()) {
  const timezone = location?.timezone || "America/Denver";
  const temporarilyClosed = !!location?.isClosed;
  const view = (day) => {
    const h = temporarilyClosed ? null : getHoursForDay(location, day);
    return h && h.open && h.close ? { day, open: h.open, close: h.close } : { day, closed: true };
  };
  const { weekday } = getLocationTime(timezone, date);
  return {
    timezone,
    hoursSource: location?.operatingHours ? "location" : "default",
    temporarilyClosed,
    openNow: isLocationOpen({ ...location, timezone }, date),
    today: view(weekday),
    week: WEEK_KEYS.map(view),
  };
}

const SLOT_MS = 15 * 60 * 1000;

/** Offset (ms) of `timeZone` from UTC at instant `ms` (e.g. -6h for MDT). */
function zoneOffsetMs(timeZone, ms) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - (ms - (ms % 1000));
}

/**
 * The UTC instant of wall-clock `minutes` after local midnight on y-m-d in
 * `timeZone`. For a wall time that happens twice (DST fall-back) this is the
 * first one; that never matters for opening or closing hours.
 */
function zonedWallTimeToDate(timeZone, y, m, d, minutes) {
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let t = guess - zoneOffsetMs(timeZone, guess);
  const corrected = guess - zoneOffsetMs(timeZone, t);
  if (corrected !== t) t = corrected;
  return t;
}

/**
 * Arrival slots for a location's local calendar day `date` ("YYYY-MM-DD"),
 * as Date instants 15 real minutes apart, from opening (or the next quarter
 * hour after `now`) through close minus 15, all in the location's timezone.
 *
 * Built on real instants, not wall-clock labels, so a DST day has no
 * duplicates or gaps: on the fall-back day the repeated hour is offered once
 * per real quarter, and on the spring-forward day the skipped hour simply
 * isn't there. Honors isClosed and closed days; ignores the testing bypass
 * (DISABLE_TIME_RESTRICTIONS) so slots are always real hours.
 */
export function slotsFor(location, date, now = new Date()) {
  if (location?.isClosed) return [];
  const [y, m, d] = String(date).split("-").map(Number);
  if (!y || !m || !d) return [];
  const dayKey = DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const dayHours = getHoursForDay(location, dayKey);
  if (!dayHours) return [];

  const tz = location?.timezone || "America/Denver";
  const openMs = zonedWallTimeToDate(tz, y, m, d, parseTimeToMinutes(dayHours.open));
  const lastMs = zonedWallTimeToDate(tz, y, m, d, parseTimeToMinutes(dayHours.close) + ORDER_CLOSE_OFFSET_MINUTES);
  const nowMs = now.getTime();
  const firstMs = nowMs <= openMs ? openMs : openMs + Math.ceil((nowMs - openMs) / SLOT_MS) * SLOT_MS;

  const slots = [];
  for (let t = firstMs; t <= lastMs; t += SLOT_MS) slots.push(new Date(t));
  return slots;
}

const WEEK_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * The week's opening hours for display (Task D4 location pages): the
 * location's own `operatingHours`, or the defaults when it has none, Monday
 * first, as 24-hour "HH:MM" strings (null open/close is a closed day). `today`
 * is the location's local weekday. Real hours only: the testing bypass
 * (DISABLE_TIME_RESTRICTIONS) never changes what this reports.
 */
export function weeklyDisplayHours(location, date = new Date()) {
  const timezone = location?.timezone || "America/Denver";
  const { weekday } = getLocationTime(timezone, date);
  const week = WEEK_ORDER.map((day) => {
    const h = location?.isClosed ? null : getHoursForDay(location, day);
    return h?.open && h?.close ? { day, open: h.open, close: h.close } : { day, open: null, close: null };
  });
  return { timezone, today: weekday, week };
}

export { DEFAULT_HOURS };
