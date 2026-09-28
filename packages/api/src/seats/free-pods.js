/**
 * Free-pod lookups and the wait-queue assignment (Task G3 fix round 1).
 *
 * Release 2 retires the old 12-pod seats (`retiredAt` set) but leaves their
 * `status` alone, so a plain `status: "AVAILABLE"` query still returns them.
 * Their numbers ("01".."12") also sort before the comb labels ("A-01"), so
 * the queue and assign-pod paths used to try the retired pods first and
 * fail every claim. Every path that picks or counts pods goes through
 * `freePodWhere` / `listFreePods`: active pods only, best pod first (the
 * same `podOrder` checkout uses).
 */
import { claimSeat, podOrder } from "../orders/service.js";

/** The where clause for a pod that can be handed out right now. */
export function freePodWhere(locationId) {
  return { locationId, status: "AVAILABLE", retiredAt: null };
}

/** Active, AVAILABLE pods at a location, best first (bestRank, then finger/position). */
export async function listFreePods(db, locationId) {
  const pods = await db.seat.findMany({ where: freePodWhere(locationId) });
  return pods.sort(podOrder);
}

/** The best free pod, or null (assign-pod's auto path). */
export async function pickAutoPod(db, locationId) {
  return (await listFreePods(db, locationId))[0] ?? null;
}

/**
 * Hands the free pods to the waiting queue, highest priority first. Each pod
 * is taken with the conditional `claimSeat` (one winner); a pod taken
 * meanwhile is skipped and the next free pod is tried for the same guest.
 * `notify(order)` runs after each assignment commits.
 */
export async function assignQueue(prisma, locationId, { notify = async () => {}, now = () => new Date(), log = console.log } = {}) {
  const pods = await listFreePods(prisma, locationId);
  if (pods.length === 0) {
    log("No available pods");
    return { assigned: 0 };
  }
  const queueEntries = await prisma.waitQueue.findMany({
    where: { locationId, status: "WAITING" },
    orderBy: { priority: "desc" },
    take: pods.length,
    include: { order: { include: { user: true } } },
  });
  if (queueEntries.length === 0) {
    log("Queue is empty");
    return { assigned: 0 };
  }

  const assigned = [];
  let next = 0;
  for (const queueEntry of queueEntries) {
    let updatedOrder = null;
    let pod = null;
    while (!updatedOrder && next < pods.length) {
      pod = pods[next++];
      try {
        // eslint-disable-next-line no-await-in-loop -- one claim at a time, in pod order
        updatedOrder = await prisma.$transaction(async (tx) => {
          if (!(await claimSeat(tx, pod.id))) return null;
          const at = now();
          const o = await tx.order.update({
            where: { id: queueEntry.orderId },
            data: { seatId: pod.id, podAssignedAt: at, podSelectionMethod: "AUTO", queuePosition: null },
            include: { seat: true, user: true },
          });
          await tx.waitQueue.update({ where: { id: queueEntry.id }, data: { status: "ASSIGNED", assignedAt: at } });
          return o;
        });
      } catch (error) {
        log(`Error assigning pod to queue entry ${queueEntry.id}: ${error?.message ?? error}`);
        updatedOrder = null;
        break;
      }
      if (!updatedOrder) log(`[queue] Pod ${pod.label || pod.number} was taken meanwhile; trying the next one`);
    }
    if (!updatedOrder) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await notify(updatedOrder);
    } catch (error) {
      log(`[queue] notify failed for order ${updatedOrder.id}: ${error?.message ?? error}`);
    }
    assigned.push({ orderId: updatedOrder.id, podNumber: pod.label || pod.number });
  }
  return { assigned: assigned.length, assignments: assigned };
}

export const POD_RETIRED = "POD_RETIRED";

/**
 * What `/pods/info` answers for an old sticker (a retired pod with no live
 * order on it): 200 with `retired: true` and the location, so the guest page
 * can say the code is out of date and offer the kiosk or choosing a pod.
 * Null when the pod is still in service (or a legacy order is still on it).
 */
export function retiredPodInfo(pod, activeOrder) {
  if (!pod?.retiredAt || activeOrder) return null;
  return {
    retired: true,
    code: POD_RETIRED,
    pod: { id: pod.id, number: pod.label || pod.number, qrCode: pod.qrCode, status: "RETIRED" },
    location: pod.location ? { id: pod.location.id, name: pod.location.name, city: pod.location.city } : null,
    hasActiveOrder: false,
    activeOrder: null,
  };
}
