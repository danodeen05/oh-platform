import { PrismaClient } from '@oh/db';

const prisma = new PrismaClient();

const UNIVERSITY_PLACE_ID = 'cmip6jbza00042nnnf4nc0dvh';
const CITY_CREEK_MALL_ID = 'cmip6jbz700022nnnxxpmm5hf';

async function addPods() {
  console.log('🪑 Adding pods to locations...\n');

  // University Place - 10 pods in U-shape
  // U-shape layout: pods arranged around the kitchen
  // Left side: U1-U3, Back: U4-U7, Right side: U8-U10
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
  // Left side: C1-C5, Back: C6-C11, Right side (L-shape): C12-C20
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
  try {
    const upResult = await prisma.seat.createMany({
      data: universityPlacePods,
      skipDuplicates: true,
    });
    console.log(`✅ Created ${upResult.count} pods at University Place`);

    const ccResult = await prisma.seat.createMany({
      data: cityCreekPods,
      skipDuplicates: true,
    });
    console.log(`✅ Created ${ccResult.count} pods at City Creek Mall`);

    console.log('\n📊 Pod Layout:');
    console.log('\nUniversity Place (U-shape):');
    console.log('  Left: U01-U03');
    console.log('  Back: U04-U07');
    console.log('  Right: U08-U10');

    console.log('\nCity Creek Mall (U+L-shape):');
    console.log('  Left: C01-C05');
    console.log('  Back: C06-C11');
    console.log('  Right (L-shape): C12-C20');

  } catch (error) {
    console.error('❌ Error creating pods:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addPods()
  .then(() => {
    console.log('\n✅ Pod setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
