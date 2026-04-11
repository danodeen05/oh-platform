import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Creating CNY Party 2026 Location...\n");

  // Find the Oh! tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "oh" },
  });

  if (!tenant) {
    throw new Error("Oh! tenant not found. Run production seed first.");
  }

  console.log(`Found tenant: ${tenant.brandName} (${tenant.id})`);

  // Create or update the CNY Party location
  const cnyLocation = await prisma.location.upsert({
    where: { id: "cny-party-2026" },
    update: {
      name: "CNY Party 2026",
      city: "Lehi",
      address: "Private Event - Embold Clubroom",
      lat: 40.3916,
      lng: -111.8508,
      taxRate: 0, // No tax for event
      timezone: "America/Denver",
      isClosed: false,
    },
    create: {
      id: "cny-party-2026",
      tenantId: tenant.id,
      name: "CNY Party 2026",
      city: "Lehi",
      address: "Private Event - Embold Clubroom",
      lat: 40.3916,
      lng: -111.8508,
      taxRate: 0, // No tax for event
      timezone: "America/Denver",
      isClosed: false,
    },
  });

  console.log("\n✅ CNY Party 2026 Location created successfully!");
  console.log(`   ID: ${cnyLocation.id}`);
  console.log(`   Name: ${cnyLocation.name}`);
  console.log(`   Address: ${cnyLocation.address}`);
  console.log(`\n📝 Use this location ID in the /orders/event endpoint: ${cnyLocation.id}`);
}

main()
  .catch((e) => {
    console.error("Error creating CNY Party location:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
