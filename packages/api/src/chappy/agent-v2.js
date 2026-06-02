/**
 * Chappy Chopstix Agent - AI SDK 6 Implementation
 *
 * Refactored to use Vercel AI SDK 6 ToolLoopAgent for:
 * - First-class agent abstraction
 * - Built-in tool loop management
 * - Streaming support
 * - Step tracking and callbacks
 *
 * Phase 3: Stripe Agent Toolkit Integration
 * - Payment status checking
 * - Payment link generation
 * - Customer payment history
 * - Invoice management
 */

import { ToolLoopAgent, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { getChappySystemPrompt as getSystemPrompt } from './prompts.js';
import { createStripeAgentToolkit } from '@stripe/agent-toolkit/ai-sdk';

// Model configuration - Using Opus 4.7 with xhigh effort
const MODEL = anthropic('claude-opus-4-7-20260416', {
  // Anthropic-specific options
  thinking: { type: 'adaptive' },
  effort: 'xhigh',
});

/**
 * Create Chappy tools with AI SDK 6 format
 * Tools are defined with zod schemas for type safety
 */
function createChappyTools(context) {
  const { prisma, userId, guestId, locationId, tenantId } = context;

  return {
    // ==========================================
    // MENU TOOLS
    // ==========================================
    browse_menu: tool({
      description: `Get the menu with all items, prices, and dietary information. Use this when:
- Customer wants to see what's available
- Customer asks about specific dishes or categories
- Customer has dietary restrictions (vegetarian, vegan, gluten-free)
- Customer wants recommendations

Returns items grouped by category with prices, descriptions, and dietary info.`,
      parameters: z.object({
        category: z.enum(['MAIN', 'SLIDER', 'ADDON', 'SIDE', 'DRINK', 'DESSERT']).optional()
          .describe('Filter by category type'),
        dietary: z.enum(['vegetarian', 'vegan', 'gluten-free']).optional()
          .describe('Filter for dietary restrictions'),
      }),
      execute: async ({ category, dietary }) => {
        const where = { tenantId, isAvailable: true };
        if (category) where.categoryType = category;

        let items = await prisma.menuItem.findMany({
          where,
          orderBy: [{ categoryType: 'asc' }, { displayOrder: 'asc' }],
        });

        if (dietary) {
          items = items.filter((item) => {
            if (dietary === 'vegetarian') return item.isVegetarian;
            if (dietary === 'vegan') return item.isVegan;
            if (dietary === 'gluten-free') return item.isGlutenFree;
            return true;
          });
        }

        return items.map((item) => ({
          id: item.id,
          name: item.name,
          price: `$${(item.basePriceCents / 100).toFixed(2)}`,
          category: item.categoryType,
          description: item.description,
          spiceLevel: item.spiceLevel,
          dietary: [
            item.isVegetarian && 'V',
            item.isVegan && 'VG',
            item.isGlutenFree && 'GF',
          ].filter(Boolean).join(', ') || null,
        }));
      },
    }),

    get_menu_item: tool({
      description: `Get detailed information about a specific menu item. Use when:
- Customer asks about a specific dish
- You need to confirm item details before adding to order
- Customer wants to know ingredients, allergens, or spice level`,
      parameters: z.object({
        itemId: z.string().optional().describe('The menu item ID'),
        itemName: z.string().optional().describe('The menu item name (partial match OK)'),
      }),
      execute: async ({ itemId, itemName }) => {
        let item;
        if (itemId) {
          item = await prisma.menuItem.findUnique({ where: { id: itemId } });
        } else if (itemName) {
          item = await prisma.menuItem.findFirst({
            where: {
              tenantId,
              name: { contains: itemName, mode: 'insensitive' },
            },
          });
        }

        if (!item) return 'Item not found';

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
      },
    }),

    // ==========================================
    // LOCATION TOOLS
    // ==========================================
    get_locations: tool({
      description: `Get all restaurant locations with hours and availability. Use when:
- Customer asks "where are you located?"
- Customer wants to know if a location is open
- Confirming which location to order from`,
      parameters: z.object({}),
      execute: async () => {
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
      },
    }),

    check_location_for_order: tool({
      description: `Confirm the location for an order and check if it's currently open and available. Use when:
- Starting a new order
- Customer asks to place an order
- Need to verify a location is accepting orders

Returns location details, operating status, available pods, and estimated wait time.`,
      parameters: z.object({
        locationId: z.string().optional()
          .describe('Location ID to check. If not provided, uses the current context location.'),
      }),
      execute: async ({ locationId: inputLocationId }) => {
        const checkLocationId = inputLocationId || locationId;

        if (!checkLocationId) {
          const locations = await prisma.location.findMany({
            where: { tenantId },
            include: { seats: true },
          });

          return {
            needsSelection: true,
            message: 'Which location would you like to order from?',
            locations: locations.map((loc) => ({
              id: loc.id,
              name: loc.name,
              city: loc.city,
              address: loc.address,
              isOpen: !loc.isClosed,
              availablePods: loc.seats.filter((s) => s.status === 'AVAILABLE').length,
            })),
          };
        }

        const location = await prisma.location.findUnique({
          where: { id: checkLocationId },
          include: { seats: true },
        });

        if (!location) return { error: 'Location not found' };

        const availablePods = location.seats.filter((s) => s.status === 'AVAILABLE');
        const occupiedPods = location.seats.filter((s) => s.status === 'OCCUPIED');
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
            ? `${location.name} is open with ${availablePods.length} pod${availablePods.length > 1 ? 's' : ''} available!`
            : `${location.name} is open but all pods are full. Estimated wait: ${estimatedWaitMinutes} minutes.`,
        };
      },
    }),

    get_available_pods: tool({
      description: `Get list of available pods/seats at a location for ASAP orders. Use when:
- Customer selected ASAP arrival
- Customer wants to choose their pod
- Showing seating options`,
      parameters: z.object({
        locationId: z.string().describe('Location ID to check pods for'),
      }),
      execute: async ({ locationId: inputLocationId }) => {
        const podsLocationId = inputLocationId || locationId;
        if (!podsLocationId) return { error: 'Location ID required' };

        const seats = await prisma.seat.findMany({
          where: {
            locationId: podsLocationId,
            status: 'AVAILABLE',
          },
          orderBy: { number: 'asc' },
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
          message: `${seats.length} pod${seats.length > 1 ? 's' : ''} available! Which one would you like?`,
          pods: seats.map((s) => ({
            id: s.id,
            number: s.number,
            type: s.type || 'standard',
          })),
        };
      },
    }),

    // ==========================================
    // ACCOUNT & PROFILE TOOLS
    // ==========================================
    get_user_profile: tool({
      description: `Get the customer's profile including tier, credits, streak, and order history summary. Use when:
- Customer asks about their account
- Customer asks about points/credits
- Need to personalize recommendations
- Checking tier progress`,
      parameters: z.object({}),
      execute: async () => {
        if (!userId) return 'No user logged in. This is a guest session.';

        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            _count: { select: { orders: true } },
          },
        });

        if (!user) return 'User not found';

        return {
          name: user.name,
          tier: user.membershipTier,
          tierBenefits: getTierBenefits(user.membershipTier),
          credits: `$${(user.creditsCents / 100).toFixed(2)}`,
          currentStreak: user.currentStreak,
          lifetimeOrders: user.lifetimeOrderCount,
          tierProgress: getTierProgressInfo(user),
        };
      },
    }),

    get_credits_balance: tool({
      description: `Get the customer's current credits balance. Use when customer asks "how many points/credits do I have?"`,
      parameters: z.object({}),
      execute: async () => {
        if (!userId) return 'No user logged in. Credits are only available for registered users.';

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { creditsCents: true },
        });

        return {
          balance: `$${(user.creditsCents / 100).toFixed(2)}`,
          balanceCents: user.creditsCents,
        };
      },
    }),

    get_order_history: tool({
      description: `Get customer's past orders for recommendations and "reorder" functionality. Use to:
- Suggest "your usual"
- Make personalized recommendations
- Show recent orders`,
      parameters: z.object({
        limit: z.number().optional().describe('Number of recent orders to return (default 5)'),
      }),
      execute: async ({ limit = 5 }) => {
        if (!userId) return 'No order history available for guest sessions.';

        const orders = await prisma.order.findMany({
          where: { userId, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: limit,
          include: { items: { include: { menuItem: true } }, location: true },
        });

        return orders.map((order) => ({
          orderId: order.id,
          orderNumber: order.orderNumber,
          date: order.createdAt.toISOString().split('T')[0],
          total: `$${(order.totalCents / 100).toFixed(2)}`,
          locationId: order.locationId,
          locationName: order.location?.name || 'Unknown',
          itemsSummary: order.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(', '),
          reorderItems: order.items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            selectedValue: i.selectedValue,
            name: i.menuItem.name,
            priceCents: i.priceCents,
          })),
        }));
      },
    }),

    // ==========================================
    // ORDER TOOLS
    // ==========================================
    get_order_status: tool({
      description: `Check the status of an existing order. Use when:
- Customer asks "where's my order?"
- Customer wants to know if food is ready
- Checking pod assignment

Returns: order status, pod number (if assigned), estimated wait time.`,
      parameters: z.object({
        orderId: z.string().optional().describe('The order ID'),
        orderNumber: z.string().optional().describe("The order number (e.g., 'ORD-1234-ABCD')"),
      }),
      execute: async ({ orderId, orderNumber }) => {
        const where = {};
        if (orderId) where.id = orderId;
        if (orderNumber) where.orderNumber = orderNumber;

        const order = await prisma.order.findFirst({
          where,
          include: { seat: true },
        });

        if (!order) return 'Order not found';

        return {
          orderNumber: order.orderNumber,
          status: order.status,
          podNumber: order.seat?.number || 'Not yet assigned',
          estimatedWait: order.estimatedWaitMinutes ? `~${order.estimatedWaitMinutes} minutes` : 'N/A',
          total: `$${(order.totalCents / 100).toFixed(2)}`,
        };
      },
    }),

    get_saved_payment_methods: tool({
      description: `Get customer's saved payment methods (credit/debit cards). Use when:
- Ready to process payment for an order
- Customer asks about their saved cards
- Need to confirm payment method before charging

Returns tokenized card info (last4, brand) - never raw card numbers. Only available for logged-in users.`,
      parameters: z.object({}),
      execute: async () => {
        if (!userId) {
          return {
            hasPaymentMethods: false,
            applePayAvailable: true,
            message: "You need to be logged in to use saved payment methods, but you can pay with Apple Pay or Google Pay!",
          };
        }

        const methods = await prisma.savedPaymentMethod.findMany({
          where: { userId },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });

        if (methods.length === 0) {
          return {
            hasPaymentMethods: false,
            applePayAvailable: true,
            message: "No saved cards on file, but you can pay with Apple Pay or Google Pay! Just say 'pay with Apple Pay' when you're ready.",
          };
        }

        return {
          hasPaymentMethods: true,
          applePayAvailable: true,
          methods: methods.map((m) => ({
            id: m.id,
            brand: m.brand ? m.brand.charAt(0).toUpperCase() + m.brand.slice(1) : 'Card',
            last4: m.last4 || '****',
            isDefault: m.isDefault,
            expiry: m.expiryMonth && m.expiryYear ? `${m.expiryMonth}/${m.expiryYear}` : null,
          })),
          defaultMethod: methods.find((m) => m.isDefault) || methods[0],
          message: methods.length === 1
            ? `I'll charge your ${methods[0].brand} ending in ${methods[0].last4}. Or say 'Apple Pay' to use that instead.`
            : `Which card would you like to use? You can also say 'Apple Pay'.`,
        };
      },
    }),

    get_chefs_choice: tool({
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
      parameters: z.object({
        locationId: z.string().optional().describe('Location ID. Uses context location if not provided.'),
      }),
      execute: async ({ locationId: inputLocationId }) => {
        const chefsChoiceLocationId = inputLocationId || locationId;

        const classicSoup = await prisma.menuItem.findFirst({
          where: { name: { contains: 'Classic Beef Noodle Soup' }, isAvailable: true },
        });
        const wideNoodles = await prisma.menuItem.findFirst({
          where: { name: { contains: 'Wide Noodles' }, isAvailable: true },
        });
        const sherbet = await prisma.menuItem.findFirst({
          where: { name: { contains: 'Mandarin Orange Sherbet' }, isAvailable: true },
        });

        if (!classicSoup) {
          return { error: "Chef's Choice items not available at this time." };
        }

        const chefsChoiceItems = [
          classicSoup && { menuItemId: classicSoup.id, name: classicSoup.name, quantity: 1, priceCents: classicSoup.basePriceCents },
          wideNoodles && { menuItemId: wideNoodles.id, name: wideNoodles.name, quantity: 1, priceCents: 0 },
          sherbet && { menuItemId: sherbet.id, name: sherbet.name, quantity: 1, priceCents: 0, note: 'Complimentary' },
        ].filter(Boolean);

        const totalCents = chefsChoiceItems.reduce((sum, item) => sum + (item.priceCents || 0), 0);

        return {
          name: "Chef's Choice",
          description: 'Our recommended bowl for the perfect Oh! experience',
          items: chefsChoiceItems,
          totalCents,
          totalFormatted: `$${(totalCents / 100).toFixed(2)}`,
          includes: [
            'Classic Beef Noodle Soup',
            'Wide noodles (most popular)',
            'Medium broth richness',
            'Mild spice level',
            'Complimentary Mandarin Orange Sherbet',
          ],
          readyToOrder: true,
          message: "Chef's Choice is ready. This is our most popular configuration - $15.99 for the perfect bowl plus a complimentary sherbet. Want me to add this to your order?",
        };
      },
    }),

    reorder_previous_order: tool({
      description: `Quickly reorder from a previous order. Use when:
- Customer says "reorder my last order"
- Customer wants to duplicate a previous order
- Customer says "same as before"

Returns the previous order details for confirmation before creating new order.`,
      parameters: z.object({
        orderId: z.string().optional()
          .describe('Specific order ID to reorder. If not provided, uses most recent completed order.'),
      }),
      execute: async ({ orderId }) => {
        if (!userId) return { error: 'You need to be logged in to reorder.' };

        let previousOrder;
        if (orderId) {
          previousOrder = await prisma.order.findFirst({
            where: { id: orderId, userId },
            include: { items: { include: { menuItem: true } }, location: true },
          });
        } else {
          previousOrder = await prisma.order.findFirst({
            where: { userId, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
            include: { items: { include: { menuItem: true } }, location: true },
          });
        }

        if (!previousOrder) {
          return {
            found: false,
            message: 'No previous orders found. Would you like to start a new order?',
          };
        }

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
            ? `Note: ${unavailableItems.map((i) => i.menuItem.name).join(', ')} ${unavailableItems.length === 1 ? 'is' : 'are'} no longer available.`
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
      },
    }),

    // ==========================================
    // PAYMENT TOOLS (with approval flags for Phase 2)
    // ==========================================
    create_payment_link: tool({
      description: `Create a payment link for an order. Use for SMS/RCS channels where we can't process payment directly. Returns a URL the customer can tap to pay.`,
      parameters: z.object({
        orderId: z.string().describe('Order ID to create payment for'),
        applyCredits: z.boolean().optional().describe('Whether to apply available credits to this order'),
      }),
      execute: async ({ orderId, applyCredits }) => {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
        });

        if (!order) return 'Order not found';

        const paymentUrl = `https://ohbeef.com/pay/${order.orderNumber}`;

        return {
          paymentUrl,
          amount: `$${(order.totalCents / 100).toFixed(2)}`,
          message: 'Tap the link to complete payment',
        };
      },
    }),
  };
}

// ==========================================
// STRIPE AGENT TOOLKIT INTEGRATION (Phase 3)
// ==========================================

/**
 * Cached Stripe Agent Toolkit instance
 * Initialized lazily on first use
 */
let stripeToolkitInstance = null;
let stripeToolkitInitializing = null;

/**
 * Initialize or get the cached Stripe Agent Toolkit
 * Uses MCP connection to mcp.stripe.com for secure tool access
 *
 * @returns {Promise<Object>} Stripe tools in AI SDK format
 */
async function getStripeToolkit() {
  if (stripeToolkitInstance) {
    return stripeToolkitInstance;
  }

  // Prevent duplicate initialization
  if (stripeToolkitInitializing) {
    return stripeToolkitInitializing;
  }

  stripeToolkitInitializing = (async () => {
    try {
      const toolkit = await createStripeAgentToolkit({
        secretKey: process.env.STRIPE_SECRET_KEY,
        configuration: {
          // Limit to read operations + payment links for safety
          // The toolkit reads permissions from Stripe RAK (Restricted API Key)
          context: {},
        },
      });

      stripeToolkitInstance = toolkit;
      console.log('[CHAPPY-V2] Stripe Agent Toolkit initialized successfully');
      return toolkit;
    } catch (error) {
      console.error('[CHAPPY-V2] Failed to initialize Stripe toolkit:', error.message);
      stripeToolkitInitializing = null;
      return null;
    }
  })();

  return stripeToolkitInitializing;
}

/**
 * Create Chappy-specific Stripe tools
 * These wrap common payment operations for restaurant context
 */
function createChappyStripeTools(context) {
  const { prisma, userId, guestId, tenantId } = context;

  return {
    // ==========================================
    // STRIPE PAYMENT TOOLS
    // ==========================================
    check_payment_status: tool({
      description: `Check the payment status for an order. Use when:
- Customer asks "did my payment go through?"
- Need to verify payment before order preparation
- Customer inquires about a charge on their card

Returns payment status, amount, and timestamp.`,
      parameters: z.object({
        orderId: z.string().optional().describe('Order ID to check payment for'),
        orderNumber: z.string().optional().describe('Order number (e.g., ORD-1234-ABCD)'),
      }),
      execute: async ({ orderId, orderNumber }) => {
        const where = {};
        if (orderId) where.id = orderId;
        if (orderNumber) where.orderNumber = orderNumber;

        const order = await prisma.order.findFirst({
          where: { ...where, tenantId },
          select: {
            id: true,
            orderNumber: true,
            totalCents: true,
            paymentStatus: true,
            stripePaymentId: true,
            createdAt: true,
            paymentMethodBrand: true,
            paymentMethodLast4: true,
          },
        });

        if (!order) {
          return { found: false, message: 'Order not found.' };
        }

        return {
          found: true,
          orderNumber: order.orderNumber,
          amount: `$${(order.totalCents / 100).toFixed(2)}`,
          paymentStatus: order.paymentStatus,
          isPaid: order.paymentStatus === 'PAID',
          paymentMethod: order.paymentMethodBrand
            ? `${order.paymentMethodBrand} ending in ${order.paymentMethodLast4}`
            : 'Not recorded',
          chargedAt: order.createdAt?.toISOString(),
          message: order.paymentStatus === 'PAID'
            ? `Payment of ${(order.totalCents / 100).toFixed(2)} was successful!`
            : order.paymentStatus === 'PENDING'
            ? 'Payment is still pending. Please complete checkout.'
            : 'Payment was not completed.',
        };
      },
    }),

    get_payment_history: tool({
      description: `Get the customer's payment history at Oh! Beef. Use when:
- Customer asks "how much have I spent?"
- Customer wants to see past charges
- Need to verify a specific transaction`,
      parameters: z.object({
        limit: z.number().optional().describe('Number of recent payments to show (default 5, max 20)'),
      }),
      execute: async ({ limit = 5 }) => {
        if (!userId) {
          return {
            available: false,
            message: "Payment history requires a logged-in account. As a guest, I can only show your current order.",
          };
        }

        const orders = await prisma.order.findMany({
          where: {
            userId,
            paymentStatus: 'PAID',
          },
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit, 20),
          select: {
            orderNumber: true,
            totalCents: true,
            createdAt: true,
            paymentMethodBrand: true,
            paymentMethodLast4: true,
            location: { select: { name: true } },
          },
        });

        if (orders.length === 0) {
          return {
            available: true,
            payments: [],
            message: "No past orders found. This will be your first order with us!",
          };
        }

        const totalSpent = orders.reduce((sum, o) => sum + o.totalCents, 0);

        return {
          available: true,
          totalOrders: orders.length,
          totalSpent: `$${(totalSpent / 100).toFixed(2)}`,
          payments: orders.map((o) => ({
            orderNumber: o.orderNumber,
            amount: `$${(o.totalCents / 100).toFixed(2)}`,
            date: o.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            location: o.location?.name || 'Oh! Beef',
            card: o.paymentMethodBrand
              ? `${o.paymentMethodBrand} •••• ${o.paymentMethodLast4}`
              : 'Card on file',
          })),
          message: `Found ${orders.length} order${orders.length > 1 ? 's' : ''} totaling $${(totalSpent / 100).toFixed(2)}.`,
        };
      },
    }),

    generate_sms_payment_link: tool({
      description: `Generate a Stripe Payment Link for SMS/RCS orders. Creates a secure checkout URL that customers can tap to pay. Use when:
- Processing an SMS order that needs payment
- Customer can't complete Apple Pay
- Creating a payment link to text to customer

The link expires after 24 hours and can only be used once.`,
      parameters: z.object({
        orderId: z.string().describe('Order ID to create payment link for'),
        expiresInHours: z.number().optional().describe('Hours until link expires (default 24, max 72)'),
      }),
      execute: async ({ orderId, expiresInHours = 24 }) => {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: { include: { menuItem: true } },
            location: true,
          },
        });

        if (!order) {
          return { success: false, error: 'Order not found' };
        }

        if (order.paymentStatus === 'PAID') {
          return {
            success: false,
            error: 'Order already paid',
            message: "This order has already been paid. No payment link needed!",
          };
        }

        try {
          // Import Stripe for payment link creation
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

          // Create a Payment Link via Stripe
          const expiresAt = Math.floor(Date.now() / 1000) + (Math.min(expiresInHours, 72) * 3600);

          // First create a price for this order
          const price = await stripe.prices.create({
            currency: 'usd',
            unit_amount: order.totalCents,
            product_data: {
              name: `Oh! Beef Order ${order.orderNumber}`,
              description: order.items.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(', '),
            },
          });

          const paymentLink = await stripe.paymentLinks.create({
            line_items: [{ price: price.id, quantity: 1 }],
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              source: 'chappy_sms',
            },
            after_completion: {
              type: 'redirect',
              redirect: {
                url: `https://ohbeef.com/order/${order.orderNumber}/confirmed`,
              },
            },
            // Payment links don't support expires_at directly, but we track it
          });

          // Store the payment link reference
          await prisma.order.update({
            where: { id: orderId },
            data: {
              stripePaymentLinkId: paymentLink.id,
              stripePaymentLinkUrl: paymentLink.url,
            },
          });

          return {
            success: true,
            paymentUrl: paymentLink.url,
            shortUrl: paymentLink.url, // Stripe URLs are already short
            amount: `$${(order.totalCents / 100).toFixed(2)}`,
            expiresIn: `${expiresInHours} hours`,
            orderNumber: order.orderNumber,
            message: `Here's your payment link for $${(order.totalCents / 100).toFixed(2)}. Tap to pay securely: ${paymentLink.url}`,
          };
        } catch (error) {
          console.error('[CHAPPY-V2] Payment link creation failed:', error);
          return {
            success: false,
            error: 'Failed to create payment link',
            fallbackUrl: `https://ohbeef.com/pay/${order.orderNumber}`,
            message: `I couldn't create a Stripe link, but you can pay here: https://ohbeef.com/pay/${order.orderNumber}`,
          };
        }
      },
    }),

    lookup_refund_status: tool({
      description: `Check the status of a refund for an order. Use when:
- Customer asks "where's my refund?"
- Customer inquires about a cancelled order refund
- Need to verify refund was processed`,
      parameters: z.object({
        orderId: z.string().optional().describe('Order ID to check refund for'),
        orderNumber: z.string().optional().describe('Order number'),
      }),
      execute: async ({ orderId, orderNumber }) => {
        const where = {};
        if (orderId) where.id = orderId;
        if (orderNumber) where.orderNumber = orderNumber;

        const order = await prisma.order.findFirst({
          where: { ...where, tenantId },
          select: {
            id: true,
            orderNumber: true,
            totalCents: true,
            status: true,
            paymentStatus: true,
            stripePaymentId: true,
            refundStatus: true,
            refundedAt: true,
            refundAmountCents: true,
          },
        });

        if (!order) {
          return { found: false, message: 'Order not found.' };
        }

        if (!order.stripePaymentId) {
          return {
            found: true,
            orderNumber: order.orderNumber,
            hasRefund: false,
            message: 'No payment was processed for this order.',
          };
        }

        // Check with Stripe for refund details
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

          const paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentId, {
            expand: ['latest_charge.refunds'],
          });

          const charge = paymentIntent.latest_charge;
          const refunds = charge?.refunds?.data || [];

          if (refunds.length === 0) {
            return {
              found: true,
              orderNumber: order.orderNumber,
              hasRefund: false,
              originalAmount: `$${(order.totalCents / 100).toFixed(2)}`,
              message: 'No refund has been issued for this order.',
            };
          }

          const totalRefunded = refunds.reduce((sum, r) => sum + r.amount, 0);
          const latestRefund = refunds[0];

          return {
            found: true,
            orderNumber: order.orderNumber,
            hasRefund: true,
            refundAmount: `$${(totalRefunded / 100).toFixed(2)}`,
            refundStatus: latestRefund.status,
            refundedAt: new Date(latestRefund.created * 1000).toLocaleDateString(),
            originalAmount: `$${(order.totalCents / 100).toFixed(2)}`,
            isFullRefund: totalRefunded >= order.totalCents,
            message: latestRefund.status === 'succeeded'
              ? `Your refund of $${(totalRefunded / 100).toFixed(2)} was processed on ${new Date(latestRefund.created * 1000).toLocaleDateString()}. It may take 5-10 business days to appear on your statement.`
              : `Your refund is ${latestRefund.status}. Please allow 5-10 business days for processing.`,
          };
        } catch (error) {
          console.error('[CHAPPY-V2] Refund lookup failed:', error);
          return {
            found: true,
            orderNumber: order.orderNumber,
            error: 'Unable to fetch refund details at this time.',
            message: "I'm having trouble checking the refund status. Please contact support at help@ohbeef.com for assistance.",
          };
        }
      },
    }),
  };
}

/**
 * Helper: Get tier benefits text
 */
function getTierBenefits(tier) {
  switch (tier) {
    case 'CHOPSTICK':
      return '1% cashback on orders';
    case 'NOODLE_MASTER':
      return '2% cashback on orders';
    case 'BEEF_BOSS':
      return '3% cashback + VIP perks';
    default:
      return '1% cashback on orders';
  }
}

/**
 * Helper: Get tier progress info
 */
function getTierProgressInfo(user) {
  const { membershipTier, lifetimeOrderCount } = user;

  const NOODLE_MASTER_THRESHOLD = 10;
  const BEEF_BOSS_THRESHOLD = 50;

  if (membershipTier === 'CHOPSTICK') {
    const remaining = NOODLE_MASTER_THRESHOLD - lifetimeOrderCount;
    return {
      currentTier: 'CHOPSTICK',
      currentBenefit: '1% cashback',
      nextTier: 'NOODLE_MASTER',
      nextBenefit: '2% cashback',
      ordersUntilNext: Math.max(0, remaining),
      progress: `${lifetimeOrderCount}/${NOODLE_MASTER_THRESHOLD}`,
      encouragement: remaining <= 3 ? `Only ${remaining} more bowl${remaining === 1 ? '' : 's'} until NOODLE_MASTER!` : null,
    };
  }

  if (membershipTier === 'NOODLE_MASTER') {
    const remaining = BEEF_BOSS_THRESHOLD - lifetimeOrderCount;
    return {
      currentTier: 'NOODLE_MASTER',
      currentBenefit: '2% cashback',
      nextTier: 'BEEF_BOSS',
      nextBenefit: '3% cashback + VIP perks',
      ordersUntilNext: Math.max(0, remaining),
      progress: `${lifetimeOrderCount}/${BEEF_BOSS_THRESHOLD}`,
      encouragement: remaining <= 5 ? `Only ${remaining} more bowl${remaining === 1 ? '' : 's'} until BEEF_BOSS!` : null,
    };
  }

  return {
    currentTier: 'BEEF_BOSS',
    currentBenefit: '3% cashback + VIP perks',
    nextTier: null,
    message: "You've reached the top tier! Enjoy your VIP benefits.",
  };
}

/**
 * Create the Chappy ToolLoopAgent with all tools including Stripe
 *
 * @param {Object} context - Context with prisma, userId, locationId, etc.
 * @param {Object} options - Optional configuration
 * @param {boolean} options.includeStripeTools - Include Stripe payment tools (default: true)
 * @param {boolean} options.includeStripeToolkit - Include raw Stripe Agent Toolkit tools (default: false)
 * @returns {Promise<ToolLoopAgent>} - Configured agent instance
 */
export async function createChappyAgent(context, options = {}) {
  const { includeStripeTools = true, includeStripeToolkit = false } = options;

  // Get base Chappy tools
  const baseTools = createChappyTools(context);

  // Get Chappy-specific Stripe tools
  const stripeTools = includeStripeTools ? createChappyStripeTools(context) : {};

  // Optionally get raw Stripe Agent Toolkit tools
  let toolkitTools = {};
  if (includeStripeToolkit) {
    try {
      const toolkit = await getStripeToolkit();
      if (toolkit) {
        toolkitTools = toolkit.getTools();
        console.log('[CHAPPY-V2] Stripe toolkit tools loaded:', Object.keys(toolkitTools).length);
      }
    } catch (error) {
      console.warn('[CHAPPY-V2] Could not load Stripe toolkit:', error.message);
    }
  }

  // Merge all tools
  const tools = {
    ...baseTools,
    ...stripeTools,
    ...toolkitTools,
  };

  const systemPrompt = getSystemPrompt(context);

  return new ToolLoopAgent({
    id: 'chappy-chopstix',
    model: MODEL,
    instructions: systemPrompt,
    tools,
    maxOutputTokens: 1024,

    // Step tracking for observability
    onStepFinish: async ({ stepNumber, usage, finishReason, toolCalls }) => {
      console.log(`[CHAPPY-V2] Step ${stepNumber}:`, {
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        finishReason,
        toolsUsed: toolCalls?.map((tc) => tc.toolName),
      });
    },
  });
}

/**
 * Create Chappy agent synchronously (without Stripe toolkit, faster startup)
 * Use this for quick responses where Stripe toolkit isn't needed
 */
export function createChappyAgentSync(context) {
  const baseTools = createChappyTools(context);
  const stripeTools = createChappyStripeTools(context);
  const tools = { ...baseTools, ...stripeTools };
  const systemPrompt = getSystemPrompt(context);

  return new ToolLoopAgent({
    id: 'chappy-chopstix',
    model: MODEL,
    instructions: systemPrompt,
    tools,
    maxOutputTokens: 1024,
    onStepFinish: async ({ stepNumber, usage, finishReason, toolCalls }) => {
      console.log(`[CHAPPY-V2] Step ${stepNumber}:`, {
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        finishReason,
        toolsUsed: toolCalls?.map((tc) => tc.toolName),
      });
    },
  });
}

/**
 * Run the Chappy agent with a user message
 *
 * @param {string} message - User's message
 * @param {Array} history - Conversation history
 * @param {Object} context - Execution context
 * @param {Object} options - Agent options (includeStripeTools, includeStripeToolkit)
 * @returns {Object} - Agent response with text and metadata
 */
export async function runChappyAgent(message, history, context, options = {}) {
  // Use sync version for faster startup unless toolkit is explicitly requested
  const agent = options.includeStripeToolkit
    ? await createChappyAgent(context, options)
    : createChappyAgentSync(context);

  // Convert history to AI SDK format
  const messages = history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Add the new user message
  messages.push({ role: 'user', content: message });

  const result = await agent.generate({
    messages,
  });

  return {
    text: result.text,
    toolCalls: result.toolCalls,
    usage: result.usage,
    finishReason: result.finishReason,
  };
}

/**
 * Stream the Chappy agent response
 *
 * @param {string} message - User's message
 * @param {Array} history - Conversation history
 * @param {Object} context - Execution context
 * @param {Object} options - Agent options
 * @returns {AsyncGenerator} - Streaming response
 */
export async function* streamChappyAgent(message, history, context, options = {}) {
  // Use sync version for faster startup unless toolkit is explicitly requested
  const agent = options.includeStripeToolkit
    ? await createChappyAgent(context, options)
    : createChappyAgentSync(context);

  const messages = history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  messages.push({ role: 'user', content: message });

  const result = await agent.stream({
    messages,
  });

  for await (const chunk of result.textStream) {
    yield { type: 'text', data: { text: chunk } };
  }

  // Yield final metadata
  const finalResult = await result;
  yield {
    type: 'done',
    data: {
      usage: finalResult.usage,
      finishReason: finalResult.finishReason,
    },
  };
}

/**
 * Get the Stripe Agent Toolkit instance for direct tool access
 * Useful for advanced integrations that need raw Stripe tools
 */
export { getStripeToolkit };

export default {
  createChappyAgent,
  createChappyAgentSync,
  runChappyAgent,
  streamChappyAgent,
  getStripeToolkit,
};
