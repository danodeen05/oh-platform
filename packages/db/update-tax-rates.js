import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // First, let's see what locations exist
  const locations = await prisma.location.findMany({
    select: { id: true, name: true, city: true, taxRate: true }
  });

  console.log('Current locations:');
  locations.forEach(loc => {
    console.log(`  - ${loc.name} (${loc.city}): taxRate = ${loc.taxRate}`);
  });

  // Update Salt Lake City location (City Creek)
  const slcUpdate = await prisma.location.updateMany({
    where: { city: 'Salt Lake City' },
    data: { taxRate: 0.0945 }  // 9.45%
  });
  console.log(`\nUpdated ${slcUpdate.count} Salt Lake City location(s) to 9.45%`);

  // Update Orem location (University Place)
  const oremUpdate = await prisma.location.updateMany({
    where: { city: 'Orem' },
    data: { taxRate: 0.0845 }  // 8.45%
  });
  console.log(`Updated ${oremUpdate.count} Orem location(s) to 8.45%`);

  // Verify the updates
  const updatedLocations = await prisma.location.findMany({
    select: { id: true, name: true, city: true, taxRate: true }
  });

  console.log('\nUpdated locations:');
  updatedLocations.forEach(loc => {
    console.log(`  - ${loc.name} (${loc.city}): taxRate = ${loc.taxRate} (${(loc.taxRate * 100).toFixed(2)}%)`);
  });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
