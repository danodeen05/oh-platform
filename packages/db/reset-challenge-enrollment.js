const { PrismaClient } = require("@oh/db");
const prisma = new PrismaClient();

async function main() {
  // Show current enrollments for Meal for a Stranger challenge
  const challenge = await prisma.challenge.findUnique({
    where: { slug: "meal-for-stranger" },
    include: {
      userChallenges: {
        include: {
          user: {
            select: { email: true, name: true }
          }
        }
      }
    }
  });

  if (\!challenge) {
    console.log("Challenge not found");
    return;
  }

  console.log(`\nChallenge: ${challenge.name} (${challenge.slug})`);
  console.log(`Total enrollments: ${challenge.userChallenges.length}\n`);

  console.log("Current enrollments:");
  challenge.userChallenges.forEach((uc, idx) => {
    console.log(`${idx + 1}. ${uc.user.email || uc.user.name} - Progress: ${uc.progress?.current || 0}/${challenge.requirements.target} - Completed: ${uc.completedAt ? "Yes" : "No"}`);
  });

  // Uncomment below to delete all enrollments (for testing)
  // const deleted = await prisma.userChallenge.deleteMany({
  //   where: { challengeId: challenge.id }
  // });
  // console.log(`\nDeleted ${deleted.count} enrollments`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
