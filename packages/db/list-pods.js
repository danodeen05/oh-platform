import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listPods() {
  const seats = await prisma.seat.findMany({
    orderBy: [
      { locationId: 'asc' },
      { number: 'asc' }
    ],
    include: {
      location: true
    }
  });

  console.log(`\nFound ${seats.length} pods:\n`);

  let currentLocation = null;
  for (const seat of seats) {
    if (currentLocation !== seat.location.name) {
      currentLocation = seat.location.name;
      console.log(`\n📍 ${currentLocation}:`);
    }
    console.log(`  ${seat.number} - ${seat.podType} ${seat.dualPartnerId ? `(paired with ${seat.dualPartnerId})` : ''}`);
  }

  await prisma.$disconnect();
}

listPods();
