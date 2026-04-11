/**
 * Chappy Chopstix - Web Chat Formatter
 *
 * Formats responses for the web chat widget with rich interactive elements.
 */

/**
 * Format response for web chat
 *
 * @param {string} text - Plain text response
 * @param {Array} contentBlocks - Full Claude response content blocks
 * @returns {Object} - Web chat message payload
 */
export function formatForWeb(text, contentBlocks = []) {
  const webMessage = {
    type: "web",
    text: text,
    timestamp: new Date().toISOString(),
    sender: "chappy",
    avatar: "/Chappy.png",
    actions: [],
    cards: [],
    typing: false,
  };

  // Detect and add quick actions
  const actions = detectQuickActions(text);
  if (actions.length > 0) {
    webMessage.actions = actions;
  }

  // Detect if we should show item cards
  const cards = detectItemCards(text, contentBlocks);
  if (cards.length > 0) {
    webMessage.cards = cards;
  }

  // Format text for web (convert markdown-style to HTML-safe)
  webMessage.formattedText = formatTextForWeb(text);

  return webMessage;
}

/**
 * Detect quick actions based on message content
 */
function detectQuickActions(text) {
  const actions = [];
  const textLower = text.toLowerCase();

  // Payment context
  if (textLower.includes("ready to pay") || textLower.includes("checkout")) {
    actions.push(
      createAction("Pay with Apple Pay", "apple_pay", "primary"),
      createAction("Pay with Card", "card_payment", "secondary")
    );
  }

  // Order context
  if (textLower.includes("add to") || textLower.includes("your cart")) {
    actions.push(
      createAction("Add to Cart", "add_to_cart", "primary"),
      createAction("View Cart", "view_cart", "secondary")
    );
  }

  // Recommendation context
  if (textLower.includes("recommend") || textLower.includes("try")) {
    actions.push(
      createAction("Add to Order", "add_recommended", "primary"),
      createAction("Tell Me More", "more_info", "secondary")
    );
  }

  // Reorder context
  if (textLower.includes("usual") || textLower.includes("reorder")) {
    actions.push(
      createAction("Reorder Now", "reorder", "primary"),
      createAction("Modify Order", "modify", "secondary")
    );
  }

  // Welcome/greeting context
  if (textLower.includes("how can i help") || textLower.includes("what would you like")) {
    actions.push(
      createAction("Start Order", "start_order", "primary"),
      createAction("Browse Menu", "browse_menu", "outline"),
      createAction("My Account", "account", "outline")
    );
  }

  return actions.slice(0, 3); // Max 3 actions
}

/**
 * Create an action button
 */
function createAction(label, action, variant = "primary") {
  return {
    label,
    action,
    variant, // "primary" | "secondary" | "outline" | "ghost"
  };
}

/**
 * Detect item cards from response
 */
function detectItemCards(text, contentBlocks) {
  // This would parse tool results to create item cards
  // For now, return empty - will be populated based on actual data
  return [];
}

/**
 * Format text for web display
 */
function formatTextForWeb(text) {
  let formatted = text;

  // Convert **bold** to <strong>
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Convert *italic* to <em>
  formatted = formatted.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Convert newlines to <br>
  formatted = formatted.replace(/\n/g, "<br>");

  // Convert bullet points
  formatted = formatted.replace(/^- (.+)$/gm, "• $1");

  return formatted;
}

/**
 * Create a menu item card for web
 */
export function createMenuItemCard(item) {
  return {
    type: "menu_item",
    id: item.id,
    name: item.name,
    description: item.description,
    price: `$${(item.basePriceCents / 100).toFixed(2)}`,
    imageUrl: item.imageUrl || "/images/default-dish.jpg",
    dietary: {
      vegetarian: item.isVegetarian,
      vegan: item.isVegan,
      glutenFree: item.isGlutenFree,
    },
    spiceLevel: item.spiceLevel,
    actions: [
      { label: "Add to Cart", action: `add_item_${item.id}`, variant: "primary" },
    ],
  };
}

/**
 * Create an order summary card for web
 */
export function createOrderSummaryCard(order) {
  return {
    type: "order_summary",
    orderNumber: order.orderNumber,
    status: order.status,
    items: order.items.map((item) => ({
      name: item.menuItem.name,
      quantity: item.quantity,
      price: `$${(item.priceCents / 100).toFixed(2)}`,
    })),
    subtotal: `$${(order.totalCents / 100).toFixed(2)}`,
    actions: [
      { label: "Pay Now", action: "pay", variant: "primary" },
      { label: "Edit Order", action: "edit_order", variant: "outline" },
    ],
  };
}

/**
 * Create a tier progress card for web
 */
export function createTierProgressCard(user) {
  const NOODLE_MASTER_THRESHOLD = 10;
  const BEEF_BOSS_THRESHOLD = 50;

  let nextTier, threshold, progress;

  if (user.membershipTier === "CHOPSTICK") {
    nextTier = "NOODLE_MASTER";
    threshold = NOODLE_MASTER_THRESHOLD;
    progress = (user.lifetimeOrderCount / threshold) * 100;
  } else if (user.membershipTier === "NOODLE_MASTER") {
    nextTier = "BEEF_BOSS";
    threshold = BEEF_BOSS_THRESHOLD;
    progress = (user.lifetimeOrderCount / threshold) * 100;
  } else {
    // Already BEEF_BOSS
    return {
      type: "tier_achieved",
      tier: "BEEF_BOSS",
      message: "You've reached the top tier!",
      benefit: "3% cashback + VIP perks",
    };
  }

  const remaining = threshold - user.lifetimeOrderCount;

  return {
    type: "tier_progress",
    currentTier: user.membershipTier,
    nextTier,
    progress: Math.min(100, progress),
    remaining,
    message: `${remaining} bowl${remaining === 1 ? "" : "s"} until ${nextTier}!`,
    benefit: nextTier === "NOODLE_MASTER" ? "2% cashback" : "3% cashback + VIP perks",
  };
}

/**
 * Create a credits balance card for web
 */
export function createCreditsCard(user) {
  return {
    type: "credits",
    balance: `$${(user.creditsCents / 100).toFixed(2)}`,
    balanceCents: user.creditsCents,
    canApply: user.creditsCents > 0,
    maxPerOrder: "$5.00",
  };
}

/**
 * Create typing indicator message
 */
export function createTypingIndicator() {
  return {
    type: "web",
    text: "",
    sender: "chappy",
    avatar: "/Chappy.png",
    typing: true,
    timestamp: new Date().toISOString(),
  };
}

export default {
  formatForWeb,
  createMenuItemCard,
  createOrderSummaryCard,
  createTierProgressCard,
  createCreditsCard,
  createTypingIndicator,
};
