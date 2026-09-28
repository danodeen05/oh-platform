/**
 * Pod calls: a diner in a pod asks staff to come over (Task B2; moved out of
 * POST /orders/:id/call-staff in index.js so Chappy's report_issue creates
 * the same row the status page's call-staff button does). Moves no money.
 */

export const POD_CALL_REASONS = Object.freeze(["GENERAL", "REFILL", "ASSISTANCE", "CHECK", "CLEANUP"]);

export class PodCallError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = "PodCallError";
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

/**
 * Creates a PENDING PodCall for the order's pod. Throws PodCallError
 * ORDER_NOT_FOUND (404), NO_POD (400) or ALREADY_PENDING (400, with the
 * existing call in extra.call). Returns the created call.
 */
export async function createPodCall(prisma, { orderId, reason = "GENERAL" }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new PodCallError("ORDER_NOT_FOUND", 404, "Order not found");
  if (!order.seatId) throw new PodCallError("NO_POD", 400, "Order does not have a pod assigned");

  const existing = await prisma.podCall.findFirst({ where: { orderId, status: "PENDING" } });
  if (existing) {
    throw new PodCallError("ALREADY_PENDING", 400, "You already have a pending call. Staff will be with you shortly.", { call: existing });
  }

  const call = await prisma.podCall.create({
    data: {
      orderId,
      seatId: order.seatId,
      locationId: order.locationId,
      reason: POD_CALL_REASONS.includes(reason) ? reason : "GENERAL",
    },
    include: {
      seat: true,
      order: { select: { orderNumber: true, kitchenOrderNumber: true } },
    },
  });
  console.log(`[POD CALL] Order ${orderId} requesting staff - Reason: ${call.reason}`);
  return call;
}
