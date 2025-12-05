# Menu Item Schema Enhancement Plan

## Step 1: Add new fields to schema (migration-safe)

Add to MenuItem model in schema.prisma:
```prisma
categoryType     CategoryType?
selectionMode    SelectionMode  @default(MULTIPLE)
displayOrder     Int            @default(0)
sliderConfig     Json?
```

Add enums:
```prisma
enum CategoryType {
  MAIN
  SLIDER
  ADDON
  SIDE
  DRINK
  DESSERT
}

enum SelectionMode {
  SINGLE
  MULTIPLE
  SLIDER
  INCLUDED
}
```

## Step 2: Run migration (safe - adds nullable fields)
```bash
pnpm --filter @oh/db prisma db push
pnpm --filter @oh/db prisma generate
```

## Step 3: Backfill existing data with UPDATE script

```javascript
// packages/db/scripts/backfill-menu-categories.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillMenuItems() {
  const items = await prisma.menuItem.findMany();

  for (const item of items) {
    const updates = {};

    // Determine categoryType from existing category string
    if (item.category?.startsWith('main')) {
      updates.categoryType = 'MAIN';
      updates.selectionMode = 'SINGLE';
      updates.displayOrder = parseInt(item.category.replace('main', '')) || 0;
    } else if (item.category?.startsWith('slider')) {
      updates.categoryType = 'SLIDER';
      updates.selectionMode = 'SLIDER';
      updates.displayOrder = parseInt(item.category.replace('slider', '')) || 0;

      // Set default slider config based on item name
      if (item.name.includes('Richness') || item.name.includes('Texture')) {
        updates.sliderConfig = {
          min: 0,
          max: 5,
          default: 3,
          labels: ['Light', 'Regular', 'Extra'],
          step: 1
        };
      } else if (item.name.includes('Spice')) {
        updates.sliderConfig = {
          min: 0,
          max: 10,
          default: 3,
          labels: ['Mild', 'Medium', 'Hot', 'Extra Hot'],
          step: 1
        };
      } else {
        // Boolean sliders (Bok Choy, Cilantro, etc.)
        updates.sliderConfig = {
          min: 0,
          max: 1,
          default: 1,
          labels: ['No', 'Yes'],
          step: 1
        };
      }
    } else if (item.category?.startsWith('add-on')) {
      updates.categoryType = 'ADDON';
      updates.selectionMode = 'MULTIPLE';
      updates.displayOrder = parseInt(item.category.replace('add-on', '')) || 0;
    } else if (item.category?.startsWith('side')) {
      updates.categoryType = 'SIDE';
      updates.selectionMode = 'MULTIPLE';
      updates.displayOrder = parseInt(item.category.replace('side', '')) || 0;
    } else if (item.category?.startsWith('drink')) {
      updates.categoryType = 'DRINK';
      updates.selectionMode = 'MULTIPLE';
      updates.displayOrder = parseInt(item.category.replace('drink', '')) || 0;
    } else if (item.category?.startsWith('dessert')) {
      updates.categoryType = 'DESSERT';
      updates.selectionMode = 'MULTIPLE';
      updates.displayOrder = parseInt(item.category.replace('dessert', '')) || 0;
    }

    await prisma.menuItem.update({
      where: { id: item.id },
      data: updates
    });

    console.log(`Updated ${item.name}: ${updates.categoryType} - ${updates.selectionMode}`);
  }

  console.log('Backfill complete!');
  await prisma.$disconnect();
}

backfillMenuItems().catch(console.error);
```

## Step 4: Update API to use new fields

Modify GET /menu endpoint to group by categoryType:
```javascript
app.get("/menu", async (req, reply) => {
  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenant.id },
    orderBy: [
      { categoryType: 'asc' },
      { displayOrder: 'asc' }
    ]
  });

  // Group by category type
  const grouped = {
    main: items.filter(i => i.categoryType === 'MAIN'),
    sliders: items.filter(i => i.categoryType === 'SLIDER'),
    addons: items.filter(i => i.categoryType === 'ADDON'),
    sides: items.filter(i => i.categoryType === 'SIDE'),
    drinks: items.filter(i => i.categoryType === 'DRINK'),
    desserts: items.filter(i => i.categoryType === 'DESSERT')
  };

  return grouped;
});
```

## Slider Config Examples

### Richness/Texture Slider (0-5 scale):
```json
{
  "min": 0,
  "max": 5,
  "default": 3,
  "labels": ["Very Light", "Light", "Regular", "Rich", "Very Rich", "Extra Rich"],
  "step": 1,
  "description": "How rich do you want your soup?"
}
```

### Spice Level Slider (0-10 scale):
```json
{
  "min": 0,
  "max": 10,
  "default": 3,
  "labels": ["No Spice", "Mild", "Medium", "Hot", "Extra Hot"],
  "labelPositions": [0, 2, 5, 7, 10],
  "step": 1,
  "description": "How spicy do you like it?"
}
```

### Yes/No Toggle Slider (Baby Bok Choy, Cilantro):
```json
{
  "min": 0,
  "max": 1,
  "default": 1,
  "labels": ["No", "Yes"],
  "step": 1,
  "description": "Include this ingredient?"
}
```

### Quantity Slider (Green Onions, Sprouts):
```json
{
  "min": 0,
  "max": 3,
  "default": 1,
  "labels": ["None", "Light", "Regular", "Extra"],
  "step": 1,
  "description": "How much do you want?"
}
```
