// Menu item image mapping
// Maps menu item names to their corresponding image files. Most come from
// /public/menu images/; the two updated in Task C6 come from the site image
// pipeline (/public/site/, see lib/site/images.ts).

const menuImageMap: Record<string, string> = {
  // Main bowls
  "Classic Beef Noodle Soup": "/site/bowl-slices-top-1200.webp",
  "Classic Beef Noodle Soup (no beef)": "/menu images/Classic Bowl No Beef.png",
  // DB name is "American Wagyu Beef Noodle Soup" (MenuItem.name); the old
  // "A5 Wagyu Beef Noodle Soup" key never matched it.
  "American Wagyu Beef Noodle Soup": "/site/bowl-chunks-top-1200.webp",

  // Noodle types
  "Shaved Noodles": "/menu images/Shaved Noodles.png",
  "Wide Noodles": "/menu images/Wide Noodles.png",
  "Wide Noodles (Gluten Free)": "/menu images/Wide Noodles.png",
  "Thin/Flat Noodles": "/menu images/Thin Flat Noodles.png",
  "Thin & Flat Noodles": "/menu images/Thin Flat Noodles.png",
  "Ramen Noodles": "/menu images/Ramen Noodles.png",
  "No Noodles": "__NO_NOODLES__", // Special case - handled by component

  // Add-ons
  "Bone Marrow": "/menu images/Beef Marrow.png",
  "Extra Beef": "/menu images/Extra Beef.png",
  "Extra Noodles": "/menu images/Wide Noodles.png",
  "Soft-Boild Egg": "/menu images/Soft Boiled Egg.png",
  "Soft-Boiled Egg": "/menu images/Soft Boiled Egg.png",
  "Soft Boiled Egg": "/menu images/Soft Boiled Egg.png",

  // Sides
  "Spicy Cucumbers": "/menu images/Spicy Cucumbers.png",
  "Spicy Green Beans": "/menu images/Spicy Green Beans.png",

  // Bowl garnishes/toppings
  "Baby Bok Choy": "/menu images/Baby Bok Choy.png",
  "Green Onions": "/menu images/Green Onions.png",
  "Cilantro": "/menu images/Cilantro.png",
  "Sprouts": "/menu images/Sprouts.png",
  "Pickled Greens": "/menu images/Pickled Greens.png",

  // Dessert
  "Mandarin Orange Sherbet": "/menu images/Mandarin Orange Sherbet.png",

  // Beverages - exact API names
  "Pepsi": "/menu images/Pepsi.jpg",
  "Diet Pepsi": "/menu images/DietPepsi.jpg",
  "Water (cold)": "/menu images/IceWater.jpeg",
  "Water (room temp)": "/menu images/RoomTempWater.jpeg",
};

// Special marker for No Noodles
export const NO_NOODLES_MARKER = "__NO_NOODLES__";

// Get image path for a menu item
export function getMenuItemImage(itemName: string): string | null {
  const image = menuImageMap[itemName];
  if (image === NO_NOODLES_MARKER) return null; // Handled separately
  return image || null;
}

// Check if item is the special "No Noodles" case
export function isNoNoodlesItem(itemName: string): boolean {
  return menuImageMap[itemName] === NO_NOODLES_MARKER;
}

// Check if an item has an image
export function hasMenuItemImage(itemName: string): boolean {
  return itemName in menuImageMap;
}

// Get all available menu images
export function getAllMenuImages(): Record<string, string> {
  return { ...menuImageMap };
}
