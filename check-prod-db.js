import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:kSmXgCyAMdHNuATuRYRTxxESkuyhkEHZ@yamabiko.proxy.rlwy.net:55841/railway"
    }
  }
});

async function checkDatabase() {
  console.log("Checking production database...\n");

  // Check Tenants
  const tenants = await prisma.tenant.findMany();
  console.log(`Tenants: ${tenants.length}`);
  tenants.forEach(t => console.log(`  - ${t.slug}: ${t.brandName}`));

  // Check Locations
  const locations = await prisma.location.findMany();
  console.log(`\nLocations: ${locations.length}`);
  locations.forEach(l => console.log(`  - ${l.name} (${l.city})`));

  // Check Seats/Pods
  const seats = await prisma.seat.findMany();
  console.log(`\nSeats/Pods: ${seats.length}`);

  // Check Orders
  const orders = await prisma.order.count();
  console.log(`\nOrders: ${orders}`);

  await prisma.$disconnect();
}

checkDatabase().catch(console.error);
