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
 * Splits long messages into multiple SMS segments
 *
 * @param {string} text - Response text
 * @returns {Object} - SMS message payload with messages array
 */
export function formatForSMS(text) {
  // Clean up for SMS constraints
  let smsText = text;

  // Remove markdown formatting
  smsText = smsText.replace(/\*\*/g, "");
  smsText = smsText.replace(/\*/g, "");
  smsText = smsText.replace(/`/g, "");

  // Remove bullet points and replace with dashes
  smsText = smsText.replace(/^[•●◦▪]/gm, "-");

  // Target ~300 chars per message (leaves room for segment indicators)
  const MAX_SEGMENT_LENGTH = 300;
  const MAX_SEGMENTS = 4; // Don't spam them with too many messages

  // If short enough, return single message
  if (smsText.length <= MAX_SEGMENT_LENGTH) {
    return {
      type: "sms",
      text: smsText,
      messages: [smsText],
    };
  }

  // Split into multiple messages at natural break points
  const messages = splitIntoSegments(smsText, MAX_SEGMENT_LENGTH, MAX_SEGMENTS);

  return {
    type: "sms",
    text: messages[0], // First message for backwards compatibility
    messages: messages,
  };
}

/**
 * Split text into SMS segments at natural break points
 */
function splitIntoSegments(text, maxLength, maxSegments) {
  const segments = [];
  let remaining = text;

  while (remaining.length > 0 && segments.length < maxSegments) {
    if (remaining.length <= maxLength) {
      segments.push(remaining.trim());
      break;
    }

    // Find a good break point (paragraph, sentence, or word boundary)
    let breakPoint = findBreakPoint(remaining, maxLength);

    const segment = remaining.substring(0, breakPoint).trim();
    segments.push(segment);
    remaining = remaining.substring(breakPoint).trim();
  }

  // If there's still content left after max segments, add continuation note
  if (remaining.length > 0 && segments.length === maxSegments) {
    const lastIdx = segments.length - 1;
    if (segments[lastIdx].length > maxLength - 30) {
      segments[lastIdx] = segments[lastIdx].substring(0, maxLength - 30);
    }
    segments[lastIdx] += "\n\n(Reply for more)";
  }

  return segments;
}

/**
 * Find a natural break point in text
 */
function findBreakPoint(text, maxLength) {
  // Look for paragraph break first
  const paragraphBreak = text.lastIndexOf("\n\n", maxLength);
  if (paragraphBreak > maxLength * 0.5) {
    return paragraphBreak + 2;
  }

  // Look for sentence end
  const sentenceBreak = Math.max(
    text.lastIndexOf(". ", maxLength),
    text.lastIndexOf("? ", maxLength),
    text.lastIndexOf("! ", maxLength)
  );
  if (sentenceBreak > maxLength * 0.5) {
    return sentenceBreak + 2;
  }

  // Look for line break
  const lineBreak = text.lastIndexOf("\n", maxLength);
  if (lineBreak > maxLength * 0.5) {
    return lineBreak + 1;
  }

  // Fall back to word boundary
  const wordBreak = text.lastIndexOf(" ", maxLength);
  if (wordBreak > maxLength * 0.5) {
    return wordBreak + 1;
  }

  // Last resort: hard break
  return maxLength;
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
