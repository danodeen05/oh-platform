/**
 * Chappy Chopstix - Tool Definitions
 *
 * All tools available to the Claude agent, mapped to existing Oh! APIs.
 */

/**
 * Tool definitions for Claude API
 * Each tool needs: name, description (detailed!), input_schema
 */
export const CHAPPY_TOOLS = [
  // ==========================================
  // MENU TOOLS
  // ==========================================
  {
    name: "browse_menu",
    description: `Get the menu with all items, prices, and dietary information. Use this when:
- Customer wants to see what's available
- Customer asks about specific dishes or categories
- Customer has dietary restrictions (vegetarian, vegan, gluten-free)
- Customer wants recommendations

Returns items grouped by category with prices, descriptions, and dietary info.`,
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category type: MAIN, SLIDER, ADDON, SIDE, DRINK, DESSERT. Leave empty for full menu.",
          enum: ["MAIN", "SLIDER", "ADDON", "SIDE", "DRINK", "DESSERT"],
        },
        dietary: {
          type: "string",
          description: "Filter for dietary restrictions: vegetarian, vegan, or gluten-free",
          enum: ["vegetarian", "vegan", "gluten-free"],
        },
      },
    },
  },

  {
    name: "get_menu_item",
    description: `Get detailed information about a specific menu item. Use when:
- Customer asks about a specific dish
- You need to confirm item details before adding to order
- Customer wants to know ingredients, allergens, or spice level`,
    input_schema: {
      type: "object",
      properties: {
        itemId: {
          type: "string",
          description: "The menu item ID",
        },
        itemName: {
          type: "string",
          description: "The menu item name (partial match OK)",
        },
      },
    },
  },

  // ==========================================
  // ORDER TOOLS
  // ==========================================
  {
    name: "create_order",
    description: `Create a new order with specified items. Use after customer confirms:
- What they want to order
- Pickup time (optional)
- Location (if not already set)

This creates the order but does NOT process payment yet. Returns order details with total and order ID.`,
    input_schema: {
      type: "object",
      properties: {
        locationId: {
          type: "string",
          description: "Location ID for the order",
        },
        items: {
          type: "array",
          description: "Array of items to order",
          items: {
            type: "object",
            properties: {
              menuItemId: { type: "string" },
              quantity: { type: "number" },
              selectedValue: {
                type: "string",
                description: "For slider items, the selected level (e.g., 'Light', 'Medium', 'Rich')",
              },
            },
            required: ["menuItemId", "quantity"],
          },
        },
        estimatedArrival: {
          type: "string",
          description: "ISO datetime for pickup (e.g., '2024-01-15T18:00:00Z')",
        },
      },
      required: ["locationId", "items"],
    },
  },

  {
    name: "get_order_status",
    description: `Check the status of an existing order. Use when:
- Customer asks "where's my order?"
- Customer wants to know if food is ready
- Checking pod assignment

Returns: order status, pod number (if assigned), estimated wait time.`,
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The order ID",
        },
        orderNumber: {
          type: "string",
          description: "The order number (e.g., 'ORD-1234-ABCD')",
        },
      },
    },
  },

  {
    name: "add_to_order",
    description: `Add items to an existing order (add-ons). Use when:
- Customer wants to add more items after placing order
- Customer requests refill or extra vegetables
- Customer is ready for dessert

Note: Some add-ons are free (refill, extra veg), others require payment.`,
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The existing order ID",
        },
        addOnType: {
          type: "string",
          description: "Type of add-on",
          enum: ["PAID_ADDON", "REFILL", "EXTRA_VEG", "DESSERT_READY"],
        },
        items: {
          type: "array",
          description: "Items to add (for PAID_ADDON)",
          items: {
            type: "object",
            properties: {
              menuItemId: { type: "string" },
              quantity: { type: "number" },
            },
          },
        },
      },
      required: ["orderId", "addOnType"],
    },
  },

  // ==========================================
  // GROUP ORDER TOOLS
  // ==========================================
  {
    name: "create_group_order",
    description: `Start a new group order. Use when:
- Customer says they're ordering for multiple people
- Customer wants to split the bill
- "We're a group of 4" or similar

Returns: a 6-character code that others can use to join.`,
    input_schema: {
      type: "object",
      properties: {
        locationId: {
          type: "string",
          description: "Location ID",
        },
        estimatedArrival: {
          type: "string",
          description: "ISO datetime for when the group plans to arrive",
        },
      },
      required: ["locationId"],
    },
  },

  {
    name: "join_group_order",
    description: `Join an existing group order using a code. Use when:
- Customer has a 6-character group code
- "My friend started a group order" or similar`,
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "6-character group order code",
        },
      },
      required: ["code"],
    },
  },

  {
    name: "add_to_group_order",
    description: `Add items to a group order for the current user. Use after joining a group order.`,
    input_schema: {
      type: "object",
      properties: {
        groupCode: {
          type: "string",
          description: "Group order code",
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              menuItemId: { type: "string" },
              quantity: { type: "number" },
              selectedValue: { type: "string" },
            },
          },
        },
      },
      required: ["groupCode", "items"],
    },
  },

  {
    name: "get_group_order_status",
    description: `Get status of a group order including all members' orders. Use to see what everyone has ordered.`,
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "Group order code",
        },
      },
      required: ["code"],
    },
  },

  // ==========================================
  // LOCATION & POD TOOLS
  // ==========================================
  {
    name: "get_locations",
    description: `Get all restaurant locations with hours and availability. Use when:
- Customer asks "where are you located?"
- Customer wants to know if a location is open
- Confirming which location to order from`,
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "check_location_availability",
    description: `Check if a specific location is currently open and has available pods. Use before placing an order.`,
    input_schema: {
      type: "object",
      properties: {
        locationId: {
          type: "string",
          description: "Location ID to check",
        },
      },
      required: ["locationId"],
    },
  },

  {
    name: "reserve_pod",
    description: `Reserve a pod for an order. Usually auto-assigns, but can specify a pod number. Use after payment is confirmed.`,
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "Order ID",
        },
        podNumber: {
          type: "string",
          description: "Specific pod number if customer requested one",
        },
      },
      required: ["orderId"],
    },
  },

  // ==========================================
  // PAYMENT TOOLS
  // ==========================================
  {
    name: "create_payment_link",
    description: `Create a payment link for an order. Use for SMS/RCS channels where we can't process payment directly. Returns a URL the customer can tap to pay.`,
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "Order ID to create payment for",
        },
        applyCredits: {
          type: "boolean",
          description: "Whether to apply available credits to this order",
        },
      },
      required: ["orderId"],
    },
  },

  {
    name: "apply_credits",
    description: `Apply user's available credits to an order. Max $5.00 per food order. Use when:
- User has credits and wants to use them
- Automatically suggest if user has credits available`,
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "Order ID",
        },
        amountCents: {
          type: "number",
          description: "Amount of credits to apply in cents (max 500)",
        },
      },
      required: ["orderId"],
    },
  },

  {
    name: "validate_promo_code",
    description: `Check if a promo code is valid and get the discount. Use before applying to order.`,
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "Promo code to validate",
        },
        subtotalCents: {
          type: "number",
          description: "Order subtotal for discount calculation",
        },
      },
      required: ["code", "subtotalCents"],
    },
  },

  // ==========================================
  // ACCOUNT & LOYALTY TOOLS
  // ==========================================
  {
    name: "get_user_profile",
    description: `Get the customer's profile including tier, credits, streak, and order history summary. Use when:
- Customer asks about their account
- Customer asks about points/credits
- Need to personalize recommendations
- Checking tier progress`,
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "get_credits_balance",
    description: `Get the customer's current credits balance. Use when customer asks "how many points/credits do I have?"`,
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "get_order_history",
    description: `Get customer's past orders for recommendations and "reorder" functionality. Use to:
- Suggest "your usual"
- Make personalized recommendations
- Show recent orders`,
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent orders to return (default 5)",
        },
      },
    },
  },

  {
    name: "get_challenges",
    description: `Get active challenges and user's progress. Use when customer asks about challenges or achievements.`,
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "get_tier_progress",
    description: `Get detailed tier progression info - how many orders until next tier, what benefits they'll unlock. Use to encourage tier progression.`,
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  // ==========================================
  // RECOMMENDATION TOOLS
  // ==========================================
  {
    name: "get_recommendations",
    description: `Get personalized dish recommendations based on customer's order history and preferences. Use when:
- Customer says "what should I get?"
- Customer wants to try something new
- Customer asks for suggestions`,
    input_schema: {
      type: "object",
      properties: {
        preference: {
          type: "string",
          description: "Optional preference hint: 'spicy', 'mild', 'new', 'popular'",
        },
      },
    },
  },

  {
    name: "get_usual_order",
    description: `Get customer's most frequently ordered items (their "usual"). Use when customer says:
- "my usual"
- "the regular"
- "same as last time"`,
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  // ==========================================
  // CHAPPY ORDERING FLOW TOOLS
  // ==========================================
  {
    name: "check_location_for_order",
    description: `Confirm the location for an order and check if it's currently open and available. Use when:
- Starting a new order
- Customer asks to place an order
- Need to verify a location is accepting orders

Returns location details, operating status, available pods, and estimated wait time.`,
    input_schema: {
      type: "object",
      properties: {
        locationId: {
          type: "string",
          description: "Location ID to check. If not provided, uses the current context location.",
        },
      },
    },
  },

  {
    name: "get_available_arrival_times",
    description: `Get available arrival time slots for ordering. Returns ASAP option and scheduled time windows. Use when:
- Customer is ready to select arrival time
- Customer asks "when can I pick up?"
- Planning an order

ASAP means arriving within 10 minutes, which allows immediate pod assignment.`,
    input_schema: {
      type: "object",
      properties: {
        locationId: {
          type: "string",
          description: "Location ID to check availability for",
        },
      },
      required: ["locationId"],
    },
  },

  {
    name: "get_available_pods",
    description: `Get list of available pods/seats at a location for ASAP orders. Use when:
- Customer selected ASAP arrival
- Customer wants to choose their pod
- Showing seating options`,
    input_schema: {
      type: "object",
      properties: {
        locationId: {
          type: "string",
          description: "Location ID to check pods for",
        },
      },
      required: ["locationId"],
    },
  },

  {
    name: "get_saved_payment_methods",
    description: `Get customer's saved payment methods (credit/debit cards). Use when:
- Ready to process payment for an order
- Customer asks about their saved cards
- Need to confirm payment method before charging

Returns tokenized card info (last4, brand) - never raw card numbers. Only available for logged-in users.`,
    input_schema: {
      type: "object",
      properties: {},
    },
  },

  {
    name: "create_and_pay_order",
    description: `Create an order and process payment using saved payment method. This is the final step in the ordering flow. Use when:
- Customer has confirmed their items, location, arrival time
- Customer has selected a payment method
- Ready to submit the order

IMPORTANT: Always confirm the order details with the customer before calling this tool.
This will charge their card and create a confirmed order.`,
    input_schema: {
      type: "object",
      properties: {
        locationId: {
          type: "string",
          description: "Location ID for the order",
        },
        items: {
          type: "array",
          description: "Array of items to order",
          items: {
            type: "object",
            properties: {
              menuItemId: { type: "string" },
              quantity: { type: "number" },
              selectedValue: { type: "string", description: "For slider items like broth richness" },
            },
            required: ["menuItemId", "quantity"],
          },
        },
        paymentMethodId: {
          type: "string",
          description: "Saved payment method ID to charge",
        },
        seatId: {
          type: "string",
          description: "Selected pod/seat ID (for ASAP orders with pod selection)",
        },
        arrivalTime: {
          type: "string",
          description: "Either 'ASAP' or ISO datetime string for scheduled pickup",
        },
        applyCredits: {
          type: "boolean",
          description: "Whether to apply available credits to this order (max $5)",
        },
      },
      required: ["locationId", "items", "paymentMethodId"],
    },
  },

  {
    name: "reorder_previous_order",
    description: `Quickly reorder from a previous order. Use when:
- Customer says "reorder my last order"
- Customer wants to duplicate a previous order
- Customer says "same as before"

Returns the previous order details for confirmation before creating new order.`,
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "Specific order ID to reorder. If not provided, uses most recent completed order.",
        },
      },
    },
  },

  {
    name: "get_chefs_choice",
    description: `Get the Chef's Choice quick order - a pre-configured bowl perfect for new customers or anyone wanting our recommended setup. Use when:
- Customer asks for "Chef's Choice"
- Customer says "chef's recommendation" or "chef's pick"
- Customer is new and wants a suggested order
- Customer asks "what do you recommend?" and wants to order quickly

The Chef's Choice includes:
- Classic Beef Noodle Soup ($15.99)
- Wide noodles (our most popular)
- Oh!'s recommended bowl configuration (medium broth richness, medium noodle texture, mild spice)
- Standard toppings (bok choy, green onions, cilantro, sprouts)
- Complimentary Mandarin Orange Sherbet

Returns the configured items ready for ordering.`,
    input_schema: {
      type: "object",
      properties: {
        locationId: {
          type: "string",
          description: "Location ID. Uses context location if not provided.",
        },
      },
    },
  },

  {
    name: "get_order_summary",
    description: `Build and display an order summary before payment. Use to show the customer what they're about to order with itemized prices, tax, and total.`,
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Array of items to summarize",
          items: {
            type: "object",
            properties: {
              menuItemId: { type: "string" },
              quantity: { type: "number" },
            },
            required: ["menuItemId", "quantity"],
          },
        },
        applyCredits: {
          type: "boolean",
          description: "Whether to show credits applied",
        },
      },
      required: ["items"],
    },
  },

  {
    name: "create_apple_pay_order",
    description: `Create an order for Apple Pay / Google Pay payment. Use when:
- Customer has no saved payment methods but wants to pay with Apple Pay or Google Pay
- Customer explicitly requests to pay with Apple Pay or Google Pay

IMPORTANT: For reorders, use previousOrderId instead of items array - this is much simpler and more reliable.

This creates a pending order and returns a payment intent for the frontend to process via Apple Pay.
The frontend will handle the actual payment and confirm the order.`,
    input_schema: {
      type: "object",
      properties: {
        locationId: {
          type: "string",
          description: "Location ID for the order",
        },
        previousOrderId: {
          type: "string",
          description: "Order ID to reorder from. If provided, items array is ignored and items are copied from the previous order. Use this for reorders instead of constructing items array.",
        },
        items: {
          type: "array",
          description: "Array of items to order (not needed if previousOrderId is provided)",
          items: {
            type: "object",
            properties: {
              menuItemId: { type: "string" },
              quantity: { type: "number" },
              selectedValue: { type: "string", description: "For slider items like broth richness" },
            },
            required: ["menuItemId", "quantity"],
          },
        },
        seatId: {
          type: "string",
          description: "Selected pod/seat ID (for ASAP orders with pod selection)",
        },
        arrivalTime: {
          type: "string",
          description: "Either 'ASAP' or ISO datetime string for scheduled pickup",
        },
        applyCredits: {
          type: "boolean",
          description: "Whether to apply available credits to this order (max $5)",
        },
      },
      required: ["locationId"],
    },
  },
];

/**
 * Execute tools and return results
 *
 * @param {Array} toolUseBlocks - Tool use blocks from Claude response
 * @param {Object} context - Execution context with prisma, userId, etc.
 * @returns {Array} - Tool result blocks for Claude
 */
export async function executeTools(toolUseBlocks, context) {
  const results = [];

  for (const toolUse of toolUseBlocks) {
    const { id, name, input } = toolUse;

    console.log(`[CHAPPY TOOL] Executing: ${name}`, JSON.stringify(input, null, 2));

    let result;
    let isError = false;

    try {
      result = await executeToolByName(name, input, context);
      console.log(`[CHAPPY TOOL] ${name} succeeded:`, typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result, null, 2).substring(0, 500));
    } catch (error) {
      console.error(`[CHAPPY TOOL] ${name} FAILED:`, error.message, error.stack);
      result = `Error: ${error.message}`;
      isError = true;
    }

    results.push({
      type: "tool_result",
      tool_use_id: id,
      content: typeof result === "string" ? result : JSON.stringify(result),
      is_error: isError,
    });
  }

  return results;
}

/**
 * Execute a specific tool by name
 */
async function executeToolByName(name, input, context) {
  const { prisma, userId, guestId, locationId, tenantId } = context;

  switch (name) {
    // ==========================================
    // MENU TOOLS
    // ==========================================
    case "browse_menu": {
      const where = { tenantId, isAvailable: true };
      if (input.category) where.categoryType = input.category;

      let items = await prisma.menuItem.findMany({
        where,
        orderBy: [{ categoryType: "asc" }, { displayOrder: "asc" }],
      });

      // Filter by dietary if specified
      if (input.dietary) {
        items = items.filter((item) => {
          if (input.dietary === "vegetarian") return item.isVegetarian;
          if (input.dietary === "vegan") return item.isVegan;
          if (input.dietary === "gluten-free") return item.isGlutenFree;
          return true;
        });
      }

      // Format for readability
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        price: `$${(item.basePriceCents / 100).toFixed(2)}`,
        category: item.categoryType,
        description: item.description,
        spiceLevel: item.spiceLevel,
        dietary: [
          item.isVegetarian && "V",
          item.isVegan && "VG",
          item.isGlutenFree && "GF",
        ].filter(Boolean).join(", ") || null,
      }));
    }

    case "get_menu_item": {
      let item;
      if (input.itemId) {
        item = await prisma.menuItem.findUnique({ where: { id: input.itemId } });
      } else if (input.itemName) {
        item = await prisma.menuItem.findFirst({
          where: {
            tenantId,
            name: { contains: input.itemName, mode: "insensitive" },
          },
        });
      }

      if (!item) return "Item not found";

      return {
        id: item.id,
        name: item.name,
        price: `$${(item.basePriceCents / 100).toFixed(2)}`,
        description: item.description,
        category: item.categoryType,
        spiceLevel: item.spiceLevel,
        allergens: item.allergens,
        isVegetarian: item.isVegetarian,
        isVegan: item.isVegan,
        isGlutenFree: item.isGlutenFree,
      };
    }

    // ==========================================
    // ORDER TOOLS
    // ==========================================
    case "create_order": {
      // Calculate total
      let totalCents = 0;
      const orderItems = [];

      for (const item of input.items) {
        const menuItem = await prisma.menuItem.findUnique({
          where: { id: item.menuItemId },
        });
        if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);

        const priceCents = menuItem.basePriceCents * item.quantity;
        totalCents += priceCents;

        orderItems.push({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          priceCents,
          selectedValue: item.selectedValue,
        });
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create order
      const order = await prisma.order.create({
        data: {
          orderNumber,
          tenantId,
          locationId: input.locationId,
          userId: userId || undefined,
          guestId: guestId || undefined,
          totalCents,
          estimatedArrival: input.estimatedArrival ? new Date(input.estimatedArrival) : undefined,
          items: {
            create: orderItems,
          },
        },
        include: { items: { include: { menuItem: true } } },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: `$${(order.totalCents / 100).toFixed(2)}`,
        status: order.status,
        items: order.items.map((i) => ({
          name: i.menuItem.name,
          quantity: i.quantity,
          price: `$${(i.priceCents / 100).toFixed(2)}`,
        })),
        message: "Order created! Ready for payment.",
      };
    }

    case "get_order_status": {
      const where = {};
      if (input.orderId) where.id = input.orderId;
      if (input.orderNumber) where.orderNumber = input.orderNumber;

      const order = await prisma.order.findFirst({
        where,
        include: { seat: true },
      });

      if (!order) return "Order not found";

      return {
        orderNumber: order.orderNumber,
        status: order.status,
        podNumber: order.seat?.number || "Not yet assigned",
        estimatedWait: order.estimatedWaitMinutes ? `~${order.estimatedWaitMinutes} minutes` : "N/A",
        total: `$${(order.totalCents / 100).toFixed(2)}`,
      };
    }

    // ==========================================
    // LOCATION TOOLS
    // ==========================================
    case "get_locations": {
      const locations = await prisma.location.findMany({
        where: { tenantId },
      });

      return locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        city: loc.city,
        address: loc.address,
        isOpen: !loc.isClosed,
        timezone: loc.timezone,
      }));
    }

    case "check_location_availability": {
      const location = await prisma.location.findUnique({
        where: { id: input.locationId },
        include: { seats: true },
      });

      if (!location) return "Location not found";

      const availablePods = location.seats.filter((s) => s.status === "AVAILABLE").length;

      return {
        name: location.name,
        isOpen: !location.isClosed,
        availablePods,
        totalPods: location.seats.length,
      };
    }

    // ==========================================
    // ACCOUNT TOOLS
    // ==========================================
    case "get_user_profile": {
      if (!userId) return "No user logged in. This is a guest session.";

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          _count: { select: { orders: true } },
        },
      });

      if (!user) return "User not found";

      return {
        name: user.name,
        tier: user.membershipTier,
        tierBenefits: getTierBenefits(user.membershipTier),
        credits: `$${(user.creditsCents / 100).toFixed(2)}`,
        currentStreak: user.currentStreak,
        lifetimeOrders: user.lifetimeOrderCount,
        tierProgress: getTierProgressInfo(user),
      };
    }

    case "get_credits_balance": {
      if (!userId) return "No user logged in. Credits are only available for registered users.";

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { creditsCents: true },
      });

      return {
        balance: `$${(user.creditsCents / 100).toFixed(2)}`,
        balanceCents: user.creditsCents,
      };
    }

    case "get_order_history": {
      if (!userId) return "No order history available for guest sessions.";

      const limit = input.limit || 5;

      const orders = await prisma.order.findMany({
        where: { userId, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { items: { include: { menuItem: true } }, location: true },
      });

      return orders.map((order) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        date: order.createdAt.toISOString().split("T")[0],
        total: `$${(order.totalCents / 100).toFixed(2)}`,
        locationId: order.locationId,
        locationName: order.location?.name || "Unknown",
        itemsSummary: order.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(", "),
        // Include structured items for reordering
        reorderItems: order.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          selectedValue: i.selectedValue,
          name: i.menuItem.name,
          priceCents: i.priceCents,
        })),
      }));
    }

    case "get_tier_progress": {
      if (!userId) return "Tier progress is only available for registered users.";

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      return getTierProgressInfo(user);
    }

    case "get_recommendations": {
      // Get menu items
      const items = await prisma.menuItem.findMany({
        where: { tenantId, isAvailable: true, categoryType: "MAIN" },
      });

      // If user has history, personalize
      if (userId) {
        const orderHistory = await prisma.orderItem.findMany({
          where: { order: { userId } },
          include: { menuItem: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        });

        // Find items they haven't tried
        const orderedIds = new Set(orderHistory.map((o) => o.menuItemId));
        const notTried = items.filter((i) => !orderedIds.has(i.id));

        // Filter by preference
        let recommendations = notTried.length > 0 ? notTried : items;

        if (input.preference === "spicy") {
          recommendations = recommendations.filter((i) => i.spiceLevel >= 2);
        }

        return recommendations.slice(0, 3).map((item) => ({
          id: item.id,
          name: item.name,
          price: `$${(item.basePriceCents / 100).toFixed(2)}`,
          description: item.description,
          reason: notTried.includes(item) ? "You haven't tried this yet!" : "Popular choice",
        }));
      }

      // For guests, return popular items
      return items.slice(0, 3).map((item) => ({
        id: item.id,
        name: item.name,
        price: `$${(item.basePriceCents / 100).toFixed(2)}`,
        description: item.description,
        reason: "Customer favorite",
      }));
    }

    case "get_usual_order": {
      if (!userId) return "No order history for guest sessions.";

      // Find most frequently ordered items
      const itemCounts = await prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: { order: { userId } },
        _count: { menuItemId: true },
        orderBy: { _count: { menuItemId: "desc" } },
        take: 5,
      });

      if (itemCounts.length === 0) return "No order history yet - this would be your first order!";

      const itemIds = itemCounts.map((c) => c.menuItemId);
      const items = await prisma.menuItem.findMany({
        where: { id: { in: itemIds } },
      });

      const itemMap = new Map(items.map((i) => [i.id, i]));

      return {
        usualItems: itemCounts.map((c) => {
          const item = itemMap.get(c.menuItemId);
          return {
            id: item.id,
            name: item.name,
            price: `$${(item.basePriceCents / 100).toFixed(2)}`,
            timesOrdered: c._count.menuItemId,
          };
        }),
      };
    }

    // ==========================================
    // PAYMENT TOOLS
    // ==========================================
    case "create_payment_link": {
      const order = await prisma.order.findUnique({
        where: { id: input.orderId },
      });

      if (!order) return "Order not found";

      // In production, this would create a Stripe checkout session
      // For now, return a placeholder
      const paymentUrl = `https://ohbeef.com/pay/${order.orderNumber}`;

      return {
        paymentUrl,
        amount: `$${(order.totalCents / 100).toFixed(2)}`,
        message: "Tap the link to complete payment",
      };
    }

    case "apply_credits": {
      if (!userId) return "Credits can only be applied for logged-in users";

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const order = await prisma.order.findUnique({ where: { id: input.orderId } });

      if (!order) return "Order not found";

      const maxCredits = Math.min(500, user.creditsCents, input.amountCents || user.creditsCents);

      // Apply credits
      await prisma.user.update({
        where: { id: userId },
        data: { creditsCents: { decrement: maxCredits } },
      });

      await prisma.order.update({
        where: { id: input.orderId },
        data: { totalCents: { decrement: maxCredits } },
      });

      return {
        creditsApplied: `$${(maxCredits / 100).toFixed(2)}`,
        newOrderTotal: `$${((order.totalCents - maxCredits) / 100).toFixed(2)}`,
        remainingCredits: `$${((user.creditsCents - maxCredits) / 100).toFixed(2)}`,
      };
    }

    case "validate_promo_code": {
      const promo = await prisma.promoCode.findFirst({
        where: {
          code: input.code.toUpperCase(),
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      if (!promo) return { valid: false, message: "Invalid or expired promo code" };

      if (promo.minimumOrderCents && input.subtotalCents < promo.minimumOrderCents) {
        return {
          valid: false,
          message: `Minimum order of $${(promo.minimumOrderCents / 100).toFixed(2)} required`,
        };
      }

      let discountCents;
      if (promo.discountType === "PERCENTAGE") {
        discountCents = Math.floor((input.subtotalCents * promo.discountValue) / 100);
        if (promo.maxDiscountCents) {
          discountCents = Math.min(discountCents, promo.maxDiscountCents);
        }
      } else {
        discountCents = promo.discountValue;
      }

      return {
        valid: true,
        code: promo.code,
        discount: `$${(discountCents / 100).toFixed(2)}`,
        discountCents,
        description: promo.description,
      };
    }

    // ==========================================
    // CHAPPY ORDERING FLOW TOOLS
    // ==========================================
    case "check_location_for_order": {
      const checkLocationId = input.locationId || locationId;

      if (!checkLocationId) {
        // Get all locations
        const locations = await prisma.location.findMany({
          where: { tenantId },
          include: { seats: true },
        });

        return {
          needsSelection: true,
          message: "Which location would you like to order from?",
          locations: locations.map((loc) => ({
            id: loc.id,
            name: loc.name,
            city: loc.city,
            address: loc.address,
            isOpen: !loc.isClosed,
            availablePods: loc.seats.filter((s) => s.status === "AVAILABLE").length,
          })),
        };
      }

      const location = await prisma.location.findUnique({
        where: { id: checkLocationId },
        include: { seats: true },
      });

      if (!location) return { error: "Location not found" };

      const availablePods = location.seats.filter((s) => s.status === "AVAILABLE");
      const occupiedPods = location.seats.filter((s) => s.status === "OCCUPIED");

      // Estimate wait time: ~5 min per occupied pod in queue
      const estimatedWaitMinutes = location.isClosed ? null : Math.min(occupiedPods.length * 5, 45);

      return {
        locationId: location.id,
        name: location.name,
        city: location.city,
        address: location.address,
        isOpen: !location.isClosed,
        canOrder: !location.isClosed,
        availablePods: availablePods.length,
        totalPods: location.seats.length,
        estimatedWaitMinutes,
        message: location.isClosed
          ? `Sorry, ${location.name} is currently closed.`
          : availablePods.length > 0
          ? `${location.name} is open with ${availablePods.length} pod${availablePods.length > 1 ? "s" : ""} available!`
          : `${location.name} is open but all pods are full. Estimated wait: ${estimatedWaitMinutes} minutes.`,
      };
    }

    case "get_available_arrival_times": {
      const arrivalLocationId = input.locationId || locationId;
      if (!arrivalLocationId) return { error: "Location ID required" };

      const location = await prisma.location.findUnique({
        where: { id: arrivalLocationId },
        include: { seats: true },
      });

      if (!location) return { error: "Location not found" };
      if (location.isClosed) return { error: "Location is currently closed", canOrder: false };

      const availablePods = location.seats.filter((s) => s.status === "AVAILABLE").length;
      const now = new Date();

      // Generate time slots for next 2 hours in 15-minute increments
      const timeSlots = [];
      for (let i = 0; i < 8; i++) {
        const slotTime = new Date(now.getTime() + (i + 1) * 15 * 60 * 1000);
        timeSlots.push({
          time: slotTime.toISOString(),
          display: slotTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        });
      }

      return {
        locationId: arrivalLocationId,
        locationName: location.name,
        asapAvailable: availablePods > 0,
        asapMessage: availablePods > 0
          ? "ASAP - Arrive within 10 minutes and get a pod immediately!"
          : "ASAP not available - all pods are currently occupied",
        scheduledSlots: timeSlots,
        recommendation: availablePods > 0
          ? "I recommend ASAP if you're nearby - you can pick your pod!"
          : `I recommend scheduling for ${timeSlots[1]?.display} to avoid waiting.`,
      };
    }

    case "get_available_pods": {
      const podsLocationId = input.locationId || locationId;
      if (!podsLocationId) return { error: "Location ID required" };

      const seats = await prisma.seat.findMany({
        where: {
          locationId: podsLocationId,
          status: "AVAILABLE",
        },
        orderBy: { number: "asc" },
      });

      if (seats.length === 0) {
        return {
          available: false,
          message: "No pods available right now. Would you like to schedule for later?",
          pods: [],
        };
      }

      return {
        available: true,
        message: `${seats.length} pod${seats.length > 1 ? "s" : ""} available! Which one would you like?`,
        pods: seats.map((s) => ({
          id: s.id,
          number: s.number,
          type: s.type || "standard",
        })),
      };
    }

    case "get_saved_payment_methods": {
      if (!userId) {
        return {
          hasPaymentMethods: false,
          applePayAvailable: true, // Frontend will check actual availability
          message: "You need to be logged in to use saved payment methods, but you can pay with Apple Pay or Google Pay!",
        };
      }

      const methods = await prisma.savedPaymentMethod.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });

      if (methods.length === 0) {
        return {
          hasPaymentMethods: false,
          applePayAvailable: true, // Frontend will check actual availability
          message: "No saved cards on file, but you can pay with Apple Pay or Google Pay! Just say 'pay with Apple Pay' when you're ready.",
        };
      }

      return {
        hasPaymentMethods: true,
        applePayAvailable: true, // Also available as alternative
        methods: methods.map((m) => ({
          id: m.id,
          brand: m.brand ? m.brand.charAt(0).toUpperCase() + m.brand.slice(1) : "Card",
          last4: m.last4 || "****",
          isDefault: m.isDefault,
          expiry: m.expiryMonth && m.expiryYear ? `${m.expiryMonth}/${m.expiryYear}` : null,
        })),
        defaultMethod: methods.find((m) => m.isDefault) || methods[0],
        message: methods.length === 1
          ? `I'll charge your ${methods[0].brand} ending in ${methods[0].last4}. Or say 'Apple Pay' to use that instead.`
          : `Which card would you like to use? You can also say 'Apple Pay'.`,
      };
    }

    case "create_and_pay_order": {
      if (!userId) {
        return { error: "You need to be logged in to place an order through Chappy. Would you like to continue on the website?" };
      }

      const { items: orderItems, paymentMethodId, seatId, arrivalTime, applyCredits } = input;
      const orderLocationId = input.locationId || locationId;

      if (!orderLocationId) return { error: "Location is required for the order" };
      if (!orderItems || orderItems.length === 0) return { error: "No items in order" };
      if (!paymentMethodId) return { error: "Payment method is required" };

      // Verify payment method belongs to user
      const paymentMethod = await prisma.savedPaymentMethod.findFirst({
        where: { id: paymentMethodId, userId },
      });
      if (!paymentMethod) return { error: "Invalid payment method" };

      // Get user's Stripe customer ID
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.stripeCustomerId) return { error: "Payment setup incomplete. Please add a card on the website first." };

      // Calculate order total
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: orderItems.map((i) => i.menuItemId) } },
      });

      let totalCents = 0;
      const itemsWithPrices = orderItems.map((item) => {
        const menuItem = menuItems.find((m) => m.id === item.menuItemId);
        if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);

        const priceCents = menuItem.basePriceCents * item.quantity;
        totalCents += priceCents;

        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          priceCents,
          selectedValue: item.selectedValue || null,
          name: menuItem.name,
        };
      });

      // Calculate tax (8.25% Utah state + local)
      const taxRate = 0.0825;
      const taxCents = Math.round(totalCents * taxRate);

      // Apply credits if requested
      let creditsApplied = 0;
      if (applyCredits && user.creditsCents > 0) {
        creditsApplied = Math.min(500, user.creditsCents, totalCents); // Max $5 credits
      }

      const finalTotal = totalCents + taxCents - creditsApplied;

      // Import Stripe (it should be available in the context)
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // Create payment intent and charge
      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount: finalTotal,
          currency: "usd",
          customer: user.stripeCustomerId,
          payment_method: paymentMethod.stripePaymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
          metadata: {
            userId,
            locationId: orderLocationId,
            source: "chappy",
          },
        });
      } catch (stripeError) {
        return {
          error: "Payment failed",
          message: stripeError.message || "Your card was declined. Please try a different payment method.",
        };
      }

      if (paymentIntent.status !== "succeeded") {
        return {
          error: "Payment not completed",
          message: "Payment requires additional action. Please complete payment on the website.",
        };
      }

      // Generate order numbers
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const orderQrCode = `ORDER-${orderLocationId.slice(-8)}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Get kitchen order number
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaysOrderCount = await prisma.order.count({
        where: {
          locationId: orderLocationId,
          paymentStatus: "PAID",
          createdAt: { gte: today, lt: tomorrow },
        },
      });
      const kitchenOrderNumber = String(todaysOrderCount + 1).padStart(4, "0");

      // Determine estimated arrival
      let estimatedArrival = null;
      if (arrivalTime && arrivalTime !== "ASAP") {
        estimatedArrival = new Date(arrivalTime);
      } else {
        // ASAP = 10 minutes from now
        estimatedArrival = new Date(Date.now() + 10 * 60 * 1000);
      }

      // Create the order
      const order = await prisma.order.create({
        data: {
          orderNumber,
          orderQrCode,
          kitchenOrderNumber,
          tenantId,
          locationId: orderLocationId,
          userId,
          seatId: seatId || null,
          podSelectionMethod: seatId ? "CUSTOMER_SELECTED" : null,
          podAssignedAt: seatId ? new Date() : null,
          totalCents: finalTotal,
          taxCents,
          estimatedArrival,
          paymentStatus: "PAID",
          stripePaymentId: paymentIntent.id,
          paymentMethodLast4: paymentMethod.last4,
          paymentMethodBrand: paymentMethod.brand,
          status: "PAID",
          orderSource: "CHAPPY",
          items: {
            create: itemsWithPrices.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              priceCents: item.priceCents,
              selectedValue: item.selectedValue,
            })),
          },
        },
        include: {
          items: { include: { menuItem: true } },
          seat: true,
          location: true,
        },
      });

      // Deduct credits if applied
      if (creditsApplied > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { creditsCents: { decrement: creditsApplied } },
        });
      }

      // Mark seat as occupied if selected
      if (seatId) {
        await prisma.seat.update({
          where: { id: seatId },
          data: { status: "OCCUPIED" },
        });
      }

      return {
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        kitchenOrderNumber: order.kitchenOrderNumber,
        total: `$${(finalTotal / 100).toFixed(2)}`,
        subtotal: `$${(totalCents / 100).toFixed(2)}`,
        tax: `$${(taxCents / 100).toFixed(2)}`,
        creditsApplied: creditsApplied > 0 ? `$${(creditsApplied / 100).toFixed(2)}` : null,
        items: itemsWithPrices.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: `$${(i.priceCents / 100).toFixed(2)}`,
        })),
        location: order.location.name,
        podNumber: order.seat?.number || null,
        estimatedArrival: order.estimatedArrival?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        message: order.seat
          ? `Order confirmed! Head to Pod ${order.seat.number} at ${order.location.name}. Your order number is ${order.kitchenOrderNumber}.`
          : `Order confirmed! Head to ${order.location.name} and check in when you arrive. Your order number is ${order.kitchenOrderNumber}.`,
      };
    }

    case "reorder_previous_order": {
      console.log("[CHAPPY] reorder_previous_order called with input:", JSON.stringify(input, null, 2));
      console.log("[CHAPPY] userId:", userId);
      if (!userId) return { error: "You need to be logged in to reorder." };

      let previousOrder;
      if (input.orderId) {
        previousOrder = await prisma.order.findFirst({
          where: { id: input.orderId, userId },
          include: { items: { include: { menuItem: true } }, location: true },
        });
      } else {
        previousOrder = await prisma.order.findFirst({
          where: { userId, status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          include: { items: { include: { menuItem: true } }, location: true },
        });
      }

      if (!previousOrder) {
        return {
          found: false,
          message: "No previous orders found. Would you like to start a new order?",
        };
      }

      // Check if all items are still available
      const itemIds = previousOrder.items.map((i) => i.menuItemId);
      const availableItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds }, isAvailable: true },
      });

      const unavailableItems = previousOrder.items.filter(
        (i) => !availableItems.find((a) => a.id === i.menuItemId)
      );

      return {
        found: true,
        orderId: previousOrder.id,
        orderDate: previousOrder.createdAt.toLocaleDateString(),
        location: previousOrder.location.name,
        items: previousOrder.items.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.menuItem.name,
          quantity: i.quantity,
          price: `$${(i.menuItem.basePriceCents / 100).toFixed(2)}`,
          selectedValue: i.selectedValue,
          available: !!availableItems.find((a) => a.id === i.menuItemId),
        })),
        hasUnavailableItems: unavailableItems.length > 0,
        unavailableMessage: unavailableItems.length > 0
          ? `Note: ${unavailableItems.map((i) => i.menuItem.name).join(", ")} ${unavailableItems.length === 1 ? "is" : "are"} no longer available.`
          : null,
        message: `Found your order from ${previousOrder.createdAt.toLocaleDateString()}. Would you like to order the same thing again?`,
        reorderItems: previousOrder.items
          .filter((i) => availableItems.find((a) => a.id === i.menuItemId))
          .map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            selectedValue: i.selectedValue,
          })),
      };
    }

    case "get_chefs_choice": {
      console.log("[CHAPPY] get_chefs_choice called");
      const chefsChoiceLocationId = input.locationId || locationId;

      // Find the menu items for Chef's Choice
      // Classic Beef Noodle Soup + Wide Noodles + recommended config + Mandarin Orange Sherbet
      const classicSoup = await prisma.menuItem.findFirst({
        where: { name: { contains: "Classic Beef Noodle Soup" }, isAvailable: true },
      });
      const wideNoodles = await prisma.menuItem.findFirst({
        where: { name: { contains: "Wide Noodles" }, isAvailable: true },
      });
      const soupRichness = await prisma.menuItem.findFirst({
        where: { name: { contains: "Soup Richness" }, isAvailable: true },
      });
      const noodleTexture = await prisma.menuItem.findFirst({
        where: { name: { contains: "Noodle Texture" }, isAvailable: true },
      });
      const spiceLevel = await prisma.menuItem.findFirst({
        where: { name: { contains: "Spice Level" }, isAvailable: true },
      });
      const bokChoy = await prisma.menuItem.findFirst({
        where: { name: { contains: "Bok Choy" }, isAvailable: true },
      });
      const greenOnions = await prisma.menuItem.findFirst({
        where: { name: { contains: "Green Onions" }, isAvailable: true },
      });
      const cilantro = await prisma.menuItem.findFirst({
        where: { name: { contains: "Cilantro" }, isAvailable: true },
      });
      const sprouts = await prisma.menuItem.findFirst({
        where: { name: { contains: "Sprouts" }, isAvailable: true },
      });
      const sherbet = await prisma.menuItem.findFirst({
        where: { name: { contains: "Mandarin Orange Sherbet" }, isAvailable: true },
      });

      if (!classicSoup) {
        return { error: "Chef's Choice items not available at this time." };
      }

      // Build the items array
      const chefsChoiceItems = [
        classicSoup && { menuItemId: classicSoup.id, name: classicSoup.name, quantity: 1, priceCents: classicSoup.basePriceCents },
        wideNoodles && { menuItemId: wideNoodles.id, name: wideNoodles.name, quantity: 1, priceCents: 0, selectedValue: null },
        soupRichness && { menuItemId: soupRichness.id, name: soupRichness.name, quantity: 1, priceCents: 0, selectedValue: "Medium" },
        noodleTexture && { menuItemId: noodleTexture.id, name: noodleTexture.name, quantity: 1, priceCents: 0, selectedValue: "Medium" },
        spiceLevel && { menuItemId: spiceLevel.id, name: spiceLevel.name, quantity: 1, priceCents: 0, selectedValue: "Mild" },
        bokChoy && { menuItemId: bokChoy.id, name: bokChoy.name, quantity: 1, priceCents: 0 },
        greenOnions && { menuItemId: greenOnions.id, name: greenOnions.name, quantity: 1, priceCents: 0 },
        cilantro && { menuItemId: cilantro.id, name: cilantro.name, quantity: 1, priceCents: 0 },
        sprouts && { menuItemId: sprouts.id, name: sprouts.name, quantity: 1, priceCents: 0 },
        sherbet && { menuItemId: sherbet.id, name: sherbet.name, quantity: 1, priceCents: 0, note: "Complimentary" },
      ].filter(Boolean);

      const totalCents = chefsChoiceItems.reduce((sum, item) => sum + (item.priceCents || 0), 0);

      return {
        name: "Chef's Choice",
        description: "Our recommended bowl for the perfect Oh! experience",
        items: chefsChoiceItems,
        totalCents,
        totalFormatted: `$${(totalCents / 100).toFixed(2)}`,
        includes: [
          "Classic Beef Noodle Soup",
          "Wide noodles (most popular)",
          "Medium broth richness",
          "Medium noodle texture",
          "Mild spice level",
          "Standard toppings (bok choy, green onions, cilantro, sprouts)",
          "Complimentary Mandarin Orange Sherbet",
        ],
        readyToOrder: true,
        message: "Chef's Choice is ready. This is our most popular configuration - $15.99 for the perfect bowl plus a complimentary sherbet. Want me to add this to your order?",
      };
    }

    case "create_apple_pay_order": {
      console.log("[CHAPPY] create_apple_pay_order called with input:", JSON.stringify(input, null, 2));
      console.log("[CHAPPY] Context - userId:", userId, "locationId:", locationId);

      let { items: applePayItems, seatId: appleSeatId, arrivalTime: appleArrivalTime, applyCredits: appleApplyCredits, previousOrderId } = input;
      const applePayLocationId = input.locationId || locationId;

      console.log("[CHAPPY] Using locationId:", applePayLocationId, "previousOrderId:", previousOrderId);

      // Handle location - might be ID or name
      let resolvedLocationId = applePayLocationId;
      if (applePayLocationId && !applePayLocationId.startsWith("cm")) {
        // This looks like a name, not an ID - try to look it up
        console.log("[CHAPPY] Location looks like a name, looking up:", applePayLocationId);
        const location = await prisma.location.findFirst({
          where: {
            OR: [
              { name: { contains: applePayLocationId, mode: "insensitive" } },
              { city: { contains: applePayLocationId, mode: "insensitive" } },
            ],
          },
        });
        if (location) {
          console.log("[CHAPPY] Found location by name:", location.name, location.id);
          resolvedLocationId = location.id;
        } else {
          console.log("[CHAPPY] Could not find location by name:", applePayLocationId);
          return { error: `Could not find location "${applePayLocationId}". Please specify a valid location.` };
        }
      }

      if (!resolvedLocationId) {
        console.log("[CHAPPY] ERROR: No locationId provided");
        return { error: "Location is required for the order" };
      }


      // If previousOrderId provided, get items from that order
      if (previousOrderId) {
        console.log("[CHAPPY] Looking up previous order:", previousOrderId, "for user:", userId);
        const previousOrder = await prisma.order.findFirst({
          where: { id: previousOrderId, userId },
          include: { items: true },
        });
        if (!previousOrder) {
          // Check if the order exists but belongs to a different user
          const orderExists = await prisma.order.findUnique({
            where: { id: previousOrderId },
            select: { id: true, userId: true },
          });
          if (orderExists) {
            console.log("[CHAPPY] ERROR: Order exists but userId mismatch. Order userId:", orderExists.userId, "Request userId:", userId);
            return { error: "Cannot access this order. Please start a new order." };
          }
          console.log("[CHAPPY] ERROR: Previous order not found for id:", previousOrderId);
          return { error: "Previous order not found. Please start a new order." };
        }
        console.log("[CHAPPY] Found previous order with", previousOrder.items.length, "items");
        applePayItems = previousOrder.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          selectedValue: i.selectedValue,
        }));
      }

      console.log("[CHAPPY] Items count:", applePayItems?.length || 0);

      // If still no items, try to get from most recent completed order
      if ((!applePayItems || applePayItems.length === 0) && userId) {
        console.log("[CHAPPY] No items provided, looking up most recent order for user:", userId);
        const lastOrder = await prisma.order.findFirst({
          where: { userId, status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          include: { items: true },
        });
        if (lastOrder && lastOrder.items.length > 0) {
          console.log("[CHAPPY] Auto-using most recent order:", lastOrder.id, "with", lastOrder.items.length, "items");
          applePayItems = lastOrder.items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            selectedValue: i.selectedValue,
          }));
        }
      }

      if (!applePayItems || applePayItems.length === 0) {
        console.log("[CHAPPY] ERROR: No items in order");
        return { error: "No items in order. Please specify what you'd like to order." };
      }

      // Handle pod number string (e.g., "5", "05", or "Pod 5") by looking up the actual seat ID
      if (appleSeatId && !appleSeatId.startsWith("cm")) {
        // This looks like a pod number, not a seat ID - look it up
        const rawNumber = appleSeatId.replace(/[^0-9]/g, ""); // Extract just the number
        // Try both with and without leading zero (seats are stored as "01", "02", etc.)
        const podNumberPadded = rawNumber.padStart(2, "0");
        console.log("[CHAPPY] Looking up seat by pod number:", rawNumber, "or", podNumberPadded, "at location:", resolvedLocationId);

        let seat = await prisma.seat.findFirst({
          where: {
            locationId: resolvedLocationId,
            number: podNumberPadded,
            status: "AVAILABLE",
          },
        });

        // Try without padding if not found
        if (!seat && rawNumber !== podNumberPadded) {
          seat = await prisma.seat.findFirst({
            where: {
              locationId: resolvedLocationId,
              number: rawNumber,
              status: "AVAILABLE",
            },
          });
        }

        if (seat) {
          console.log("[CHAPPY] Found seat ID:", seat.id, "for pod", seat.number);
          appleSeatId = seat.id;
        } else {
          console.log("[CHAPPY] Pod", rawNumber, "not found or not available");
          // Don't fail - just proceed without seat selection
          appleSeatId = null;
        }
      }

      // Get user if logged in (for credits)
      let user = null;
      if (userId) {
        user = await prisma.user.findUnique({ where: { id: userId } });
      }

      // Calculate order total
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: applePayItems.map((i) => i.menuItemId) } },
      });

      console.log("[CHAPPY] Found", menuItems.length, "menu items out of", applePayItems.length, "requested");

      // Check for missing menu items before processing
      const foundIds = new Set(menuItems.map((m) => m.id));
      const missingItems = applePayItems.filter((i) => !foundIds.has(i.menuItemId));
      if (missingItems.length > 0) {
        console.log("[CHAPPY] Missing menu items:", missingItems.map((i) => i.menuItemId));

        // Fallback: if user is logged in, try to get their most recent completed order instead
        if (userId) {
          console.log("[CHAPPY] Attempting fallback: using most recent completed order");
          const fallbackOrder = await prisma.order.findFirst({
            where: { userId, status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            include: { items: true },
          });
          if (fallbackOrder && fallbackOrder.items.length > 0) {
            console.log("[CHAPPY] Using fallback order:", fallbackOrder.id, "with", fallbackOrder.items.length, "items");
            applePayItems = fallbackOrder.items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              selectedValue: i.selectedValue,
            }));
            // Re-fetch menu items for the new list
            const fallbackMenuItems = await prisma.menuItem.findMany({
              where: { id: { in: applePayItems.map((i) => i.menuItemId) } },
            });
            menuItems.length = 0;
            menuItems.push(...fallbackMenuItems);
          } else {
            console.log("[CHAPPY] ERROR: Fallback failed, no completed orders found");
            return {
              error: `Some menu items are no longer available. Please start a new order.`,
              missingItemIds: missingItems.map((i) => i.menuItemId),
            };
          }
        } else {
          return {
            error: `Some menu items are no longer available. Please start a new order.`,
            missingItemIds: missingItems.map((i) => i.menuItemId),
          };
        }
      }

      let totalCents = 0;
      const itemsWithPrices = applePayItems.map((item) => {
        const menuItem = menuItems.find((m) => m.id === item.menuItemId);
        // This should never happen now due to the check above, but keep for safety
        if (!menuItem) {
          console.error("[CHAPPY] Unexpected: menu item not found after validation:", item.menuItemId);
          return null;
        }

        const priceCents = menuItem.basePriceCents * item.quantity;
        totalCents += priceCents;

        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          priceCents,
          selectedValue: item.selectedValue || null,
          name: menuItem.name,
        };
      }).filter(Boolean);

      // Calculate tax (8.25% Utah state + local)
      const taxRate = 0.0825;
      const taxCents = Math.round(totalCents * taxRate);

      // Apply credits if requested and user is logged in
      let creditsApplied = 0;
      if (appleApplyCredits && user?.creditsCents > 0) {
        creditsApplied = Math.min(500, user.creditsCents, totalCents);
      }

      const finalTotal = totalCents + taxCents - creditsApplied;

      // Import Stripe
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // Create or get Stripe customer for the user
      let stripeCustomerId = user?.stripeCustomerId;
      if (!stripeCustomerId && userId && user) {
        // Create a Stripe customer for this user
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customer.id },
        });
      }

      // Generate order numbers
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const orderQrCode = `ORDER-${resolvedLocationId.slice(-8)}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Get kitchen order number
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaysOrderCount = await prisma.order.count({
        where: {
          locationId: resolvedLocationId,
          paymentStatus: "PAID",
          createdAt: { gte: today, lt: tomorrow },
        },
      });
      const kitchenOrderNumber = String(todaysOrderCount + 1).padStart(4, "0");

      // Determine estimated arrival
      let estimatedArrival = null;
      if (appleArrivalTime && appleArrivalTime !== "ASAP") {
        estimatedArrival = new Date(appleArrivalTime);
      } else {
        estimatedArrival = new Date(Date.now() + 10 * 60 * 1000);
      }

      // Create pending order first
      const pendingOrder = await prisma.order.create({
        data: {
          orderNumber,
          orderQrCode,
          kitchenOrderNumber,
          tenantId,
          locationId: resolvedLocationId,
          userId: userId || undefined,
          guestId: guestId || undefined,
          seatId: appleSeatId || null,
          podSelectionMethod: appleSeatId ? "CUSTOMER_SELECTED" : null,
          totalCents: finalTotal,
          taxCents,
          estimatedArrival,
          paymentStatus: "PENDING",
          status: "PENDING_PAYMENT",
          orderSource: "CHAPPY",
          items: {
            create: itemsWithPrices.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              priceCents: item.priceCents,
              selectedValue: item.selectedValue,
            })),
          },
        },
        include: {
          items: { include: { menuItem: true } },
          location: true,
        },
      });

      // Create Payment Intent for Apple Pay
      const paymentIntentData = {
        amount: finalTotal,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          orderId: pendingOrder.id,
          orderNumber: pendingOrder.orderNumber,
          locationId: resolvedLocationId,
          source: "chappy_apple_pay",
          userId: userId || "",
          guestId: guestId || "",
        },
      };

      // Attach customer if we have one
      if (stripeCustomerId) {
        paymentIntentData.customer = stripeCustomerId;
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

      // Update order with payment intent ID
      await prisma.order.update({
        where: { id: pendingOrder.id },
        data: { stripePaymentId: paymentIntent.id },
      });

      // Get location name for display
      const location = await prisma.location.findUnique({ where: { id: resolvedLocationId } });

      return {
        success: true,
        requiresApplePay: true,
        orderId: pendingOrder.id,
        orderNumber: pendingOrder.orderNumber,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        total: `$${(finalTotal / 100).toFixed(2)}`,
        totalCents: finalTotal,
        subtotal: `$${(totalCents / 100).toFixed(2)}`,
        tax: `$${(taxCents / 100).toFixed(2)}`,
        creditsApplied: creditsApplied > 0 ? `$${(creditsApplied / 100).toFixed(2)}` : null,
        items: itemsWithPrices.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: `$${(i.priceCents / 100).toFixed(2)}`,
        })),
        locationName: location?.name || "Oh! Beef",
        message: "Ready for Apple Pay! Tap the Apple Pay button to complete your order.",
      };
    }

    case "get_order_summary": {
      const { items: summaryItems, applyCredits: showCredits } = input;

      if (!summaryItems || summaryItems.length === 0) {
        return { error: "No items to summarize" };
      }

      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: summaryItems.map((i) => i.menuItemId) } },
      });

      let subtotal = 0;
      const itemizedList = summaryItems.map((item) => {
        const menuItem = menuItems.find((m) => m.id === item.menuItemId);
        if (!menuItem) return null;

        const itemTotal = menuItem.basePriceCents * item.quantity;
        subtotal += itemTotal;

        return {
          name: menuItem.name,
          quantity: item.quantity,
          unitPrice: `$${(menuItem.basePriceCents / 100).toFixed(2)}`,
          total: `$${(itemTotal / 100).toFixed(2)}`,
        };
      }).filter(Boolean);

      const taxCents = Math.round(subtotal * 0.0825);
      let creditsAvailable = 0;
      let creditsToApply = 0;

      if (showCredits && userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user?.creditsCents > 0) {
          creditsAvailable = user.creditsCents;
          creditsToApply = Math.min(500, creditsAvailable, subtotal);
        }
      }

      const total = subtotal + taxCents - creditsToApply;

      return {
        items: itemizedList,
        subtotal: `$${(subtotal / 100).toFixed(2)}`,
        tax: `$${(taxCents / 100).toFixed(2)}`,
        creditsAvailable: creditsAvailable > 0 ? `$${(creditsAvailable / 100).toFixed(2)}` : null,
        creditsApplied: creditsToApply > 0 ? `$${(creditsToApply / 100).toFixed(2)}` : null,
        total: `$${(total / 100).toFixed(2)}`,
        summary: `${itemizedList.length} item${itemizedList.length > 1 ? "s" : ""} - Total: $${(total / 100).toFixed(2)}`,
      };
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * Helper: Get tier benefits text
 */
function getTierBenefits(tier) {
  switch (tier) {
    case "CHOPSTICK":
      return "1% cashback on orders";
    case "NOODLE_MASTER":
      return "2% cashback on orders";
    case "BEEF_BOSS":
      return "3% cashback + VIP perks";
    default:
      return "1% cashback on orders";
  }
}

/**
 * Helper: Get tier progress info
 */
function getTierProgressInfo(user) {
  const { membershipTier, lifetimeOrderCount } = user;

  const NOODLE_MASTER_THRESHOLD = 10;
  const BEEF_BOSS_THRESHOLD = 50;

  if (membershipTier === "CHOPSTICK") {
    const remaining = NOODLE_MASTER_THRESHOLD - lifetimeOrderCount;
    return {
      currentTier: "CHOPSTICK",
      currentBenefit: "1% cashback",
      nextTier: "NOODLE_MASTER",
      nextBenefit: "2% cashback",
      ordersUntilNext: Math.max(0, remaining),
      progress: `${lifetimeOrderCount}/${NOODLE_MASTER_THRESHOLD}`,
      encouragement:
        remaining <= 3
          ? `Only ${remaining} more bowl${remaining === 1 ? "" : "s"} until NOODLE_MASTER!`
          : null,
    };
  }

  if (membershipTier === "NOODLE_MASTER") {
    const remaining = BEEF_BOSS_THRESHOLD - lifetimeOrderCount;
    return {
      currentTier: "NOODLE_MASTER",
      currentBenefit: "2% cashback",
      nextTier: "BEEF_BOSS",
      nextBenefit: "3% cashback + VIP perks",
      ordersUntilNext: Math.max(0, remaining),
      progress: `${lifetimeOrderCount}/${BEEF_BOSS_THRESHOLD}`,
      encouragement:
        remaining <= 5
          ? `Only ${remaining} more bowl${remaining === 1 ? "" : "s"} until BEEF_BOSS!`
          : null,
    };
  }

  return {
    currentTier: "BEEF_BOSS",
    currentBenefit: "3% cashback + VIP perks",
    nextTier: null,
    message: "You've reached the top tier! Enjoy your VIP benefits.",
  };
}

export default { CHAPPY_TOOLS, executeTools };
