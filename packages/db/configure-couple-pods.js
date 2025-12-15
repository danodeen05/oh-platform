import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const UNIVERSITY_PLACE_ID = 'cmip6jbza00042nnnf4nc0dvh';
const CITY_CREEK_MALL_ID = 'cmip6jbz700022nnnxxpmm5hf';

async function configureDualPods() {
  console.log('Configuring dual pods...\n');

  try {
    // City Creek: Pods 01 & 02, and 11 & 12
    // University Place: Pods 05 & 06, and 07 & 08

    // First, get the pods we need to configure
    const cityCreekPods = await prisma.seat.findMany({
      where: {
        locationId: CITY_CREEK_MALL_ID,
        number: { in: ['01', '02', '11', '12'] }
      }
    });

    const universityPlacePods = await prisma.seat.findMany({
      where: {
        locationId: UNIVERSITY_PLACE_ID,
        number: { in: ['05', '06', '07', '08'] }
      }
    });

    console.log('Found City Creek pods:', cityCreekPods.map(p => p.number).join(', '));
    console.log('Found University Place pods:', universityPlacePods.map(p => p.number).join(', '));
    console.log('');

    // Helper to find pod by number
    const findPod = (pods, number) => pods.find(p => p.number === number);

    // City Creek: 01 & 02
    const c01 = findPod(cityCreekPods, '01');
    const c02 = findPod(cityCreekPods, '02');
    if (c01 && c02) {
      // First, set both to DUAL type
      await prisma.seat.update({
        where: { id: c01.id },
        data: { podType: 'DUAL' }
      });
      await prisma.seat.update({
        where: { id: c02.id },
        data: { podType: 'DUAL' }
      });
      // Then link 01 -> 02 (only one side needs dualPartnerId due to @unique)
      await prisma.seat.update({
        where: { id: c01.id },
        data: { dualPartnerId: c02.id }
      });
      console.log('City Creek: Linked 01 & 02 as dual pod');
    } else {
      console.log('Could not find 01 and/or 02 at City Creek');
    }

    // City Creek: 11 & 12
    const c11 = findPod(cityCreekPods, '11');
    const c12 = findPod(cityCreekPods, '12');
    if (c11 && c12) {
      await prisma.seat.update({
        where: { id: c11.id },
        data: { podType: 'DUAL' }
      });
      await prisma.seat.update({
        where: { id: c12.id },
        data: { podType: 'DUAL' }
      });
      await prisma.seat.update({
        where: { id: c11.id },
        data: { dualPartnerId: c12.id }
      });
      console.log('City Creek: Linked 11 & 12 as dual pod');
    } else {
      console.log('Could not find 11 and/or 12 at City Creek');
    }

    // University Place: 05 & 06
    const u05 = findPod(universityPlacePods, '05');
    const u06 = findPod(universityPlacePods, '06');
    if (u05 && u06) {
      await prisma.seat.update({
        where: { id: u05.id },
        data: { podType: 'DUAL' }
      });
      await prisma.seat.update({
        where: { id: u06.id },
        data: { podType: 'DUAL' }
      });
      await prisma.seat.update({
        where: { id: u05.id },
        data: { dualPartnerId: u06.id }
      });
      console.log('University Place: Linked 05 & 06 as dual pod');
    } else {
      console.log('Could not find 05 and/or 06 at University Place');
    }

    // University Place: 07 & 08
    const u07 = findPod(universityPlacePods, '07');
    const u08 = findPod(universityPlacePods, '08');
    if (u07 && u08) {
      await prisma.seat.update({
        where: { id: u07.id },
        data: { podType: 'DUAL' }
      });
      await prisma.seat.update({
        where: { id: u08.id },
        data: { podType: 'DUAL' }
      });
      await prisma.seat.update({
        where: { id: u07.id },
        data: { dualPartnerId: u08.id }
      });
      console.log('University Place: Linked 07 & 08 as dual pod');
    } else {
      console.log('Could not find 07 and/or 08 at University Place');
    }

    console.log('\nDual Pod Summary:');
    console.log('City Creek Mall:');
    console.log('  01 & 02 - Dual Pod');
    console.log('  11 & 12 - Dual Pod');
    console.log('University Place:');
    console.log('  05 & 06 - Dual Pod');
    console.log('  07 & 08 - Dual Pod');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

configureDualPods()
  .then(() => {
    console.log('\nDual pod configuration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
