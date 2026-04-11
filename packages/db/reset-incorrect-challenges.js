import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function resetIncorrectCompletions() {
  // Get all user challenges that were marked complete but not claimed
  const completedUnclaimed = await prisma.userChallenge.findMany({
    where: {
      completedAt: { not: null },
      rewardClaimed: false,
    },
    include: { challenge: true, user: true }
  });

  console.log('Found', completedUnclaimed.length, 'challenges to check...\n');

  let resetCount = 0;

  for (const uc of completedUnclaimed) {
    const req = uc.challenge.requirements;
    const prog = uc.progress || { current: 0 };

    // Get the target - challenges use either 'target' or 'count'
    const target = req.target || req.count || 1;

    // Special handling for different challenge types
    let shouldBeComplete = false;

    switch (req.type) {
      case 'try_all_noodles':
        // Need to try all 4 noodle types
        shouldBeComplete = prog.current >= (req.count || 4);
        break;

      case 'referrals':
        // Need to refer X friends
        shouldBeComplete = prog.current >= (req.count || 5);
        break;

      case 'early_order':
        // Need to have placed an early order - check if progress indicates success
        shouldBeComplete = prog.current >= 1 && prog.orderedEarly === true;
        break;

      case 'meal_gift':
        // Need to have a meal gift accepted
        shouldBeComplete = prog.current >= 1;
        break;

      default:
        shouldBeComplete = prog.current >= target;
    }

    if (!shouldBeComplete) {
      console.log('RESETTING:', uc.challenge.name);
      console.log('  User:', uc.user?.email);
      console.log('  Progress:', JSON.stringify(prog));
      console.log('  Target:', target);
      console.log('  Type:', req.type);
      console.log('');

      await prisma.userChallenge.update({
        where: { id: uc.id },
        data: { completedAt: null }
      });

      resetCount++;
    }
  }

  console.log('\n✅ Reset', resetCount, 'incorrectly completed challenges');
}

resetIncorrectCompletions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
