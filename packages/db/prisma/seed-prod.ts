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

  // Create locations
  console.log('\nCreating locations...');

  // City Creek Mall - Salt Lake City
  const cityCreekLocation = await prisma.location.upsert({
    where: { id: 'cmip6jbz700022nnnxxpmm5hf' },
    update: {
      lat: 40.7685,
      lng: -111.8910
    },
    create: {
      id: 'cmip6jbz700022nnnxxpmm5hf',
      tenantId: tenant.id,
      name: 'City Creek Mall',
      city: 'Salt Lake City',
      address: '50 S Main St, Salt Lake City, UT 84101',
      lat: 40.7685,
      lng: -111.8910
    }
  });
  console.log('✓ Location created:', cityCreekLocation.name);

  // University Place - Orem
  const universityPlaceLocation = await prisma.location.upsert({
    where: { id: 'cmip6jbza00042nnnf4nc0dvh' },
    update: {},
    create: {
      id: 'cmip6jbza00042nnnf4nc0dvh',
      tenantId: tenant.id,
      name: 'University Place',
      city: 'Orem',
      address: '575 E University Pkwy, Orem, UT 84097',
      lat: 40.2338,
      lng: -111.6585
    }
  });
  console.log('✓ Location created:', universityPlaceLocation.name);

  // Legacy main-location (for backwards compatibility)
  const location = await prisma.location.upsert({
    where: { id: 'main-location' },
    update: {},
    create: {
      id: 'main-location',
      tenantId: tenant.id,
      name: 'Tosh Tokyo',
      city: 'Tokyo',
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

  // Create seats (U-shape layout: 12 pods total)
  // Left side: 01-04 (top to bottom)
  // Bottom: 05-08 (left to right)
  // Right side: 09-12 (bottom to top for continuous flow)
  console.log('\nCreating seats...');

  // Check if seats already exist
  const existingSeats = await prisma.seat.count({
    where: { locationId: location.id }
  });

  if (existingSeats === 0) {
    // Left side pods (01-04)
    for (let i = 0; i < 4; i++) {
      const podNum = (i + 1).toString().padStart(2, '0');
      await prisma.seat.create({
        data: {
          locationId: location.id,
          number: podNum,
          qrCode: `POD-main-${podNum}-${Date.now()}`,
          status: 'AVAILABLE',
          side: 'left',
          row: 0,
          col: i,
        }
      });
    }

    // Bottom pods (05-08)
    for (let i = 0; i < 4; i++) {
      const podNum = (i + 5).toString().padStart(2, '0');
      await prisma.seat.create({
        data: {
          locationId: location.id,
          number: podNum,
          qrCode: `POD-main-${podNum}-${Date.now()}`,
          status: 'AVAILABLE',
          side: 'bottom',
          row: 1,
          col: i,
        }
      });
    }

    // Right side pods (09-12) - numbered bottom to top for U-shape flow
    for (let i = 0; i < 4; i++) {
      const podNum = (i + 9).toString().padStart(2, '0');
      await prisma.seat.create({
        data: {
          locationId: location.id,
          number: podNum,
          qrCode: `POD-main-${podNum}-${Date.now()}`,
          status: 'AVAILABLE',
          side: 'right',
          row: 2,
          col: i, // col 0 = bottom (pod 09), col 3 = top (pod 12)
        }
      });
    }

    console.log('✓ Created 12 seats in U-shape layout');
  } else {
    console.log(`✓ Seats already exist (${existingSeats} seats)`);
  }

  // Create location stats
  console.log('\nCreating location stats...');
  await prisma.locationStats.upsert({
    where: { locationId: location.id },
    update: {},
    create: {
      locationId: location.id,
      totalSeats: 12,
      availableSeats: 12,
      occupiedSeats: 0,
      avgWaitMinutes: 0,
    }
  });
  console.log('✓ Location stats created');

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
