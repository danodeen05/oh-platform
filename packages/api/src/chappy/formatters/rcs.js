/**
 * Chappy Chopstix - RCS/SMS Formatters
 *
 * Formats responses for Twilio RCS (Rich Communication Services) and SMS fallback.
 * RCS provides rich features like carousels, buttons, and images.
 */

// Oh! Brand colors
const BRAND_COLORS = {
  olive: "#7C7A67",        // Primary olive/sage
  oliveDark: "#5a5848",    // Darker olive
  orange: "#F97316",       // Orange accent
  black: "#1a1a1a",        // Near black
  cream: "#faf9f7",        // Light background
};

// RCS Business Messaging configuration
const RCS_CONFIG = {
  agentId: "oh-beef-noodle-soup",  // Twilio RCS agent ID
  logoUrl: "https://ohbeef.com/logo-black-orange.png",  // Black + orange logo
  brandColor: BRAND_COLORS.olive,
  brandName: "Oh! Beef Noodle Soup",
};

/**
 * Format response for RCS (Rich Communication Services)
 *
 * @param {string} text - Plain text response
 * @param {Array} contentBlocks - Full Claude response content blocks (for context)
 * @returns {Object} - RCS message payload
 */
export function formatForRCS(text, contentBlocks = []) {
  // Base RCS message
  const rcsMessage = {
    type: "rcs",
    text: text,
    branding: {
      agentId: RCS_CONFIG.agentId,
      logo: RCS_CONFIG.logoUrl,
      brandColor: RCS_CONFIG.brandColor,
    },
    suggestions: [],
    richCards: [],
  };

  // Detect context and add appropriate suggestions
  const suggestions = detectSuggestions(text);
  if (suggestions.length > 0) {
    rcsMessage.suggestions = suggestions;
  }

  // Detect if we should show a menu carousel
  if (shouldShowMenuCarousel(text)) {
    rcsMessage.richCards = createMenuCarousel();
  }

  // Detect if we should show quick actions
  if (shouldShowQuickActions(text)) {
    rcsMessage.suggestions = [
      ...rcsMessage.suggestions,
      ...createQuickActionSuggestions(),
    ];
  }

  // Add signature if not already present
  if (!text.includes("Chappy")) {
    rcsMessage.text = `${text}\n\n- Chappy`;
  }

  return rcsMessage;
}

/**
 * Format response for SMS (plain text fallback)
 *
 * @param {string} text - Response text
 * @returns {Object} - SMS message payload
 */
export function formatForSMS(text) {
  // Clean up for SMS constraints
  let smsText = text;

  // Remove markdown formatting
  smsText = smsText.replace(/\*\*/g, "");
  smsText = smsText.replace(/\*/g, "");
  smsText = smsText.replace(/`/g, "");

  // Truncate if too long (SMS max is ~160 chars per segment, aim for 2 segments max)
  const MAX_LENGTH = 320;
  if (smsText.length > MAX_LENGTH) {
    smsText = smsText.substring(0, MAX_LENGTH - 3) + "...";
  }

  // Add signature if not present and fits
  if (!smsText.includes("Chappy") && smsText.length < MAX_LENGTH - 15) {
    smsText = `${smsText}\n- Chappy`;
  }

  return {
    type: "sms",
    text: smsText,
  };
}

/**
 * Detect appropriate suggestion chips based on message content
 */
function detectSuggestions(text) {
  const suggestions = [];
  const textLower = text.toLowerCase();

  // Order confirmation context
  if (textLower.includes("order") && textLower.includes("confirm")) {
    suggestions.push(
      createSuggestion("Pay Now", "pay"),
      createSuggestion("Change Order", "change_order")
    );
  }

  // Menu browsing context
  if (textLower.includes("menu") || textLower.includes("what") && textLower.includes("get")) {
    suggestions.push(
      createSuggestion("Mains", "browse_mains"),
      createSuggestion("Sides", "browse_sides"),
      createSuggestion("Drinks", "browse_drinks")
    );
  }

  // Recommendation context
  if (textLower.includes("recommend") || textLower.includes("suggestion")) {
    suggestions.push(
      createSuggestion("Add to Order", "add_recommended"),
      createSuggestion("Something Else", "more_recommendations")
    );
  }

  // Greeting/welcome context
  if (textLower.includes("welcome") || textLower.includes("hey") || textLower.includes("help")) {
    suggestions.push(
      createSuggestion("Order Now", "start_order"),
      createSuggestion("My Usual", "reorder_usual"),
      createSuggestion("Check Points", "check_points")
    );
  }

  return suggestions.slice(0, 4); // Max 4 suggestions
}

/**
 * Create a suggestion chip
 */
function createSuggestion(text, postbackData) {
  return {
    type: "reply",
    text: text,
    postbackData: postbackData,
  };
}

/**
 * Detect if we should show a menu carousel
 */
function shouldShowMenuCarousel(text) {
  const textLower = text.toLowerCase();
  return (
    textLower.includes("here are") &&
    (textLower.includes("menu") || textLower.includes("dishes") || textLower.includes("options"))
  );
}

/**
 * Create menu carousel (sample items - in production, would be dynamic)
 */
function createMenuCarousel() {
  return [
    {
      type: "standalone",
      cardOrientation: "HORIZONTAL",
      cardContent: {
        title: "Classic Beef Noodle",
        description: "Our signature! Rich broth, tender beef.",
        media: {
          height: "MEDIUM",
          contentInfo: {
            fileUrl: "https://ohbeef.com/images/classic-beef-noodle.jpg",
            forceRefresh: false,
          },
        },
        suggestions: [
          { type: "reply", text: "Order This", postbackData: "order_classic_beef" },
        ],
      },
    },
    {
      type: "standalone",
      cardOrientation: "HORIZONTAL",
      cardContent: {
        title: "Szechuan Fire Bowl",
        description: "Our spiciest! For heat lovers.",
        media: {
          height: "MEDIUM",
          contentInfo: {
            fileUrl: "https://ohbeef.com/images/szechuan-fire.jpg",
            forceRefresh: false,
          },
        },
        suggestions: [
          { type: "reply", text: "Order This", postbackData: "order_szechuan_fire" },
        ],
      },
    },
    {
      type: "standalone",
      cardOrientation: "HORIZONTAL",
      cardContent: {
        title: "Veggie Delight",
        description: "Plant-based, same great flavor.",
        media: {
          height: "MEDIUM",
          contentInfo: {
            fileUrl: "https://ohbeef.com/images/veggie-delight.jpg",
            forceRefresh: false,
          },
        },
        suggestions: [
          { type: "reply", text: "Order This", postbackData: "order_veggie" },
        ],
      },
    },
  ];
}

/**
 * Detect if we should show quick action suggestions
 */
function shouldShowQuickActions(text) {
  const textLower = text.toLowerCase();
  return (
    textLower.includes("anything else") ||
    textLower.includes("how can i help") ||
    textLower.includes("what would you like")
  );
}

/**
 * Create quick action suggestion chips
 */
function createQuickActionSuggestions() {
  return [
    createSuggestion("Browse Menu", "browse_menu"),
    createSuggestion("My Order", "check_order"),
    createSuggestion("My Points", "check_points"),
  ];
}

/**
 * Create a payment button for RCS
 */
export function createPaymentButton(amount, paymentUrl) {
  return {
    type: "openUrl",
    text: `Pay $${amount}`,
    url: paymentUrl,
  };
}

/**
 * Create an order confirmation card
 */
export function createOrderConfirmationCard(order) {
  return {
    type: "standalone",
    cardOrientation: "VERTICAL",
    cardContent: {
      title: `Order #${order.orderNumber}`,
      description: `Total: $${(order.totalCents / 100).toFixed(2)}\nStatus: ${order.status}`,
      suggestions: [
        { type: "reply", text: "Track Order", postbackData: `track_${order.id}` },
      ],
    },
  };
}

/**
 * Build a complete RCS message with Twilio-compatible format
 */
export function buildTwilioRCSMessage(rcsPayload) {
  // Twilio Content API format for RCS
  return {
    contentSid: null, // Would be set if using Content API templates
    body: rcsPayload.text,
    // RCS-specific fields
    contentVariables: JSON.stringify({
      suggestions: rcsPayload.suggestions,
      richCards: rcsPayload.richCards,
    }),
  };
}

export default {
  formatForRCS,
  formatForSMS,
  createPaymentButton,
  createOrderConfirmationCard,
  buildTwilioRCSMessage,
};
