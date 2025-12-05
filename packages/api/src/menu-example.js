// Example of enhanced GET /menu endpoint using the new fields

// Option 1: Return grouped by categoryType for easy UI rendering
app.get("/menu/grouped", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenant.id, isAvailable: true },
    orderBy: [
      { categoryType: 'asc' },
      { displayOrder: 'asc' },
      { name: 'asc' }
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

// Option 2: Return structured for multi-step order builder
app.get("/menu/steps", async (req, reply) => {
  const tenantSlug = getTenantContext(req);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) return reply.code(404).send({ error: "Tenant not found" });

  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenant.id, isAvailable: true },
    orderBy: [
      { categoryType: 'asc' },
      { displayOrder: 'asc' },
      { name: 'asc' }
    ]
  });

  // Organize into steps for order builder UI
  return {
    steps: [
      {
        title: "Choose Your Bowl",
        sections: [
          {
            name: "Soup Style",
            selectionMode: "SINGLE",
            items: items.filter(i => i.category === 'main01')
          },
          {
            name: "Noodle Type",
            selectionMode: "SINGLE",
            items: items.filter(i => i.category === 'main02')
          }
        ]
      },
      {
        title: "Customize",
        sections: items
          .filter(i => i.categoryType === 'SLIDER')
          .map(item => ({
            name: item.name,
            selectionMode: "SLIDER",
            config: item.sliderConfig,
            item
          }))
      },
      {
        title: "Add Premium Toppings",
        sections: [{
          name: "Add-ons",
          selectionMode: "MULTIPLE",
          items: items.filter(i => i.categoryType === 'ADDON')
        }]
      },
      {
        title: "Sides & Drinks",
        sections: [
          {
            name: "Side Dishes",
            selectionMode: "MULTIPLE",
            items: items.filter(i => i.categoryType === 'SIDE')
          },
          {
            name: "Beverages",
            selectionMode: "MULTIPLE",
            items: items.filter(i => i.categoryType === 'DRINK')
          },
          {
            name: "Dessert",
            selectionMode: "MULTIPLE",
            items: items.filter(i => i.categoryType === 'DESSERT')
          }
        ]
      }
    ]
  };
});

// Example slider config for Baby Bok Choy:
// {
//   "min": 0,
//   "max": 3,
//   "default": 1,
//   "labels": ["None", "Light", "Regular", "Extra"],
//   "step": 1,
//   "description": "How much do you want?"
// }

// Example slider config for Spice Level:
// {
//   "min": 0,
//   "max": 10,
//   "default": 3,
//   "labels": ["No Spice", "Mild", "Medium", "Hot", "Extra Hot"],
//   "labelPositions": [0, 2, 5, 7, 10],
//   "step": 1,
//   "description": "How spicy do you like it?"
// }
