import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_BADGES = [
  {
    slug: "lunch-regular",
    name: "Lunch Regular",
    description: "Ordered during lunch hours 10 times",
    iconEmoji: "☀️",
    category: "MILESTONE",
  },
  {
    slug: "night-owl",
    name: "Night Owl",
    description: "Ordered after 8pm 5 times",
    iconEmoji: "🦉",
    category: "MILESTONE",
  },
  {
    slug: "big-spender",
    name: "Big Spender",
    description: "Spent over $500 lifetime",
    iconEmoji: "💰",
    category: "MILESTONE",
  },
  {
    slug: "generous-soul",
    name: "Generous Soul",
    description: "Referred 3 friends who ordered",
    iconEmoji: "💕",
    category: "REFERRAL",
  },
  {
    slug: "pod-explorer",
    name: "Pod Explorer",
    description: "Dined in 5 different pods",
    iconEmoji: "🎯",
    category: "CHALLENGE",
  },
  {
    slug: "quick-return",
    name: "Quick Return",
    description: "Ordered again within 24 hours",
    iconEmoji: "⚡",
    category: "SPECIAL",
  },
];

async function main() {
  console.log("Adding new badges...\n");

  for (const badge of NEW_BADGES) {
    const existing = await prisma.badge.findUnique({
      where: { slug: badge.slug },
    });

    if (existing) {
      console.log(`⏭️  Badge "${badge.name}" already exists, skipping`);
      continue;
    }

    await prisma.badge.create({
      data: {
        ...badge,
        isActive: true,
      },
    });
    console.log(`✅ Created badge: ${badge.iconEmoji} ${badge.name}`);
  }

  console.log("\n✅ Done adding badges!");

  // Show all badges
  const allBadges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  console.log(`\nTotal active badges: ${allBadges.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
