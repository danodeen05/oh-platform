import { Instrument_Serif, Raleway } from "next/font/google";

export const instrumentSerif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-instrument-serif", display: "swap" });
export const raleway = Raleway({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-raleway", display: "swap" });
export const fontVariables = `${instrumentSerif.variable} ${raleway.variable}`;
