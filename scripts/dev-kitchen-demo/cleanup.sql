-- Removes everything seed.sql created and resets the City Creek Mall pods.
\set loc '''cmip6jbz700022nnnxxpmm5hf'''
BEGIN;
DELETE FROM "OrderItem" WHERE "orderId" LIKE 'seedkds-%';
DELETE FROM "Order" WHERE id LIKE 'seedkds-%';
DELETE FROM "User" WHERE id LIKE 'seedkds-%';
UPDATE "Seat" SET status = 'AVAILABLE', "updatedAt" = now() WHERE "locationId" = :loc AND status <> 'AVAILABLE';
COMMIT;
