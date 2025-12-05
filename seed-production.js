// Quick script to seed production database via Railway API
const API_URL = "https://ohapi-production.up.railway.app";

async function seed() {
  try {
    // 1. Create Tenant
    console.log("Creating tenant...");
    const tenantRes = await fetch(`${API_URL}/tenants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "oh",
        brandName: "Oh Beef Noodle Soup",
        logoUrl: "/oh-logo.png"
      })
    });
    const tenant = await tenantRes.json();
    console.log("✓ Tenant created:", tenant.slug);

    // 2. Create Location
    console.log("\nCreating location...");
    const locationRes = await fetch(`${API_URL}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        name: "Oh Beef - Main Location",
        address: "123 Main St, City, State 12345",
        phone: "(555) 123-4567"
      })
    });
    const location = await locationRes.json();
    console.log("✓ Location created:", location.name);

    // 3. Create Menu Items
    console.log("\nCreating menu items...");
    const menuItems = [
      {
        tenantId: tenant.id,
        name: "Beef Noodle Soup",
        description: "Traditional beef noodle soup with tender beef and fresh noodles",
        priceCents: 1299,
        category: "Noodles"
      },
      {
        tenantId: tenant.id,
        name: "Pork Belly Noodles",
        description: "Rich pork belly with handmade noodles",
        priceCents: 1399,
        category: "Noodles"
      },
      {
        tenantId: tenant.id,
        name: "Baby Bok Choy",
        description: "Fresh steamed baby bok choy",
        priceCents: 399,
        category: "Sides",
        includedQuantity: 2,
        additionalPriceCents: 199
      }
    ];

    for (const item of menuItems) {
      const res = await fetch(`${API_URL}/menu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      });
      const menuItem = await res.json();
      console.log(`✓ Menu item created: ${menuItem.name}`);
    }

    console.log("\n✅ Production database seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
}

seed();
