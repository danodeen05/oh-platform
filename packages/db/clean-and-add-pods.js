import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const UNIVERSITY_PLACE_ID = 'cmip6jbza00042nnnf4nc0dvh';
const CITY_CREEK_MALL_ID = 'cmip6jbz700022nnnxxpmm5hf';

async function cleanAndAddPods() {
  console.log('🧹 Cleaning existing pods...\n');

  try {
    // Delete all existing seats
    const deleted = await prisma.seat.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} existing pods\n`);

    console.log('🪑 Adding new pods to locations...\n');

    // University Place - 10 pods in U-shape
    // U-shape layout: pods arranged around the kitchen
    // Left side: U01-U03, Back: U04-U07, Right side: U08-U10
    console.log('📍 University Place (U-shape, 10 pods)');
    const universityPlacePods = [];
    for (let i = 1; i <= 10; i++) {
      const podNumber = `U${i.toString().padStart(2, '0')}`;
      universityPlacePods.push({
        locationId: UNIVERSITY_PLACE_ID,
        number: podNumber,
        qrCode: `POD-UP-${podNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'AVAILABLE',
      });
    }

    // City Creek Mall - 20 pods in U+L-shape
    // U+L-shape layout: U-shape with extended L on one side
    // Left side: C01-C05, Back: C06-C11, Right side (L-shape): C12-C20
    console.log('📍 City Creek Mall (U+L-shape, 20 pods)');
    const cityCreekPods = [];
    for (let i = 1; i <= 20; i++) {
      const podNumber = `C${i.toString().padStart(2, '0')}`;
      cityCreekPods.push({
        locationId: CITY_CREEK_MALL_ID,
        number: podNumber,
        qrCode: `POD-CC-${podNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'AVAILABLE',
      });
    }

    // Insert all pods
    const upResult = await prisma.seat.createMany({
      data: universityPlacePods,
    });
    console.log(`✅ Created ${upResult.count} pods at University Place`);

    const ccResult = await prisma.seat.createMany({
      data: cityCreekPods,
    });
    console.log(`✅ Created ${ccResult.count} pods at City Creek Mall`);

    console.log('\n📊 Pod Layout:');
    console.log('\nUniversity Place (U-shape, 10 pods):');
    console.log('  Left side:   U01-U03 (3 pods)');
    console.log('  Back:        U04-U07 (4 pods)');
    console.log('  Right side:  U08-U10 (3 pods)');

    console.log('\nCity Creek Mall (U+L-shape, 20 pods):');
    console.log('  Left side:   C01-C05 (5 pods)');
    console.log('  Back:        C06-C11 (6 pods)');
    console.log('  Right (L):   C12-C20 (9 pods)');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanAndAddPods()
  .then(() => {
    console.log('\n✅ Pod setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
