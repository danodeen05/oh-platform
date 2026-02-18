import { ZodiacAnimal, ZODIAC_ANIMALS } from "./zodiac";

export interface ZodiacFortune {
  lookForwardTo: string;
  thingsToAvoid: string;
}

export interface Attendee {
  name: string;
  phone?: string;
  birthdate?: string;
  zodiac?: ZodiacAnimal;
}

// Year of the Horse 2026 predictions for each zodiac
export const ZODIAC_FORTUNES: Record<ZodiacAnimal, ZodiacFortune> = {
  Rat: {
    lookForwardTo:
      "Fast thinking and quick opportunity spotting work in your favor. Career advancement and authority positions await those who step up.",
    thingsToAvoid:
      "Slow down on impulse decisions. The Horse year clashes with your energy, so ask extra questions before acting.",
  },
  Ox: {
    lookForwardTo:
      "Your natural endurance shines while others burn out. Romance is strongly indicated - this is your year to find love!",
    thingsToAvoid:
      "Don't resist change too strongly. Balance steady progress with warmth in relationships. Avoid overworking yourself.",
  },
  Tiger: {
    lookForwardTo:
      "Momentum returns! Exciting opportunities in leadership and creative self-expression. Doors open with greater ease.",
    thingsToAvoid:
      "Don't neglect personal relationships while chasing achievements. Keep your loved ones close as you rise.",
  },
  Rabbit: {
    lookForwardTo:
      "Your diplomacy and refined taste help you navigate situations smoothly without bulldozing through.",
    thingsToAvoid:
      "Not everything will go as planned. Pick one brave decision and commit fully rather than trying to please everyone.",
  },
  Dragon: {
    lookForwardTo:
      "The pace eases up, giving you breathing room for creativity and pleasure. Time to enjoy life's finer moments.",
    thingsToAvoid:
      "Prioritize experiences that refill you, not obligations that drain you. Stay flexible as situations unfold.",
  },
  Snake: {
    lookForwardTo:
      "Competition sharpens you this year. Rising standards and capable peers force meaningful growth and leveling up.",
    thingsToAvoid:
      "Put expectations in writing with collaborators. Focus on self-care and balance after an intense previous year.",
  },
  Horse: {
    lookForwardTo:
      "Everything amplifies - your confidence, charm, and magnetic appeal surge! You're the protagonist of 2026.",
    thingsToAvoid:
      "This is your Ben Ming Nian (zodiac year). Wear red for luck! Protect finances from impulse spending and avoid major risks.",
  },
  Goat: {
    lookForwardTo:
      "Doors open through people this year. Mentors, friends, and collaborators bring unexpected blessings. It's a blossoming year!",
    thingsToAvoid:
      "Stay generous with credit and follow through consistently. Don't spend too much time worrying about past or future.",
  },
  Monkey: {
    lookForwardTo:
      "Your speed matches the year perfectly. Access to new opportunities multiplies. Relationships improve across the board.",
    thingsToAvoid:
      "Choose your best projects and finish them instead of chasing shiny distractions. Focus brings the biggest wins.",
  },
  Rooster: {
    lookForwardTo:
      "Your precision and high standards become superpowers in this fast-paced year. Progress feels refreshing.",
    thingsToAvoid:
      "Swap critique for appreciation when possible. Embrace flexibility even when perfection isn't available.",
  },
  Dog: {
    lookForwardTo:
      "Your reliability and follow-through finally get noticed and rewarded! You're among the luckiest signs in 2026.",
    thingsToAvoid:
      "Accept care without picking it apart. Let your steadiness build trust over time rather than seeking instant validation.",
  },
  Pig: {
    lookForwardTo:
      "Progress comes through consistency rather than dramatic pushes. Your endurance is perfectly suited for this year.",
    thingsToAvoid:
      "Avoid forcing outcomes. Let impatient people burn themselves out while you stack steady progress.",
  },
};

// Zodiac incompatibility for "Avoid Tonight" section
export const ZODIAC_INCOMPATIBLE: Record<ZodiacAnimal, ZodiacAnimal[]> = {
  Rat: ["Horse", "Goat"],
  Ox: ["Horse", "Goat", "Dog"],
  Tiger: ["Snake", "Monkey"],
  Rabbit: ["Rooster", "Dragon"],
  Dragon: ["Dog", "Rabbit"],
  Snake: ["Tiger", "Pig"],
  Horse: ["Rat", "Ox"],
  Goat: ["Rat", "Ox"],
  Monkey: ["Tiger", "Pig"],
  Rooster: ["Rabbit", "Dog"],
  Dog: ["Dragon", "Rooster", "Ox"],
  Pig: ["Snake", "Monkey"],
};

// Unique characteristics for each zodiac (~5 traits)
export const ZODIAC_TRAITS: Record<ZodiacAnimal, string[]> = {
  Rat: ["Clever", "Quick-witted", "Resourceful", "Adaptable", "Charming"],
  Ox: ["Reliable", "Strong", "Patient", "Methodical", "Honest"],
  Tiger: ["Brave", "Confident", "Competitive", "Bold", "Passionate"],
  Rabbit: ["Gentle", "Elegant", "Cautious", "Gracious", "Sensitive"],
  Dragon: ["Ambitious", "Powerful", "Charismatic", "Lucky", "Fearless"],
  Snake: ["Wise", "Intuitive", "Mysterious", "Sophisticated", "Calm"],
  Horse: ["Energetic", "Free-spirited", "Optimistic", "Independent", "Adventurous"],
  Goat: ["Creative", "Gentle", "Artistic", "Kind", "Empathetic"],
  Monkey: ["Witty", "Clever", "Curious", "Playful", "Inventive"],
  Rooster: ["Honest", "Punctual", "Observant", "Hardworking", "Courageous"],
  Dog: ["Loyal", "Faithful", "Honest", "Protective", "Dependable"],
  Pig: ["Generous", "Compassionate", "Diligent", "Sincere", "Tolerant"],
};

// Zodiac SVG file mapping (Ox uses Cow.svg)
export const ZODIAC_SVG_FILES: Record<ZodiacAnimal, string> = {
  Rat: "/cny/slides/Zodiacs/Rat.svg",
  Ox: "/cny/slides/Zodiacs/Cow.svg",
  Tiger: "/cny/slides/Zodiacs/Tiger.svg",
  Rabbit: "/cny/slides/Zodiacs/Rabbit.svg",
  Dragon: "/cny/slides/Zodiacs/Dragon.svg",
  Snake: "/cny/slides/Zodiacs/Snake.svg",
  Horse: "/cny/slides/Zodiacs/Horse.svg",
  Goat: "/cny/slides/Zodiacs/Goat.svg",
  Monkey: "/cny/slides/Zodiacs/Monkey.svg",
  Rooster: "/cny/slides/Zodiacs/Rooster.svg",
  Dog: "/cny/slides/Zodiacs/Dog.svg",
  Pig: "/cny/slides/Zodiacs/Pig.svg",
};

// Group attendees by their zodiac sign
export function groupAttendeesByZodiac(
  attendees: Attendee[]
): Record<ZodiacAnimal, Attendee[]> {
  const grouped = {} as Record<ZodiacAnimal, Attendee[]>;

  // Initialize empty arrays for all zodiacs
  for (const zodiac of ZODIAC_ANIMALS) {
    grouped[zodiac] = [];
  }

  // Group attendees
  for (const attendee of attendees) {
    if (attendee.zodiac && ZODIAC_ANIMALS.includes(attendee.zodiac)) {
      grouped[attendee.zodiac].push(attendee);
    }
  }

  return grouped;
}

// Get compatible attendees for a zodiac from the grouped data
export function getCompatibleAttendees(
  zodiac: ZodiacAnimal,
  compatibleZodiacs: ZodiacAnimal[],
  attendeesByZodiac: Record<ZodiacAnimal, Attendee[]>
): Attendee[] {
  return compatibleZodiacs.flatMap((z) => attendeesByZodiac[z] || []);
}

// Get incompatible attendees for a zodiac from the grouped data
export function getIncompatibleAttendees(
  zodiac: ZodiacAnimal,
  attendeesByZodiac: Record<ZodiacAnimal, Attendee[]>
): Attendee[] {
  const incompatibleZodiacs = ZODIAC_INCOMPATIBLE[zodiac] || [];
  return incompatibleZodiacs.flatMap((z) => attendeesByZodiac[z] || []);
}
