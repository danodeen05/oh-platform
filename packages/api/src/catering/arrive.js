import { isEventDay } from "./attendee.js";

// Release a held attendee order into the kitchen queue (PAID -> QUEUED). Idempotent.
// checkDay=true is the public flow (only on the event day); false is the host override.
export async function arriveOrder(prisma, qrCode, { checkDay = true, now = new Date() } = {}) {
  const order = await prisma.order.findFirst({
    where: { orderQrCode: qrCode, orderSource: "CATERING" },
    select: { id: true, status: true, cateringEvent: { select: { eventDate: true } } },
  });
  if (!order) return { status: 404, body: { error: "Order not found" } };
  if (order.status !== "PAID") return { status: 200, body: { success: true, status: order.status } };
  if (checkDay && order.cateringEvent?.eventDate && !isEventDay(order.cateringEvent.eventDate, now)) {
    return { status: 400, body: { error: "Check in opens on the event day" } };
  }
  await prisma.order.update({ where: { id: order.id }, data: { status: "QUEUED", queuedAt: now } });
  return { status: 200, body: { success: true, status: "QUEUED" } };
}
