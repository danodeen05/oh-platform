import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateCoupleToSingle() {
  console.log('Migrating COUPLE pods to SINGLE before schema update...\n');

  try {
    // First, clear the couplePartnerId references
    const clearedRefs = await prisma.$executeRaw`UPDATE "Seat" SET "couplePartnerId" = NULL WHERE "couplePartnerId" IS NOT NULL`;
    console.log(`Cleared ${clearedRefs} partner references`);

    // Then update podType from COUPLE to SINGLE
    const updated = await prisma.$executeRaw`UPDATE "Seat" SET "podType" = 'SINGLE' WHERE "podType" = 'COUPLE'`;
    console.log(`Updated ${updated} seats from COUPLE to SINGLE`);

    // Also clear Order couple pod data
    const orders = await prisma.$executeRaw`UPDATE "Order" SET "isCouplePod" = false, "couplePartnerSeatId" = NULL WHERE "isCouplePod" = true`;
    console.log(`Updated ${orders} orders - cleared couple pod data`);

    console.log('\nMigration complete! Now run: npx prisma db push --accept-data-loss');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateCoupleToSingle();
