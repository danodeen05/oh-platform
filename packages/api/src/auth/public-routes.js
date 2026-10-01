/**
 * API routes that intentionally carry no admin auth, with the reason.
 * The classification test requires every route outside /admin and /plan to be
 * listed here or in console-guard.js CONSOLE_ROUTES.
 */
const p = (method, url, why) => Object.freeze({ method, url, why });

export const PUBLIC_ROUTES = Object.freeze([
  // Health check (infra/monitoring)
  p("GET", "/health", "public-read"),

  // Basic public reads (tenant/location/menu context, needed before a session exists)
  p("GET", "/tenants", "customer"),
  p("GET", "/locations", "customer"),
  p("GET", "/locations/:id/availability", "customer"),
  p("GET", "/locations/:id/seats", "customer"),
  p("GET", "/menu", "public-read"),
  p("GET", "/menu/steps", "customer"),
  p("GET", "/seats/:qrCode", "public-read"),

  // Kiosk
  p("POST", "/kiosk/auth", "kiosk"),
  p("POST", "/kiosk/heartbeat", "kiosk"),
  p("GET", "/orders/by-member", "kiosk"),
  p("GET", "/orders/lookup", "kiosk"),
  p("POST", "/kiosk/orders/payment-intent", "kiosk"),
  p("POST", "/kiosk/orders/confirm-payment", "kiosk"),
  p("POST", "/kiosk/orders/:id/seat", "kiosk"), // Task D12 fix 1: device-authenticated pod claim before payment

  // Customer ordering flow
  p("POST", "/orders/check-in", "customer"),
  p("GET", "/orders/status", "customer"),
  p("POST", "/orders/link-to-account", "customer"),
  p("POST", "/orders/confirm-pod", "customer"),
  p("POST", "/pods/confirm-arrival", "customer"),
  p("GET", "/pods/info", "customer"),
  p("POST", "/orders/:id/call-staff", "customer"),
  p("GET", "/orders/:id/available-addons", "customer"),
  p("POST", "/orders/:id/refill", "customer"),
  p("POST", "/orders/:id/extra-vegetables", "customer"),
  p("POST", "/orders/:id/dessert-ready", "customer"),
  p("POST", "/orders/:id/addons", "customer"),
  p("GET", "/orders/:id", "customer"),
  p("POST", "/orders", "customer"),
  p("POST", "/orders/quote", "customer"),
  p("POST", "/orders/:id/payment-intent", "customer"),
  p("POST", "/orders/:id/confirm-payment", "customer"),
  p("GET", "/orders/event/check", "customer"),
  p("POST", "/orders/event", "customer"),
  p("GET", "/orders/zodiac-insights", "customer"),
  p("PATCH", "/orders/:id", "customer"),
  p("GET", "/orders/fortune", "customer"),
  p("GET", "/orders/roast", "customer"),
  p("GET", "/orders/commentary", "customer"),
  p("GET", "/orders/:id/backstory", "customer"),
  p("GET", "/orders/mental-health-fact", "customer"),
  p("POST", "/orders/:id/apply-credits", "customer"),

  // Support cases (Task A9): contact form and Chappy. Customer from auth only; validated, honeypot, 5/hour limit.
  p("POST", "/support/cases", "customer"),
  // Task D5 fix round 2: no longer anonymous. Not console-guarded because kiosk devices use it too;
  // the handler (orders/kitchen-status.js) requires staff (any console role) or a same-location kiosk.
  p("PATCH", "/kitchen/orders/:id/status", "kiosk"),
  // The guest's "I'm done eating": the verified owner only, SERVING -> COMPLETED only.
  p("POST", "/orders/:id/done", "customer"),

  // Cron
  p("GET", "/cny/rsvps", "cron"),
  p("POST", "/cron/cny-sms-reminder", "cron"),
  p("POST", "/cron/cny-sms-order-link", "cron"),
  p("POST", "/cron/cny-sms-test", "cron"),
  p("POST", "/cron/wallet-streak-notifications", "cron"),
  p("POST", "/cron/wallet-challenge-notifications", "cron"),
  p("POST", "/cron/wallet-credits-reminder", "cron"),
  p("POST", "/cron/wallet-tier-progress", "cron"),
  p("POST", "/cron/wallet-pod-availability", "cron"),
  p("POST", "/cron/catering-sms-dayof", "cron"),
  p("POST", "/cron/catering-sms-survey", "cron"),
  p("POST", "/cron/catering-weekly-digest", "cron"),

  // Users, guests, credits
  p("POST", "/users", "customer"),
  p("GET", "/users/by-email/:email", "customer"),
  p("GET", "/users/referral/:code", "public-read"),
  p("POST", "/create-payment-intent", "customer"),
  p("POST", "/guests", "customer"),
  p("GET", "/guests/session/:token", "customer"),
  p("PATCH", "/guests/:id", "customer"),
  p("POST", "/guests/session/refresh", "customer"),
  p("GET", "/users/:id/credits", "customer"),
  p("GET", "/users/:id/profile", "customer"),
  p("PATCH", "/users/:id", "customer"), // self-update (locale today; Task F2)
  p("PATCH", "/users/:id/phone", "customer"),
  p("GET", "/users/:id/orders", "customer"),
  p("GET", "/users/by-email/:email/order-patterns", "customer"),
  p("POST", "/users/:id/stripe-customer", "customer"),
  p("GET", "/users/:id/payment-methods", "customer"),
  p("POST", "/users/:id/payment-methods", "customer"),
  p("DELETE", "/users/:id/payment-methods/:methodId", "customer"),
  // Verified-identity helper (auth/customer.js): the caller's own row.
  p("GET", "/users/me", "customer"),

  // Badges and challenges
  p("GET", "/badges", "customer"),
  p("GET", "/challenges", "customer"),
  p("GET", "/users/:id/challenges", "customer"),
  p("GET", "/challenges/:idOrSlug", "public-read"),
  p("POST", "/users/:userId/challenges/:challengeId/enroll", "customer"),
  p("POST", "/users/:userId/challenges/:challengeId/claim", "customer"),
  p("GET", "/users/:id/badge-progress", "customer"),
  p("GET", "/users/:id/pending-credits", "customer"),
  p("GET", "/users/:id/rewards", "customer"),
  p("POST", "/users/:id/moments", "customer"),

  // Membership engine (packages/api/src/membership/routes.js)
  p("GET", "/membership/program", "public-read"),

  // Wallet passes (customer-facing status/actions) and Wallet v1 (pass-token auth)
  p("GET", "/wallet/status", "customer"),
  p("GET", "/users/:id/wallet/apple", "customer"),
  p("GET", "/users/:id/wallet/google", "customer"),
  p("GET", "/users/:id/wallet", "customer"),
  p("POST", "/wallet/v1/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber", "wallet"),
  p("DELETE", "/wallet/v1/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber", "wallet"),
  p("GET", "/wallet/v1/devices/:deviceLibraryId/registrations/:passTypeId", "wallet"),
  p("GET", "/wallet/v1/passes/:passTypeId/:serialNumber", "wallet"),
  p("POST", "/wallet/v1/log", "wallet"),

  // Group orders
  p("POST", "/group-orders", "customer"),
  p("GET", "/group-orders/:code", "customer"),
  p("POST", "/group-orders/:code/join", "customer"),
  p("PATCH", "/group-orders/:code", "customer"),
  p("POST", "/group-orders/:code/orders", "customer"),
  p("DELETE", "/group-orders/:code/orders/:orderId", "customer"),
  p("POST", "/group-orders/:code/transfer-host", "customer"),
  p("POST", "/group-orders/:code/complete", "customer"),
  // Host pays for the group (Task A7): verified host; confirm also takes the Stripe webhook as a trusted service call
  p("POST", "/group-orders/:code/payment-intent", "customer"),
  p("POST", "/group-orders/:code/confirm-payment", "customer"),

  // Meal gifts
  p("POST", "/meal-gifts", "customer"),
  p("GET", "/meal-gifts/next/:locationId", "customer"),
  // Stripe webhook (x-admin-api-key): records a paid meal gift from its PaymentIntent (Task D9 fix round 1).
  p("POST", "/meal-gifts/confirm-payment", "webhook"),
  p("POST", "/meal-gifts/:id/pay-forward", "customer"), // Task D5 fix round 2: signed-in caller only; the recipient is the caller
  p("GET", "/meal-gifts/:id", "customer"),
  p("GET", "/users/:userId/meal-gifts", "customer"),

  // Analytics (customer-side event logging)
  p("POST", "/analytics/language", "customer"),

  // Gift cards and shop
  p("POST", "/gift-cards", "customer"),
  p("GET", "/gift-cards/code/:code", "customer"),
  // Stripe webhook only: requires x-admin-api-key (orders/gift-card-routes.js).
  p("POST", "/gift-cards/confirm-payment", "webhook"),
  p("GET", "/shop/products", "customer"),
  p("GET", "/shop/products/:slug", "public-read"),
  p("GET", "/shop/products/qr/:qrCode", "customer"),
  p("POST", "/shop/orders", "customer"),
  // Owner, guest session or the Stripe webhook (x-admin-api-key); verified against Stripe (Task D10a).
  p("POST", "/shop/orders/:id/confirm-payment", "customer"),
  p("POST", "/promo-codes/validate", "customer"),
  p("GET", "/gift-card-config", "customer"),

  // Party invitations
  p("GET", "/party-invitations/:code", "customer"),
  p("POST", "/party-invitations/:code/rsvp", "customer"),

  // Chappy (packages/api/src/chappy/routes.js). chat/history/reset need a verified
  // member or a signed guest token (one preHandler); guest-token is public and rate limited.
  p("POST", "/chappy/sms", "webhook"),
  p("POST", "/chappy/guest-token", "customer"),
  p("POST", "/chappy/chat", "customer"),
  p("GET", "/chappy/history", "customer"),
  p("POST", "/chappy/reset", "customer"),

  // Catering: public catering/* (booking paths 404 unless CATERING_PUBLIC_ENABLED; attendee paths and the two admin-console reads stay open)
  p("GET", "/catering/site-config/order-now", "catering-public"),
  p("GET", "/catering/availability", "catering-public"),
  p("GET", "/catering/events/:slug", "catering-public"),
  p("GET", "/catering/menu", "catering-public"),
  p("GET", "/catering/events/:slug/greeting", "catering-public"),
  p("POST", "/catering/bookings", "catering-public"),
  p("POST", "/catering/bookings/:id/promo", "catering-public"),
  p("POST", "/catering/bookings/:id/confirm", "catering-public"),
  p("GET", "/catering/dashboard/:bookingToken", "catering-public"),
  p("POST", "/catering/events/:slug/rsvp", "catering-public"),
  p("GET", "/catering/events/:slug/rsvp/:token", "catering-public"),
  p("GET", "/catering/events/:slug/menu-steps", "catering-public"),
  p("GET", "/catering/events/:slug/order/check", "catering-public"),
  p("POST", "/catering/events/:slug/order", "catering-public"),
  p("GET", "/catering/kitchen-locations", "catering-public"),
  p("GET", "/catering/orders/:qrCode/chappy-quip", "catering-public"),
  p("GET", "/catering/orders/:qrCode/guest", "catering-public"),
  p("POST", "/catering/orders/:qrCode/arrive", "catering-public"),
  p("DELETE", "/catering/events/:slug/order/:orderId", "catering-public"),
  p("GET", "/catering/events/:slug/survey/identity", "catering-public"),
  p("POST", "/catering/events/:slug/survey", "catering-public"),

  // Agents: only the routes the web proxy (apps/web/app/api/agents/*/route.ts) actually
  // calls stay public. Everything else in autonomous/routes.js moved to CONSOLE_ROUTES
  // (OWNER) because it had no caller anywhere in apps/ and autonomous/routes.js applies
  // no auth of its own.
  // TODO(security): web proxy has Clerk auth but API does not; needs a shared secret
  p("POST", "/agents/ideas", "agents"),
  p("GET", "/agents/runs", "agents"),
  p("GET", "/agents/runs/:id", "agents"),
  p("POST", "/agents/approvals/:id", "agents"),
  p("POST", "/agents/questions/:id", "agents"),

  // Webhooks
  p("POST", "/webhooks/github", "webhook"),
  p("POST", "/webhooks/stripe", "webhook"),
  p("POST", "/webhooks/monitoring", "webhook"),
  p("POST", "/webhooks/trigger", "webhook"),
  p("GET", "/webhooks/status", "webhook"),
]);
