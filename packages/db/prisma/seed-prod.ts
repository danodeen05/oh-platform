import { PrismaClient } from '@prisma/client';
import { seedLocation, LOCATIONS } from '../scripts/seed-comb-seats';
import { BADGES } from './seed-data/badges';
import { CHALLENGES } from './seed-data/challenges';
import { LOCATION_I18N } from './seed-data/locations';
import { SLIDER_LABELS_I18N } from './seed-data/slider-labels';

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

  // Cast once here: Prisma's InputJsonObject wants an index signature our
  // hand-authored LocationCopy/I18nCopy interfaces don't (and shouldn't)
  // carry, since they're plain, fully JSON-serializable data (see
  // seed-data/locations.ts).
  const cityCreekI18n = LOCATION_I18N['city-creek'] as any;
  const universityPlaceI18n = LOCATION_I18N['university-place'] as any;

  const cityCreek = await prisma.location.upsert({
    where: { id: 'cmip6jbz700022nnnxxpmm5hf' },
    update: {
      name: 'City Creek Mall',
      city: 'Salt Lake City',
      address: '50 S Main St, Salt Lake City, UT 84101',
      lat: 40.7679773,
      lng: -111.89162,
      taxRate: 0.0945, // Salt Lake City: 8.45% base + 1% restaurant tax = 9.45%
      i18n: cityCreekI18n,
    },
    create: {
      id: 'cmip6jbz700022nnnxxpmm5hf',
      tenantId: tenant.id,
      name: 'City Creek Mall',
      city: 'Salt Lake City',
      address: '50 S Main St, Salt Lake City, UT 84101',
      lat: 40.7679773,
      lng: -111.89162,
      taxRate: 0.0945, // Salt Lake City: 8.45% base + 1% restaurant tax = 9.45%
      i18n: cityCreekI18n,
    }
  });
  console.log('✓ Location:', cityCreek.name, `(${cityCreek.city}, tax: ${(cityCreek.taxRate * 100).toFixed(2)}%)`);

  const universityPlace = await prisma.location.upsert({
    where: { id: 'cmip6jbza00042nnnf4nc0dvh' },
    update: {
      name: 'University Place',
      city: 'Orem',
      address: '575 E University Pkwy, Orem, UT 84097',
      lat: 40.2338,
      lng: -111.6585,
      taxRate: 0.0845, // Orem: 7.45% base + 1% restaurant tax = 8.45%
      i18n: universityPlaceI18n,
    },
    create: {
      id: 'cmip6jbza00042nnnf4nc0dvh',
      tenantId: tenant.id,
      name: 'University Place',
      city: 'Orem',
      address: '575 E University Pkwy, Orem, UT 84097',
      lat: 40.2338,
      lng: -111.6585,
      taxRate: 0.0845, // Orem: 7.45% base + 1% restaurant tax = 8.45%
      i18n: universityPlaceI18n,
    }
  });
  console.log('✓ Location:', universityPlace.name, `(${universityPlace.city}, tax: ${(universityPlace.taxRate * 100).toFixed(2)}%)`);

  // ==========================================
  // MENU ITEMS
  // ==========================================
  console.log('\nCreating menu items...');

  const menuItems = [
    // MAIN DISHES (main01)
    { id: 'cmip6jbzc00082nnn1di1ka94', name: 'American Wagyu Beef Noodle Soup', nameZhTW: '美國和牛牛肉麵', nameZhCN: '美国和牛牛肉面', nameEs: 'Sopa de Fideos con Res Wagyu Americana', basePriceCents: 2399, category: 'main01', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1, isGlutenFree: false, spiceLevel: 1 },
    { id: 'cmip6jbza00062nnnskz6ntt8', name: 'Classic Beef Noodle Soup', nameZhTW: '經典牛肉麵', nameZhCN: '经典牛肉面', nameEs: 'Sopa de Fideos con Res Clásica', basePriceCents: 1599, category: 'main01', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1, isGlutenFree: false, spiceLevel: 1 },
    { id: 'cmip6jbzc000a2nnnewnr00lb', name: 'Classic Beef Noodle Soup (no beef)', nameZhTW: '經典牛肉麵（無牛肉）', nameZhCN: '经典牛肉面（无牛肉）', nameEs: 'Sopa de Fideos Clásica (sin carne)', basePriceCents: 1099, category: 'main01', categoryType: 'MAIN', selectionMode: 'SINGLE', displayOrder: 1, isVegetarian: false, isGlutenFree: false, spiceLevel: 0 },

    // NOODLE TYPES (main02): off the menu since 2026-10-01 (one house noodle; firmness is the
    // Noodle Texture slider). Rows stay, unavailable, so past orders keep their lines.
    { id: 'cmip6jbze000g2nnnvgx9hqnf', name: 'Ramen Noodles', nameZhTW: '拉麵', nameZhCN: '拉面', nameEs: 'Fideos Ramen', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', isAvailable: false, displayOrder: 1, isVegetarian: true, isVegan: true },
    { id: 'cmip6jbzd000e2nnnw1ftbmxr', name: 'Shaved Noodles', nameZhTW: '刀削麵', nameZhCN: '刀削面', nameEs: 'Fideos Cortados a Mano', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', isAvailable: false, displayOrder: 2, isVegetarian: true, isVegan: true },
    { id: 'cmip6jbzd000c2nnny2hrd859', name: 'Wide Noodles', nameZhTW: '寬麵', nameZhCN: '宽面', nameEs: 'Fideos Anchos', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', isAvailable: false, displayOrder: 3, isVegetarian: true, isVegan: true },
    { id: 'cmjnacgf10001gf1rgfwide01', name: 'Wide Noodles (Gluten Free)', nameZhTW: '寬麵（無麩質）', nameZhCN: '宽面（无麸质）', nameEs: 'Fideos Anchos (Sin Gluten)', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', isAvailable: false, displayOrder: 4, isVegetarian: true, isVegan: true, isGlutenFree: true },
    { id: 'cmip6jbze000i2nnnsjjcpifd', name: 'No Noodles', nameZhTW: '無麵', nameZhCN: '无面', nameEs: 'Sin Fideos', basePriceCents: 0, category: 'main02', categoryType: 'MAIN', selectionMode: 'SINGLE', isAvailable: false, displayOrder: 5, isVegetarian: true, isVegan: true, isGlutenFree: true },

    // SLIDERS
    { id: 'cmip6jbzf000k2nnnmy81pbsx', name: 'Soup Richness', nameZhTW: '湯頭濃度', nameZhCN: '汤头浓度', nameEs: 'Intensidad del Caldo', basePriceCents: 0, category: 'slider01', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 1, sliderConfig: { max: 3, min: 0, step: 1, labels: ['Light', 'Medium', 'Rich', 'Extra Rich'], labelsI18n: SLIDER_LABELS_I18N.slider01, default: 1, description: 'How rich do you want your soup?' } },
    { id: 'cmip6jbzf000m2nnn3pkux3rw', name: 'Noodle Texture', nameZhTW: '麵條口感', nameZhCN: '面条口感', nameEs: 'Textura de Fideos', basePriceCents: 0, category: 'slider02', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 2, sliderConfig: { max: 2, min: 0, step: 1, labels: ['Firm', 'Medium', 'Soft'], labelsI18n: SLIDER_LABELS_I18N.slider02, default: 1, description: 'How firm do you want your noodles?' } },
    { id: 'cmip6jbza00062z01skz6ndd5', name: 'Spice Level', nameZhTW: '辣度', nameZhCN: '辣度', nameEs: 'Nivel de Picante', basePriceCents: 0, category: 'slider03', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 3, sliderConfig: { max: 4, min: 0, step: 1, labels: ['None', 'Mild', 'Medium', 'Spicy', 'Extra Spicy'], labelsI18n: SLIDER_LABELS_I18N.slider03, default: 1, description: 'How spicy do you like it?' } },
    { id: 'cmip6jc0200272nnnmx2bv246', name: 'Baby Bok Choy', nameZhTW: '青江菜', nameZhCN: '小白菜', nameEs: 'Bok Choy', basePriceCents: 0, category: 'slider04', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 4, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], labelsI18n: SLIDER_LABELS_I18N.slider04, default: 2, description: 'How much do you want?' }, isVegetarian: true, isVegan: true, isGlutenFree: true },
    { id: 'cmip6jc0g00292nnnwsr3nsiq', name: 'Green Onions', nameZhTW: '蔥花', nameZhCN: '葱花', nameEs: 'Cebollín', basePriceCents: 0, category: 'slider05', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 5, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], labelsI18n: SLIDER_LABELS_I18N.slider05, default: 2, description: 'How much do you want?' }, isVegetarian: true, isVegan: true, isGlutenFree: true },
    { id: 'cmip6jc0h002b2nnnedxu3hy6', name: 'Cilantro', nameZhTW: '香菜', nameZhCN: '香菜', nameEs: 'Cilantro', basePriceCents: 0, category: 'slider06', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 6, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], labelsI18n: SLIDER_LABELS_I18N.slider06, default: 1, description: 'How much do you want?' }, isVegetarian: true, isVegan: true, isGlutenFree: true },
    { id: 'cmip6jc0h002d2nnn4zrbfozw', name: 'Sprouts', nameZhTW: '豆芽菜', nameZhCN: '豆芽菜', nameEs: 'Brotes de Soja', basePriceCents: 0, category: 'slider07', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 7, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], labelsI18n: SLIDER_LABELS_I18N.slider07, default: 2, description: 'How much do you want?' }, isVegetarian: true, isVegan: true, isGlutenFree: true },
    { id: 'cmip6jc0i002f2nnnpv38o0iq', name: 'Pickled Greens', nameZhTW: '酸菜', nameZhCN: '酸菜', nameEs: 'Verduras en Escabeche', basePriceCents: 0, category: 'slider08', categoryType: 'SLIDER', selectionMode: 'SLIDER', displayOrder: 8, sliderConfig: { max: 3, min: 0, step: 1, labels: ['None', 'Light', 'Normal', 'Extra'], labelsI18n: SLIDER_LABELS_I18N.slider08, default: 1, description: 'How much do you want?' }, isVegetarian: true, isVegan: true, isGlutenFree: true },

    // ADD-ONS
    { id: 'cmip6jc0i002f2nnnqv38o0ir', name: 'Bone Marrow', nameZhTW: '牛骨髓', nameZhCN: '牛骨髓', nameEs: 'Tuétano de Res', basePriceCents: 399, category: 'add-on01', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 1, isGlutenFree: true },
    { id: 'cmip6jc0i002f2nnnrv38o0is', name: 'Extra Beef', nameZhTW: '加牛肉', nameZhCN: '加牛肉', nameEs: 'Carne Extra', basePriceCents: 599, category: 'add-on02', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 2, isGlutenFree: true },
    { id: 'cmip6jc0i002f2nnnsv38o0it', name: 'Extra Noodles', nameZhTW: '加麵', nameZhCN: '加面', nameEs: 'Fideos Extra', basePriceCents: 299, category: 'add-on03', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 3, isVegetarian: true, isVegan: true },
    { id: 'cmip6jc0i002f2nnntv38o0iu', name: 'Soft-Boild Egg', nameZhTW: '滷蛋', nameZhCN: '卤蛋', nameEs: 'Huevo Marinado', basePriceCents: 199, category: 'add-on04', categoryType: 'ADDON', selectionMode: 'MULTIPLE', displayOrder: 4, isVegetarian: true, isGlutenFree: true },

    // SIDES
    { id: 'cmip6jc0i002f2nnnuv38o0iv', name: 'Spicy Cucumbers', nameZhTW: '涼拌小黃瓜', nameZhCN: '凉拌黄瓜', nameEs: 'Pepinos Picantes', basePriceCents: 299, category: 'side01', categoryType: 'SIDE', selectionMode: 'MULTIPLE', displayOrder: 1, isVegetarian: true, isVegan: true, isGlutenFree: true, spiceLevel: 2 },
    { id: 'cmip6jc0i002f2nnnvv38o0iw', name: 'Spicy Green Beans', nameZhTW: '乾煸四季豆', nameZhCN: '干煸四季豆', nameEs: 'Ejotes Picantes', basePriceCents: 299, category: 'side02', categoryType: 'SIDE', selectionMode: 'MULTIPLE', displayOrder: 2, isVegetarian: false, isVegan: false, isGlutenFree: true, spiceLevel: 2 },

    // DRINKS
    { id: 'cmip6jc0i002f2nnnwv38o0ix', name: 'Pepsi', nameZhTW: '百事可樂', nameZhCN: '百事可乐', nameEs: 'Pepsi', basePriceCents: 249, category: 'drink01', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 1, isVegetarian: true, isVegan: true, isGlutenFree: true },
    { id: 'cmip6jc0i002f2nnnxv38o0iy', name: 'Diet Pepsi', nameZhTW: '無糖百事', nameZhCN: '无糖百事', nameEs: 'Pepsi Dietética', basePriceCents: 249, category: 'drink02', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 2, isVegetarian: true, isVegan: true, isGlutenFree: true },
    { id: 'cmip6jc0i002f2nnnyv38o0iz', name: 'Water (cold)', nameZhTW: '冰水', nameZhCN: '冰水', nameEs: 'Agua Fría', basePriceCents: 0, category: 'drink03', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 3, isVegetarian: true, isVegan: true, isGlutenFree: true },
    { id: 'cmip6jc0i002f2nnnzv38o0ia', name: 'Water (room temp)', nameZhTW: '常溫水', nameZhCN: '常温水', nameEs: 'Agua Natural', basePriceCents: 0, category: 'drink04', categoryType: 'DRINK', selectionMode: 'MULTIPLE', displayOrder: 4, isVegetarian: true, isVegan: true, isGlutenFree: true },

    // DESSERT
    { id: 'cmip6jc0i002f2nnnav38o0ib', name: 'Mandarin Orange Sherbet', nameZhTW: '橘子雪酪', nameZhCN: '橘子雪酪', nameEs: 'Sorbete de Mandarina', basePriceCents: 0, category: 'dessert01', categoryType: 'DESSERT', selectionMode: 'MULTIPLE', displayOrder: 1, isVegetarian: true, isGlutenFree: true },
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
        // Dietary fields
        isVegetarian: (item as any).isVegetarian ?? false,
        isVegan: (item as any).isVegan ?? false,
        isGlutenFree: (item as any).isGlutenFree ?? false,
        spiceLevel: (item as any).spiceLevel ?? 0,
        allergens: (item as any).allergens || null,
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
        // Dietary fields
        isVegetarian: (item as any).isVegetarian ?? false,
        isVegan: (item as any).isVegan ?? false,
        isGlutenFree: (item as any).isGlutenFree ?? false,
        spiceLevel: (item as any).spiceLevel ?? 0,
        allergens: (item as any).allergens || null,
      }
    });
  }
  console.log(`✓ Created/updated ${menuItems.length} menu items`);

  // ==========================================
  // BADGES
  // ==========================================
  console.log('\nCreating badges...');

  // Content (name/description/i18n/iconKey) comes from ./seed-data/badges.ts,
  // the single source of truth shared with the backfill script and the
  // i18n-seed test. iconEmoji is nullable on Badge and is dropped in favor
  // of iconKey (an in-house SVG glyph, see apps/web/components/site/seal).
  const badges = BADGES.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.i18n.en.name,
    description: b.i18n.en.description,
    category: b.category,
    iconKey: b.iconKey,
    // Cast: see the LOCATION_I18N cast note above.
    i18n: b.i18n as any,
  }));

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { id: badge.id },
      update: {
        slug: badge.slug,
        name: badge.name,
        description: badge.description,
        iconEmoji: null,
        iconKey: badge.iconKey,
        i18n: badge.i18n,
        category: badge.category as any,
        isActive: true,
      },
      create: {
        id: badge.id,
        slug: badge.slug,
        name: badge.name,
        description: badge.description,
        iconEmoji: null,
        iconKey: badge.iconKey,
        i18n: badge.i18n,
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

  // Content comes from ./seed-data/challenges.ts. Challenge.iconEmoji is
  // still schema-required (frozen migration from Task A2), so the seed
  // writes '' there instead of an emoji; iconKey carries the real icon.
  const challenges = CHALLENGES.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.i18n.en.name,
    description: c.i18n.en.description,
    iconKey: c.iconKey,
    // Cast: see the LOCATION_I18N cast note above.
    i18n: c.i18n as any,
    rewardCents: c.rewardCents,
    requirements: c.requirements as any,
  }));

  for (const challenge of challenges) {
    await prisma.challenge.upsert({
      where: { id: challenge.id },
      update: {
        slug: challenge.slug,
        name: challenge.name,
        iconEmoji: '',
        iconKey: challenge.iconKey,
        i18n: challenge.i18n,
        rewardCents: challenge.rewardCents,
        description: challenge.description,
        requirements: challenge.requirements,
        isActive: true,
      },
      create: {
        id: challenge.id,
        slug: challenge.slug,
        name: challenge.name,
        iconEmoji: '',
        iconKey: challenge.iconKey,
        i18n: challenge.i18n,
        rewardCents: challenge.rewardCents,
        description: challenge.description,
        requirements: challenge.requirements,
        isActive: true,
      }
    });
  }
  console.log(`✓ Created/updated ${challenges.length} challenges`);

  // ==========================================
  // SEATS (PODS) - Comb layout (Task A8)
  // ==========================================
  // Real comb-layout seats (75 pods at City Creek, 70 mirrored at University
  // Place) replace the old 12-pod U-shape placeholder. `seedLocation` sets
  // the location's slug/layoutKey/layoutMirror/podCount, seeds/retires its
  // `Seat` rows via `seedCombSeats` (idempotent), and syncs
  // `LocationStats.totalSeats` to `podCount`.
  console.log('\nSeeding comb seats...');

  for (const entry of LOCATIONS) {
    const result = await seedLocation(prisma, entry);
    console.log(`✓ ${entry.slug}: created ${result.created}, retired ${result.retired} pods`);
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
