import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, brandName: true, subscriptionStatus: true }
  });
  console.log("TENANTS:", JSON.stringify(tenants, null, 2));

  const locations = await prisma.location.findMany({
    select: { id: true, name: true, city: true, tenantId: true, isClosed: true }
  });
  console.log("LOCATIONS:", JSON.stringify(locations, null, 2));

  const menuItems = await prisma.menuItem.findMany({
    select: { id: true, name: true, category: true, tenantId: true }
  });
  console.log("MENU ITEMS:", menuItems.length, "items");
  console.log("Sample:", JSON.stringify(menuItems.slice(0, 3), null, 2));

  const seats = await prisma.seat.findMany({
    select: { id: true, number: true, status: true, locationId: true }
  });
  console.log("SEATS:", seats.length, "total");

  await prisma.$disconnect();
}

main().catch(console.error);
