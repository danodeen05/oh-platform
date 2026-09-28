/**
 * The body of GET /orders/status (the guest's order status page), built
 * from a prisma order with `seat`, `location`, `items.menuItem`, `guest`
 * and `waitQueueEntry` (Task D6: moved out of index.js so it can be tested).
 *
 * Every field the page read before is unchanged. Task D6 adds, all
 * additive (the business plan's phone demo reads the same shape):
 *   - `podLabel`: the seat's comb label ("B-07"), or null (the demo seat
 *     has only its number, "32", which stays in `podNumber`).
 *   - `location.timezone`, and `location.name` localized from its `i18n`.
 *   - `items[].selectedLabel`: a slider choice in the page's language
 *     (`sliderConfig.displayLabels`); `selectedValue` stays the English
 *     value the kitchen reads.
 *
 * Contact fields: `guestName` is the full name only for a viewer who may
 * see the full order (A8b), a first name otherwise.
 */
import { localizeLocation, localizeMenuItem } from "../i18n/localize.js";
import { firstNameOnly } from "./order-view.js";

/** The localized label for a slider's English value, or null when it isn't one of the labels. */
export function sliderDisplayLabel(menuItem, selectedValue, locale) {
  if (!selectedValue || !menuItem?.sliderConfig) return null;
  const localized = localizeMenuItem(menuItem, locale);
  const labels = Array.isArray(menuItem.sliderConfig.labels) ? menuItem.sliderConfig.labels : [];
  const display = Array.isArray(localized?.sliderConfig?.displayLabels) ? localized.sliderConfig.displayLabels : labels;
  const i = labels.indexOf(selectedValue);
  return i >= 0 && typeof display[i] === "string" ? display[i] : null;
}

export function buildStatusView(order, { locale = "en", canSeeFull = false } = {}) {
  const fullGuestName = order.guestName || order.guest?.name || null;
  const guestName = canSeeFull ? fullGuestName : firstNameOnly(fullGuestName);
  const location = order.location ? localizeLocation(order.location, locale) : null;

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      kitchenOrderNumber: order.kitchenOrderNumber,
      orderQrCode: order.orderQrCode,
      status: order.status,
      totalCents: order.totalCents,
      estimatedArrival: order.estimatedArrival,

      // Timestamps
      paidAt: order.paidAt,
      arrivedAt: order.arrivedAt,
      queuedAt: order.queuedAt,
      prepStartTime: order.prepStartTime,
      readyTime: order.readyTime,
      deliveredAt: order.deliveredAt,
      completedTime: order.completedTime,

      // Pod info
      podNumber: order.seat?.number,
      podLabel: order.seat?.label ?? null,
      podAssignedAt: order.podAssignedAt,
      podConfirmedAt: order.podConfirmedAt,

      // Queue info
      queuePosition: order.queuePosition,
      estimatedWaitMinutes: order.estimatedWaitMinutes,

      // Location
      location: {
        id: order.location?.id ?? null,
        name: location?.name ?? null,
        city: order.location?.city ?? null,
        timezone: order.location?.timezone ?? "America/Denver",
      },

      // Guest name (for non-authenticated orders) - fallback to guest record name.
      guestName,

      // Items - localized based on the page's language
      items: (order.items || []).map((item) => {
        const localizedMenuItem = localizeMenuItem(item.menuItem, locale);
        return {
          id: item.id,
          name: localizedMenuItem?.name ?? null,
          quantity: item.quantity,
          selectedValue: item.selectedValue,
          selectedLabel: sliderDisplayLabel(item.menuItem, item.selectedValue, locale),
          priceCents: item.priceCents,
          categoryType: item.menuItem?.categoryType ?? null,
        };
      }),
    },
  };
}
