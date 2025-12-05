/**
 * Export local database data to production (excluding orders)
 *
 * This script:
 * 1. Connects to local database and exports all data except orders
 * 2. Connects to production database and imports the data
 * 3. Preserves relationships and IDs for consistency
 */

import { PrismaClient } from '@prisma/client';

// Local database connection
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://oh:ohpassword@localhost:5432/ohdb?schema=public'
    }
  }
});

// Production database connection
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.RAILWAY_DATABASE_URL
    }
  }
});

async function exportToProduction() {
  console.log('🚀 Starting export to production...\n');

  try {
    // ==========================================
    // STEP 1: Export data from local database
    // ==========================================
    console.log('📦 Exporting data from local database...\n');

    const tenants = await localPrisma.tenant.findMany();
    console.log(`✓ Found ${tenants.length} tenant(s)`);

    const locations = await localPrisma.location.findMany();
    console.log(`✓ Found ${locations.length} location(s)`);

    const menuItems = await localPrisma.menuItem.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    console.log(`✓ Found ${menuItems.length} menu item(s)`);

    const badges = await localPrisma.badge.findMany();
    console.log(`✓ Found ${badges.length} badge(s)`);

    const challenges = await localPrisma.challenge.findMany();
    console.log(`✓ Found ${challenges.length} challenge(s)`);

    const seats = await localPrisma.seat.findMany();
    console.log(`✓ Found ${seats.length} seat(s)`);

    const locationStats = await localPrisma.locationStats.findMany();
    console.log(`✓ Found ${locationStats.length} location stats record(s)`);

    // ==========================================
    // STEP 2: Import to production (preserving IDs)
    // ==========================================
    console.log('\n📤 Importing data to production...\n');

    // Import Tenants - track ID mapping for foreign keys
    console.log('Importing tenants...');
    const tenantIdMap = {}; // Maps local tenant ID -> production tenant ID

    for (const tenant of tenants) {
      const result = await prodPrisma.tenant.upsert({
        where: { slug: tenant.slug },
        update: {
          brandName: tenant.brandName,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          domain: tenant.domain,
          stripeAccountId: tenant.stripeAccountId,
          subscriptionStatus: tenant.subscriptionStatus,
          subscriptionTier: tenant.subscriptionTier,
        },
        create: {
          id: tenant.id,
          slug: tenant.slug,
          brandName: tenant.brandName,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          domain: tenant.domain,
          stripeAccountId: tenant.stripeAccountId,
          subscriptionStatus: tenant.subscriptionStatus,
          subscriptionTier: tenant.subscriptionTier,
        }
      });
      tenantIdMap[tenant.id] = result.id;
      console.log(`  ✓ ${tenant.brandName} (${result.id === tenant.id ? 'same ID' : 'remapped ID'})`);
    }

    // Import Locations
    console.log('\nImporting locations...');
    for (const location of locations) {
      const mappedTenantId = tenantIdMap[location.tenantId];
      await prodPrisma.location.upsert({
        where: { id: location.id },
        update: {
          tenantId: mappedTenantId,
          name: location.name,
          city: location.city,
          address: location.address,
          lat: location.lat,
          lng: location.lng,
        },
        create: {
          id: location.id,
          tenantId: mappedTenantId,
          name: location.name,
          city: location.city,
          address: location.address,
          lat: location.lat,
          lng: location.lng,
        }
      });
      console.log(`  ✓ ${location.name} (${location.city})`);
    }

    // Import Menu Items
    console.log('\nImporting menu items...');
    for (const item of menuItems) {
      const mappedTenantId = tenantIdMap[item.tenantId];
      await prodPrisma.menuItem.upsert({
        where: { id: item.id },
        update: {
          tenantId: mappedTenantId,
          name: item.name,
          basePriceCents: item.basePriceCents,
          additionalPriceCents: item.additionalPriceCents,
          includedQuantity: item.includedQuantity,
          category: item.category,
          description: item.description,
          isAvailable: item.isAvailable,
          categoryType: item.categoryType,
          selectionMode: item.selectionMode,
          displayOrder: item.displayOrder,
          sliderConfig: item.sliderConfig,
        },
        create: {
          id: item.id,
          tenantId: mappedTenantId,
          name: item.name,
          basePriceCents: item.basePriceCents,
          additionalPriceCents: item.additionalPriceCents,
          includedQuantity: item.includedQuantity,
          category: item.category,
          description: item.description,
          isAvailable: item.isAvailable,
          categoryType: item.categoryType,
          selectionMode: item.selectionMode,
          displayOrder: item.displayOrder,
          sliderConfig: item.sliderConfig,
        }
      });
      console.log(`  ✓ ${item.name} ($${(item.basePriceCents / 100).toFixed(2)}) - ${item.selectionMode}`);
    }

    // Import Badges
    console.log('\nImporting badges...');
    for (const badge of badges) {
      await prodPrisma.badge.upsert({
        where: { id: badge.id },
        update: {
          slug: badge.slug,
          name: badge.name,
          description: badge.description,
          iconEmoji: badge.iconEmoji,
          category: badge.category,
          isActive: badge.isActive,
        },
        create: {
          id: badge.id,
          slug: badge.slug,
          name: badge.name,
          description: badge.description,
          iconEmoji: badge.iconEmoji,
          category: badge.category,
          isActive: badge.isActive,
        }
      });
      console.log(`  ✓ ${badge.iconEmoji} ${badge.name}`);
    }

    // Import Challenges
    console.log('\nImporting challenges...');
    for (const challenge of challenges) {
      await prodPrisma.challenge.upsert({
        where: { id: challenge.id },
        update: {
          slug: challenge.slug,
          name: challenge.name,
          description: challenge.description,
          rewardCents: challenge.rewardCents,
          iconEmoji: challenge.iconEmoji,
          requirements: challenge.requirements,
          startsAt: challenge.startsAt,
          endsAt: challenge.endsAt,
          isActive: challenge.isActive,
        },
        create: {
          id: challenge.id,
          slug: challenge.slug,
          name: challenge.name,
          description: challenge.description,
          rewardCents: challenge.rewardCents,
          iconEmoji: challenge.iconEmoji,
          requirements: challenge.requirements,
          startsAt: challenge.startsAt,
          endsAt: challenge.endsAt,
          isActive: challenge.isActive,
        }
      });
      console.log(`  ✓ ${challenge.iconEmoji} ${challenge.name} ($${(challenge.rewardCents / 100).toFixed(2)})`);
    }

    // Import Seats
    console.log('\nImporting seats...');
    for (const seat of seats) {
      await prodPrisma.seat.upsert({
        where: { id: seat.id },
        update: {
          locationId: seat.locationId,
          number: seat.number,
          qrCode: seat.qrCode,
          status: seat.status,
        },
        create: {
          id: seat.id,
          locationId: seat.locationId,
          number: seat.number,
          qrCode: seat.qrCode,
          status: seat.status,
        }
      });
    }
    console.log(`  ✓ Imported ${seats.length} seat(s)`);

    // Import Location Stats
    console.log('\nImporting location stats...');
    for (const stats of locationStats) {
      await prodPrisma.locationStats.upsert({
        where: { id: stats.id },
        update: {
          locationId: stats.locationId,
          totalSeats: stats.totalSeats,
          availableSeats: stats.availableSeats,
          occupiedSeats: stats.occupiedSeats,
          avgWaitMinutes: stats.avgWaitMinutes,
        },
        create: {
          id: stats.id,
          locationId: stats.locationId,
          totalSeats: stats.totalSeats,
          availableSeats: stats.availableSeats,
          occupiedSeats: stats.occupiedSeats,
          avgWaitMinutes: stats.avgWaitMinutes,
        }
      });
    }
    console.log(`  ✓ Imported ${locationStats.length} location stats record(s)`);

    console.log('\n✅ Export to production completed successfully!\n');
    console.log('Summary:');
    console.log(`  - ${tenants.length} tenant(s)`);
    console.log(`  - ${locations.length} location(s)`);
    console.log(`  - ${menuItems.length} menu item(s)`);
    console.log(`  - ${badges.length} badge(s)`);
    console.log(`  - ${challenges.length} challenge(s)`);
    console.log(`  - ${seats.length} seat(s)`);
    console.log(`  - ${locationStats.length} location stats`);
    console.log('\n⚠️  Note: Orders, users, and related data were NOT exported (as requested)');

  } catch (error) {
    console.error('\n❌ Error during export:', error);
    throw error;
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

// Run the export
exportToProduction()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
