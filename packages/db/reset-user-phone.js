// Script to reset a user's phone and smsOptIn for testing SMS modal
// Usage: node reset-user-phone.js <email>

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: node reset-user-phone.js <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, phone: true, smsOptIn: true },
  });

  if (!user) {
    console.error(`User not found with email: ${email}`);
    process.exit(1);
  }

  console.log("Current user data:", user);

  const updated = await prisma.user.update({
    where: { email },
    data: {
      phone: null,
      smsOptIn: false,
    },
  });

  console.log("Updated user data:", {
    id: updated.id,
    email: updated.email,
    phone: updated.phone,
    smsOptIn: updated.smsOptIn,
  });

  console.log("\nPhone and smsOptIn have been cleared. You can now test the SMS modal.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
