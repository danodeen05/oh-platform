import { ZodiacAnimal, ZODIAC_ANIMALS } from "./zodiac";

/**
 * Get all years for a given zodiac animal within a range
 * @param zodiac - The zodiac animal
 * @param startYear - Start of year range (default 1950)
 * @param endYear - End of year range (default 2030)
 * @returns Array of years when this zodiac occurs
 */
export function getYearsForZodiac(
  zodiac: ZodiacAnimal,
  startYear = 1950,
  endYear = 2030
): number[] {
  const baseYear = 1900; // Year of the Rat (index 0)
  const zodiacIndex = ZODIAC_ANIMALS.indexOf(zodiac);
  const years: number[] = [];

  for (let year = startYear; year <= endYear; year++) {
    let yearIndex = (year - baseYear) % 12;
    if (yearIndex < 0) yearIndex += 12;
    if (yearIndex === zodiacIndex) {
      years.push(year);
    }
  }

  return years;
}

// Pre-calculated years for display (1950-2030)
export const ZODIAC_YEARS: Record<ZodiacAnimal, number[]> = {
  Rat: [1960, 1972, 1984, 1996, 2008, 2020],
  Ox: [1961, 1973, 1985, 1997, 2009, 2021],
  Tiger: [1950, 1962, 1974, 1986, 1998, 2010, 2022],
  Rabbit: [1951, 1963, 1975, 1987, 1999, 2011, 2023],
  Dragon: [1952, 1964, 1976, 1988, 2000, 2012, 2024],
  Snake: [1953, 1965, 1977, 1989, 2001, 2013, 2025],
  Horse: [1954, 1966, 1978, 1990, 2002, 2014, 2026],
  Goat: [1955, 1967, 1979, 1991, 2003, 2015, 2027],
  Monkey: [1956, 1968, 1980, 1992, 2004, 2016, 2028],
  Rooster: [1957, 1969, 1981, 1993, 2005, 2017, 2029],
  Dog: [1958, 1970, 1982, 1994, 2006, 2018, 2030],
  Pig: [1959, 1971, 1983, 1995, 2007, 2019],
};

/**
 * Format years for display (e.g., "1990, 2002, 2014, 2026")
 */
export function formatZodiacYears(zodiac: ZodiacAnimal): string {
  return ZODIAC_YEARS[zodiac].join(", ");
}
