import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updateSliderConfigs() {
  console.log('Updating slider configurations...\n');

  const updates = [
    {
      name: 'Soup Richness',
      config: {
        min: 0,
        max: 3,
        default: 1,
        labels: ['Light', 'Medium', 'Rich', 'Extra Rich'],
        step: 1,
        description: 'How rich do you want your soup?'
      }
    },
    {
      name: 'Noodle Texture',
      config: {
        min: 0,
        max: 2,
        default: 1,
        labels: ['Firm', 'Medium', 'Soft'],
        step: 1,
        description: 'How firm do you want your noodles?'
      }
    },
    {
      name: 'Spice Level',
      config: {
        min: 0,
        max: 4,
        default: 1,
        labels: ['None', 'Mild', 'Medium', 'Spicy', 'Extra Spicy'],
        step: 1,
        description: 'How spicy do you like it?'
      }
    },
    {
      name: 'Baby Bok Choy',
      config: {
        min: 0,
        max: 3,
        default: 2,
        labels: ['None', 'Light', 'Normal', 'Extra'],
        step: 1,
        description: 'How much do you want?'
      }
    },
    {
      name: 'Green Onions',
      config: {
        min: 0,
        max: 3,
        default: 2,
        labels: ['None', 'Light', 'Normal', 'Extra'],
        step: 1,
        description: 'How much do you want?'
      }
    },
    {
      name: 'Cilantro',
      config: {
        min: 0,
        max: 3,
        default: 1,
        labels: ['None', 'Light', 'Normal', 'Extra'],
        step: 1,
        description: 'How much do you want?'
      }
    },
    {
      name: 'Sprouts',
      config: {
        min: 0,
        max: 3,
        default: 2,
        labels: ['None', 'Light', 'Normal', 'Extra'],
        step: 1,
        description: 'How much do you want?'
      }
    },
    {
      name: 'Pickled Greens',
      config: {
        min: 0,
        max: 3,
        default: 1,
        labels: ['None', 'Light', 'Normal', 'Extra'],
        step: 1,
        description: 'How much do you want?'
      }
    }
  ];

  for (const update of updates) {
    const result = await prisma.menuItem.updateMany({
      where: { name: update.name },
      data: { sliderConfig: update.config }
    });
    console.log(`✓ Updated ${update.name}: ${result.count} item(s)`);
  }

  console.log('\n✨ All slider configurations updated!');
  await prisma.$disconnect();
}

updateSliderConfigs().catch((error) => {
  console.error('Error updating slider configs:', error);
  process.exit(1);
});
