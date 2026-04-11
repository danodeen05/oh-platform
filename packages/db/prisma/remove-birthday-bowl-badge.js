import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Removing birthday-bowl badge...\n");

  // Check if the badge exists
  const badge = await prisma.badge.findUnique({
    where: { slug: "birthday-bowl" },
  });

  if (!badge) {
    console.log("Birthday Bowl badge does not exist in the database. Nothing to remove.");
    return;
  }

  // First, delete any UserBadge records that reference this badge
  const deletedUserBadges = await prisma.userBadge.deleteMany({
    where: { badgeId: badge.id },
  });

  if (deletedUserBadges.count > 0) {
    console.log(`Deleted ${deletedUserBadges.count} user badge records.`);
  }

  // Now delete the badge itself
  await prisma.badge.delete({
    where: { slug: "birthday-bowl" },
  });

  console.log("Successfully removed Birthday Bowl badge from the database.");

  // Show remaining badges
  const remainingBadges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  console.log(`\nTotal active badges remaining: ${remainingBadges.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
