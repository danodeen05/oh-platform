/**
 * Preview what data will be exported (dry run)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://oh:ohpassword@localhost:5432/ohdb?schema=public'
    }
  }
});

async function preview() {
  console.log('📋 Preview: Data in local database\n');
  console.log('This data will be exported to production:\n');

  try {
    const tenants = await prisma.tenant.findMany();
    console.log(`✓ Tenants: ${tenants.length}`);
    tenants.forEach(t => console.log(`  - ${t.brandName} (${t.slug})`));

    const locations = await prisma.location.findMany();
    console.log(`\n✓ Locations: ${locations.length}`);
    locations.forEach(l => console.log(`  - ${l.name} in ${l.city}`));

    const menuItems = await prisma.menuItem.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    console.log(`\n✓ Menu Items: ${menuItems.length}`);
    const grouped = {};
    menuItems.forEach(item => {
      const mode = item.selectionMode || 'MULTIPLE';
      if (!grouped[mode]) grouped[mode] = [];
      grouped[mode].push(item);
    });
    Object.entries(grouped).forEach(([mode, items]) => {
      console.log(`  ${mode}: ${items.length} items`);
      items.slice(0, 3).forEach(item => {
        const price = (item.basePriceCents / 100).toFixed(2);
        console.log(`    - ${item.name} ($${price})`);
      });
      if (items.length > 3) {
        console.log(`    ... and ${items.length - 3} more`);
      }
    });

    const badges = await prisma.badge.findMany();
    console.log(`\n✓ Badges: ${badges.length}`);
    badges.slice(0, 5).forEach(b => console.log(`  ${b.iconEmoji} ${b.name}`));
    if (badges.length > 5) console.log(`  ... and ${badges.length - 5} more`);

    const challenges = await prisma.challenge.findMany();
    console.log(`\n✓ Challenges: ${challenges.length}`);
    challenges.forEach(c => console.log(`  ${c.iconEmoji} ${c.name} - $${(c.rewardCents / 100).toFixed(2)} reward`));

    const seats = await prisma.seat.findMany();
    console.log(`\n✓ Seats: ${seats.length}`);

    const locationStats = await prisma.locationStats.findMany();
    console.log(`✓ Location Stats: ${locationStats.length}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  The following will NOT be exported:\n');

    const orders = await prisma.order.count();
    const users = await prisma.user.count();
    const creditEvents = await prisma.creditEvent.count();

    console.log(`✗ Orders: ${orders} (will remain untouched in production)`);
    console.log(`✗ Users: ${users}`);
    console.log(`✗ Credit Events: ${creditEvents}`);

    console.log('\n✅ Preview complete!');
    console.log('\nTo export this data to production, run:');
    console.log('  RAILWAY_DATABASE_URL="..." pnpm --filter @oh/db seed:prod\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

preview().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
