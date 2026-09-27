-- Demo tickets for the kitchen display at City Creek Mall (dev database only).
-- Every row is prefixed "seedkds-" so cleanup.sql can remove it cleanly.
-- Run:    psql "$DATABASE_URL" -f scripts/dev-kitchen-demo/seed.sql
-- Remove: psql "$DATABASE_URL" -f scripts/dev-kitchen-demo/cleanup.sql
\set tenant '''cmpvys3ly0000igmsxk0xf3x9'''
\set loc '''cmip6jbz700022nnnxxpmm5hf'''
BEGIN;

-- Members at every tier (the local dev database has no users).
INSERT INTO "User" (id, name, email, "membershipTier", "referralCode", "lifetimeOrderCount", "createdAt", "updatedAt") VALUES
  ('seedkds-user-meiling', 'Mei-Ling Chen',     'meiling.demo@example.com', 'BEEF_BOSS',     'SEEDKDS01', 42, now(), now()),
  ('seedkds-user-marcus',  'Marcus Reed',       'marcus.demo@example.com',  'NOODLE_MASTER', 'SEEDKDS02', 14, now(), now()),
  ('seedkds-user-sofia',   'Sofia Alvarez',     'sofia.demo@example.com',   'CHOPSTICK',     'SEEDKDS03',  2, now(), now()),
  ('seedkds-user-dano',    'Dano Didericksen',  'dano.demo@example.com',    'BEEF_BOSS',     'SEEDKDS04', 88, now(), now()),
  ('seedkds-user-priya',   'Priya Natarajan',   'priya.demo@example.com',   'NOODLE_MASTER', 'SEEDKDS05', 11, now(), now()),
  ('seedkds-user-tom',     'Tom Wu',            'tom.demo@example.com',     'BEEF_BOSS',     'SEEDKDS06', 31, now(), now());

-- Orders. Times are relative to now() so the display's timers look live.
INSERT INTO "Order" (id, "orderNumber", "kitchenOrderNumber", status, "totalCents", "taxCents", "fulfillmentType", "paymentStatus", "paymentMethodBrand", "paymentMethodLast4", "orderSource",
  "locationId", "tenantId", "userId", "guestName", "seatId", "dualPartnerSeatId", "isDualPod", "parentOrderId", "addOnType",
  "queuePosition", "estimatedWaitMinutes", "paidAt", "arrivedAt", "queuedAt", "podAssignedAt", "podConfirmedAt", "prepStartTime", "readyTime", "deliveredAt", "completedTime", "createdAt", "updatedAt")
SELECT * FROM (VALUES
  -- completed earlier today (feeds the day's counters)
  ('seedkds-o09', 'ORD-SEEDKDS-0041', '0041', 'COMPLETED'::"OrderStatus", 1723, 124, 'DINE_IN'::"FulfillmentType", 'PAID'::"PaymentStatus", 'visa', '4242', 'KIOSK'::"OrderSource",
   :loc, :tenant, 'seedkds-user-sofia', NULL, NULL, NULL, false, NULL, NULL::"AddOnType",
   NULL, NULL, now()-interval '55 min', now()-interval '54 min', now()-interval '54 min', now()-interval '53 min', now()-interval '52 min', now()-interval '50 min', now()-interval '45 min', now()-interval '44 min', now()-interval '20 min', now()-interval '55 min', now()),
  ('seedkds-o10', 'ORD-SEEDKDS-0042', '0042', 'COMPLETED', 1991, 143, 'DINE_IN', 'PAID', 'mastercard', '5100', 'WEB',
   :loc, :tenant, NULL, 'Avery M.', NULL, NULL, false, NULL, NULL,
   NULL, NULL, now()-interval '70 min', now()-interval '66 min', now()-interval '66 min', now()-interval '65 min', now()-interval '64 min', now()-interval '62 min', now()-interval '57 min', now()-interval '56 min', now()-interval '30 min', now()-interval '70 min', now()),
  -- serving: guest in pod 11, eating for 14 minutes
  ('seedkds-o07', 'ORD-SEEDKDS-0043', '0043', 'SERVING', 1991, 143, 'DINE_IN', 'PAID', 'amex', '0005', 'KIOSK',
   :loc, :tenant, NULL, 'Lena K.', (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '11'), NULL, false, NULL, NULL,
   NULL, NULL, now()-interval '28 min', now()-interval '27 min', now()-interval '27 min', now()-interval '26 min', now()-interval '25 min', now()-interval '23 min', now()-interval '15 min', now()-interval '14 min', NULL, now()-interval '28 min', now()),
  -- serving: Noodle Master in pod 09
  ('seedkds-o06', 'ORD-SEEDKDS-0044', '0044', 'SERVING', 1723, 124, 'DINE_IN', 'PAID', 'visa', '1881', 'KIOSK',
   :loc, :tenant, 'seedkds-user-priya', NULL, (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '09'), NULL, false, NULL, NULL,
   NULL, NULL, now()-interval '20 min', now()-interval '19 min', now()-interval '19 min', now()-interval '18 min', now()-interval '17 min', now()-interval '15 min', now()-interval '7 min', now()-interval '6 min', NULL, now()-interval '20 min', now()),
  -- serving: dual pod 01 + 02, Beef Boss, two bowls
  ('seedkds-o08', 'ORD-SEEDKDS-0045', '0045', 'SERVING', 6888, 495, 'DINE_IN', 'PAID', 'visa', '7777', 'KIOSK',
   :loc, :tenant, 'seedkds-user-tom', NULL, (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '01'), (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '02'), true, NULL, NULL,
   NULL, NULL, now()-interval '16 min', now()-interval '15 min', now()-interval '15 min', now()-interval '14 min', now()-interval '13 min', now()-interval '11 min', now()-interval '4 min', now()-interval '3 min', NULL, now()-interval '16 min', now()),
  -- ready: Beef Boss in pod 03, bowl waiting at the pass for 1 minute
  ('seedkds-o05', 'ORD-SEEDKDS-0046', '0046', 'READY', 2907, 209, 'DINE_IN', 'PAID', 'visa', '4444', 'MOBILE',
   :loc, :tenant, 'seedkds-user-dano', NULL, (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '03'), NULL, false, NULL, NULL,
   NULL, NULL, now()-interval '12 min', now()-interval '11 min', now()-interval '11 min', now()-interval '10 min', now()-interval '9 min', now()-interval '8 min', now()-interval '1 min', NULL, NULL, now()-interval '12 min', now()),
  -- prepping: Noodle Master in pod 05, on the line for 4 minutes
  ('seedkds-o03', 'ORD-SEEDKDS-0047', '0047', 'PREPPING', 3173, 228, 'DINE_IN', 'PAID', 'mastercard', '2222', 'KIOSK',
   :loc, :tenant, 'seedkds-user-marcus', NULL, (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '05'), NULL, false, NULL, NULL,
   NULL, NULL, now()-interval '9 min', now()-interval '8 min', now()-interval '8 min', now()-interval '7 min', now()-interval '6 min', now()-interval '4 min', NULL, NULL, NULL, now()-interval '9 min', now()),
  -- prepping: Chopstick member in pod 07, just fired
  ('seedkds-o04', 'ORD-SEEDKDS-0048', '0048', 'PREPPING', 1506, 108, 'DINE_IN', 'PAID', 'visa', '9999', 'WEB',
   :loc, :tenant, 'seedkds-user-sofia', NULL, (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '07'), NULL, false, NULL, NULL,
   NULL, NULL, now()-interval '6 min', now()-interval '5 min', now()-interval '5 min', now()-interval '4 min', now()-interval '3 min', now()-interval '1 min', NULL, NULL, NULL, now()-interval '6 min', now()),
  -- add-on tickets on the serving pods (color coded on the display)
  ('seedkds-o07b', 'ORD-SEEDKDS-0049', '0049', 'READY', 0, 0, 'DINE_IN', 'PAID', 'amex', '0005', 'KIOSK',
   :loc, :tenant, NULL, 'Lena K.', (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '11'), NULL, false, 'seedkds-o07', 'EXTRA_VEG',
   NULL, NULL, now()-interval '5 min', NULL, NULL, NULL, NULL, now()-interval '4 min', now()-interval '1 min', NULL, NULL, now()-interval '5 min', now()),
  ('seedkds-o06b', 'ORD-SEEDKDS-0050', '0050', 'PREPPING', 0, 0, 'DINE_IN', 'PAID', 'visa', '1881', 'KIOSK',
   :loc, :tenant, 'seedkds-user-priya', NULL, (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '09'), NULL, false, 'seedkds-o06', 'REFILL',
   NULL, NULL, now()-interval '3 min', NULL, NULL, NULL, NULL, now()-interval '1 min', NULL, NULL, NULL, now()-interval '3 min', now()),
  -- queued: Beef Boss just checked in, first in line for a pod
  ('seedkds-o01', 'ORD-SEEDKDS-0051', '0051', 'QUEUED', 3283, 236, 'DINE_IN', 'PAID', 'visa', '1010', 'KIOSK',
   :loc, :tenant, 'seedkds-user-meiling', NULL, NULL, NULL, false, NULL, NULL,
   1, 4, now()-interval '3 min', now()-interval '2 min', now()-interval '2 min', NULL, NULL, NULL, NULL, NULL, NULL, now()-interval '3 min', now()),
  ('seedkds-o06a', 'ORD-SEEDKDS-0052', '0052', 'QUEUED', 645, 46, 'DINE_IN', 'PAID', 'visa', '1881', 'KIOSK',
   :loc, :tenant, 'seedkds-user-priya', NULL, (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '09'), NULL, false, 'seedkds-o06', 'PAID_ADDON',
   NULL, NULL, now()-interval '2 min', NULL, now()-interval '2 min', NULL, NULL, NULL, NULL, NULL, NULL, now()-interval '2 min', now()),
  ('seedkds-o07a', 'ORD-SEEDKDS-0053', '0053', 'QUEUED', 0, 0, 'DINE_IN', 'PAID', 'amex', '0005', 'KIOSK',
   :loc, :tenant, NULL, 'Lena K.', (SELECT id FROM "Seat" WHERE "locationId" = :loc AND number = '11'), NULL, false, 'seedkds-o07', 'DESSERT_READY',
   NULL, NULL, now()-interval '1 min', NULL, now()-interval '1 min', NULL, NULL, NULL, NULL, NULL, NULL, now()-interval '1 min', now()),
  -- queued: walk-in guest, second in line
  ('seedkds-o02', 'ORD-SEEDKDS-0054', '0054', 'QUEUED', 1723, 124, 'DINE_IN', 'PAID', 'discover', '6011', 'WEB',
   :loc, :tenant, NULL, 'Jordan P.', NULL, NULL, false, NULL, NULL,
   2, 7, now()-interval '1 min', now()-interval '1 min', now()-interval '1 min', NULL, NULL, NULL, NULL, NULL, NULL, now()-interval '1 min', now())
) AS v;

-- Items. Menu item ids are the City Creek Mall menu; sliders carry their label.
INSERT INTO "OrderItem" (id, "orderId", "menuItemId", quantity, "priceCents", "selectedValue") VALUES
  -- 0041 Sofia, completed
  ('seedkds-i0901', 'seedkds-o09', 'cmip6jbza00062nnnskz6ntt8', 1, 1599, NULL),
  ('seedkds-i0902', 'seedkds-o09', 'cmip6jbzd000c2nnny2hrd859', 1, 0, NULL),
  ('seedkds-i0903', 'seedkds-o09', 'cmip6jbza00062z01skz6ndd5', 1, 0, 'Mild'),
  -- 0042 Avery, completed
  ('seedkds-i1001', 'seedkds-o10', 'cmip6jbza00062nnnskz6ntt8', 1, 1599, NULL),
  ('seedkds-i1002', 'seedkds-o10', 'cmip6jbze000g2nnnvgx9hqnf', 1, 0, NULL),
  ('seedkds-i1003', 'seedkds-o10', 'cmip6jc0i002f2nnnwv38o0ix', 1, 249, NULL),
  -- 0043 Lena, serving
  ('seedkds-i0701', 'seedkds-o07', 'cmip6jbza00062nnnskz6ntt8', 1, 1599, NULL),
  ('seedkds-i0702', 'seedkds-o07', 'cmip6jbze000g2nnnvgx9hqnf', 1, 0, NULL),
  ('seedkds-i0703', 'seedkds-o07', 'cmip6jc0200272nnnmx2bv246', 1, 0, 'Extra'),
  ('seedkds-i0704', 'seedkds-o07', 'cmip6jbza00062z01skz6ndd5', 1, 0, 'None'),
  ('seedkds-i0705', 'seedkds-o07', 'cmip6jc0i002f2nnnwv38o0ix', 1, 249, NULL),
  -- 0044 Priya, serving
  ('seedkds-i0601', 'seedkds-o06', 'cmip6jbza00062nnnskz6ntt8', 1, 1599, NULL),
  ('seedkds-i0602', 'seedkds-o06', 'cat-thinflat-daf15fe508a8', 1, 0, NULL),
  ('seedkds-i0603', 'seedkds-o06', 'cmip6jbza00062z01skz6ndd5', 1, 0, 'Medium'),
  ('seedkds-i0604', 'seedkds-o06', 'cmip6jc0i002f2nnnpv38o0iq', 1, 0, 'Extra'),
  ('seedkds-i0605', 'seedkds-o06', 'cmip6jc0i002f2nnnzv38o0ia', 1, 0, NULL),
  -- 0045 Tom, dual pod, two bowls
  ('seedkds-i0801', 'seedkds-o08', 'cmip6jbzc00082nnn1di1ka94', 2, 2399, NULL),
  ('seedkds-i0802', 'seedkds-o08', 'cmip6jbze000g2nnnvgx9hqnf', 2, 0, NULL),
  ('seedkds-i0803', 'seedkds-o08', 'cmip6jbzf000k2nnnmy81pbsx', 1, 0, 'Medium'),
  ('seedkds-i0804', 'seedkds-o08', 'cmip6jc0i002f2nnnqv38o0ir', 2, 399, NULL),
  ('seedkds-i0805', 'seedkds-o08', 'cmip6jc0i002f2nnnuv38o0iv', 1, 299, NULL),
  ('seedkds-i0806', 'seedkds-o08', 'cmip6jc0i002f2nnnwv38o0ix', 2, 249, NULL),
  -- 0046 Dano, ready
  ('seedkds-i0501', 'seedkds-o05', 'cmip6jbzc00082nnn1di1ka94', 1, 2399, NULL),
  ('seedkds-i0502', 'seedkds-o05', 'cmip6jbze000g2nnnvgx9hqnf', 1, 0, NULL),
  ('seedkds-i0503', 'seedkds-o05', 'cmip6jbzf000k2nnnmy81pbsx', 1, 0, 'Rich'),
  ('seedkds-i0504', 'seedkds-o05', 'cmip6jc0i002f2nnnsv38o0it', 1, 299, NULL),
  ('seedkds-i0505', 'seedkds-o05', 'cmip6jc0i002f2nnnav38o0ib', 1, 0, NULL),
  -- 0047 Marcus, prepping
  ('seedkds-i0301', 'seedkds-o03', 'cmip6jbza00062nnnskz6ntt8', 1, 1599, NULL),
  ('seedkds-i0302', 'seedkds-o03', 'cmip6jbzd000c2nnny2hrd859', 1, 0, NULL),
  ('seedkds-i0303', 'seedkds-o03', 'cmip6jbzf000k2nnnmy81pbsx', 1, 0, 'Extra Rich'),
  ('seedkds-i0304', 'seedkds-o03', 'cmip6jbzf000m2nnn3pkux3rw', 1, 0, 'Medium'),
  ('seedkds-i0305', 'seedkds-o03', 'cmip6jbza00062z01skz6ndd5', 1, 0, 'Spicy'),
  ('seedkds-i0306', 'seedkds-o03', 'cmip6jc0i002f2nnnrv38o0is', 1, 599, NULL),
  ('seedkds-i0307', 'seedkds-o03', 'cmip6jc0i002f2nnntv38o0iu', 1, 199, NULL),
  ('seedkds-i0308', 'seedkds-o03', 'cmip6jc0i002f2nnnuv38o0iv', 1, 299, NULL),
  ('seedkds-i0309', 'seedkds-o03', 'cmip6jc0i002f2nnnxv38o0iy', 1, 249, NULL),
  -- 0048 Sofia, prepping
  ('seedkds-i0401', 'seedkds-o04', 'cmip6jbzc000a2nnnewnr00lb', 1, 1099, NULL),
  ('seedkds-i0402', 'seedkds-o04', 'cmjnacgf10001gf1rgfwide01', 1, 0, NULL),
  ('seedkds-i0403', 'seedkds-o04', 'cmip6jbza00062z01skz6ndd5', 1, 0, 'Extra Spicy'),
  ('seedkds-i0404', 'seedkds-o04', 'cmip6jc0h002b2nnnedxu3hy6', 1, 0, 'None'),
  ('seedkds-i0405', 'seedkds-o04', 'cmip6jc0g00292nnnwsr3nsiq', 1, 0, 'Extra'),
  ('seedkds-i0406', 'seedkds-o04', 'cmip6jc0i002f2nnnvv38o0iw', 1, 299, NULL),
  -- add-on tickets
  ('seedkds-i07b1', 'seedkds-o07b', 'cmip6jc0200272nnnmx2bv246', 1, 0, 'Extra'),
  ('seedkds-i06b1', 'seedkds-o06b', 'cmip6jc0i002f2nnnwv38o0ix', 1, 0, NULL),
  ('seedkds-i06a1', 'seedkds-o06a', 'cmip6jc0i002f2nnnrv38o0is', 1, 599, NULL),
  ('seedkds-i07a1', 'seedkds-o07a', 'cmip6jc0i002f2nnnav38o0ib', 1, 0, NULL),
  -- 0051 Mei-Ling, queued
  ('seedkds-i0101', 'seedkds-o01', 'cmip6jbzc00082nnn1di1ka94', 1, 2399, NULL),
  ('seedkds-i0102', 'seedkds-o01', 'cmip6jbze000g2nnnvgx9hqnf', 1, 0, NULL),
  ('seedkds-i0103', 'seedkds-o01', 'cmip6jbzf000k2nnnmy81pbsx', 1, 0, 'Rich'),
  ('seedkds-i0104', 'seedkds-o01', 'cmip6jbzf000m2nnn3pkux3rw', 1, 0, 'Firm'),
  ('seedkds-i0105', 'seedkds-o01', 'cmip6jbza00062z01skz6ndd5', 1, 0, 'Medium'),
  ('seedkds-i0106', 'seedkds-o01', 'cmip6jc0i002f2nnnqv38o0ir', 1, 399, NULL),
  ('seedkds-i0107', 'seedkds-o01', 'cmip6jc0i002f2nnnwv38o0ix', 1, 249, NULL),
  -- 0054 Jordan, queued
  ('seedkds-i0201', 'seedkds-o02', 'cmip6jbza00062nnnskz6ntt8', 1, 1599, NULL),
  ('seedkds-i0202', 'seedkds-o02', 'cmip6jbzd000e2nnnw1ftbmxr', 1, 0, NULL),
  ('seedkds-i0203', 'seedkds-o02', 'cmip6jbza00062z01skz6ndd5', 1, 0, 'Mild'),
  ('seedkds-i0204', 'seedkds-o02', 'cmip6jc0h002d2nnn4zrbfozw', 1, 0, 'None'),
  ('seedkds-i0205', 'seedkds-o02', 'cmip6jc0i002f2nnnyv38o0iz', 1, 0, NULL);

-- Pod board: occupied where someone is seated, one pod being cleaned.
UPDATE "Seat" SET status = 'OCCUPIED', "updatedAt" = now() WHERE "locationId" = :loc AND number IN ('01','02','03','05','07','09','11');
UPDATE "Seat" SET status = 'CLEANING', "updatedAt" = now() WHERE "locationId" = :loc AND number = '04';
COMMIT;
