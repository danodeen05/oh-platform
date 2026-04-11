import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Creating CNY 2026 Party Invitation...");

  const invitation = await prisma.partyInvitation.upsert({
    where: { code: "cny2026" },
    update: {
      title: "Chinese New Year Celebration 2026",
      hostName: "The Didericksen Family",
      eventDate: new Date("2026-02-17T18:00:00-07:00"), // Feb 17, 2026 at 6pm MST
      eventTime: "6:00 PM",
      location: "888 Lucky Dragon Lane, Salt Lake City, UT 84103", // UPDATE THIS!
      dresscode: "Festive Red & Gold",
      description: "Join us for a celebration of the Year of the Snake with delicious beef noodle soup!",
      zodiacYear: "蛇年",
      zodiacEnglish: "Year of the Snake",
      maxGuests: null, // No limit
      rsvpDeadline: new Date("2026-02-14T23:59:59-07:00"), // RSVP by Feb 14
      allowPlusOnes: true,
      maxGuestsPerRsvp: 4,
      isActive: true,
    },
    create: {
      code: "cny2026",
      title: "Chinese New Year Celebration 2026",
      hostName: "The Didericksen Family",
      eventDate: new Date("2026-02-17T18:00:00-07:00"),
      eventTime: "6:00 PM",
      location: "888 Lucky Dragon Lane, Salt Lake City, UT 84103", // UPDATE THIS!
      dresscode: "Festive Red & Gold",
      description: "Join us for a celebration of the Year of the Snake with delicious beef noodle soup!",
      zodiacYear: "蛇年",
      zodiacEnglish: "Year of the Snake",
      maxGuests: null,
      rsvpDeadline: new Date("2026-02-14T23:59:59-07:00"),
      allowPlusOnes: true,
      maxGuestsPerRsvp: 4,
      isActive: true,
    },
  });

  console.log("Created party invitation:", invitation);
  console.log("\n✅ CNY Party invitation created successfully!");
  console.log(`   Code: ${invitation.code}`);
  console.log(`   URL: https://cny.ohbeef.com`);
  console.log(`\n⚠️  Don't forget to update the location address!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
