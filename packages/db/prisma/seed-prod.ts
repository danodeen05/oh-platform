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
    { id: 'cmip6jbzc00082nnn1di1ka94', name: 'A5 Wagyu Beef Noodle Soup', nameZhTW: 'A5和牛牛肉麵', nameZhCN: 'A5和牛牛肉面', nameEs: 'Sopa de Fideos con Res Wagyu A5', basePriceCents: 2399, category: 'main01', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1 },
    { id: 'cmip6jbza00062nnnskz6ntt8', name: 'Classic Beef Noodle Soup', nameZhTW: '經典牛肉麵', nameZhCN: '经典牛肉面', nameEs: 'Sopa de Fideos con Res Clásica', basePriceCents: 1599, category: 'main01', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1 },
    { id: 'cmip6jbzc000a2nnnewnr00lb', name: 'Classic Beef Noodle Soup (no beef)', nameZhTW: '經典牛肉麵（無牛肉）', nameZhCN: '经典牛肉面（无牛肉）', nameEs: 'Sopa de Fideos Clásica (sin carne)', basePriceCents: 1099, category: 'main01', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1 },

    // NOODLE TYPES (main02)
    { id: 'cmip6jbze000g2nnnvgx9hqnf', name: 'Ramen Noodles', nameZhTW: '拉麵', nameZhCN: '拉面', nameEs: 'Fideos Ramen', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1 },
    { id: 'cmip6jbzd000e2nnnw1ftbmxr', name: 'Shaved Noodles', nameZhTW: '刀削麵', nameZhCN: '刀削面', nameEs: 'Fideos Cortados a Mano', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 2 },
    { id: 'cmip6jbzd000c2nnny2hrd859', name: 'Wide Noodles', nameZhTW: '寬麵', nameZhCN: '宽面', nameEs: 'Fideos Anchos', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 3 },
    { id: 'cmip6jbze000i2nnnsjjcpifd', name: 'No Noodles', nameZhTW: '無麵', nameZhCN: '无面', nameEs: 'Sin Fideos', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 4 },

    // SLIDERS
    { id: 'cmip6jbzf000k2nnnmy81pbsx', name: 'Soup Richness', nameZhTW: '湯頭濃度', nameZhCN: '汤头浓度', nameEs: 'Intensidad del Caldo', basePriceCents: 0, category: 'slider01', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 1, sliderConfig: { max: 3, min: 0, step: 1, labels: ['Light', 'Medium', 'Rich', 'Extra Rich'], default: 1, description: 'How rich do you want your soup?' } },
    { id: 'cmip6jbzf000m2nnn3pkux3rw', name: 'Noodle Texture', nameZhTW: '麵條口感', nameZhCN: '面条口感', nameEs: 'Textura de Fideos', basePriceCents: 0, category: 'slider02', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 2, sliderConfig: { max: 2, min: 0, step: 1, labels: ['Firm', 'Medium', 'Soft'], default: 1, description: 'How firm do you want your noodles?' } },
    { id: 'cmip6jbza00062z01skz6ndd5', name: 'Spice Level', nameZhTW: '辣度', nameZhCN: '辣度', nameEs: 'Nivel de Picante', basePriceCents: 0, category: 'slider03', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 3, sliderConfig: { max: 4, min: 0, step: 1, labels: ['None', 'Mild', 'Medium', 'Spicy', 'Extra Spicy'], default: 1, description: 'How spicy do you like it?' } },
    { id: 'cmip6jc0200272nnnmx2bv246', name: 'Baby Bok Choy', nameZhTW: '青江菜', nameZhCN: '小白菜', nameEs: 'Bok Choy', basePriceCents: 0, category: 'slider04', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 4, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], default: 2, description: 'How much do you want?' } },
    { id: 'cmip6jc0g00292nnnwsr3nsiq', name: 'Green Onions', nameZhTW: '蔥花', nameZhCN: '葱花', nameEs: 'Cebollín', basePriceCents: 0, category: 'slider05', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 5, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], default: 2, description: 'How much do you want?' } },
    { id: 'cmip6jc0h002b2nnnedxu3hy6', name: 'Cilantro', nameZhTW: '香菜', nameZhCN: '香菜', nameEs: 'Cilantro', basePriceCents: 0, category: 'slider06', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 6, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], default: 1, description: 'How much do you want?' } },
    { id: 'cmip6jc0h002d2nnn4zrbfozw', name: 'Sprouts', nameZhTW: '豆芽菜', nameZhCN: '豆芽菜', nameEs: 'Brotes de Soja', basePriceCents: 0, category: 'slider07', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 7, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], default: 2, description: 'How much do you want?' } },
    { id: 'cmip6jc0i002f2nnnpv38o0iq', name: 'Pickled Greens', nameZhTW: '酸菜', nameZhCN: '酸菜', nameEs: 'Verduras en Escabeche', basePriceCents: 0, category: 'slider08', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 8, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], default: 1, description: 'How much do you want?' } },

    // ADD-ONS
    { id: 'cmip6jc0i002f2nnnqv38o0ir', name: 'Bone Marrow', nameZhTW: '牛骨髓', nameZhCN: '牛骨髓', nameEs: 'Tuétano de Res', basePriceCents: 399, category: 'add-on01', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 1 },
    { id: 'cmip6jc0i002f2nnnrv38o0is', name: 'Extra Beef', nameZhTW: '加牛肉', nameZhCN: '加牛肉', nameEs: 'Carne Extra', basePriceCents: 599, category: 'add-on02', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 2 },
    { id: 'cmip6jc0i002f2nnnsv38o0it', name: 'Extra Noodles', nameZhTW: '加麵', nameZhCN: '加面', nameEs: 'Fideos Extra', basePriceCents: 299, category: 'add-on03', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 3 },
    { id: 'cmip6jc0i002f2nnntv38o0iu', name: 'Soft-Boild Egg', nameZhTW: '滷蛋', nameZhCN: '卤蛋', nameEs: 'Huevo Marinado', basePriceCents: 199, category: 'add-on04', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 4 },

    // SIDES
    { id: 'cmip6jc0i002f2nnnuv38o0iv', name: 'Spicy Cucumbers', nameZhTW: '涼拌小黃瓜', nameZhCN: '凉拌黄瓜', nameEs: 'Pepinos Picantes', basePriceCents: 299, category: 'side01', categoryType: 'SIDE', selectionMode: 'MULTIPLE', displayOrder: 1 },
    { id: 'cmip6jc0i002f2nnnvv38o0iw', name: 'Spicy Green Beans', nameZhTW: '乾煸四季豆', nameZhCN: '干煸四季豆', nameEs: 'Ejotes Picantes', basePriceCents: 299, category: 'side02', categoryType: 'SIDE', selectionMode: 'MULTIPLE', displayOrder: 2 },

    // DRINKS
    { id: 'cmip6jc0i002f2nnnwv38o0ix', name: 'Pepsi', nameZhTW: '百事可樂', nameZhCN: '百事可乐', nameEs: 'Pepsi', basePriceCents: 249, category: 'drink01', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 1 },
    { id: 'cmip6jc0i002f2nnnxv38o0iy', name: 'Diet Pepsi', nameZhTW: '無糖百事', nameZhCN: '无糖百事', nameEs: 'Pepsi Dietética', basePriceCents: 249, category: 'drink02', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 2 },
    { id: 'cmip6jc0i002f2nnnyv38o0iz', name: 'Water (cold)', nameZhTW: '冰水', nameZhCN: '冰水', nameEs: 'Agua Fría', basePriceCents: 0, category: 'drink03', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 3 },
    { id: 'cmip6jc0i002f2nnnzv38o0ia', name: 'Water (room temp)', nameZhTW: '常溫水', nameZhCN: '常温水', nameEs: 'Agua Natural', basePriceCents: 0, category: 'drink04', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 4 },

    // DESSERT
    { id: 'cmip6jc0i002f2nnnav38o0ib', name: 'Mandarin Orange Sherbet', nameZhTW: '橘子雪酪', nameZhCN: '橘子雪酪', nameEs: 'Sorbete de Mandarina', basePriceCents: 0, category: 'dessert01', categoryType: 'DESSERT', selectionMode: 'MULTIPLE', displayOrder: 1 },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        nameZhTW: (item as any).nameZhTW || null,
        nameZhCN: (item as any).nameZhCN || null,
        nameEs: (item as any).nameEs || null,
        basePriceCents: item.basePriceCents,
        category: item.category,
        categoryType: item.categoryType as any,
        selectionMode: item.selectionMode as any,
        displayOrder: item.displayOrder,
        sliderConfig: (item as any).sliderConfig || null,
        isAvailable: true,
      },
      create: {
        id: item.id,
        tenantId: tenant.id,
        name: item.name,
        nameZhTW: (item as any).nameZhTW || null,
        nameZhCN: (item as any).nameZhCN || null,
        nameEs: (item as any).nameEs || null,
        basePriceCents: item.basePriceCents,
        category: item.category,
        categoryType: item.categoryType as any,
        selectionMode: item.selectionMode as any,
        displayOrder: item.displayOrder,
        sliderConfig: (item as any).sliderConfig || null,
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
  // SEATS (PODS) - U-Shape Layout with Dual Pods
  // ==========================================
  console.log('\nCreating/updating seats (pods)...');

  // City Creek Mall: Dual pods at 01-02 (left) and 11-12 (right)
  const cityCreekSeats = [
    { number: '01', side: 'left', row: 0, col: 0, podType: 'DUAL' as const },
    { number: '02', side: 'left', row: 0, col: 1, podType: 'DUAL' as const },
    { number: '03', side: 'left', row: 0, col: 2, podType: 'SINGLE' as const },
    { number: '04', side: 'left', row: 0, col: 3, podType: 'SINGLE' as const },
    { number: '05', side: 'bottom', row: 1, col: 0, podType: 'SINGLE' as const },
    { number: '06', side: 'bottom', row: 1, col: 1, podType: 'SINGLE' as const },
    { number: '07', side: 'bottom', row: 1, col: 2, podType: 'SINGLE' as const },
    { number: '08', side: 'bottom', row: 1, col: 3, podType: 'SINGLE' as const },
    { number: '09', side: 'right', row: 2, col: 0, podType: 'SINGLE' as const },
    { number: '10', side: 'right', row: 2, col: 1, podType: 'SINGLE' as const },
    { number: '11', side: 'right', row: 2, col: 2, podType: 'DUAL' as const },
    { number: '12', side: 'right', row: 2, col: 3, podType: 'DUAL' as const },
  ];

  // University Place: Dual pods at 05-06 and 07-08 (bottom)
  const universityPlaceSeats = [
    { number: '01', side: 'left', row: 0, col: 0, podType: 'SINGLE' as const },
    { number: '02', side: 'left', row: 0, col: 1, podType: 'SINGLE' as const },
    { number: '03', side: 'left', row: 0, col: 2, podType: 'SINGLE' as const },
    { number: '04', side: 'left', row: 0, col: 3, podType: 'SINGLE' as const },
    { number: '05', side: 'bottom', row: 1, col: 0, podType: 'DUAL' as const },
    { number: '06', side: 'bottom', row: 1, col: 1, podType: 'DUAL' as const },
    { number: '07', side: 'bottom', row: 1, col: 2, podType: 'DUAL' as const },
    { number: '08', side: 'bottom', row: 1, col: 3, podType: 'DUAL' as const },
    { number: '09', side: 'right', row: 2, col: 0, podType: 'SINGLE' as const },
    { number: '10', side: 'right', row: 2, col: 1, podType: 'SINGLE' as const },
    { number: '11', side: 'right', row: 2, col: 2, podType: 'SINGLE' as const },
    { number: '12', side: 'right', row: 2, col: 3, podType: 'SINGLE' as const },
  ];

  // Helper function to create or update seats for a location
  async function seedLocationSeats(
    location: { id: string; name: string },
    seatConfigs: typeof cityCreekSeats,
    dualPairs: [string, string][]  // pairs of pod numbers that are linked
  ) {
    const createdSeats: Record<string, string> = {};  // number -> id

    // First pass: create/update all seats
    for (const config of seatConfigs) {
      const existing = await prisma.seat.findFirst({
        where: { locationId: location.id, number: config.number }
      });

      if (existing) {
        await prisma.seat.update({
          where: { id: existing.id },
          data: {
            side: config.side,
            row: config.row,
            col: config.col,
            podType: config.podType,
            status: 'AVAILABLE',
          }
        });
        createdSeats[config.number] = existing.id;
      } else {
        const seat = await prisma.seat.create({
          data: {
            locationId: location.id,
            number: config.number,
            qrCode: `POD-${location.id.slice(-8)}-${config.number}-${Date.now()}`,
            status: 'AVAILABLE',
            side: config.side,
            row: config.row,
            col: config.col,
            podType: config.podType,
          }
        });
        createdSeats[config.number] = seat.id;
      }
    }

    // Second pass: link dual pods
    for (const [pod1, pod2] of dualPairs) {
      const id1 = createdSeats[pod1];
      const id2 = createdSeats[pod2];
      if (id1 && id2) {
        await prisma.seat.update({
          where: { id: id1 },
          data: { dualPartnerId: id2 }
        });
      }
    }

    console.log(`✓ Created/updated 12 pods for ${location.name}`);
  }

  // Seed City Creek Mall seats (dual: 01-02, 11-12)
  await seedLocationSeats(cityCreek, cityCreekSeats, [['01', '02'], ['11', '12']]);

  // Seed University Place seats (dual: 05-06, 07-08)
  await seedLocationSeats(universityPlace, universityPlaceSeats, [['05', '06'], ['07', '08']]);

  // ==========================================
  // LOCATION STATS
  // ==========================================
  console.log('\nCreating location stats...');

  for (const location of [cityCreek, universityPlace]) {
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
