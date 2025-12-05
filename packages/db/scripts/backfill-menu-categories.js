import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function backfillMenuItems() {
  console.log('Starting menu item backfill...\n');

  const items = await prisma.menuItem.findMany({
    orderBy: { category: 'asc' }
  });

  console.log(`Found ${items.length} menu items to process\n`);

  for (const item of items) {
    const updates = {};

    if (!item.category) {
      console.log(`⚠️  Skipping ${item.name} (no category)`);
      continue;
    }

    // Determine categoryType and selectionMode from existing category string
    if (item.category.startsWith('main')) {
      updates.categoryType = 'MAIN';
      updates.selectionMode = 'SINGLE';
      updates.displayOrder = parseInt(item.category.replace('main', '')) || 0;
    } else if (item.category.startsWith('slider')) {
      updates.categoryType = 'SLIDER';
      updates.selectionMode = 'SLIDER';
      updates.displayOrder = parseInt(item.category.replace('slider', '')) || 0;

      // Set slider config based on item name
      const lowerName = item.name.toLowerCase();

      if (lowerName.includes('richness') || lowerName.includes('texture')) {
        updates.sliderConfig = {
          min: 0,
          max: 5,
          default: 3,
          labels: ['Very Light', 'Light', 'Regular', 'Rich', 'Very Rich', 'Extra Rich'],
          step: 1,
          description: `How ${lowerName.includes('richness') ? 'rich' : 'firm'} do you want it?`
        };
      } else if (lowerName.includes('spice')) {
        updates.sliderConfig = {
          min: 0,
          max: 10,
          default: 3,
          labels: ['No Spice', 'Mild', 'Medium', 'Hot', 'Extra Hot'],
          labelPositions: [0, 2, 5, 7, 10],
          step: 1,
          description: 'How spicy do you like it?'
        };
      } else if (lowerName.includes('bok choy') || lowerName.includes('onion') ||
                 lowerName.includes('cilantro') || lowerName.includes('sprout') ||
                 lowerName.includes('greens')) {
        // Ingredients with potential quantity
        updates.sliderConfig = {
          min: 0,
          max: 3,
          default: 1,
          labels: ['None', 'Light', 'Regular', 'Extra'],
          step: 1,
          description: 'How much do you want?'
        };
      } else {
        // Default yes/no slider
        updates.sliderConfig = {
          min: 0,
          max: 1,
          default: 1,
          labels: ['No', 'Yes'],
          step: 1,
          description: 'Include this?'
        };
      }
    } else if (item.category.startsWith('add-on')) {
      updates.categoryType = 'ADDON';
      updates.selectionMode = 'MULTIPLE';
      updates.displayOrder = parseInt(item.category.replace('add-on', '')) || 0;
    } else if (item.category.startsWith('side')) {
      updates.categoryType = 'SIDE';
      updates.selectionMode = 'MULTIPLE';
      updates.displayOrder = parseInt(item.category.replace('side', '')) || 0;
    } else if (item.category.startsWith('drink')) {
      updates.categoryType = 'DRINK';
      updates.selectionMode = 'MULTIPLE';
      updates.displayOrder = parseInt(item.category.replace('drink', '')) || 0;
    } else if (item.category.startsWith('dessert')) {
      updates.categoryType = 'DESSERT';
      updates.selectionMode = 'MULTIPLE';
      updates.displayOrder = parseInt(item.category.replace('dessert', '')) || 0;
    } else {
      // Legacy categories (base, protein, vegetables, toppings, extras)
      console.log(`⚠️  Skipping legacy category: ${item.name} (${item.category})`);
      continue;
    }

    await prisma.menuItem.update({
      where: { id: item.id },
      data: updates
    });

    const sliderInfo = updates.sliderConfig
      ? ` | Slider: ${updates.sliderConfig.min}-${updates.sliderConfig.max}`
      : '';
    console.log(`✅ ${item.name.padEnd(30)} → ${updates.categoryType.padEnd(8)} ${updates.selectionMode.padEnd(10)} (order: ${updates.displayOrder})${sliderInfo}`);
  }

  console.log('\n✨ Backfill complete!');
  await prisma.$disconnect();
}

backfillMenuItems().catch((error) => {
  console.error('Error during backfill:', error);
  process.exit(1);
});
