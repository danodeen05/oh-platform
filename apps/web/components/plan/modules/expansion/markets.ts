/**
 * Market pins and facts for the Expansion Engine (spec 6.3). Coordinates
 * are [longitude, latitude]. Population and employment figures are rounded
 * public estimates for orientation, labeled approximate in the UI; the
 * financial numbers on each card come from the engine.
 */
export type MapView = "utah" | "us" | "world";

export interface MarketPin {
  key: string;
  view: MapView;
  lonLat: [number, number];
  /** Metro or city population, approximate. */
  population: number;
  /** People within the target trade area (15-minute drive, or metro core), approximate. */
  tradeArea: number;
  /** Daytime workers or daily visitors in the trade area, approximate. */
  daytime: number;
}

export const MARKET_PINS: readonly MarketPin[] = [
  { key: "lehi", view: "utah", lonLat: [-111.85, 40.39], population: 84_000, tradeArea: 260_000, daytime: 110_000 },
  { key: "slc", view: "utah", lonLat: [-111.89, 40.77], population: 210_000, tradeArea: 420_000, daytime: 150_000 },
  { key: "south-jordan", view: "utah", lonLat: [-112.0, 40.55], population: 82_000, tradeArea: 300_000, daytime: 45_000 },
  { key: "provo", view: "utah", lonLat: [-111.66, 40.23], population: 115_000, tradeArea: 250_000, daytime: 95_000 },
  { key: "st-george", view: "utah", lonLat: [-113.58, 37.1], population: 100_000, tradeArea: 190_000, daytime: 40_000 },
  { key: "nyc", view: "us", lonLat: [-74.01, 40.71], population: 8_300_000, tradeArea: 1_600_000, daytime: 950_000 },
  { key: "la", view: "us", lonLat: [-118.24, 34.05], population: 3_800_000, tradeArea: 1_200_000, daytime: 400_000 },
  { key: "las-vegas", view: "us", lonLat: [-115.14, 36.17], population: 660_000, tradeArea: 900_000, daytime: 110_000 },
  { key: "seattle", view: "us", lonLat: [-122.33, 47.61], population: 750_000, tradeArea: 800_000, daytime: 300_000 },
  { key: "taipei", view: "world", lonLat: [121.57, 25.03], population: 2_600_000, tradeArea: 7_000_000, daytime: 1_200_000 },
  { key: "tokyo", view: "world", lonLat: [139.69, 35.68], population: 14_000_000, tradeArea: 9_000_000, daytime: 2_500_000 },
  { key: "london", view: "world", lonLat: [-0.13, 51.51], population: 8_900_000, tradeArea: 3_500_000, daytime: 1_200_000 },
  { key: "paris", view: "world", lonLat: [2.35, 48.86], population: 2_100_000, tradeArea: 2_500_000, daytime: 900_000 },
  { key: "singapore", view: "world", lonLat: [103.82, 1.35], population: 5_900_000, tradeArea: 2_000_000, daytime: 700_000 },
  { key: "melbourne", view: "world", lonLat: [144.96, -37.81], population: 5_200_000, tradeArea: 1_800_000, daytime: 450_000 },
];

export const VIEW_ORDER: readonly MapView[] = ["utah", "us", "world"];
