/**
 * Seed catering menu items for Oh! Beef Noodle Soup.
 *
 * Idempotently creates the catering-specific menu items under the "oh" tenant.
 * Uses upsert-by-name so it is safe to run multiple times.
 *
 * Items:
 *   Soups    (MAIN):    Classic Beef Noodle Soup, Classic Beef Noodle Soup (no beef)
 *   Noodles  (SIDE):    Wide Noodles, Wide Noodles (Gluten Free), Thin/Flat Noodles, No Noodles
 *   Sliders  (SLIDER):  Baby Bok Choy, Sprouts
 *
 * Note: "Classic Beef Noodle Soup (no beef)" must keep that exact substring
 * "(no beef)" because the kitchen display uses it for the red-glow indicator.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding catering menu items...\n");

  // Find the Oh! tenant
  const tenant = await prisma.tenant.findFirst({ where: { slug: "oh" } });
  if (!tenant) {
    throw new Error('Oh! tenant not found. Run production seed first.');
  }
  console.log(`Found tenant: ${tenant.brandName} (${tenant.id})`);

  const items = [
    // ----- Soups (MAIN category) -----
    {
      name: "Classic Beef Noodle Soup",
      category: "main01",
      categoryType: "MAIN",
      basePriceCents: 0,   // free for catering attendees
      additionalPriceCents: 0,
      includedQuantity: 1,
      selectionMode: "SINGLE",
      displayOrder: 1,
      spiceLevel: 0,
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
      // Task F1: the same English as prisma/seed-data/menu-copy.ts (the catering-era copy is retired).
      description: "Sliced USDA Prime brisket, smoked low and slow, over our two-phase bone broth.",
    },
    {
      // The exact "(no beef)" substring triggers the kitchen red glow — do not change it
      name: "Classic Beef Noodle Soup (no beef)",
      category: "main01",
      categoryType: "MAIN",
      basePriceCents: 0,
      additionalPriceCents: 0,
      includedQuantity: 1,
      selectionMode: "SINGLE",
      displayOrder: 2,
      spiceLevel: 0,
      isVegetarian: true,
      isVegan: true,
      isGlutenFree: false,
      description: "Our classic bowl and broth, made without the beef.",
    },

    // ----- Noodles (SIDE category) -----
    {
      name: "Wide Noodles",
      category: "noodles",
      categoryType: "SIDE",
      basePriceCents: 0,
      additionalPriceCents: 0,
      includedQuantity: 1,
      selectionMode: "SINGLE",
      displayOrder: 10,
      spiceLevel: 0,
      isGlutenFree: false,
      description: "Broad, satisfying wheat noodles with a hearty chew. They catch the broth in every fold and are the house favorite for a reason.",
    },
    {
      name: "Wide Noodles (Gluten Free)",
      category: "noodles",
      categoryType: "SIDE",
      basePriceCents: 0,
      additionalPriceCents: 0,
      includedQuantity: 1,
      selectionMode: "SINGLE",
      displayOrder: 11,
      spiceLevel: 0,
      isGlutenFree: true,
      description: "The same broad, chewy noodle, made from rice and certified gluten free.",
    },
    {
      name: "Thin/Flat Noodles",
      category: "noodles",
      categoryType: "SIDE",
      basePriceCents: 0,
      additionalPriceCents: 0,
      includedQuantity: 1,
      selectionMode: "SINGLE",
      displayOrder: 12,
      spiceLevel: 0,
      isGlutenFree: false,
      description: "Thin, flat ribbons that soak up the broth and cook in moments. A lighter, softer bite.",
    },
    {
      name: "No Noodles",
      category: "noodles",
      categoryType: "SIDE",
      basePriceCents: 0,
      additionalPriceCents: 0,
      includedQuantity: 1,
      selectionMode: "SINGLE",
      displayOrder: 13,
      spiceLevel: 0,
      isGlutenFree: false,
      description: "A full bowl of broth and toppings, with the noodles left out.",
    },

    // ----- Sliders (SLIDER category) -----
    {
      name: "Baby Bok Choy",
      category: "slider01",
      categoryType: "SLIDER",
      basePriceCents: 0,
      additionalPriceCents: 0,
      includedQuantity: 1,
      selectionMode: "MULTIPLE",
      displayOrder: 20,
      spiceLevel: 0,
      isVegetarian: true,
      isVegan: true,
      isGlutenFree: true,
      description: "Tender baby bok choy, blanched to order so it stays crisp and bright green. A fresh, vibrant finish to every bowl.",
    },
    {
      name: "Sprouts",
      category: "slider01",
      categoryType: "SLIDER",
      basePriceCents: 0,
      additionalPriceCents: 0,
      includedQuantity: 1,
      selectionMode: "MULTIPLE",
      displayOrder: 21,
      spiceLevel: 0,
      isVegetarian: true,
      isVegan: true,
      isGlutenFree: true,
      description: "Fresh bean sprouts added at the last moment for a clean, crisp crunch against the warm broth.",
    },
  ];

  let created = 0;
  let updated = 0;

  for (const item of items) {
    // Try to find an existing item by exact name under this tenant
    const existing = await prisma.menuItem.findFirst({
      where: { tenantId: tenant.id, name: item.name },
    });

    if (existing) {
      // Update to ensure fields are correct but don't overwrite custom pricing
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: {
          category: item.category,
          categoryType: item.categoryType,
          selectionMode: item.selectionMode,
          displayOrder: item.displayOrder,
          isVegetarian: item.isVegetarian || false,
          isVegan: item.isVegan || false,
          isGlutenFree: item.isGlutenFree || false,
          spiceLevel: item.spiceLevel,
          description: item.description,
        },
      });
      console.log(`  Updated: ${item.name}`);
      updated++;
    } else {
      await prisma.menuItem.create({
        data: {
          tenantId: tenant.id,
          ...item,
        },
      });
      console.log(`  Created: ${item.name}`);
      created++;
    }
  }

  console.log(`\n✅ Catering menu seed complete: ${created} created, ${updated} updated`);
}

main()
  .catch((e) => {
    console.error("Error seeding catering menu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
