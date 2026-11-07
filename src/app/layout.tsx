import type { Metadata } from "next";
import { DM_Sans, Manrope, Instrument_Serif } from "next/font/google";
import "./globals.css";
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Manrope({ subsets: ["latin"], variable: "--font-display" });
const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-serif" });
export const metadata: Metadata = { title: "Motion Foundry — Show the motion. Invent the machine.", description: "A spatial invention workshop. Shape a petal’s movement, synthesize a real four-bar mechanism, and inspect the mathematics behind it.", applicationName: "Motion Foundry" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body className={`${sans.variable} ${display.variable} ${serif.variable}`}>{children}</body></html>; }
