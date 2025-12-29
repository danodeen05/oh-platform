import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding 'Meal for a Stranger' challenge...");

  const challenge = await prisma.challenge.upsert({
    where: { slug: "meal-for-stranger" },
    update: {},
    create: {
      slug: "meal-for-stranger",
      name: "Meal for a Stranger",
      description: "Gift a meal to the next solo diner at your location",
      rewardCents: 500, // $5 reward
      iconEmoji: "🎁",
      requirements: JSON.stringify({
        type: "meal_gift",
        action: "gift_accepted",
      }),
      isActive: true,
    },
  });

  console.log("✅ Challenge created:", challenge);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
