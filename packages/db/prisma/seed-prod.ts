import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.RAILWAY_DATABASE_URL
});

async function main() {
  console.log('🌱 Seeding production database...\n');

  // Create tenant
  console.log('Creating tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'oh' },
    update: {},
    create: {
      slug: 'oh',
      brandName: 'Oh Beef Noodle Soup',
      logoUrl: '/oh-logo.png'
    }
  });
  console.log('✓ Tenant created:', tenant.slug);

  // Create location
  console.log('\nCreating location...');
  const location = await prisma.location.upsert({
    where: { id: 'main-location' },
    update: {},
    create: {
      id: 'main-location',
      tenantId: tenant.id,
      name: 'Oh Beef - Main Location',
      city: 'City',
      address: '123 Main St, City, State 12345',
      lat: 40.7128,
      lng: -74.0060
    }
  });
  console.log('✓ Location created:', location.name);

  // Create menu items
  console.log('\nCreating menu items...');

  const beefNoodles = await prisma.menuItem.upsert({
    where: { id: 'beef-noodles' },
    update: {},
    create: {
      id: 'beef-noodles',
      tenantId: tenant.id,
      name: 'Beef Noodle Soup',
      basePriceCents: 1299
    }
  });
  console.log('✓ Menu item created:', beefNoodles.name);

  const porkNoodles = await prisma.menuItem.upsert({
    where: { id: 'pork-noodles' },
    update: {},
    create: {
      id: 'pork-noodles',
      tenantId: tenant.id,
      name: 'Pork Belly Noodles',
      basePriceCents: 1399
    }
  });
  console.log('✓ Menu item created:', porkNoodles.name);

  const bokChoy = await prisma.menuItem.upsert({
    where: { id: 'bok-choy' },
    update: {},
    create: {
      id: 'bok-choy',
      tenantId: tenant.id,
      name: 'Baby Bok Choy',
      basePriceCents: 399,
      includedQuantity: 2,
      additionalPriceCents: 199
    }
  });
  console.log('✓ Menu item created:', bokChoy.name);

  console.log('\n✅ Production database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
