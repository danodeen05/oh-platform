/**
 * Market Analysis data (spec 6.7). Rounded public estimates for
 * orientation, labeled approximate in the UI. SOM comes from the engine.
 */
export const TAM_USD = 63_000_000_000; // US Asian restaurant industry sales, approximate
export const SAM_USD = 2_400_000_000; // Asian fast-casual spend across the nine target trade areas, approximate

export interface UtahRow {
  key: "lehi" | "slc" | "south-jordan" | "provo" | "st-george";
  population: number;
  growth5y: number;
  householdIncome: number;
  daytimeWorkers: number;
  asianDiningSpend: number;
}
export const UTAH_ROWS: readonly UtahRow[] = [
  { key: "lehi", population: 84_000, growth5y: 0.21, householdIncome: 112_000, daytimeWorkers: 110_000, asianDiningSpend: 58_000_000 },
  { key: "slc", population: 210_000, growth5y: 0.06, householdIncome: 78_000, daytimeWorkers: 150_000, asianDiningSpend: 140_000_000 },
  { key: "south-jordan", population: 82_000, growth5y: 0.18, householdIncome: 118_000, daytimeWorkers: 45_000, asianDiningSpend: 44_000_000 },
  { key: "provo", population: 115_000, growth5y: 0.04, householdIncome: 62_000, daytimeWorkers: 95_000, asianDiningSpend: 52_000_000 },
  { key: "st-george", population: 100_000, growth5y: 0.24, householdIncome: 74_000, daytimeWorkers: 40_000, asianDiningSpend: 31_000_000 },
];

export interface Competitor {
  key: string;
  /** 0..1 operational efficiency (labor share, throughput, footprint). */
  efficiency: number;
  /** 0..1 experience quality (product, room, ritual). */
  experience: number;
  oh?: boolean;
}
export const COMPETITORS: readonly Competitor[] = [
  { key: "fullServiceAsian", efficiency: 0.3, experience: 0.6 },
  { key: "nationalChineseFastFood", efficiency: 0.82, experience: 0.28 },
  { key: "noodleChain", efficiency: 0.62, experience: 0.45 },
  { key: "ramenShop", efficiency: 0.38, experience: 0.72 },
  { key: "ichiran", efficiency: 0.7, experience: 0.82 },
  { key: "oh", efficiency: 0.9, experience: 0.86, oh: true },
];
