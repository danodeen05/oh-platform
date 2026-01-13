import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Gift card denominations - migrated from hardcoded values
const denominations = [
  { amountCents: 2500, displayOrder: 0 },  // $25
  { amountCents: 5000, displayOrder: 1 },  // $50
  { amountCents: 7500, displayOrder: 2 },  // $75
  { amountCents: 10000, displayOrder: 3 }, // $100
];

// Custom amount range config
const customAmountRange = {
  configType: 'DENOMINATION',
  isPreset: false,
  minAmountCents: 1000,  // $10
  maxAmountCents: 50000, // $500
  displayOrder: 99, // Last in order
};

// Gift card designs - migrated from hardcoded values
const designs = [
  {
    designId: 'classic',
    designName: 'Classic',
    gradient: 'linear-gradient(135deg, #7C7A67 0%, #5a584a 100%)',
    displayOrder: 0,
  },
  {
    designId: 'dark',
    designName: 'Dark',
    gradient: 'linear-gradient(135deg, #222222 0%, #444444 100%)',
    displayOrder: 1,
  },
  {
    designId: 'gold',
    designName: 'Gold',
    gradient: 'linear-gradient(135deg, #C7A878 0%, #8B7355 100%)',
    displayOrder: 2,
  },
];

async function seedGiftCardConfig() {
  console.log('🎁 Seeding gift card configuration...\n');

  try {
    // Check existing config
    const existingCount = await prisma.giftCardConfig.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing config records.`);
      console.log('   Use --force to delete and re-seed, or skipping...\n');

      if (process.argv.includes('--force')) {
        console.log('🗑️  Deleting existing config...');
        await prisma.giftCardConfig.deleteMany({});
        console.log('✅ Deleted existing config\n');
      } else {
        console.log('Skipping seed. Use --force to overwrite.');
        return;
      }
    }

    // Seed denominations
    console.log('💰 Seeding denominations...');
    for (const denom of denominations) {
      await prisma.giftCardConfig.create({
        data: {
          configType: 'DENOMINATION',
          isPreset: true,
          amountCents: denom.amountCents,
          displayOrder: denom.displayOrder,
          isActive: true,
        },
      });
      console.log(`   ✅ $${(denom.amountCents / 100).toFixed(0)}`);
    }

    // Seed custom amount range
    console.log('\n📊 Seeding custom amount range...');
    await prisma.giftCardConfig.create({
      data: customAmountRange,
    });
    console.log(`   ✅ Custom range: $${customAmountRange.minAmountCents / 100} - $${customAmountRange.maxAmountCents / 100}`);

    // Seed designs
    console.log('\n🎨 Seeding designs...');
    for (const design of designs) {
      await prisma.giftCardConfig.create({
        data: {
          configType: 'DESIGN',
          designId: design.designId,
          designName: design.designName,
          gradient: design.gradient,
          displayOrder: design.displayOrder,
          isActive: true,
        },
      });
      console.log(`   ✅ ${design.designName} (${design.designId})`);
    }

    // Summary
    console.log('\n📋 Summary:');
    console.log(`   Denominations: ${denominations.length} preset amounts`);
    console.log(`   Custom range: $${customAmountRange.minAmountCents / 100} - $${customAmountRange.maxAmountCents / 100}`);
    console.log(`   Designs: ${designs.length}`);

  } catch (error) {
    console.error('❌ Error seeding gift card config:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedGiftCardConfig()
  .then(() => {
    console.log('\n✅ Gift card config seed complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
