/**
 * Kiosk pod claims (Task D12 fix round 1).
 *
 * The kiosk creates its orders before the pod step, so the pod rides on a
 * separate, device-authenticated call made BEFORE payment:
 *
 *   POST /kiosk/orders/:id/seat  {label} | {best:true} | {shareWithOrderId}   (+ dual?)
 *
 * Every claim goes through orders/service.js `pickBestPod` / `claimSeat`
 * (a conditional updateMany AVAILABLE -> RESERVED that exactly one
 * transaction can win), so two checkouts can never hold the same pod. A lost
 * label falls back, in the same transaction, to the next best pod and says
 * so ({code: "POD_TAKEN", label: <new>}) so the kiosk can show it before the
 * guest pays. The hold expires like any unpaid pod hold (the index.js
 * release job clears unpaid holds past podReservationExpiry).
 *
 * `claimCheckInSeat` is the same rule for POST /orders/check-in's pod pick.
 */
import { pickBestPod, claimSeat, releaseClaim, PodUnavailableError, POD_HOLD_MS, isPartyDuoShare, DUO_SHARE_WINDOW_MS } from "../orders/service.js";

const ACTIVE = ["PENDING_PAYMENT", "PAID", "QUEUED", "PREPPING", "READY", "SERVING"];
const LABEL_MAX = 16;

class Refusal extends Error {
  constructor(status, body) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

const seatName = (s) => (s ? s.label || s.number || null : null);

/** Seats this order holds (its pod, plus the other half of a duo). */
function heldBy(order) {
  return [order.seatId, ...(order.isDualPod && order.dualPartnerSeatId ? [order.dualPartnerSeatId] : [])].filter(Boolean);
}

/** Releases this order's holds, except a seat another live order also points at (a party sharing a duo). */
async function releaseOwnHolds(tx, order) {
  for (const seatId of heldBy(order)) {
    const shared = await tx.order.count({
      where: { id: { not: order.id }, status: { in: ACTIVE }, OR: [{ seatId }, { dualPartnerSeatId: seatId }] },
    });
    if (shared === 0) await releaseClaim(tx, seatId);
  }
}

/** Validates the request body. Returns {label} | {best:true} | {shareWithOrderId}, plus dual. */
export function parseSeatRequest(body) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const dual = b.dual === true;
  if (typeof b.label === "string" && b.label.trim() && b.label.length <= LABEL_MAX) return { label: b.label.trim(), dual };
  if (b.best === true) return { best: true, dual };
  if (typeof b.shareWithOrderId === "string" && b.shareWithOrderId && b.shareWithOrderId.length <= 64) return { shareWithOrderId: b.shareWithOrderId };
  return null;
}

/**
 * Claims a pod for an unpaid kiosk order at the device's location.
 * Returns { status, body }.
 */
export async function assignKioskSeat(prisma, { locationId, orderId, request, now = new Date() }) {
  try {
    const body = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.locationId !== locationId) throw new Refusal(404, { error: "Order not found", code: "ORDER_NOT_FOUND" });
      if (order.paymentStatus === "PAID") throw new Refusal(409, { error: "This order is already paid; its pod can't change here.", code: "ORDER_PAID" });
      // Only a live, unpaid order holds a pod here (a cancelled one would strand it: the release job only sweeps PENDING_PAYMENT).
      if (order.status !== "PENDING_PAYMENT") throw new Refusal(409, { error: "This order can't take a pod.", code: "ORDER_NOT_OPEN" });
      const hold = { podAssignedAt: now, podReservationExpiry: new Date(now.getTime() + POD_HOLD_MS) };

      // Second guest of a party that took a duo: sits at the other half the
      // first guest holds, but only as that same kiosk party (fix round 3): the
      // host is unpaid, a kiosk order from the last 30 minutes, created within
      // 30 minutes of this one (orders carry no party or device id), and nobody
      // else already sits on that half. Anything else is treated as a lost pod:
      // the next best pod, reported as POD_TAKEN.
      let shareLostLabel = null;
      if (request.shareWithOrderId) {
        const host = await tx.order.findUnique({ where: { id: request.shareWithOrderId } });
        const candidate = { ...order, seatId: host?.dualPartnerSeatId ?? null, podSelectionMethod: "DUO_SHARED" };
        const recent = Boolean(host && host.createdAt && now.getTime() - new Date(host.createdAt).getTime() <= DUO_SHARE_WINDOW_MS);
        const sitters = host?.dualPartnerSeatId
          ? (await tx.order.findMany({ where: { status: { in: ACTIVE }, seatId: host.dualPartnerSeatId } })).filter((o) => o.id !== order.id && o.id !== host.id).length
          : 1;
        if (host && host.locationId === locationId && recent && host.status === "PENDING_PAYMENT" && sitters === 0 && isPartyDuoShare(host, candidate)) {
          await releaseOwnHolds(tx, order);
          await tx.order.update({
            where: { id: order.id },
            // DUO_SHARED marks this seat as the other half of the host order's duo (orders/service.js isPartyDuoShare).
            data: { seatId: host.dualPartnerSeatId, isDualPod: false, dualPartnerSeatId: null, podSelectionMethod: "DUO_SHARED", ...hold },
          });
          const seat = await tx.seat.findUnique({ where: { id: host.dualPartnerSeatId } });
          return { ok: true, seatId: seat?.id ?? host.dualPartnerSeatId, label: seatName(seat), partnerLabel: null, fallback: false };
        }
        const half = host?.dualPartnerSeatId ? await tx.seat.findUnique({ where: { id: host.dualPartnerSeatId } }) : null;
        shareLostLabel = seatName(half) || "duo";
      }

      await releaseOwnHolds(tx, order);
      let pod;
      let fallback = false;
      try {
        if (shareLostLabel) throw new PodUnavailableError(shareLostLabel);
        pod = await pickBestPod(tx, { locationId, requestedLabel: request.label || null, dual: request.dual });
      } catch (err) {
        if (!(err instanceof PodUnavailableError)) throw err;
        if (!request.label && !shareLostLabel) throw new Refusal(409, { error: "No pod is free right now.", code: "NO_POD_AVAILABLE" });
        try {
          pod = await pickBestPod(tx, { locationId, partySize: request.dual ? 2 : 1 });
        } catch (err2) {
          if (!(err2 instanceof PodUnavailableError)) throw err2;
          throw new Refusal(409, { error: "No pod is free right now.", code: "NO_POD_AVAILABLE" });
        }
        fallback = true;
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          seatId: pod.seat.id,
          isDualPod: Boolean(pod.partner),
          dualPartnerSeatId: pod.partner ? pod.partner.id : null,
          podSelectionMethod: request.label && !fallback ? "CUSTOMER_SELECTED" : "AUTO",
          ...hold,
        },
      });
      return {
        ok: true,
        seatId: pod.seat.id,
        label: seatName(pod.seat),
        partnerLabel: seatName(pod.partner),
        fallback,
        ...(fallback ? { code: "POD_TAKEN", requested: request.label || shareLostLabel } : {}),
      };
    });
    return { status: 200, body };
  } catch (err) {
    // A refusal rolls the transaction back, so the order keeps any pod it held before.
    if (err instanceof Refusal) return { status: err.status, body: err.body };
    throw err;
  }
}

/**
 * POST /orders/check-in with a pod the guest picked at the kiosk: claims it
 * (AVAILABLE -> RESERVED, only one caller can win) and seats the order in one
 * transaction. Returns { order, seat } or null when the pod is taken, retired
 * or at another location (the caller then falls through to auto-assign).
 */
export async function claimCheckInSeat(prisma, { order, seatId, data, include }) {
  return prisma.$transaction(async (tx) => {
    const seat = await tx.seat.findFirst({ where: { id: seatId, locationId: order.locationId, retiredAt: null } });
    if (!seat || !(await claimSeat(tx, seat.id))) return null;
    if (order.seatId && order.seatId !== seat.id) await releaseOwnHolds(tx, order);
    const updated = await tx.order.update({
      where: { id: order.id },
      data: { ...data, seatId: seat.id, isDualPod: false, dualPartnerSeatId: null },
      ...(include ? { include } : {}),
    });
    return { order: updated, seat };
  });
}
