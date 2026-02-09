// Chinese Zodiac calculation utilities

export const ZODIAC_ANIMALS = [
  "Rat",
  "Ox",
  "Tiger",
  "Rabbit",
  "Dragon",
  "Snake",
  "Horse",
  "Goat",
  "Monkey",
  "Rooster",
  "Dog",
  "Pig",
] as const;

export type ZodiacAnimal = (typeof ZODIAC_ANIMALS)[number];

// Five elements cycle (each element covers 2 years)
const ELEMENTS = ["Metal", "Water", "Wood", "Fire", "Earth"] as const;
export type ZodiacElement = (typeof ELEMENTS)[number];

// Lucky numbers by zodiac animal
const ZODIAC_LUCKY_NUMBERS: Record<ZodiacAnimal, number[]> = {
  Rat: [2, 3, 8],
  Ox: [1, 4, 9],
  Tiger: [1, 3, 4],
  Rabbit: [3, 4, 6],
  Dragon: [1, 6, 7],
  Snake: [2, 8, 9],
  Horse: [2, 3, 7],
  Goat: [2, 7, 8],
  Monkey: [4, 9],
  Rooster: [5, 7, 8],
  Dog: [3, 4, 9],
  Pig: [2, 5, 8],
};

// Lucky colors by zodiac animal
const ZODIAC_LUCKY_COLORS: Record<ZodiacAnimal, string[]> = {
  Rat: ["Blue", "Gold", "Green"],
  Ox: ["White", "Yellow", "Green"],
  Tiger: ["Blue", "Gray", "Orange"],
  Rabbit: ["Red", "Pink", "Purple"],
  Dragon: ["Gold", "Silver", "Gray"],
  Snake: ["Black", "Red", "Yellow"],
  Horse: ["Yellow", "Red", "Green"],
  Goat: ["Brown", "Red", "Purple"],
  Monkey: ["White", "Blue", "Gold"],
  Rooster: ["Gold", "Brown", "Yellow"],
  Dog: ["Red", "Green", "Purple"],
  Pig: ["Yellow", "Gray", "Brown"],
};

// Compatible animals (best matches for friendship/partnership)
const ZODIAC_COMPATIBLE: Record<ZodiacAnimal, ZodiacAnimal[]> = {
  Rat: ["Dragon", "Monkey", "Ox"],
  Ox: ["Rat", "Snake", "Rooster"],
  Tiger: ["Horse", "Dog", "Pig"],
  Rabbit: ["Goat", "Pig", "Dog"],
  Dragon: ["Rat", "Monkey", "Rooster"],
  Snake: ["Ox", "Rooster", "Dragon"],
  Horse: ["Tiger", "Goat", "Dog"],
  Goat: ["Rabbit", "Horse", "Pig"],
  Monkey: ["Rat", "Dragon", "Snake"],
  Rooster: ["Ox", "Snake", "Dragon"],
  Dog: ["Tiger", "Rabbit", "Horse"],
  Pig: ["Tiger", "Rabbit", "Goat"],
};

export interface ZodiacInfo {
  animal: ZodiacAnimal;
  element: ZodiacElement;
  luckyNumbers: number[];
  luckyColors: string[];
  compatibleWith: ZodiacAnimal[];
}

/**
 * Calculate Chinese zodiac from birthdate
 * @param birthdate - Date in MM/DD/YYYY format
 * @returns ZodiacInfo object with animal, element, lucky numbers, colors, and compatible animals
 */
export function getChineseZodiac(birthdate: string): ZodiacInfo {
  // Parse MM/DD/YYYY format
  const parts = birthdate.split("/");
  if (parts.length !== 3) {
    // Default to Horse if invalid format
    return getZodiacByYear(2026);
  }

  const year = parseInt(parts[2], 10);
  if (isNaN(year) || year < 1900 || year > 2100) {
    return getZodiacByYear(2026);
  }

  return getZodiacByYear(year);
}

/**
 * Get zodiac info for a specific year
 */
export function getZodiacByYear(year: number): ZodiacInfo {
  // 1900 was Year of the Rat (index 0)
  const baseYear = 1900;
  let zodiacIndex = (year - baseYear) % 12;
  if (zodiacIndex < 0) zodiacIndex += 12;

  const animal = ZODIAC_ANIMALS[zodiacIndex];

  // Element cycle: each element covers 2 consecutive years
  // 1900-1901: Metal, 1902-1903: Water, etc.
  let elementIndex = Math.floor((year - baseYear) / 2) % 5;
  if (elementIndex < 0) elementIndex += 5;
  const element = ELEMENTS[elementIndex];

  return {
    animal,
    element,
    luckyNumbers: ZODIAC_LUCKY_NUMBERS[animal],
    luckyColors: ZODIAC_LUCKY_COLORS[animal],
    compatibleWith: ZODIAC_COMPATIBLE[animal],
  };
}

/**
 * Find lucky numbers present in a phone number
 * @param phone - Phone number (will extract digits)
 * @param luckyNumbers - Array of lucky numbers to look for
 * @returns Array of lucky numbers found in the phone
 */
export function findLuckyNumbersInPhone(
  phone: string,
  luckyNumbers: number[]
): number[] {
  const digits = phone.replace(/\D/g, "");
  const found: number[] = [];

  for (const lucky of luckyNumbers) {
    if (digits.includes(lucky.toString())) {
      found.push(lucky);
    }
  }

  return found;
}

/**
 * Get a description of how two zodiac animals relate
 */
export function getCompatibilityDescription(
  userAnimal: ZodiacAnimal,
  targetAnimal: ZodiacAnimal
): "excellent" | "good" | "neutral" | "challenging" {
  const compatible = ZODIAC_COMPATIBLE[userAnimal];
  if (compatible.includes(targetAnimal)) {
    return "excellent";
  }

  // Check if target considers user compatible (mutual affinity)
  if (ZODIAC_COMPATIBLE[targetAnimal].includes(userAnimal)) {
    return "good";
  }

  return "neutral";
}
