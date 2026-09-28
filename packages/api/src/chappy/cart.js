/**
 * Chappy's server-held cart (Task B2), stored on ChappyConversation.cart.
 *
 * The cart is only a list of what the customer asked for plus their choices
 * (location, arrival, pod request, savings). It holds no prices: every view
 * is priced by the order service (quoteOrder), and checkout creates the order
 * from a fresh quote. The model never sees or edits this row directly; the
 * `cart` tool applies one validated op at a time.
 *
 * Shape:
 *   { locationId: string|null, items: [{ menuItemId, quantity, selectedValue }],
 *     arrival: ISO string|null (null = as soon as possible),
 *     pod: { best: true } | { label } | null, partySize: 1..8,
 *     savings: { useCreditsCents, promoCode, rewardId },
 *     lastOrderId: string|null }
 */
import { MAX_LINE_QUANTITY } from "../orders/pricing.js";
import { MAX_ORDER_LINES } from "../orders/service.js";

export const CART_OPS = Object.freeze(["add", "remove", "set_quantity", "clear", "view"]);

export class CartError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "CartError";
    this.code = code;
  }
}

export function emptyCart() {
  return { locationId: null, items: [], arrival: null, pod: null, partySize: 1, savings: { useCreditsCents: 0, promoCode: null, rewardId: null }, lastOrderId: null };
}

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A stored (or missing, or legacy) value as a well-formed cart. */
export function normalizeCart(raw) {
  const base = emptyCart();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((i) => i && typeof i.menuItemId === "string" && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= MAX_LINE_QUANTITY)
        .slice(0, MAX_ORDER_LINES)
        .map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, selectedValue: str(i.selectedValue) }))
    : [];
  let pod = null;
  if (raw.pod && typeof raw.pod === "object") {
    if (raw.pod.best === true) pod = { best: true };
    else if (str(raw.pod.label)) pod = { label: str(raw.pod.label) };
  }
  const partySize = Number.isInteger(raw.partySize) && raw.partySize >= 1 && raw.partySize <= 8 ? raw.partySize : 1;
  const s = raw.savings && typeof raw.savings === "object" ? raw.savings : {};
  return {
    locationId: str(raw.locationId),
    items,
    arrival: str(raw.arrival),
    pod,
    partySize,
    savings: {
      useCreditsCents: Number.isInteger(s.useCreditsCents) && s.useCreditsCents > 0 ? s.useCreditsCents : 0,
      promoCode: str(s.promoCode),
      rewardId: str(s.rewardId),
    },
    lastOrderId: str(raw.lastOrderId),
  };
}

const sameLine = (a, menuItemId, selectedValue) => a.menuItemId === menuItemId && (a.selectedValue || null) === (selectedValue || null);

/**
 * Applies one cart op and returns a NEW cart (pure). Throws CartError for a
 * bad op or quantity. `option` is a slider's chosen label (e.g. "Medium"), or "".
 */
export function applyCartOp(cart, { op, menuItemId = "", quantity = 0, option = "" }) {
  const next = normalizeCart(cart);
  const id = str(menuItemId);
  const selectedValue = str(option);
  if (!CART_OPS.includes(op)) throw new CartError("INVALID_OP", `op must be one of ${CART_OPS.join(", ")}`);
  if (op === "view") return next;
  if (op === "clear") return { ...next, items: [] };
  if (!id) throw new CartError("ITEM_REQUIRED", "menuItemId required");

  if (op === "remove") {
    return { ...next, items: next.items.filter((l) => !(l.menuItemId === id && (!selectedValue || sameLine(l, id, selectedValue)))) };
  }

  const q = op === "add" ? (Number.isInteger(quantity) && quantity > 0 ? quantity : 1) : quantity;
  if (!Number.isInteger(q) || q < 0 || q > MAX_LINE_QUANTITY) throw new CartError("INVALID_QUANTITY", `quantity must be 0 to ${MAX_LINE_QUANTITY}`);
  const existing = next.items.find((l) => sameLine(l, id, selectedValue));

  if (op === "set_quantity") {
    if (q === 0) return { ...next, items: next.items.filter((l) => !sameLine(l, id, selectedValue)) };
    if (existing) return { ...next, items: next.items.map((l) => (l === existing ? { ...l, quantity: q } : l)) };
    return addLine(next, { menuItemId: id, quantity: q, selectedValue });
  }

  // add
  if (existing) {
    const total = existing.quantity + q;
    if (total > MAX_LINE_QUANTITY) throw new CartError("INVALID_QUANTITY", `quantity must be 0 to ${MAX_LINE_QUANTITY}`);
    return { ...next, items: next.items.map((l) => (l === existing ? { ...l, quantity: total } : l)) };
  }
  return addLine(next, { menuItemId: id, quantity: q, selectedValue });
}

function addLine(cart, line) {
  if (cart.items.length >= MAX_ORDER_LINES) throw new CartError("CART_FULL", "The cart is full.");
  return { ...cart, items: [...cart.items, line] };
}

/** The cart with its items replaced (reorder). */
export function replaceItems(cart, items) {
  return normalizeCart({ ...normalizeCart(cart), items });
}

/** The items as quoteOrder takes them. */
export function cartLines(cart) {
  return normalizeCart(cart).items.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, ...(l.selectedValue ? { selectedValue: l.selectedValue } : {}) }));
}

export async function loadCart(prisma, conversationId) {
  if (!conversationId) throw new CartError("NO_CONVERSATION", "No conversation to hold a cart.");
  const row = await prisma.chappyConversation.findUnique({ where: { id: conversationId } });
  return normalizeCart(row?.cart);
}

export async function saveCart(prisma, conversationId, cart) {
  if (!conversationId) throw new CartError("NO_CONVERSATION", "No conversation to hold a cart.");
  const value = normalizeCart(cart);
  await prisma.chappyConversation.update({ where: { id: conversationId }, data: { cart: value } });
  return value;
}
