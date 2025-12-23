import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.RAILWAY_DATABASE_URL
});

/**
 * Production Seed Script
 *
 * Usage:
 *   RAILWAY_DATABASE_URL="..." npx tsx prisma/seed-prod.ts
 *   RAILWAY_DATABASE_URL="..." npx tsx prisma/seed-prod.ts --reset-users
 *   RAILWAY_DATABASE_URL="..." npx tsx prisma/seed-prod.ts --reset-orders
 *   RAILWAY_DATABASE_URL="..." npx tsx prisma/seed-prod.ts --reset-all
 */

const args = process.argv.slice(2);
const shouldResetUsers = args.includes('--reset-users') || args.includes('--reset-all');
const shouldResetOrders = args.includes('--reset-orders') || args.includes('--reset-all');

async function resetUsers() {
  console.log('\n🗑️  Resetting users and related data...');

  // Delete in order of dependencies
  await prisma.creditEvent.deleteMany();
  console.log('  ✓ Deleted credit events');

  await prisma.userBadge.deleteMany();
  console.log('  ✓ Deleted user badges');

  await prisma.userChallenge.deleteMany();
  console.log('  ✓ Deleted user challenges');

  await prisma.user.deleteMany();
  console.log('  ✓ Deleted users');

  await prisma.guest.deleteMany();
  console.log('  ✓ Deleted guests');

  console.log('✅ Users reset complete!');
}

async function resetOrders() {
  console.log('\n🗑️  Resetting orders and related data...');

  // Delete in order of dependencies
  await prisma.podCall.deleteMany();
  console.log('  ✓ Deleted pod calls');

  await prisma.orderItem.deleteMany();
  console.log('  ✓ Deleted order items');

  await prisma.order.deleteMany();
  console.log('  ✓ Deleted orders');

  await prisma.groupOrder.deleteMany();
  console.log('  ✓ Deleted group orders');

  // Reset seat statuses
  await prisma.seat.updateMany({
    data: { status: 'AVAILABLE' }
  });
  console.log('  ✓ Reset all seats to AVAILABLE');

  // Reset location stats
  await prisma.locationStats.updateMany({
    data: {
      availableSeats: 12,
      occupiedSeats: 0,
      avgWaitMinutes: 0
    }
  });
  console.log('  ✓ Reset location stats');

  // Reset language visits
  await prisma.languageVisit.deleteMany();
  console.log('  ✓ Deleted language visits');

  console.log('✅ Orders reset complete!');
}

async function seedCoreData() {
  console.log('🌱 Seeding production database...\n');

  // ==========================================
  // TENANT
  // ==========================================
  console.log('Creating tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'oh' },
    update: {
      brandName: 'Oh! Beef Noodle Soup',
      logoUrl: '/logos/oh-logo.png',
      primaryColor: '#667eea',
      subscriptionStatus: 'ACTIVE',
      subscriptionTier: 'premium',
    },
    create: {
      id: 'cmip6jbxa00002nnnktgu64dc',
      slug: 'oh',
      brandName: 'Oh! Beef Noodle Soup',
      logoUrl: '/logos/oh-logo.png',
      primaryColor: '#667eea',
      subscriptionStatus: 'ACTIVE',
      subscriptionTier: 'premium',
    }
  });
  console.log('✓ Tenant:', tenant.brandName);

  // ==========================================
  // LOCATIONS
  // ==========================================
  console.log('\nCreating locations...');

  const cityCreek = await prisma.location.upsert({
    where: { id: 'cmip6jbz700022nnnxxpmm5hf' },
    update: {
      name: 'City Creek Mall',
      city: 'Salt Lake City',
      address: '50 S Main St, Salt Lake City, UT 84101',
      lat: 40.7679773,
      lng: -111.89162,
    },
    create: {
      id: 'cmip6jbz700022nnnxxpmm5hf',
      tenantId: tenant.id,
      name: 'City Creek Mall',
      city: 'Salt Lake City',
      address: '50 S Main St, Salt Lake City, UT 84101',
      lat: 40.7679773,
      lng: -111.89162,
    }
  });
  console.log('✓ Location:', cityCreek.name, `(${cityCreek.city})`);

  const universityPlace = await prisma.location.upsert({
    where: { id: 'cmip6jbza00042nnnf4nc0dvh' },
    update: {
      name: 'University Place',
      city: 'Orem',
      address: '575 E University Pkwy, Orem, UT 84097',
      lat: 40.2338,
      lng: -111.6585,
    },
    create: {
      id: 'cmip6jbza00042nnnf4nc0dvh',
      tenantId: tenant.id,
      name: 'University Place',
      city: 'Orem',
      address: '575 E University Pkwy, Orem, UT 84097',
      lat: 40.2338,
      lng: -111.6585,
    }
  });
  console.log('✓ Location:', universityPlace.name, `(${universityPlace.city})`);

  // ==========================================
  // MENU ITEMS
  // ==========================================
  console.log('\nCreating menu items...');

  const menuItems = [
    // MAIN DISHES (main01)
    { id: 'cmip6jbzc00082nnn1di1ka94', name: 'A5 Wagyu Beef Noodle Soup', basePriceCents: 2399, category: 'main01', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1 },
    { id: 'cmip6jbza00062nnnskz6ntt8', name: 'Classic Beef Noodle Soup', basePriceCents: 1599, category: 'main01', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1 },
    { id: 'cmip6jbzc000a2nnnewnr00lb', name: 'Classic Beef Noodle Soup (no beef)', basePriceCents: 1099, category: 'main01', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1 },

    // NOODLE TYPES (main02)
    { id: 'cmip6jbze000g2nnnvgx9hqnf', name: 'Ramen Noodles', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1 },
    { id: 'cmip6jbzd000e2nnnw1ftbmxr', name: 'Shaved Noodles', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 2 },
    { id: 'cmip6jbzd000c2nnny2hrd859', name: 'Wide Noodles', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 3 },
    { id: 'cmip6jbze000i2nnnsjjcpifd', name: 'No Noodles', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 4 },

    // SLIDERS
    { id: 'cmip6jbzf000k2nnnmy81pbsx', name: 'Soup Richness', basePriceCents: 0, category: 'slider01', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 1 },
    { id: 'cmip6jbzf000m2nnn3pkux3rw', name: 'Noodle Texture', basePriceCents: 0, category: 'slider02', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 2 },
    { id: 'cmip6jbza00062z01skz6ndd5', name: 'Spice Level', basePriceCents: 0, category: 'slider03', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 3 },
    { id: 'cmip6jc0200272nnnmx2bv246', name: 'Baby Bok Choy', basePriceCents: 0, category: 'slider04', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 4 },
    { id: 'cmip6jc0g00292nnnwsr3nsiq', name: 'Green Onions', basePriceCents: 0, category: 'slider05', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 5 },
    { id: 'cmip6jc0h002b2nnnedxu3hy6', name: 'Cilantro', basePriceCents: 0, category: 'slider06', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 6 },
    { id: 'cmip6jc0h002d2nnn4zrbfozw', name: 'Sprouts', basePriceCents: 0, category: 'slider07', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 7 },
    { id: 'cmip6jc0i002f2nnnpv38o0iq', name: 'Pickled Greens', basePriceCents: 0, category: 'slider08', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 8 },

    // ADD-ONS
    { id: 'cmip6jc0i002f2nnnqv38o0ir', name: 'Bone Marrow', basePriceCents: 399, category: 'add-on01', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 1 },
    { id: 'cmip6jc0i002f2nnnrv38o0is', name: 'Extra Beef', basePriceCents: 599, category: 'add-on02', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 2 },
    { id: 'cmip6jc0i002f2nnnsv38o0it', name: 'Extra Noodles', basePriceCents: 299, category: 'add-on03', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 3 },
    { id: 'cmip6jc0i002f2nnntv38o0iu', name: 'Soft-Boild Egg', basePriceCents: 199, category: 'add-on04', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 4 },

    // SIDES
    { id: 'cmip6jc0i002f2nnnuv38o0iv', name: 'Spicy Cucumbers', basePriceCents: 299, category: 'side01', categoryType: 'SIDE', selectionMode: 'MULTIPLE', displayOrder: 1 },
    { id: 'cmip6jc0i002f2nnnvv38o0iw', name: 'Spicy Green Beans', basePriceCents: 299, category: 'side02', categoryType: 'SIDE', selectionMode: 'MULTIPLE', displayOrder: 2 },

    // DRINKS
    { id: 'cmip6jc0i002f2nnnwv38o0ix', name: 'Pepsi', basePriceCents: 249, category: 'drink01', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 1 },
    { id: 'cmip6jc0i002f2nnnxv38o0iy', name: 'Diet Pepsi', basePriceCents: 249, category: 'drink02', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 2 },
    { id: 'cmip6jc0i002f2nnnyv38o0iz', name: 'Water (cold)', basePriceCents: 0, category: 'drink03', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 3 },
    { id: 'cmip6jc0i002f2nnnzv38o0ia', name: 'Water (room temp)', basePriceCents: 0, category: 'drink04', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 4 },

    // DESSERT
    { id: 'cmip6jc0i002f2nnnav38o0ib', name: 'Mandarin Orange Sherbet', basePriceCents: 0, category: 'dessert01', categoryType: 'DESSERT', selectionMode: 'MULTIPLE', displayOrder: 1 },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        basePriceCents: item.basePriceCents,
        category: item.category,
        categoryType: item.categoryType as any,
        selectionMode: item.selectionMode as any,
        displayOrder: item.displayOrder,
        isAvailable: true,
      },
      create: {
        id: item.id,
        tenantId: tenant.id,
        name: item.name,
        basePriceCents: item.basePriceCents,
        category: item.category,
        categoryType: item.categoryType as any,
        selectionMode: item.selectionMode as any,
        displayOrder: item.displayOrder,
        isAvailable: true,
      }
    });
  }
  console.log(`✓ Created/updated ${menuItems.length} menu items`);

  // ==========================================
  // BADGES
  // ==========================================
  console.log('\nCreating badges...');

  const badges = [
    { id: 'cmip6jc1f00362nnnnbmu4xdk', slug: 'first-order', name: 'First Bowl', iconEmoji: '🍜', category: 'MILESTONE', description: 'Ordered your first bowl of noodles' },
    { id: 'cmip6jc1f00372nnnvjx2b00h', slug: '10-orders', name: 'Noodle Enthusiast', iconEmoji: '🥢', category: 'MILESTONE', description: 'Completed 10 orders' },
    { id: 'cmip6jc1f00382nnn5pq8tnau', slug: '50-orders', name: 'Beef Devotee', iconEmoji: '🐂', category: 'MILESTONE', description: 'Completed 50 orders' },
    { id: 'cmip6jc1f00392nnnhzmay5y0', slug: '100-orders', name: 'Century Club', iconEmoji: '💯', category: 'MILESTONE', description: 'Completed 100 orders' },
    { id: 'cmip6jc1f003a2nnnabck2fc3', slug: 'first-referral', name: 'Share the Love', iconEmoji: '🤝', category: 'REFERRAL', description: 'Referred your first friend' },
    { id: 'cmip6jc1f003b2nnnqit3ocm3', slug: '10-referrals', name: 'Influencer', iconEmoji: '⭐', category: 'REFERRAL', description: 'Referred 10 friends' },
    { id: 'cmip6jc1f003c2nnn2qovjr1w', slug: '50-referrals', name: 'Ambassador', iconEmoji: '👑', category: 'REFERRAL', description: 'Referred 50 friends' },
    { id: 'cmip6jc1f003d2nnnj5lhrdap', slug: '3-day-streak', name: 'Hot Streak', iconEmoji: '🔥', category: 'STREAK', description: 'Ordered 3 days in a row' },
    { id: 'cmip6jc1f003e2nnnmsaafisv', slug: '7-day-streak', name: 'Weekly Warrior', iconEmoji: '⚡', category: 'STREAK', description: 'Ordered 7 days in a row' },
    { id: 'cmip6jc1f003f2nnnwuv9pa4k', slug: '30-day-streak', name: 'Legend', iconEmoji: '🏆', category: 'STREAK', description: 'Ordered 30 days in a row' },
    { id: 'cmip6jc1f003g2nnnpciz90gx', slug: 'tried-all-items', name: 'Menu Master', iconEmoji: '📋', category: 'CHALLENGE', description: 'Tried every item on the menu' },
    { id: 'cmip6jc1f003h2nnn3116tr0v', slug: 'spicy-challenge', name: 'Heat Seeker', iconEmoji: '🌶️', category: 'CHALLENGE', description: 'Ordered max spice level' },
    { id: 'cmip6jc1f003i2nnn2tcyznmn', slug: 'grand-opening', name: 'OG Member', iconEmoji: '🎉', category: 'SPECIAL', description: 'Member since grand opening' },
    { id: 'cmip6jc1f003j2nnn963gxsan', slug: 'vip', name: 'VIP', iconEmoji: '💎', category: 'SPECIAL', description: 'VIP member status' },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { id: badge.id },
      update: {
        slug: badge.slug,
        name: badge.name,
        description: badge.description,
        iconEmoji: badge.iconEmoji,
        category: badge.category as any,
        isActive: true,
      },
      create: {
        id: badge.id,
        slug: badge.slug,
        name: badge.name,
        description: badge.description,
        iconEmoji: badge.iconEmoji,
        category: badge.category as any,
        isActive: true,
      }
    });
  }
  console.log(`✓ Created/updated ${badges.length} badges`);

  // ==========================================
  // CHALLENGES
  // ==========================================
  console.log('\nCreating challenges...');

  const challenges = [
    { id: 'cmip6jc1l003k2nnnoc7o1uve', slug: 'try-all-bases', name: 'Noodle Explorer', iconEmoji: '🗺️', rewardCents: 500, description: 'Try all noodle types', requirements: { type: 'try_all_noodles', count: 4 } },
    { id: 'cmip6jc1l003l2nnnseead1fn', slug: 'weekend-warrior', name: 'Weekend Warrior', iconEmoji: '📅', rewardCents: 300, description: 'Order on both Saturday and Sunday', requirements: { type: 'weekend_orders', days: ['saturday', 'sunday'] } },
    { id: 'cmip6jc1l003m2nnnbgkfv7ff', slug: 'bring-5-friends', name: 'Party Host', iconEmoji: '🎊', rewardCents: 1000, description: 'Refer 5 friends who make a purchase', requirements: { type: 'referrals', count: 5 } },
    { id: 'cmip6jc1l003n2nnns34wpuds', slug: 'early-bird', name: 'Early Bird', iconEmoji: '🌅', rewardCents: 400, description: 'Order before 11am', requirements: { type: 'early_order', beforeHour: 11 } },
  ];

  for (const challenge of challenges) {
    await prisma.challenge.upsert({
      where: { id: challenge.id },
      update: {
        slug: challenge.slug,
        name: challenge.name,
        iconEmoji: challenge.iconEmoji,
        rewardCents: challenge.rewardCents,
        description: challenge.description,
        requirements: challenge.requirements,
        isActive: true,
      },
      create: {
        id: challenge.id,
        slug: challenge.slug,
        name: challenge.name,
        iconEmoji: challenge.iconEmoji,
        rewardCents: challenge.rewardCents,
        description: challenge.description,
        requirements: challenge.requirements,
        isActive: true,
      }
    });
  }
  console.log(`✓ Created/updated ${challenges.length} challenges`);

  // ==========================================
  // SEATS (PODS) - U-Shape Layout per Location
  // ==========================================
  console.log('\nCreating seats (pods)...');

  const locations = [cityCreek, universityPlace];

  for (const location of locations) {
    // Check existing seats
    const existingCount = await prisma.seat.count({ where: { locationId: location.id } });

    if (existingCount === 0) {
      // Left side (01-04)
      for (let i = 0; i < 4; i++) {
        const podNum = (i + 1).toString().padStart(2, '0');
        await prisma.seat.create({
          data: {
            locationId: location.id,
            number: podNum,
            qrCode: `POD-${location.id.slice(-8)}-${podNum}-${Date.now()}`,
            status: 'AVAILABLE',
            side: 'left',
            row: 0,
            col: i,
          }
        });
      }

      // Bottom (05-08)
      for (let i = 0; i < 4; i++) {
        const podNum = (i + 5).toString().padStart(2, '0');
        await prisma.seat.create({
          data: {
            locationId: location.id,
            number: podNum,
            qrCode: `POD-${location.id.slice(-8)}-${podNum}-${Date.now()}`,
            status: 'AVAILABLE',
            side: 'bottom',
            row: 1,
            col: i,
          }
        });
      }

      // Right side (09-12)
      for (let i = 0; i < 4; i++) {
        const podNum = (i + 9).toString().padStart(2, '0');
        await prisma.seat.create({
          data: {
            locationId: location.id,
            number: podNum,
            qrCode: `POD-${location.id.slice(-8)}-${podNum}-${Date.now()}`,
            status: 'AVAILABLE',
            side: 'right',
            row: 2,
            col: i,
          }
        });
      }
      console.log(`✓ Created 12 pods for ${location.name}`);
    } else {
      console.log(`✓ ${location.name} already has ${existingCount} seats`);
    }
  }

  // ==========================================
  // LOCATION STATS
  // ==========================================
  console.log('\nCreating location stats...');

  for (const location of locations) {
    await prisma.locationStats.upsert({
      where: { locationId: location.id },
      update: {
        totalSeats: 12,
      },
      create: {
        locationId: location.id,
        totalSeats: 12,
        availableSeats: 12,
        occupiedSeats: 0,
        avgWaitMinutes: 0,
      }
    });
    console.log(`✓ Location stats for ${location.name}`);
  }

  console.log('\n✅ Production database seeded successfully!');
}

async function main() {
  try {
    if (shouldResetUsers) {
      await resetUsers();
    }

    if (shouldResetOrders) {
      await resetOrders();
    }

    // Always seed core data (uses upsert, so safe to run multiple times)
    await seedCoreData();

    // Summary
    const counts = await Promise.all([
      prisma.tenant.count(),
      prisma.location.count(),
      prisma.menuItem.count(),
      prisma.badge.count(),
      prisma.challenge.count(),
      prisma.seat.count(),
      prisma.user.count(),
      prisma.order.count(),
    ]);

    console.log('\n📊 Database Summary:');
    console.log(`  Tenants:    ${counts[0]}`);
    console.log(`  Locations:  ${counts[1]}`);
    console.log(`  Menu Items: ${counts[2]}`);
    console.log(`  Badges:     ${counts[3]}`);
    console.log(`  Challenges: ${counts[4]}`);
    console.log(`  Seats:      ${counts[5]}`);
    console.log(`  Users:      ${counts[6]}`);
    console.log(`  Orders:     ${counts[7]}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
